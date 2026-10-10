// VerifiedBuild recruiter dashboard: sign in → internships → ranked applicants → one candidate's report.
// React-style components on Preact (htm, no build step). Shared pieces live in /ui.js.

import {
  html, render, useState, useEffect, useRef,
  api as callApi, store, enc, go, useHash, useMedia, levelOf, ago, pct, count, githubUser, repoName,
  TAGS, TAG_NAME,
  Icon, Mark, Button, Field, Tag, LevelTag, Avatar, Bar, Skeleton, SkeletonList, Empty, Banner,
  SkillRows, ClaimsList, HackathonList, EvidenceSheet, BuildHistory, MatchCard, Toasts, DialogHost, toast,
} from "/ui.js";

const POLL_MS = 5000;
const KEY = "vb_admin_key";
const session = store(window.sessionStorage);
const api = (path, opts = {}) => callApi(path, { ...opts, headers: opts.admin ? { "X-Admin-Key": session.get(KEY) || "" } : {} });

// Loads data now and again every few seconds while the tab is visible. `live` is "ok", "stale" or null.
function usePoll(fn, deps) {
  const [st, setSt] = useState({ loading: true, data: null, error: null, live: null });
  const last = useRef("");
  useEffect(() => {
    let alive = true;
    last.current = "";
    setSt({ loading: true, data: null, error: null, live: null });
    const run = async (first) => {
      if (!alive || (!first && document.hidden)) return;
      try {
        const data = await fn();
        if (!alive) return;
        const json = JSON.stringify(data);
        if (json !== last.current) { last.current = json; setSt({ loading: false, data, error: null, live: "ok" }); }
        else setSt((s) => (s.live === "ok" ? s : { ...s, live: "ok" }));
      } catch (error) {
        if (!alive) return;
        if (first) setSt({ loading: false, data: null, error, live: null });
        else setSt((s) => ({ ...s, live: error.code === "BAD_ADMIN_KEY" ? null : "stale", error: error.code === "BAD_ADMIN_KEY" ? error : s.error }));
      }
    };
    run(true);
    const t = setInterval(() => run(false), POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, deps);
  return st;
}

const PageHead = ({ title, lead, back, action }) => html`<div class="page-head">${back ? html`<a class="back" href=${back[0]}><${Icon} name="arrow-left" size="sm" />${back[1]}</a>` : null}<div class="row between wrap"><h1 class="h1">${title}</h1>${action || null}</div>${lead ? html`<p class="lead">${lead}</p>` : null}</div>`;
const Section = ({ title, note, children }) => html`<section class="section"><div class="section-head"><div><h2 class="h2">${title}</h2>${note ? html`<p>${note}</p>` : null}</div></div>${children}</section>`;

function Shell({ live, signedIn, onSignOut, wide, children }) {
  return html`
    <header class="topbar">
      <a class="brand" href="#/"><${Mark} />VerifiedBuild <span class="sub">for recruiters</span></a>
      <span class="spacer"></span>
      ${live ? html`<${Tag} kind=${live === "ok" ? "ok live" : ""}>${live === "ok" ? "Updating live" : "Reconnecting"}<//>` : null}
      ${signedIn ? html`<button class="icon-btn" type="button" aria-label="Sign out" title="Sign out" onClick=${onSignOut}><${Icon} name="logout" /></button>` : null}
    </header>
    <main class=${`main${wide ? " wide" : ""}`}>${children}</main>
    <${Toasts} /><${DialogHost} />`;
}

// ---------- Sign in ----------

function SignIn({ message, onDone }) {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(message || "");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (!pass.trim()) { setErr("Enter the passcode."); return; }
    setBusy(true);
    session.set(KEY, pass.trim());
    try { await api("/api/admin/verify", { admin: true }); go("#/", true); onDone(); }
    catch (e2) { session.del(KEY); setErr(e2.message); }
    finally { setBusy(false); }
  }
  return html`<form class="signin fade" novalidate onSubmit=${submit}>
    <div><h1 class="h1">Recruiter sign-in</h1><p class="small muted" style="margin-top:0.375rem">Enter the passcode from the VerifiedBuild team to see who applied to your internships, ranked by the skills they verified.</p></div>
    <${Field} id="passcode" label="Passcode" type="password" value=${pass} onInput=${(e) => { setPass(e.target.value); setErr(""); }} state=${err ? "error" : ""} hint=${err} attrs=${{ autocomplete: "current-password", autofocus: true }} />
    <${Button} type="submit" size="lg" busy=${busy} block>Sign in<//>
  </form>`;
}

// ---------- Internships ----------

function weightBars(required) {
  const weights = Object.entries(required).sort((a, b) => b[1] - a[1]);
  const total = weights.reduce((sum, [, w]) => sum + w, 0) || 1;
  return html`<div class="weights" aria-label="Skills this role needs">${weights.map(([tag, w]) => html`<div class="weight"><span>${TAG_NAME[tag] || tag}</span><div class="bar"><span style=${`width:${pct(w / total)}`}></span></div><span class="num" style="text-align:right">${pct(w / total)}</span></div>`)}</div>`;
}

function Listings({ onBadKey }) {
  const { loading, data, error, live } = usePoll(async () => {
    const { listings } = await api("/api/listings");
    const shortlists = await Promise.all(listings.map((l) => api(`/api/admin/shortlist/${enc(l.id)}`, { admin: true })));
    return { listings, shortlists };
  }, []);
  useEffect(() => { if (error && error.code === "BAD_ADMIN_KEY") onBadKey(error.message); }, [error]);
  if (error && !data) return html`<${Banner}>${error.message}<//>`;
  if (loading) return html`<div class="stack"><${Skeleton} w="30%" h="1.5rem" /><div class="grid">${[1, 2, 3].map(() => html`<${Skeleton} h="14rem" />`)}</div></div>`;
  const { listings, shortlists } = data;
  const applications = shortlists.reduce((n, sl) => n + sl.candidates.length, 0);
  return html`<div class="fade" data-live=${live}>
    <${PageHead} title="Internships" lead=${applications ? `${count(applications, "application")} so far. Students appear here when they apply and agree to share their report.` : "No applications yet. Students appear here when they apply and agree to share their report."} />
    <div class="grid">${listings.map((l, i) => {
      const c = shortlists[i].candidates;
      return html`<a class="listing" href=${`#/listing/${enc(l.id)}`}>
        <div><div class="h3">${l.title}</div><div class="small muted">${l.venture}</div></div>
        <p class="small muted clamp-2">${l.description}</p>
        ${weightBars(l.required_skills)}
        <div class="listing-foot"><span class=${`count${c.length ? "" : " zero"}`}>${c.length}</span><span>${c.length ? (c.length === 1 ? "applicant" : "applicants") : "No applicants yet"}</span><span class="spacer" style="flex:1"></span>${c[0] ? html`<span class="meta">Top: ${c[0].name}, ${c[0].match}%</span>` : null}<${Icon} name="chevron-right" /></div>
      </a>`;
    })}</div>
  </div>`;
}

// ---------- Ranked applicants ----------

async function downloadCsv(listingId, setBusy) {
  setBusy(true);
  try {
    const res = await api(`/api/admin/shortlist/${enc(listingId)}/csv`, { admin: true, raw: true });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = `shortlist-${listingId}.csv`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("CSV downloaded.");
  } catch (e) { toast(e.message); } finally { setBusy(false); }
}

function Candidate({ c, listingId, selected, isNew, onSelect, wide }) {
  const skills = TAGS.filter(([tag]) => c.skills[tag] !== undefined);
  return html`<a class=${`item cand${isNew ? " new" : ""}${selected ? " selected" : ""}`} href=${`#/candidate/${enc(c.student_id)}?listing=${enc(listingId)}`} aria-current=${selected ? "true" : null} onClick=${(e) => { if (wide) { e.preventDefault(); onSelect(c.student_id); } }}>
    <span class="rank" aria-label=${`Rank ${c.rank}`}>${c.rank}</span>
    <${Avatar} username=${c.github_username} />
    <div class="item-main">
      <div class="item-title">${c.name}</div>
      <div class="item-meta"><span>${c.college}</span><span>Applied ${ago(c.applied_at)}</span></div>
      <div class="tags">${skills.map(([tag, name]) => html`<${Tag} kind=${levelOf(c.skills[tag])}>${name} ${c.skills[tag]}<//>`)}${(c.hackathons || []).length ? html`<${Tag} kind="brand">${c.hackathons.length} verified hackathon${c.hackathons.length > 1 ? "s" : ""}<//>` : null}</div>
    </div>
    <div style="text-align:right"><div class="pct">${c.match}%</div><div class="meta">match</div></div>
  </a>`;
}

function ReportView({ r, listing }) {
  const repos = [...new Set(r.evidence.map((e) => e.repo_full_name))];
  const forThis = listing && r.status === "done" ? r.matches.find((m) => m.listing_id === listing.id) : null;
  return html`<div class="fade">
    <div class="card">
      <div class="profile"><${Avatar} username=${r.student.github_username} size="lg" /><div class="who"><h1 class="h1">${r.student.name}</h1><div class="small muted">${r.student.college} · <a href=${githubUser(r.student.github_username)} target="_blank" rel="noopener noreferrer">@${r.student.github_username}</a></div></div></div>
      ${r.status === "done" ? html`<div class="overall" style="margin-top:1.25rem"><div><div class="k">Overall score</div><div class="score">${r.overall}<small>/ 100</small></div></div><div class="facts"><${Tag} kind="ok">Verified by viva<//>${repos.map((x) => html`<${Tag} plain kind="outline">${repoName(x)}<//>`)}<${Tag} plain kind="outline">${count(r.evidence.length, "answer")} with evidence<//></div></div>` : null}
    </div>
    ${r.status !== "done" ? html`<div class="section"><${Banner} kind="info">This student hasn't finished a viva yet, so there are no scores to show.<//></div>` : html`
      ${forThis ? html`<div class="section"><${MatchCard} m=${forThis} listing=${listing} top=${true} /></div>` : null}
      <${Section} title="Verified skills" note="From their answers. 70 and up is strong, 40 to 69 partial."><${SkillRows} skills=${r.skills} /><//>
      <${Section} title="Claimed and verified" note="Only skills shown in the viva count toward matches."><${ClaimsList} rows=${r.claimed_vs_verified} who="them" /><//>
      ${r.hackathons.length ? html`<${Section} title="Hackathons" note="Verified when the student finishes a viva on its repo. On team repos the questions are about the files they changed."><${HackathonList} items=${r.hackathons} who="them" /><//>` : null}
      <${Section} title="Answers" note="Each question was about the code shown beside it."><div class="evidence">${r.evidence.map((e, i) => html`<${EvidenceSheet} e=${e} i=${i} who="them" />`)}</div><//>
      ${r.build_history ? html`<${Section} title="How the repo was built" note="Facts from GitHub. They don't change the score."><${BuildHistory} bh=${r.build_history} who="them" /><//>` : null}
      <${Section} title="Matches across all internships"><div class="list">${r.matches.map((m) => html`<div class="item"><span class="pct" style="font-size:1rem;font-weight:600;min-width:3rem">${m.match}%</span><div class="item-main"><div class="item-title">${m.title}, ${m.venture}</div><div class="item-sub">${m.why}</div></div><span class="item-trail">${m.applied ? html`<${Tag} kind="ok">Applied<//>` : null}</span></div>`)}</div><//>`}
  </div>`;
}

function Shortlist({ listingId, initialSelected, onBadKey }) {
  const wide = useMedia("(min-width: 1200px)");
  const { loading, data: sl, error, live } = usePoll(() => api(`/api/admin/shortlist/${enc(listingId)}`, { admin: true }), [listingId]);
  const [listing, setListing] = useState(null);
  const [selected, setSelected] = useState(initialSelected);
  const [detail, setDetail] = useState({ id: null, loading: false, report: null, error: null });
  const [fresh, setFresh] = useState(new Set());
  const known = useRef(null);
  const [csvBusy, setCsvBusy] = useState(false);
  useEffect(() => { api("/api/listings").then((x) => setListing(x.listings.find((l) => l.id === listingId) || null)).catch(() => {}); }, [listingId]);
  useEffect(() => { if (error && error.code === "BAD_ADMIN_KEY") onBadKey(error.message); }, [error]);

  // New applicants: a toast and a short highlight
  useEffect(() => {
    if (!sl) return;
    const ids = sl.candidates.map((c) => c.student_id);
    const f = new Set(known.current ? ids.filter((id) => !known.current.has(id)) : []);
    known.current = new Set(ids);
    if (f.size) {
      setFresh(f);
      const names = sl.candidates.filter((c) => f.has(c.student_id)).map((c) => c.name).join(", ");
      toast(`New applicant: ${names}`, { actionText: wide ? "View" : null, onAction: () => select([...f][0]) });
      setTimeout(() => setFresh(new Set()), 2500);
    }
    if (wide && ids.length && (!selected || !ids.includes(selected))) select(ids[0]);
    else if (wide && selected && detail.id !== selected) select(selected);
  }, [sl, wide]);

  const select = (id) => {
    setSelected(id);
    history.replaceState(null, "", `#/listing/${enc(listingId)}?c=${enc(id)}`);
    setDetail({ id, loading: true, report: null, error: null });
    api(`/api/report/${enc(id)}`).then((report) => setDetail((d) => (d.id === id ? { id, loading: false, report, error: null } : d))).catch((e) => setDetail((d) => (d.id === id ? { id, loading: false, report: null, error: e } : d)));
  };

  if (error && !sl) return html`<${Banner}>${error.message}<//>`;
  if (loading) return html`<div class="stack"><${Skeleton} w="40%" h="1.5rem" /><${SkeletonList} rows=${4} /></div>`;
  const head = html`<${PageHead} back=${["#/", "All internships"]} title=${sl.listing.title} lead=${`${sl.listing.venture}. ${sl.candidates.length ? `${count(sl.candidates.length, "applicant")}, ranked` : "Ranked"} by match on verified skills and verified hackathons, then by overall score.`} action=${sl.candidates.length ? html`<${Button} kind="secondary" icon="download" busy=${csvBusy} onClick=${() => downloadCsv(listingId, setCsvBusy)}>Download CSV<//>` : null} />`;
  if (!sl.candidates.length) return html`<div class="fade" data-live=${live}>${head}<div class="list"><${Empty} icon="users" title="No applicants yet" text="Students appear here the moment they apply and agree to share their report. This page updates by itself." /></div></div>`;
  return html`<div class="fade" data-live=${live}>${head}
    <div class="split">
      <div class="list split-list">${sl.candidates.map((c) => html`<${Candidate} key=${c.student_id} c=${c} listingId=${listingId} wide=${wide} selected=${wide && c.student_id === selected} isNew=${fresh.has(c.student_id)} onSelect=${select} />`)}</div>
      ${wide ? html`<div class="split-detail">${detail.loading ? html`<div class="stack"><${Skeleton} w="40%" h="1.5rem" /><${Skeleton} h="8rem" /><${SkeletonList} rows=${4} /></div>` : detail.error ? html`<${Banner}>${detail.error.message}<//>` : detail.report ? html`<${ReportView} r=${detail.report} listing=${listing || sl.listing} />` : null}</div>` : null}
    </div>
  </div>`;
}

function CandidatePage({ studentId, listingId }) {
  const [st, setSt] = useState({ loading: true, report: null, listing: null, error: null });
  useEffect(() => {
    setSt({ loading: true, report: null, listing: null, error: null });
    Promise.all([api(`/api/report/${enc(studentId)}`), api("/api/listings").then((x) => x.listings).catch(() => [])])
      .then(([report, listings]) => setSt({ loading: false, report, listing: listings.find((l) => l.id === listingId) || null, error: null }))
      .catch((error) => setSt({ loading: false, report: null, listing: null, error }));
    window.scrollTo(0, 0);
  }, [studentId, listingId]);
  const back = html`<div class="page-head"><a class="back" href=${listingId ? `#/listing/${enc(listingId)}` : "#/"}><${Icon} name="arrow-left" size="sm" />${listingId ? "Back to applicants" : "All internships"}</a></div>`;
  if (st.error) return html`${back}<${Banner}>${st.error.message}<//>`;
  if (st.loading) return html`${back}<div class="stack"><${Skeleton} w="40%" h="1.5rem" /><${Skeleton} h="8rem" /><${SkeletonList} rows=${4} /></div>`;
  return html`${back}<${ReportView} r=${st.report} listing=${st.listing} />`;
}

// ---------- App ----------

function App() {
  const { parts, query } = useHash();
  const [, bump] = useState(0);
  const [message, setMessage] = useState(null);
  const refresh = () => bump((x) => x + 1);
  const signOut = (msg) => { session.del(KEY); setMessage(msg || null); go("#/", true); refresh(); };
  if (!session.get(KEY)) return html`<${Shell} signedIn=${false}><${SignIn} message=${message} onDone=${() => { setMessage(null); refresh(); }} /><//>`;
  let view;
  if (parts[0] === "listing" && parts[1]) view = html`<${Shortlist} key=${parts[1]} listingId=${decodeURIComponent(parts[1])} initialSelected=${query.get("c")} onBadKey=${signOut} />`;
  else if (parts[0] === "candidate" && parts[1]) view = html`<${CandidatePage} studentId=${decodeURIComponent(parts[1])} listingId=${query.get("listing")} />`;
  else view = html`<${Listings} onBadKey=${signOut} />`;
  return html`<${Shell} signedIn=${true} onSignOut=${() => signOut()} wide=${true}>${view}<//>`;
}

render(html`<${App} />`, document.getElementById("root"));
