// VerifiedBuild student app: sign up → pick a repo → what we found → 5 questions (voice or text) → report → apply.
// React-style components on Preact (htm, no build step). Shared pieces live in /ui.js.

import {
  html, render, useState, useEffect, useRef, useMemo,
  api, store, enc, go, useHash, useMedia, levelOf, repoName, count, fmt, readFileAsBase64,
  TAG_NAME, TAG_ICON, RESULT_LABEL, INTERESTS, SKILL_CHIPS,
  Icon, Mark, Button, IconButton, Field, Select, ChipGroup, Tag, LevelTag, Seg, Avatar, Progress, Segments, Skeleton, SkeletonList,
  Empty, Banner, Code, SkillRows, ClaimsList, HackathonList, EvidenceSheet, BuildHistory, MatchCard, Toasts, DialogHost, toast, confirm,
} from "/ui.js";

const local = store(window.localStorage);
const tab = store(window.sessionStorage);
const RETRYABLE = new Set(["AI_FAILED", "NETWORK", "DB_UNAVAILABLE", "DB_ERROR", "INTERNAL", "HTTP_500", "HTTP_502", "HTTP_503", "HTTP_504"]);
const MAX_RECORDING_S = 120;
const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const me = {
  id: () => local.get("vb_student_id"),
  name: () => local.get("vb_student_name") || "",
  github: () => local.get("vb_github") || "",
  save(id, name, github) { local.set("vb_student_id", id); local.set("vb_student_name", name); local.set("vb_github", github); },
  forget() { ["vb_student_id", "vb_student_name", "vb_github"].forEach((k) => local.del(k)); tab.del("vb_last_analysis"); tab.del("vb_session_id"); },
};
const normaliseUsername = (raw) => (raw || "").trim().replace(/^https?:\/\//i, "").replace(/^(www\.)?github\.com\//i, "").replace(/^@/, "").split("/")[0];
function normaliseRepo(raw) {
  const s = (raw || "").trim().replace(/^https?:\/\//i, "").replace(/^(www\.)?github\.com\//i, "");
  const [owner, name] = s.split("/");
  return owner && name ? `${owner}/${name.replace(/\.git$/, "")}` : s;
}

// Loads data for a page. Re-runs when deps change; `reload` runs it again by hand.
function useLoad(fn, deps) {
  const [st, setSt] = useState({ loading: true, data: null, error: null });
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setSt((s) => ({ ...s, loading: true, error: null }));
    fn().then((data) => alive && setSt({ loading: false, data, error: null })).catch((error) => alive && setSt({ loading: false, data: null, error }));
    return () => { alive = false; };
  }, [...deps, n]);
  return { ...st, reload: () => setN((x) => x + 1) };
}

// ---------- Frame ----------

const NAV = [["home", "Home", "home"], ["repos", "Verify", "code"], ["internships", "Internships", "briefcase"], ["report", "Report", "verified"]];

function Shell({ page, focus, onSignOut, children }) {
  const showNav = !focus && page !== null && !!me.id();
  useEffect(() => { document.body.classList.toggle("has-nav", showNav); }, [showNav]);
  const nav = (cls) => NAV.map(([id, label, icon]) => html`<a class=${cls} href=${`#/${id}`} aria-current=${id === page ? "page" : null}><${Icon} name=${icon} size=${cls === "tab" ? "lg" : ""} /><span>${label}</span></a>`);
  return html`
    ${focus ? null : html`<header class="topbar">
      <a class="brand" href="#/home"><${Mark} />VerifiedBuild</a>
      <span class="spacer"></span>
      ${me.id() ? html`<button class="icon-btn" type="button" aria-label="Account" title="Account" onClick=${onSignOut}><${Avatar} username=${me.github()} size="sm" /></button>` : null}
    </header>`}
    <div class=${showNav ? "with-side" : ""}>
      ${showNav ? html`<nav class="sidebar" aria-label="Main">${nav("side-item")}</nav>` : null}
      <main class=${`main${focus ? " narrow" : ""}`}>${children}</main>
    </div>
    ${showNav ? html`<nav class="tabs" aria-label="Main">${nav("tab")}</nav>` : null}
    <${Toasts} /><${DialogHost} />`;
}

const PageHead = ({ title, lead, back }) => html`<div class="page-head">${back ? html`<a class="back" href=${back[0]}><${Icon} name="arrow-left" size="sm" />${back[1]}</a>` : null}<h1 class="h1">${title}</h1>${lead ? html`<p class="lead">${lead}</p>` : null}</div>`;
const Section = ({ title, note, action, children }) => html`<section class="section"><div class="section-head"><div><h2 class="h2">${title}</h2>${note ? html`<p>${note}</p>` : null}</div>${action || null}</div>${children}</section>`;
const ErrorView = ({ error, onRetry }) => html`<div class="stack"><${Banner} action=${onRetry ? html`<${Button} kind="secondary" size="sm" icon="refresh" onClick=${onRetry}>Try again<//>` : null}>${error.message}<//></div>`;

// ---------- Sign up ----------

const STEPS = [
  ["Your GitHub", "Where your questions come from"],
  ["About you", "Name, email and college"],
  ["Interests", "What kind of work you want"],
  ["Skills", "What you claim; the viva checks it"],
];

function SignUp({ message, onDone }) {
  const [step, setStep] = useState(0);
  const [gh, setGh] = useState({ value: "", state: "", hint: "We only read your public repos.", found: null });
  const [about, setAbout] = useState({ name: "", email: "", college: "" });
  const [aboutErr, setAboutErr] = useState({});
  const [interests, setInterests] = useState(new Set());
  const [skills, setSkills] = useState(new Set());
  const [resume, setResume] = useState(null);
  const [resumeErr, setResumeErr] = useState("");
  const [interestErr, setInterestErr] = useState("");
  const [skillErr, setSkillErr] = useState("");
  const [top, setTop] = useState(null);
  const [busy, setBusy] = useState(false);
  const checkTimer = useRef(null);
  const checkSeq = useRef(0);
  const fileRef = useRef(null);

  async function checkGithub(raw) {
    const u = normaliseUsername(raw);
    const seq = ++checkSeq.current;
    if (!u) return setGh((g) => ({ ...g, state: "", hint: "We only read your public repos.", found: null }));
    if (!USERNAME_RE.test(u)) return setGh((g) => ({ ...g, state: "error", hint: "A GitHub username has letters, numbers and dashes only.", found: null }));
    setGh((g) => ({ ...g, state: "", hint: "Checking GitHub…", found: null }));
    try {
      const r = await api(`/api/github/${enc(u)}/repos`);
      if (seq !== checkSeq.current) return;
      setGh((g) => ({ ...g, state: "ok", found: { username: u, repos: r.repos.length }, hint: r.repos.length ? `Found @${u}, with ${count(r.repos.length, "public repo")}.` : `Found @${u}. Push a project to GitHub so we can verify it.` }));
    } catch (e) {
      if (seq !== checkSeq.current) return;
      if (e.code === "GITHUB_USER_NOT_FOUND") setGh((g) => ({ ...g, state: "error", hint: "We couldn't find that GitHub username.", found: null }));
      else setGh((g) => ({ ...g, state: "", hint: "We'll check this username when you sign up.", found: { username: u, repos: null } }));
    }
  }
  const onGithubInput = (e) => {
    let v = e.target.value;
    if (/github\.com\/|^https?:|^@/i.test(v)) { v = normaliseUsername(v); e.target.value = v; } // a pasted profile link becomes just the username
    setGh((g) => ({ ...g, value: v }));
    clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(() => checkGithub(v), 450);
  };

  async function onFile(e) {
    const f = e.target.files && e.target.files[0];
    setResume(null); setResumeErr("");
    if (f && f.type && f.type !== "application/pdf") { setResumeErr("That file isn't a PDF. Upload your resume as a PDF, or pick your skills below."); e.target.value = ""; }
    else if (f && f.size > 5 * 1024 * 1024) { setResumeErr("That PDF is over 5 MB. Upload a smaller copy, or pick your skills below."); e.target.value = ""; }
    else if (f) setResume({ base64: await readFileAsBase64(f), name: f.name });
  }

  function next() {
    if (step === 0) {
      const u = normaliseUsername(gh.value);
      if (!USERNAME_RE.test(u)) { setGh((g) => ({ ...g, state: "error", hint: "Enter your GitHub username, like asharao." })); return; }
      if (gh.state === "error") return;
    }
    if (step === 1) {
      const errs = {};
      if (!about.name.trim()) errs.name = "Enter your name.";
      if (!EMAIL_RE.test(about.email.trim())) errs.email = "Enter an email like name@college.edu.";
      if (!about.college.trim()) errs.college = "Enter your college.";
      setAboutErr(errs);
      if (Object.keys(errs).length) return;
    }
    if (step === 2 && !interests.size) { setInterestErr("Pick at least one interest."); return; }
    setStep(step + 1);
  }

  async function send(useResume) {
    setTop(null); setSkillErr(""); setResumeErr("");
    if (!(useResume && resume) && !skills.size) { setSkillErr("Upload your resume or pick at least one skill."); return; }
    setBusy(true);
    try {
      const r = await api("/api/students", { method: "POST", body: {
        name: about.name.trim(), email: about.email.trim(), college: about.college.trim(),
        github_username: normaliseUsername(gh.value), interests: [...interests], skills: skills.size ? [...skills] : null,
        resume_base64: useResume && resume ? resume.base64 : null, resume_mime: useResume && resume ? "application/pdf" : null,
      } });
      me.save(r.student_id, about.name.trim(), r.github_username);
      go("#/home", true);
      onDone();
    } catch (e) {
      if (e.code === "GITHUB_USER_NOT_FOUND") { setStep(0); setGh((g) => ({ ...g, state: "error", hint: e.message })); }
      else if (e.code === "RESUME_UNREADABLE") {
        setResumeErr(e.message);
        if (skills.size) setTop(html`<${Banner} action=${html`<${Button} kind="secondary" size="sm" onClick=${() => { setResume(null); send(false); }}>Continue with my picked skills<//>`}>${e.message}<//>`);
      } else setTop(html`<${Banner}>${e.message}<//>`);
    } finally { setBusy(false); }
  }

  const last = step === STEPS.length - 1;
  const body = [
    () => html`<${Field} id="github" label="GitHub username" prefix="github.com/" value=${gh.value} onInput=${onGithubInput} state=${gh.state} hint=${gh.hint}
      trail=${gh.found ? html`<${Avatar} username=${gh.found.username} size="sm" />` : null} attrs=${{ maxlength: "100", autocapitalize: "off", autocomplete: "username", spellcheck: "false", inputmode: "url", autofocus: true }} />`,
    () => html`<div class="fields">
      <${Field} id="name" label="Full name" value=${about.name} onInput=${(e) => setAbout({ ...about, name: e.target.value })} state=${aboutErr.name ? "error" : ""} hint=${aboutErr.name} attrs=${{ maxlength: "100", autocomplete: "name", autofocus: true }} />
      <${Field} id="email" label="Email" type="email" value=${about.email} onInput=${(e) => setAbout({ ...about, email: e.target.value })} state=${aboutErr.email ? "error" : ""} hint=${aboutErr.email || "Only shown to recruiters you apply to."} attrs=${{ maxlength: "200", autocomplete: "email", inputmode: "email" }} />
      <${Field} id="college" label="College" value=${about.college} onInput=${(e) => setAbout({ ...about, college: e.target.value })} state=${aboutErr.college ? "error" : ""} hint=${aboutErr.college} attrs=${{ maxlength: "150", autocomplete: "organization" }} />
    </div>`,
    () => html`<div class="stack-sm"><${ChipGroup} options=${INTERESTS} selected=${interests} onChange=${(s) => { setInterests(s); setInterestErr(""); }} label="Interests" />${interestErr ? html`<div class="hint" style="color:var(--bad)"><${Icon} name="alert" size="sm" /><span>${interestErr}</span></div>` : null}</div>`,
    () => html`<div class="fields">
      <div class=${`field${resumeErr ? " invalid" : ""}`}>
        <span class="label">Resume <span class="opt">(optional)</span></span>
        <input type="file" id="resume" accept="application/pdf" class="sr-only" ref=${fileRef} onChange=${onFile} />
        ${resume ? html`<div class="file-row"><${Icon} name="file" /><span class="name truncate">${resume.name}</span><${IconButton} icon="x" label="Remove resume" onClick=${() => { setResume(null); setResumeErr(""); if (fileRef.current) fileRef.current.value = ""; }} /></div>`
          : html`<label class="drop" for="resume"><${Icon} name="upload" size="lg" /><span class="small" style="font-weight:500">Upload your resume</span><span class="meta">PDF, under 5 MB. We read the skills it lists.</span></label>`}
        ${resumeErr ? html`<div class="hint" role="alert"><${Icon} name="alert" size="sm" /><span>${resumeErr}</span></div>` : null}
      </div>
      <div class="divider">or pick your skills</div>
      <${ChipGroup} options=${SKILL_CHIPS.map((s) => [s, s])} selected=${skills} onChange=${(s) => { setSkills(s); setSkillErr(""); }} label="Skills" />
      ${skillErr ? html`<div class="hint" style="color:var(--bad)" role="alert"><${Icon} name="alert" size="sm" /><span>${skillErr}</span></div>` : null}
    </div>`,
  ][step];

  return html`<div class="signup fade">
    <aside class="signup-side">
      <div><h1 class="h1">Create your verified profile</h1><p class="lead" style="margin-top:0.375rem">Four short steps, about two minutes. Then pick a repo and answer five questions about your own code.</p></div>
      <ol class="stepper" aria-label="Steps">${STEPS.map(([t, d], i) => html`<li class=${`step ${i < step ? "done" : i === step ? "now" : ""}`}><span class="dot">${i < step ? html`<${Icon} name="check" size="sm" />` : i + 1}</span><div><div class="t">${t}</div><div class="d">${d}</div></div></li>`)}</ol>
      <p class="small faint">Your report stays private until you apply to an internship.</p>
    </aside>
    <form class="signup-card" novalidate onSubmit=${(e) => { e.preventDefault(); if (last) send(true); else next(); }}>
      ${message ? html`<${Banner} kind="info">${message}<//>` : null}
      <div><div class="meta">Step ${step + 1} of ${STEPS.length}</div><h2 class="h2" style="margin-top:0.25rem">${STEPS[step][0]}</h2></div>
      ${body()}
      ${top}
      <div class="actions" style="justify-content:space-between">
        ${step > 0 ? html`<${Button} kind="ghost" icon="arrow-left" onClick=${() => setStep(step - 1)}>Back<//>` : html`<span></span>`}
        ${last ? html`<${Button} type="submit" size="lg" busy=${busy}>${busy ? (resume ? "Reading your resume…" : "Creating your profile…") : "Create my profile"}<//>`
          : html`<${Button} type="submit" size="lg" iconAfter="arrow-right">Continue<//>`}
      </div>
    </form>
  </div>`;
}

// ---------- Home ----------

function HackathonDialog({ repos, onClose }) {
  const [f, setF] = useState({ event: "", year: String(new Date().getFullYear()), result: "participant", team: "1", repo: "", other: "" });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  async function submit(e) {
    e.preventDefault();
    const full = normaliseRepo(f.other) || f.repo;
    const errs = {};
    if (!f.event.trim()) errs.event = "Enter the hackathon's name.";
    if (!REPO_RE.test(full)) errs.repo = "Pick one of your repos, or type a team repo as owner/repo.";
    setErr(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api(`/api/students/${enc(me.id())}/hackathons`, { method: "POST", body: { event: f.event.trim(), year: Number(f.year), result: f.result, team_size: Number(f.team), repo_full_name: full } });
      onClose(true);
    } catch (e2) { setErr({ top: e2.message }); } finally { setBusy(false); }
  }
  return html`<dialog ref=${ref} aria-labelledby="h-title" onClose=${() => onClose(false)}>
    <form novalidate onSubmit=${submit}>
      <div class="dialog-body">
        <h2 class="h2" id="h-title">Add a hackathon</h2>
        <p>It counts toward your matches once you finish a viva on its repo.</p>
        <${Field} id="h-event" label="Hackathon" value=${f.event} onInput=${(e) => setF({ ...f, event: e.target.value })} state=${err.event ? "error" : ""} hint=${err.event} attrs=${{ maxlength: "120", placeholder: "e.g. Smart India Hackathon", autofocus: true }} />
        <div class="fields two">
          <${Field} id="h-year" label="Year" type="number" value=${f.year} onInput=${(e) => setF({ ...f, year: e.target.value })} attrs=${{ min: "2000", max: "2100", inputmode: "numeric" }} />
          <${Field} id="h-team" label="Team size" type="number" value=${f.team} onInput=${(e) => setF({ ...f, team: e.target.value })} attrs=${{ min: "1", max: "20", inputmode: "numeric" }} />
        </div>
        <${Select} id="h-result" label="Result" value=${f.result} onChange=${(e) => setF({ ...f, result: e.target.value })} options=${["winner", "finalist", "participant"].map((r) => [r, RESULT_LABEL[r]])} />
        <${Select} id="h-repo" label="Project repo" value=${f.repo} onChange=${(e) => setF({ ...f, repo: e.target.value })} options=${[["", repos.length ? "Pick one of your repos" : "No public repos found"], ...repos.map((r) => [r.full_name, r.full_name])]} />
        <${Field} id="h-other" label="Or a team repo" optional value=${f.other} onInput=${(e) => setF({ ...f, other: e.target.value })} state=${err.repo ? "error" : ""} hint=${err.repo || "owner/repo. You need commits in it; your viva will ask about the files you changed."} attrs=${{ autocapitalize: "off", spellcheck: "false" }} />
        ${err.top ? html`<${Banner}>${err.top}<//>` : null}
      </div>
      <div class="dialog-actions"><${Button} kind="secondary" onClick=${() => onClose(false)}>Cancel<//><${Button} type="submit" busy=${busy}>Add hackathon<//></div>
    </form>
  </dialog>`;
}

function Home({ onLost }) {
  const { loading, data, error, reload } = useLoad(async () => {
    const report = await api(`/api/report/${enc(me.id())}`);
    const [repos, listings] = await Promise.all([
      api(`/api/github/${enc(me.github())}/repos`).then((r) => r.repos).catch(() => []),
      api("/api/listings").then((r) => r.listings).catch(() => []),
    ]);
    return { report, repos, listings };
  }, []);
  const [dialog, setDialog] = useState(false);
  useEffect(() => { if (error && error.code === "STUDENT_NOT_FOUND") onLost(); }, [error]);
  if (error) return html`<${ErrorView} error=${error} onRetry=${reload} />`;
  if (loading) return html`<div class="stack"><${Skeleton} w="40%" h="1.5rem" /><${Skeleton} w="100%" h="9rem" /><${SkeletonList} rows=${3} /></div>`;
  const { report, repos, listings } = data;
  const byId = Object.fromEntries(listings.map((l) => [l.id, l]));
  const first = (me.name() || report.student.name).split(" ")[0];
  const done = report.status === "done";
  const prog = report.viva_in_progress;
  const top = Object.entries(report.skills).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return html`<div class="fade">
    <div class="profile" style="margin-bottom:1.5rem"><${Avatar} username=${report.student.github_username} size="lg" /><div class="who"><h1 class="h1">Hi, ${first}</h1><div class="small muted">@${report.student.github_username} · ${report.student.college}</div></div></div>
    <div class="stack">
      ${prog ? html`<div class="card"><div class="card-head"><div><div class="h3">Finish your viva</div><div class="small muted">${repoName(prog.repo_full_name)}: ${prog.answered} of ${prog.total} answered. Your answers so far are saved.</div></div><${Button} iconAfter="arrow-right" onClick=${() => { tab.set("vb_session_id", prog.session_id); go("#/viva"); }}>Continue<//></div><${Progress} value=${(prog.answered / prog.total) * 100} label=${`${prog.answered} of ${prog.total} answered`} /></div>` : null}
      ${done ? html`<div class="card">
          <div class="card-head"><div class="h3">Your verified profile</div><${Tag} kind="ok">Verified by viva<//></div>
          <div class="overall"><div><div class="k">Overall score</div><div class="score">${report.overall}<small>/ 100</small></div></div>
            <div class="skill-rows" style="border:0">${top.map(([t, s]) => html`<div class="skill-row" style="padding:0.5rem 0"><span class="name"><${Icon} name=${TAG_ICON[t]} />${TAG_NAME[t]}</span><div class=${`bar ${levelOf(s)}`}><span style=${`width:${s}%`}></span></div><span class="v">${s}</span><${LevelTag} level=${levelOf(s)} /></div>`)}</div></div>
          <div class="actions" style="margin-top:1rem"><${Button} href="#/report" icon="verified">View report<//><${Button} kind="secondary" href="#/repos">Verify another repo<//></div>
        </div>`
      : html`<div class="card">
          <div class="h3">Verify your skills</div>
          <p class="small muted" style="margin-top:0.25rem">About 8 minutes. Your report stays private until you apply.</p>
          <ol class="checklist" style="margin-top:0.75rem">
            ${[["Pick one of your GitHub repos", "Or a team repo you committed to"], ["Answer 5 questions about its code", "Out loud or typed, in any language"], ["Get matched on what you showed", "Verified skills, interests and hackathons"]].map(([t, d], i) => html`<li class="check-item todo"><span class="st">${i + 1}</span><div><div class="t" style="color:var(--text)">${t}</div><div class="d">${d}</div></div><span></span></li>`)}
          </ol>
          <div class="actions" style="margin-top:1rem"><${Button} size="lg" href="#/repos" iconAfter="arrow-right">Pick a repo<//></div>
        </div>`}
    </div>
    <${Section} title="Hackathons" note="Each one counts toward your matches once you verify it with a viva on its repo." action=${html`<${Button} kind="secondary" size="sm" icon="plus" onClick=${() => setDialog(true)}>Add<//>`}>
      ${report.hackathons.length ? html`<${HackathonList} items=${report.hackathons} who="you" action=${(x) => html`${x.verified ? null : html`<${Button} kind="secondary" size="sm" onClick=${() => go(`#/analyzing?repo=${enc(x.repo_full_name)}`)}>Verify now<//>`}<${IconButton} icon="trash" label=${`Remove ${x.event} ${x.year}`} onClick=${async () => {
        if (!await confirm({ title: `Remove ${x.event} ${x.year}?`, text: "This takes it off your profile and out of your matches.", confirmText: "Remove", danger: true })) return;
        try { await api(`/api/students/${enc(me.id())}/hackathons/${enc(x.hackathon_id)}`, { method: "DELETE" }); toast("Hackathon removed."); reload(); } catch (e) { toast(e.message); }
      }} />`} />`
      : html`<div class="list"><${Empty} icon="trophy" title="No hackathons yet" text="Add the ones you've done. A viva on the project repo verifies your part in it." /></div>`}
    <//>
    <${Section} title="Internships" note=${done ? "Matched on the skills and hackathons you verified." : "Finish a viva to see how well you match each one."}>
      ${done ? html`<div class="matches">${report.matches.slice(0, 2).map((m, i) => html`<${MatchCard} m=${m} listing=${byId[m.listing_id]} top=${i === 0 && m.match > 0} />`)}<div><${Button} kind="ghost" href="#/internships" iconAfter="arrow-right">See all internships<//></div></div>`
      : html`<div class="list">${listings.map((l) => html`<div class="item"><span class="ic-box"><${Icon} name="building" /></span><div class="item-main"><div class="item-title">${l.title}</div><div class="item-sub">${l.venture}</div></div><span></span></div>`)}</div>`}
    <//>
    ${dialog ? html`<${HackathonDialog} repos=${repos} onClose=${(saved) => { setDialog(false); if (saved) { toast("Hackathon added. Verify it with a viva on its repo."); reload(); } }} />` : null}
  </div>`;
}

// ---------- Pick a repo ----------

function Repos() {
  const { loading, data, error, reload } = useLoad(() => api(`/api/github/${enc(me.github())}/repos`).then((r) => r.repos), []);
  const [q, setQ] = useState("");
  const [team, setTeam] = useState("");
  const [teamErr, setTeamErr] = useState("");
  const pick = async (full) => {
    if (await confirm({ title: `Verify ${repoName(full)}?`, text: "We'll read the code and ask you 5 questions about it. Answer by speaking or typing, in any language. Each question has 90 seconds.", confirmText: "Start" })) go(`#/analyzing?repo=${enc(full)}`);
  };
  if (error) return html`<${ErrorView} error=${error} onRetry=${reload} />`;
  const repos = data || [];
  const shown = repos.filter((r) => !q || r.full_name.toLowerCase().includes(q.toLowerCase()) || (r.description || "").toLowerCase().includes(q.toLowerCase()));
  return html`<div class="fade">
    <${PageHead} title="Pick a repo" lead="Pick a project you built, so you can answer questions about its code." />
    ${loading ? html`<${SkeletonList} rows=${5} />` : html`<div class="stack">
      ${repos.length > 6 ? html`<${Field} id="repo-search" value=${q} onInput=${(e) => setQ(e.target.value)} attrs=${{ placeholder: "Search your repos", autocapitalize: "off", spellcheck: "false", "aria-label": "Search your repos" }} trail=${html`<${Icon} name="search" />`} />` : null}
      <div class="list">${shown.length ? shown.map((r) => html`<button class="item" type="button" onClick=${() => pick(r.full_name)}>
        <span class="ic-box"><${Icon} name="code" /></span>
        <div class="item-main"><div class="item-title truncate">${repoName(r.full_name)}</div><div class="item-sub clamp-2">${r.description || "No description"}</div><div class="item-meta"><span>${r.language || "Code"}</span><span>${r.stars} stars</span><span>Updated ${(r.pushed_at || "").slice(0, 10)}</span></div></div>
        <span class="item-trail"><${Icon} name="chevron-right" /></span>
      </button>`) : html`<${Empty} icon="search" title=${q ? `No repos match "${q}"` : "No public repos found"} text=${q ? "" : `Push a project to GitHub under @${me.github()}, then reload this page.`} />`}</div>
    </div>`}
    <${Section} title="Verify a team repo instead" note="A teammate's or organisation's repo you have commits in. Your questions will be about the files you changed.">
      <form class="card" novalidate onSubmit=${(e) => { e.preventDefault(); const repo = normaliseRepo(team); if (!REPO_RE.test(repo)) { setTeamErr("Type it as owner/repo, like your-team/hackathon-app."); return; } go(`#/analyzing?repo=${enc(repo)}`); }}>
        <div class="fields"><${Field} id="team-repo" label="Team repo" value=${team} onInput=${(e) => { setTeam(e.target.value); setTeamErr(""); }} state=${teamErr ? "error" : ""} hint=${teamErr} attrs=${{ placeholder: "owner/repo", autocapitalize: "off", spellcheck: "false" }} /><div class="actions end"><${Button} type="submit" kind="secondary" iconAfter="arrow-right">Start<//></div></div>
      </form>
    <//>
  </div>`;
}

// ---------- Analyzing and "what we found" ----------

function Analyzing({ repo }) {
  const [st, setSt] = useState({ error: null, result: null });
  const [tick, setTick] = useState(0);
  const started = useRef(Date.now());
  const ran = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    api("/api/analyze", { method: "POST", body: { student_id: me.id(), repo_full_name: repo } })
      .then((a) => { tab.set("vb_last_analysis", JSON.stringify(a)); tab.set("vb_session_id", a.session_id); setSt({ error: null, result: a }); setTimeout(() => go("#/found", true), 900); })
      .catch((error) => setSt({ error, result: null }));
  }, [repo]);
  const elapsed = (Date.now() - started.current) / 1000;
  const a = st.result;
  const steps = [
    ["Read the repo", a ? `Kept ${count(a.repo.files_read, "file")}, skipped libraries and generated code` : "Download it, skip libraries, build output and generated files", a ? "done" : "run"],
    ["Find the skills it shows", a ? (a.repo_skills.map((x) => TAG_NAME[x.tag] || x.tag).join(", ") || "None found") : "Rank files by how often other files import them", a ? "done" : elapsed > 6 ? "run" : "todo"],
    ["Write 5 questions", a ? `${count(a.questions.length, "question")} about real lines in your files` : "Each about real lines in your files", a ? "done" : elapsed > 10 ? "run" : "todo"],
  ];
  if (st.error) return html`<div class="fade"><${PageHead} title=${`We couldn't start the viva on ${repoName(repo)}`} /><div class="stack"><${Banner}>${st.error.message}<//><div class="actions"><${Button} icon="refresh" onClick=${() => { ran.current = false; started.current = Date.now(); setSt({ error: null, result: null }); }}>Try again<//><${Button} kind="ghost" href="#/repos">Pick another repo<//></div></div></div>`;
  return html`<div class="fade" role="status" aria-label=${`Reading ${repo}`}>
    <${PageHead} title=${`Reading ${repoName(repo)}`} lead="This usually takes 15 to 30 seconds. Keep this page open." />
    <div class="card">
      <div class="card-head"><span class="mono truncate">${repo}</span><span class=${`tag ${a ? "ok" : "brand live"}`}>${a ? "Done" : `Working · ${fmt(elapsed)}`}</span></div>
      <${Progress} indeterminate=${!a} value=${100} label="Reading the repo" />
      <ol class="checklist" style="margin-top:0.5rem">${steps.map(([t, d, s]) => html`<li class=${`check-item ${s}`}><span class="st">${s === "done" ? html`<${Icon} name="check" size="sm" />` : s === "run" ? html`<${Icon} name="loader" size="sm" cls="spin" />` : ""}</span><div><div class="t">${t}</div><div class="d">${d}</div></div><span></span></li>`)}</ol>
    </div>
  </div>`;
}

function Found() {
  const a = JSON.parse(tab.get("vb_last_analysis") || "null");
  useEffect(() => { if (!a) go("#/home", true); }, []);
  if (!a) return null;
  const langs = Object.entries(a.repo.languages).sort((x, y) => y[1] - x[1]);
  const top = langs.slice(0, 4);
  const other = langs.slice(4).reduce((sum, [, v]) => sum + v, 0);
  if (other > 0) top.push(["Other", Math.round(other * 10) / 10]);
  return html`<div class="fade">
    <${PageHead} title=${`We read ${repoName(a.repo.full_name)}`} lead=${`${count(a.repo.files_read, "file")} read. Here's what your code shows.`} />
    <div class="stack">
      <div class="card tight stack-sm"><div class="langs" role="img" aria-label=${top.map(([n, v]) => `${n} ${v}%`).join(", ")}>${top.map(([, v], i) => html`<span class=${`l${i}`} style=${`flex-grow:${v}`}></span>`)}</div><div class="legend">${top.map(([n, v], i) => html`<span><i class=${`l${i}`}></i>${n} ${v}%</span>`)}</div></div>
      ${a.contribution.team_repo ? html`<div class="card info"><div class="h3">Team repo</div><p class="small" style="margin-top:0.25rem">You made ${count(a.contribution.your_commits, "commit")} here. Your questions are about the files you changed:</p><ul class="points" style="margin-top:0.5rem">${a.contribution.focus_files.slice(0, 5).map((f) => html`<li><${Icon} name="file" size="sm" /><span class="mono">${f}</span></li>`)}</ul></div>` : null}
      <div class="list">${a.repo_skills.map((sk) => html`<div class="item" style="align-items:start"><span class="ic-box brand"><${Icon} name=${TAG_ICON[sk.tag] || "code"} /></span><div class="item-main"><div class="item-title">${TAG_NAME[sk.tag] || sk.tag}</div><div class="item-sub">${sk.evidence}</div></div><span></span></div>`)}</div>
      <div class="card flat"><div class="facts"><${Tag} plain kind="outline">5 questions<//><${Tag} plain kind="outline">90 seconds each<//><${Tag} plain kind="outline">Speak or type<//><${Tag} plain kind="outline">Any language<//></div><p class="small muted" style="margin-top:0.625rem">Each question points at specific lines of this code. There are no trick questions, and no score shows until the end.</p></div>
      <div class="actions end"><${Button} size="lg" iconAfter="arrow-right" onClick=${() => go("#/viva", true)}>Start question 1<//></div>
    </div>
  </div>`;
}

// ---------- The viva ----------

const recorder = {
  media: null, stream: null, chunks: [], startedAt: 0, mime: "", stopTimer: null, audio: null, analyser: null, frame: 0, onAutoStop: null,
  get active() { return !!this.media; },
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
    this.media = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime } : undefined);
    this.chunks = [];
    this.media.ondataavailable = (ev) => { if (ev.data && ev.data.size) this.chunks.push(ev.data); };
    this.media.start();
    this.startedAt = Date.now();
    this.stopTimer = setTimeout(() => { if (this.active && this.onAutoStop) this.onAutoStop(); }, MAX_RECORDING_S * 1000);
    this.listen();
  },
  // The bars beside the button follow the real microphone level
  listen() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.audio = new Ctx();
      const src = this.audio.createMediaStreamSource(this.stream);
      this.analyser = this.audio.createAnalyser();
      this.analyser.fftSize = 512;
      src.connect(this.analyser);
      const data = new Uint8Array(this.analyser.fftSize);
      const levels = new Array(40).fill(0);
      let last = 0;
      const draw = (now) => {
        if (!this.analyser) return;
        if (now - last > 70) {
          last = now;
          this.analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
          levels.shift();
          levels.push(Math.min(1, (peak / 128) * 1.6));
          document.querySelectorAll("#wave span").forEach((bar, i) => { bar.style.height = `${Math.max(3, Math.round(levels[i] * 32))}px`; });
        }
        this.frame = requestAnimationFrame(draw);
      };
      this.frame = requestAnimationFrame(draw);
    } catch { /* no bars; recording still works */ }
  },
  quiet() { cancelAnimationFrame(this.frame); this.analyser = null; if (this.audio) { this.audio.close().catch(() => {}); this.audio = null; } },
  stop() {
    return new Promise((resolve) => {
      if (!this.media) return resolve(null);
      const media = this.media, stream = this.stream, chunks = this.chunks;
      this.media = null;
      this.quiet();
      const seconds = Math.round((Date.now() - this.startedAt) / 1000);
      clearTimeout(this.stopTimer);
      media.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: media.mimeType || this.mime || "audio/webm" });
        if (blob.size < 2000 || seconds < 1) return resolve(null);
        resolve({ base64: await readFileAsBase64(blob), mime: blob.type || "audio/webm", seconds });
      };
      media.stop();
    });
  },
  discard() {
    if (!this.media) return;
    clearTimeout(this.stopTimer);
    this.quiet();
    const stream = this.stream;
    this.media.onstop = () => { stream.getTracks().forEach((t) => t.stop()); };
    this.media.stop();
    this.media = null;
  },
};

// Analyze stores the fresh session here, so the viva doesn't need to fetch it again
let vivaCache = null;

function Viva({ onLost }) {
  const sessionId = tab.get("vb_session_id");
  const [s, setS] = useState(() => (vivaCache && vivaCache.sessionId === sessionId ? vivaCache : null));
  const [loadError, setLoadError] = useState(null);
  const [mode, setMode] = useState("voice");
  const [text, setText] = useState("");
  const pasted = useRef(false);
  const [rec, setRec] = useState(null);
  const [recording, setRecording] = useState(false);
  const [now, setNow] = useState(Date.now());
  const shownAt = useRef(Date.now());
  const shownKey = useRef(null);
  const analysis = useMemo(() => JSON.parse(tab.get("vb_last_analysis") || "null"), []);

  useEffect(() => {
    if (!sessionId) { go("#/home", true); return; }
    if (s) return;
    api(`/api/viva/${enc(sessionId)}`).then((v) => setS({
      sessionId: v.session_id, questions: v.questions, current: v.status === "done" ? null : v.current_question_id,
      followUp: v.pending_follow_up ? v.pending_follow_up.follow_up : null, answered: v.answered, loading: false, error: null, failed: null, done: v.status === "done", timeLimit: 90,
    })).catch((e) => { if (e.code === "SESSION_NOT_FOUND") { tab.del("vb_session_id"); go("#/home", true); } else if (e.code === "STUDENT_NOT_FOUND") onLost(); else setLoadError(e); });
  }, [sessionId]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => { clearInterval(t); recorder.discard(); }; }, []);
  useEffect(() => { if (s && s.done) go("#/done", true); }, [s && s.done]);

  const q = s && s.questions.find((x) => x.id === s.current);
  const key = q ? `${q.id}|${s.followUp || ""}` : null;
  if (key && shownKey.current !== key) { shownKey.current = key; shownAt.current = Date.now(); } // the clock starts when the question first shows
  useEffect(() => { if (key) window.scrollTo({ top: 0, behavior: "smooth" }); }, [key]);

  const left = s ? s.timeLimit - (now - shownAt.current) / 1000 : 0;
  async function stopAndKeep() {
    if (!recorder.active) return;
    const r = await recorder.stop();
    setRecording(false);
    setRec(r);
    if (!r) setS((x) => ({ ...x, error: { message: "That recording was too short. Please try again.", code: "LOCAL" } }));
  }
  recorder.onAutoStop = stopAndKeep;
  useEffect(() => { if (left <= 0 && recorder.active) stopAndKeep(); }, [left <= 0]);

  async function send(body) {
    setS((x) => ({ ...x, loading: true, error: null, failed: null }));
    try {
      const r = await api(`/api/viva/${enc(s.sessionId)}/answer`, { method: "POST", body });
      if (body.mode === "voice" && r.transcript) toast(`Saved. We heard: “${r.transcript}”`, { timeout: 9000 });
      else toast(r.follow_up ? "Saved. You get one more chance on this question." : "Answer saved.", { timeout: 3000 });
      setS((x) => {
        const n = { ...x, loading: false };
        if (r.follow_up) n.followUp = r.follow_up;
        else { n.followUp = null; if (!n.answered.includes(r.question_id)) n.answered = [...n.answered, r.question_id]; n.current = r.next_question_id; n.done = r.done; }
        return n;
      });
      setText(""); pasted.current = false; setRec(null);
    } catch (e) {
      if (e.code === "ALREADY_ANSWERED") { vivaCache = null; setS(null); return; }
      setS((x) => ({ ...x, loading: false, error: e, failed: body }));
    }
  }
  const submit = (fields) => { if (!s || !s.current || s.loading) return; send({ question_id: s.current, is_follow_up: s.followUp !== null, ...fields }); };

  if (loadError) return html`<${ErrorView} error=${loadError} onRetry=${() => { setLoadError(null); setS(null); }} />`;
  if (!s || !q) return html`<div class="stack"><${Skeleton} w="50%" h="1.25rem" /><${Skeleton} w="100%" h="4rem" /><${Skeleton} w="100%" h="14rem" /></div>`;
  const idx = s.questions.findIndex((x) => x.id === q.id);
  const mine = analysis && analysis.session_id === s.sessionId && analysis.contribution.focus_files.includes(q.file);
  const busy = s.loading;
  const err = s.error;

  return html`<div>
    <div class="viva-bar">
      <div class="row">
        <${IconButton} icon="x" label="Leave the viva" onClick=${async () => { if (await confirm({ title: "Leave the viva?", text: "Your answers so far are saved. You can continue from your home page.", confirmText: "Leave" })) { recorder.discard(); go("#/home"); } }} />
        <span class="h3">Question ${idx + 1} of ${s.questions.length}</span>
        <span class="grow"></span>
        <span class=${`timer${left <= 0 ? " up" : left <= 15 ? " low" : ""}`} aria-live="off"><${Icon} name="clock" size="sm" />${left > 0 ? fmt(left) : "Time's up"}</span>
      </div>
      <${Segments} total=${s.questions.length} done=${s.answered.length} now=${idx} />
    </div>
    <div class="stack">
      <div class="facts"><${Tag} plain kind="outline">${{ easy: "Easy", medium: "Medium", hard: "Hard" }[q.difficulty] || q.difficulty}<//><${Tag} kind="brand">${TAG_NAME[q.skill] || q.skill}<//>${mine ? html`<${Tag} plain kind="outline">You changed this file<//>` : null}</div>
      ${s.followUp ? html`<div class="followup"><span class="k">One more chance on this question</span><p>${s.followUp}</p></div><p class="question dim">${q.question}</p>` : html`<p class="question">${q.question}</p>`}
      <${Code} file=${q.file} lines=${q.lines} snippet=${q.snippet} startLine=${q.snippet_start_line} />
      <div class="card answer">
        <div class="row between wrap"><div class="h3">Your answer</div><${Seg} options=${[["voice", "Speak", "mic"], ["text", "Type", "keyboard"]]} value=${mode} onChange=${setMode} disabled=${busy || recording} label="How to answer" /></div>
        ${mode === "voice" ? html`
          <div class="record">
            <button type="button" class=${`rec-btn${recording ? " on" : ""}`} disabled=${busy} aria-label=${recording ? "Stop recording" : rec ? "Record again" : "Start recording"} onClick=${async () => {
              if (recorder.active) return stopAndKeep();
              setS((x) => ({ ...x, error: null })); setRec(null);
              try { await recorder.start(); setRecording(true); } catch { setS((x) => ({ ...x, error: { message: "We couldn't use your microphone. You can type your answer instead.", code: "LOCAL" } })); setMode("text"); }
            }}>${recording ? html`<span class="dot"></span>Stop` : html`<${Icon} name="mic" />${rec ? "Record again" : "Record"}`}</button>
            <div class=${`wave${recording ? "" : " idle"}`} id="wave" aria-hidden="true">${Array.from({ length: 40 }, () => html`<span></span>`)}</div>
          </div>
          <p class="rec-status">${recording ? `Recording ${fmt((now - recorder.startedAt) / 1000)}. Tap Stop when you're done.` : rec ? `Recorded ${fmt(rec.seconds)}. Send it, or record again.` : "Explain in your own words. English, Hindi, Telugu or a mix."}</p>
          ${rec && !recording ? html`<div class="actions end"><${Button} size="lg" busy=${busy} icon="check" onClick=${() => submit({ mode: "voice", audio_base64: rec.base64, audio_mime: rec.mime, duration_s: rec.seconds })}>${busy ? "Saving your answer…" : "Send answer"}<//></div>` : null}`
        : html`
          <${Field} id="answer" multiline value=${text} onInput=${(e) => setText(e.target.value)} attrs=${{ maxlength: "6000", placeholder: "Explain in your own words. Any language is fine.", disabled: busy, "aria-label": "Your answer", onPaste: () => { pasted.current = true; } }} />
          <div class="actions end"><${Button} size="lg" busy=${busy} icon="check" onClick=${() => {
            if (!text.trim()) { setS((x) => ({ ...x, error: { message: "Type an answer first.", code: "LOCAL" } })); return; }
            submit({ mode: "text", answer_text: text, duration_s: Math.min(3600, Math.round((Date.now() - shownAt.current) / 1000)), pasted: pasted.current });
          }}>${busy ? "Saving your answer…" : "Send answer"}<//></div>`}
        ${err ? html`<${Banner} action=${RETRYABLE.has(err.code) && s.failed ? html`<${Button} kind="secondary" size="sm" icon="refresh" onClick=${() => send(s.failed)}>Try again<//>` : null}>${err.message}<//>` : null}
      </div>
    </div>
  </div>`;
}

function Done({ onLost }) {
  const analysis = useMemo(() => JSON.parse(tab.get("vb_last_analysis") || "null"), []);
  const { loading, data: report, error, reload } = useLoad(() => api(`/api/report/${enc(me.id())}`), []);
  useEffect(() => { tab.del("vb_session_id"); vivaCache = null; }, []);
  useEffect(() => { if (error && error.code === "STUDENT_NOT_FOUND") onLost(); }, [error]);
  if (error) return html`<${ErrorView} error=${error} onRetry=${reload} />`;
  if (loading) return html`<div class="stack"><${Skeleton} w="40%" h="1.5rem" /><${Skeleton} w="100%" h="10rem" /></div>`;
  const repoFull = analysis ? analysis.repo.full_name : "";
  const verified = analysis ? report.hackathons.filter((x) => x.verified && x.repo_full_name.toLowerCase() === repoFull.toLowerCase()) : [];
  const evidence = report.evidence.filter((e) => !repoFull || e.repo_full_name.toLowerCase() === repoFull.toLowerCase());
  return html`<div class="fade">
    <${PageHead} title="Viva complete" lead="Your report is ready. It stays private until you apply to an internship." />
    <div class="stack">
      ${report.status === "done" ? html`<div class="card">
        <div class="overall"><div><div class="k">Overall score</div><div class="score">${report.overall}<small>/ 100</small></div></div>
          <div class="list" style="border-radius:var(--r)">${evidence.map((e, i) => html`<div class="item" style="min-height:2.75rem;padding:0.5rem 0.875rem"><span class="small faint num">Q${i + 1}</span><div class="item-main"><div class="small">${TAG_NAME[e.skill] || e.skill}</div></div><span class="row"><${Tag} kind=${levelOf(e.score * 10)}>${e.score}/10<//></span></div>`)}</div></div>
      </div>` : null}
      ${verified.map((x) => html`<${Banner} kind="ok">This viva also verified your hackathon: ${RESULT_LABEL[x.result]} at ${x.event} ${x.year}.<//>`)}
      <div class="actions"><${Button} size="lg" href="#/report" icon="verified">See my report<//><${Button} size="lg" kind="secondary" href="#/internships">Find internships<//></div>
    </div>
  </div>`;
}

// ---------- Report and internships ----------

const justApplied = new Set();
async function apply(m, reload) {
  const ok = await confirm({ title: `Apply to ${m.venture}?`, text: `${m.title}. Applying shares your VerifiedBuild report (scores, answers, code evidence and hackathons) with ${m.venture} for this role. Nobody else sees it.`, confirmText: "Apply", consent: `I agree to share my report with ${m.venture}.` });
  if (!ok) return;
  try {
    await api("/api/apply", { method: "POST", body: { student_id: me.id(), listing_id: m.listing_id, share_consent: true } });
    justApplied.add(m.listing_id);
    toast(`Applied to ${m.venture}. They can now see your report.`);
  } catch (e) { if (e.code !== "ALREADY_APPLIED") toast(e.message); }
  reload();
}
const applyAction = (m, reload) => (m.applied ? html`<${Tag} kind="ok">Applied<//>` : html`<${Button} kind="secondary" size="sm" onClick=${() => apply(m, reload)}>Apply<//>`);

function useReport(onLost) {
  const r = useLoad(async () => {
    const [report, listings] = await Promise.all([api(`/api/report/${enc(me.id())}`), api("/api/listings").then((x) => x.listings).catch(() => [])]);
    return { report, listings, byId: Object.fromEntries(listings.map((l) => [l.id, l])) };
  }, []);
  useEffect(() => { if (r.error && r.error.code === "STUDENT_NOT_FOUND") onLost(); }, [r.error]);
  return r;
}
const NotYet = ({ title }) => html`<div class="fade"><${PageHead} title=${title} lead="Finish a viva first. Your scores, matches and report appear here after your fifth answer." /><div class="actions"><${Button} size="lg" href="#/repos" iconAfter="arrow-right">Pick a repo<//></div></div>`;

function Internships({ onLost }) {
  const { loading, data, error, reload } = useReport(onLost);
  if (error) return html`<${ErrorView} error=${error} onRetry=${reload} />`;
  if (loading) return html`<div class="stack"><${Skeleton} w="40%" h="1.5rem" /><${SkeletonList} rows=${4} /></div>`;
  const { report: r, listings, byId } = data;
  if (r.status !== "done") return html`<div class="fade"><${PageHead} title="Internships" lead="Finish a viva to see how well you match each one. Only skills you show count." /><div class="list">${listings.map((l) => html`<div class="item"><span class="ic-box"><${Icon} name="building" /></span><div class="item-main"><div class="item-title">${l.title}</div><div class="item-sub clamp-2">${l.venture}. ${l.description}</div></div><span></span></div>`)}</div><div class="actions" style="margin-top:1rem"><${Button} size="lg" href="#/repos" iconAfter="arrow-right">Pick a repo<//></div></div>`;
  return html`<div class="fade"><${PageHead} title="Internships" lead="Matched on the skills and hackathons you verified. Applying shares your report with that company only." /><div class="matches">${r.matches.map((m, i) => html`<${MatchCard} m=${m} listing=${byId[m.listing_id]} top=${i === 0 && m.match > 0} action=${applyAction(m, reload)} />`)}</div></div>`;
}

function Report({ onLost }) {
  const { loading, data, error, reload } = useReport(onLost);
  if (error) return html`<${ErrorView} error=${error} onRetry=${reload} />`;
  if (loading) return html`<div class="stack"><${Skeleton} w="40%" h="1.5rem" /><${Skeleton} w="100%" h="8rem" /><${SkeletonList} rows=${6} /></div>`;
  const { report: r, byId } = data;
  if (r.status !== "done") return html`<${NotYet} title="Your report" />`;
  const repos = [...new Set(r.evidence.map((e) => e.repo_full_name))];
  return html`<div class="fade">
    <div class="card">
      <div class="profile"><${Avatar} username=${r.student.github_username} size="lg" /><div class="who"><h1 class="h1">${r.student.name}</h1><div class="small muted">${r.student.college} · @${r.student.github_username}</div></div></div>
      <div class="overall" style="margin-top:1.25rem"><div><div class="k">Overall score</div><div class="score">${r.overall}<small>/ 100</small></div></div><div class="facts"><${Tag} kind="ok">Verified by viva<//>${repos.map((x) => html`<${Tag} plain kind="outline">${repoName(x)}<//>`)}<${Tag} plain kind="outline">${count(r.evidence.length, "answer")} with evidence<//></div></div>
    </div>
    <${Section} title="Verified skills" note="From your answers. 70 and up is strong, 40 to 69 partial."><${SkillRows} skills=${r.skills} /><//>
    <${Section} title="Claimed and verified" note="Only skills you showed in the viva count toward matches."><${ClaimsList} rows=${r.claimed_vs_verified} who="you" /><//>
    <${Section} title="Internships for you" note="Each match adds up verified skills, shared interests and verified hackathons. No AI in this number.">
      <div class="matches">${r.matches.slice(0, 3).map((m, i) => html`<${MatchCard} m=${m} listing=${byId[m.listing_id]} top=${i === 0 && m.match > 0} action=${applyAction(m, reload)} />`)}</div>
      <div><${Button} kind="ghost" href="#/internships" iconAfter="arrow-right">See all internships<//></div>
    <//>
    ${r.hackathons.length ? html`<${Section} title="Hackathons"><${HackathonList} items=${r.hackathons} who="you" /><//>` : null}
    <${Section} title="Your answers" note="Each question was about the code shown beside it."><div class="evidence">${r.evidence.map((e, i) => html`<${EvidenceSheet} e=${e} i=${i} who="you" />`)}</div><//>
    ${r.build_history ? html`<${Section} title="How the repo was built" note="Facts from GitHub. They don't change your score."><${BuildHistory} bh=${r.build_history} who="you" /><//>` : null}
  </div>`;
}

// ---------- App ----------

function App() {
  const { parts, query } = useHash();
  const [, bump] = useState(0);
  const [lostMessage, setLostMessage] = useState(null);
  const refresh = () => bump((x) => x + 1);
  const onLost = () => { me.forget(); setLostMessage("We couldn't find your profile. Please sign up again."); go("#/", true); refresh(); };
  const page = parts[0] || "";
  if (page !== "viva" && recorder.active) recorder.discard();

  const signOut = async () => {
    if (!await confirm({ title: "Sign out on this device?", text: `You're signed in as @${me.github()}. Your profile and results stay saved. Sign up again with the same GitHub to start fresh.`, confirmText: "Sign out" })) return;
    me.forget(); go("#/", true); refresh();
  };

  if (!me.id()) return html`<${Shell} page=${null}><${SignUp} message=${lostMessage} onDone=${() => { setLostMessage(null); refresh(); }} /><//>`;
  const focus = page === "viva";
  const pageId = ["repos", "internships", "report"].includes(page) ? page : ["analyzing", "found", "viva", "done"].includes(page) ? "repos" : "home";
  let view;
  if (page === "repos") view = html`<${Repos} />`;
  else if (page === "analyzing" && query.get("repo")) view = html`<${Analyzing} repo=${query.get("repo")} key=${query.get("repo")} />`;
  else if (page === "found") view = html`<${Found} />`;
  else if (page === "viva") view = html`<${Viva} onLost=${onLost} />`;
  else if (page === "done") view = html`<${Done} onLost=${onLost} />`;
  else if (page === "report") view = html`<${Report} onLost=${onLost} />`;
  else if (page === "internships") view = html`<${Internships} onLost=${onLost} />`;
  else view = html`<${Home} onLost=${onLost} />`;
  return html`<${Shell} page=${pageId} focus=${focus} onSignOut=${signOut}>${view}<//>`;
}

// Analyze hands the fresh session to the viva through this hook, so the first question shows at once
const origSet = tab.set.bind(tab);
tab.set = (k, v) => { origSet(k, v); if (k === "vb_last_analysis") { const a = JSON.parse(v); vivaCache = { sessionId: a.session_id, questions: a.questions, current: a.questions[0] ? a.questions[0].id : null, followUp: null, answered: [], loading: false, error: null, failed: null, done: false, timeLimit: a.time_limit_s || 90 }; } };

render(html`<${App} />`, document.getElementById("root"));
