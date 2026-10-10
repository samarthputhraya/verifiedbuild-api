"use strict";
// VerifiedBuild student app (web):
// sign up → pick a repo → "what we found" → 5 questions (voice or text) → report → apply.
// Plain JavaScript, no build step. Shared components live in /common.js (the VB object).

const { h, enc, chip, api, icon, shape, button, levelOf, repoName, TAG_NAME, TAG_ICON, RESULT_LABEL, INTERESTS, SKILL_CHIPS } = VB;
const local = VB.store(window.localStorage);
const tab = VB.store(window.sessionStorage);
const app = document.getElementById("app");
const nav = document.getElementById("nav");
const accountButton = document.getElementById("account");
VB.watchScroll(document.getElementById("appbar"));

const RETRYABLE = new Set(["AI_FAILED", "NETWORK", "DB_UNAVAILABLE", "DB_ERROR", "INTERNAL", "HTTP_500", "HTTP_502", "HTTP_503", "HTTP_504"]);
const MAX_RECORDING_S = 120;
const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

let viewToken = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ticker = null; // the viva timer

const me = {
  id: () => local.get("vb_student_id"),
  name: () => local.get("vb_student_name") || "",
  github: () => local.get("vb_github") || "",
  save(id, name, github) { local.set("vb_student_id", id); local.set("vb_student_name", name); local.set("vb_github", github); },
  forget() { ["vb_student_id", "vb_student_name", "vb_github"].forEach((k) => local.del(k)); tab.del("vb_last_analysis"); },
};

// ---------- Frame ----------

const NAV = [["home", "Home", "home"], ["repos", "Verify", "code"], ["internships", "Internships", "work"], ["report", "Report", "verified"]];

function frame(page) {
  // page: which nav item is current, or null for focus screens (sign-up, analyzing, viva) with no navigation
  const showNav = page !== null && page !== "viva" && !!me.id();
  document.body.classList.toggle("has-nav", showNav);
  nav.hidden = !showNav;
  if (showNav) {
    nav.replaceChildren(...NAV.map(([id, label, iconName]) => h("a", { class: "nav-item", href: `#/${id}`, "aria-current": id === page ? "page" : null },
      h("span", { class: "pill" }, icon(iconName)), h("span", {}, label))));
  }
  accountButton.hidden = !me.id();
  if (me.id() && !accountButton.firstChild) accountButton.append(VB.avatar(me.github()));
  app.className = page === "viva" ? "page focus" : "page";
  document.body.classList.toggle("focus-mode", page === "viva");
}

function go(hash, replace = false) {
  if (replace) location.replace(hash); else location.hash = hash;
}

function paint(token, ...nodes) {
  if (token !== viewToken) return false;
  app.replaceChildren(...nodes.flat().filter((n) => n !== null && n !== undefined && n !== false));
  window.scrollTo(0, 0);
  return true;
}

const head = (title, sub, back) => h("div", { class: "page-head" },
  back ? h("a", { class: "btn text back", href: back[0] }, icon("arrow_back"), back[1]) : null,
  h("h1", { class: "headline-l" }, title),
  sub ? h("p", { class: "body-l var" }, sub) : null);

const section = (title, ...children) => h("section", { class: "section" }, h("div", { class: "section-head" }, h("h2", { class: "title-l" }, title)), children);

function normaliseUsername(raw) {
  const s = (raw || "").trim().replace(/^https?:\/\//i, "").replace(/^(www\.)?github\.com\//i, "").replace(/^@/, "");
  return s.split("/")[0];
}

function normaliseRepo(raw) {
  const s = (raw || "").trim().replace(/^https?:\/\//i, "").replace(/^(www\.)?github\.com\//i, "");
  const [owner, name] = s.split("/");
  return owner && name ? `${owner}/${name.replace(/\.git$/, "")}` : s;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// ---------- Sign up: four short steps ----------

function showSignup(token, message) {
  frame(null);
  const state = { step: 0, found: null, interests: new Set(), skills: new Set(), resume: null };
  const gh = VB.textField({ id: "github", label: "GitHub username", prefix: "github.com/", attrs: { maxlength: "100", autocapitalize: "off", autocomplete: "username", spellcheck: "false", inputmode: "url" }, support: "We only read your public repos." });
  const name = VB.textField({ id: "name", label: "Full name", attrs: { maxlength: "100", autocomplete: "name" } });
  const email = VB.textField({ id: "email", label: "Email", type: "email", attrs: { maxlength: "200", autocomplete: "email", inputmode: "email" } });
  const college = VB.textField({ id: "college", label: "College", attrs: { maxlength: "150", autocomplete: "organization" } });
  const card = h("div", { class: "step-card" });
  const topError = h("div", {});
  let checkTimer = null;
  let checkSeq = 0;

  async function checkGithub() {
    const u = normaliseUsername(gh.input.value);
    const seq = ++checkSeq;
    state.found = null;
    gh.box.querySelector(".trail")?.remove();
    if (!u) return gh.setSupport("We only read your public repos.");
    if (!USERNAME_RE.test(u)) return gh.setError("A GitHub username has letters, numbers and dashes only.");
    gh.setSupport("Checking GitHub…");
    try {
      const r = await api(`/api/github/${enc(u)}/repos`);
      if (seq !== checkSeq) return;
      state.found = { username: u, repos: r.repos.length };
      gh.box.append(h("span", { class: "trail" }, VB.avatar(u)));
      gh.setOk(r.repos.length ? `Found @${u}, with ${VB.count(r.repos.length, "public repo")}.` : `Found @${u}. Push a project to GitHub so we can verify it.`);
    } catch (e) {
      if (seq !== checkSeq) return;
      if (e.code === "GITHUB_USER_NOT_FOUND") gh.setError("We couldn't find that GitHub username.");
      else { state.found = { username: u, repos: null }; gh.setSupport("We'll check this username when you sign up."); }
    }
  }
  gh.input.addEventListener("input", () => {
    // A pasted profile link becomes just the username
    if (/github\.com\/|^https?:|^@/i.test(gh.input.value)) gh.input.value = normaliseUsername(gh.input.value);
    clearTimeout(checkTimer);
    checkTimer = setTimeout(checkGithub, 450);
  });

  // Resume: a drop zone, or skill chips
  const fileInput = h("input", { type: "file", id: "resume", accept: "application/pdf", class: "sr-only" });
  const resumeError = h("div", { class: "field-support", role: "alert" });
  const resumeArea = h("div", {});
  const resumeField = h("div", { class: "field" }, fileInput, resumeArea, resumeError);
  function drawResume() {
    resumeArea.replaceChildren(state.resume
      ? h("div", { class: "file-pill" }, icon("description"), h("span", { class: "name" }, state.resume.name),
        h("button", { class: "icon-btn", type: "button", "aria-label": "Remove resume", onclick: () => { state.resume = null; fileInput.value = ""; setResumeError(""); drawResume(); } }, icon("close")))
      : h("label", { class: "drop", for: "resume" }, icon("upload_file", "lg"), h("span", { class: "title-s" }, "Upload your resume"), h("span", { class: "body-s var" }, "PDF, under 5 MB. We read the skills it lists.")));
  }
  function setResumeError(text) {
    resumeError.replaceChildren(...(text ? [icon("error"), h("span", {}, text)] : []));
    resumeField.classList.toggle("invalid", !!text);
  }
  fileInput.addEventListener("change", async () => {
    const f = fileInput.files && fileInput.files[0];
    state.resume = null;
    setResumeError("");
    if (f && f.type && f.type !== "application/pdf") { setResumeError("That file isn't a PDF. Upload your resume as a PDF, or pick your skills below."); fileInput.value = ""; }
    else if (f && f.size > 5 * 1024 * 1024) { setResumeError("That PDF is over 5 MB. Upload a smaller copy, or pick your skills below."); fileInput.value = ""; }
    else if (f) state.resume = { base64: await readFileAsBase64(f), name: f.name };
    drawResume();
  });
  drawResume();

  const steps = [
    {
      title: "What's your GitHub?",
      sub: "Your questions come from code in your own public repos.",
      body: () => gh.wrap,
      next() {
        const u = normaliseUsername(gh.input.value);
        if (!USERNAME_RE.test(u)) { gh.setError("Enter your GitHub username, like asharao."); gh.input.focus(); return false; }
        if (gh.wrap.classList.contains("invalid")) { gh.input.focus(); return false; }
        return true;
      },
      focus: () => gh.input,
    },
    {
      title: "About you",
      sub: "Recruiters see this only on reports you choose to share.",
      body: () => h("div", { class: "fields" }, name.wrap, email.wrap, college.wrap),
      next() {
        let ok = true;
        if (!name.input.value.trim()) { name.setError("Enter your name."); ok = false; } else name.setSupport("");
        if (!EMAIL_RE.test(email.input.value.trim())) { email.setError("Enter an email like name@college.edu."); ok = false; } else email.setSupport("");
        if (!college.input.value.trim()) { college.setError("Enter your college."); ok = false; } else college.setSupport("");
        if (!ok) card.querySelector("[aria-invalid='true']")?.focus();
        return ok;
      },
      focus: () => name.input,
    },
    {
      title: "What are you into?",
      sub: "Pick at least one. Internships with the same tags rank higher.",
      body: () => VB.filterChips(INTERESTS, state.interests, "Interests", () => interestError.replaceChildren()),
      next() {
        if (state.interests.size) return true;
        interestError.replaceChildren(icon("error"), h("span", {}, "Pick at least one interest."));
        return false;
      },
    },
    {
      title: "Your skills",
      sub: "These are what you claim. The viva checks them, and only what you show counts.",
      body: () => h("div", { class: "fields" },
        resumeField,
        h("div", { class: "or" }, "Or pick your skills"),
        VB.filterChips(SKILL_CHIPS.map((s) => [s, s]), state.skills, "Skills", () => skillError.replaceChildren())),
      next: () => true,
    },
  ];
  const interestError = h("div", { class: "field-support", role: "alert" });
  const skillError = h("div", { class: "field-support", role: "alert" });

  const submit = button("Create my profile", { kind: "lg", iconName: "check" });
  async function send(useResume) {
    topError.replaceChildren();
    skillError.replaceChildren();
    setResumeError("");
    if (!(useResume && state.resume) && !state.skills.size) {
      skillError.replaceChildren(icon("error"), h("span", {}, "Upload your resume or pick at least one skill."));
      return;
    }
    submit.disabled = true;
    submit.replaceChildren(icon("schedule"), useResume && state.resume ? "Reading your resume…" : "Creating your profile…");
    try {
      const r = await api("/api/students", {
        method: "POST",
        body: {
          name: name.input.value.trim(), email: email.input.value.trim(), college: college.input.value.trim(),
          github_username: normaliseUsername(gh.input.value), interests: [...state.interests], skills: state.skills.size ? [...state.skills] : null,
          resume_base64: useResume && state.resume ? state.resume.base64 : null, resume_mime: useResume && state.resume ? "application/pdf" : null,
        },
      });
      me.save(r.student_id, name.input.value.trim(), r.github_username);
      if (location.hash === "#/home") render(); else go("#/home", true); // a hash change renders by itself
    } catch (e) {
      if (e.code === "GITHUB_USER_NOT_FOUND") { state.step = 0; draw(); gh.setError(e.message); return; }
      if (e.code === "RESUME_UNREADABLE") {
        setResumeError(e.message);
        if (state.skills.size) {
          topError.replaceChildren(VB.banner(e.message, { action: button("Continue with my picked skills", { kind: "text", onclick: () => { state.resume = null; drawResume(); send(false); } }) }));
        }
        return;
      }
      topError.replaceChildren(VB.banner(e.message));
    } finally {
      submit.disabled = false;
      submit.replaceChildren(icon("check"), "Create my profile");
    }
  }
  submit.addEventListener("click", () => send(true));

  function draw() {
    const st = steps[state.step];
    const last = state.step === steps.length - 1;
    const nextBtn = last ? submit : button("Next", { kind: "lg", iconAfter: "arrow_forward", onclick: () => { if (st.next()) { state.step += 1; draw(); } } });
    card.replaceChildren(
      h("div", { class: "step-top" },
        VB.stepsBar(steps.length, state.step, state.step),
        h("span", { class: "label-m step-count" }, `Step ${state.step + 1} of ${steps.length}`),
        h("h2", { class: "headline-m" }, st.title),
        h("p", { class: "body-m var" }, st.sub)),
      h("form", { class: "fields", novalidate: true, onsubmit: (ev) => { ev.preventDefault(); if (last) send(true); else if (st.next()) { state.step += 1; draw(); } } },
        st.body(),
        state.step === 2 ? interestError : null,
        last ? skillError : null,
        topError,
        h("div", { class: "actions" }, state.step > 0 ? button("Back", { kind: "text", iconName: "arrow_back", onclick: () => { state.step -= 1; draw(); } }) : null, h("span", { class: "spacer" }), nextBtn)));
    const f = st.focus && st.focus();
    if (f) setTimeout(() => f.focus(), 0);
  }
  draw();

  const fact = (iconName, text) => h("div", { class: "fact" }, icon(iconName), h("span", { class: "body-l" }, text));
  const sample = VB.seal({ skills: { backend: 82, frontend: 58, data: 71, ai_ml: 44, devops: 63 }, seed: "verifiedbuild", size: 128 });
  paint(token,
    message ? VB.banner(message, { kind: "info", iconName: "info" }) : null,
    h("div", { class: "signup" },
      h("div", { class: "signup-hero" },
        sample,
        h("h1", { class: "display-m" }, "Show what you can really build."),
        h("p", { class: "body-l var" }, "Pick one of your GitHub repos and answer 5 questions about your own code. Internships are matched on the skills you show, not the ones you list."),
        h("div", { class: "facts" },
          fact("mic", "Speak or type, in any language"),
          fact("timer", "5 questions, about 8 minutes"),
          fact("lock", "Private until you apply"))),
      card));
}

// ---------- Home ----------

function hackathonDialog(repos) {
  return new Promise((resolve) => {
    const event = VB.textField({ id: "h-event", label: "Hackathon name", attrs: { maxlength: "120", placeholder: "e.g. Smart India Hackathon" } });
    const year = VB.textField({ id: "h-year", label: "Year", type: "number", value: String(new Date().getFullYear()), attrs: { min: "2000", max: "2100", inputmode: "numeric" } });
    const result = VB.selectField({ id: "h-result", label: "Result", options: ["winner", "finalist", "participant"].map((r) => [r, RESULT_LABEL[r]]), value: "participant" });
    const team = VB.textField({ id: "h-team", label: "Team size", type: "number", value: "1", attrs: { min: "1", max: "20", inputmode: "numeric" } });
    const repo = VB.selectField({ id: "h-repo", label: "Project repo", options: [["", repos.length ? "Pick one of your repos" : "No public repos found"], ...repos.map((r) => [r.full_name, r.full_name])], value: "" });
    const other = VB.textField({ id: "h-other", label: "Or a team repo (owner/repo)", support: "You need commits in it. Your viva will ask about the files you changed.", attrs: { autocapitalize: "off", spellcheck: "false" } });
    const error = h("div", {});
    const save = h("button", { class: "btn", type: "submit" }, "Add hackathon");
    const d = h("dialog", { "aria-labelledby": "h-title" },
      h("form", {
        novalidate: true,
        onsubmit: async (ev) => {
          ev.preventDefault();
          error.replaceChildren();
          const full = normaliseRepo(other.input.value) || repo.select.value;
          if (!event.input.value.trim()) { event.setError("Enter the hackathon's name."); return; }
          if (!REPO_RE.test(full)) { other.setError("Pick one of your repos, or type a team repo as owner/repo."); return; }
          save.disabled = true;
          try {
            await api(`/api/students/${enc(me.id())}/hackathons`, {
              method: "POST",
              body: { event: event.input.value.trim(), year: Number(year.input.value), result: result.select.value, team_size: Number(team.input.value), repo_full_name: full },
            });
            d.close("saved");
          } catch (e) {
            error.replaceChildren(VB.banner(e.message));
          } finally {
            save.disabled = false;
          }
        },
      },
        h("span", { class: "dialog-icon" }, icon("emoji_events")),
        h("h2", { id: "h-title" }, "Add a hackathon"),
        h("p", {}, "It counts toward your matches once you finish a viva on its repo."),
        h("div", { class: "fields" }, event.wrap, h("div", { class: "actions" }, h("div", { class: "spacer" }, year.wrap), h("div", { class: "spacer" }, team.wrap)), result.wrap, repo.wrap, other.wrap),
        error,
        h("div", { class: "actions" }, h("button", { class: "btn text", type: "button", onclick: () => d.close("cancel") }, "Cancel"), save)));
    d.addEventListener("close", () => { d.remove(); resolve(d.returnValue === "saved"); });
    document.body.append(d);
    d.showModal();
    event.input.focus();
  });
}

async function showHome(token) {
  frame("home");
  paint(token, VB.loadingView("Loading your profile…"));
  let report;
  try {
    report = await api(`/api/report/${enc(me.id())}`);
  } catch (e) {
    if (e.code === "STUDENT_NOT_FOUND") { me.forget(); return showSignup(token, "We couldn't find your profile. Please sign up again."); }
    throw e;
  }
  const [repos, listings] = await Promise.all([
    api(`/api/github/${enc(me.github())}/repos`).then((r) => r.repos).catch(() => []),
    api("/api/listings").then((r) => r.listings).catch(() => []),
  ]);
  const byId = Object.fromEntries(listings.map((l) => [l.id, l]));
  const first = (me.name() || report.student.name).split(" ")[0];
  const inProgress = report.viva_in_progress;
  const done = report.status === "done";

  const hero = done
    ? h("div", { class: "card hero" },
      h("div", { class: "hero-row" },
        h("div", { class: "fields" },
          h("h2", { class: "headline-s" }, "Your verified profile"),
          VB.skillBadges(report.skills, { only: (x) => x.score !== undefined })),
        VB.scoreSeal(report, 112)),
      h("div", { class: "actions" }, button("View report", { href: "#/report", iconName: "verified" }), button("Verify another repo", { href: "#/repos", kind: "tonal" })))
    : h("div", { class: "card hero" },
      h("div", { class: "hero-row" }, h("h2", { class: "headline-s" }, "Verify your skills"), VB.seal({ empty: true, size: 84, seed: report.student.github_username })),
      VB.pipeline([
        { state: "queued", label: "Pick one of your GitHub repos", sub: "Or a team repo you committed to" },
        { state: "queued", label: "Answer 5 questions about its code", sub: "Out loud or typed, in any language" },
        { state: "queued", label: "Get matched on what you showed", sub: "Verified skills, interests and hackathons" }]),
      h("div", { class: "actions" }, button("Pick a repo", { href: "#/repos", kind: "lg", iconAfter: "arrow_forward" })));

  const continueCard = inProgress ? h("div", { class: "card tertiary" },
    h("div", { class: "hero-row" },
      h("div", { class: "fields" },
        h("h2", { class: "title-l" }, "Finish your viva"),
        h("p", { class: "body-m" }, `${repoName(inProgress.repo_full_name)}: ${inProgress.answered} of ${inProgress.total} answered. Your answers so far are saved.`)),
      VB.ring((inProgress.answered / inProgress.total) * 100, { size: 56, label: `${inProgress.answered} of ${inProgress.total} answered`, children: h("span", { class: "label-l" }, `${inProgress.answered}/${inProgress.total}`) })),
    h("div", { class: "actions" }, button("Continue", { iconAfter: "arrow_forward", onclick: () => { tab.set("vb_session_id", inProgress.session_id); go("#/viva"); } }))) : null;

  const addHack = button("Add a hackathon", { kind: "tonal", iconName: "add", onclick: async () => { if (await hackathonDialog(repos)) { VB.snackbar("Hackathon added. Verify it with a viva on its repo."); render(); } } });
  const hacks = report.hackathons.length
    ? VB.hackathonList(report.hackathons, "you", (x) => [
      x.verified ? null : button("Verify now", { kind: "text", onclick: () => go(`#/analyzing?repo=${enc(x.repo_full_name)}`) }),
      h("button", {
        class: "icon-btn", type: "button", "aria-label": `Remove ${x.event} ${x.year}`,
        onclick: async () => {
          if (!await VB.confirm({ title: `Remove ${x.event} ${x.year}?`, text: "This takes it off your profile and out of your matches.", confirmText: "Remove", iconName: "delete", danger: true })) return;
          try { await api(`/api/students/${enc(me.id())}/hackathons/${enc(x.hackathon_id)}`, { method: "DELETE" }); VB.snackbar("Hackathon removed."); render(); } catch (e) { VB.snackbar(e.message); }
        },
      }, icon("delete"))])
    : h("p", { class: "body-m var" }, "Add the hackathons you've done. Each one counts toward your matches once you verify it with a viva on its repo.");

  const jobs = done
    ? h("div", { class: "matches" }, report.matches.slice(0, 2).map((m, i) => VB.matchCard(m, byId[m.listing_id], { top: i === 0, report })),
      h("div", {}, button("See all internships", { href: "#/internships", kind: "text", iconAfter: "arrow_forward" })))
    : [h("p", { class: "section-note" }, "Finish a viva to see how well you match each one."),
      h("div", { class: "list" }, listings.map((l) => h("div", { class: "li" },
        shape("cookie6", 40, "secondary", h("span", { class: "label-l" }, l.venture.slice(0, 1))),
        h("div", { class: "li-main" }, h("div", { class: "title-m" }, l.title), h("div", { class: "li-meta" }, l.venture)),
        h("span", {}))))];

  paint(token,
    h("div", { class: "hello" }, VB.avatar(report.student.github_username, "lg"),
      h("div", {}, h("h1", { class: "headline-m" }, `Hi, ${first}`), h("div", { class: "li-meta body-m" }, h("span", {}, `@${report.student.github_username}`), h("span", {}, report.student.college)))),
    h("div", { class: "fields" }, continueCard, hero),
    h("section", { class: "section" }, h("div", { class: "section-head" }, h("h2", { class: "title-l" }, "Your hackathons"), addHack), hacks),
    section("Internships", jobs));
}

// ---------- Pick a repo ----------

async function showRepos(token) {
  frame("repos");
  paint(token, VB.loadingView("Loading your repos…"));
  const { repos } = await api(`/api/github/${enc(me.github())}/repos`);
  const pick = async (full) => {
    if (await VB.confirm({
      title: `Verify ${repoName(full)}?`,
      text: "We'll read the code and ask you 5 questions about it. Answer by speaking or typing, in any language. Each question has 90 seconds.",
      confirmText: "Start", iconName: "verified",
    })) go(`#/analyzing?repo=${enc(full)}`);
  };
  const search = VB.textField({ id: "repo-search", label: "Search your repos", attrs: { autocapitalize: "off", spellcheck: "false" }, trail: icon("search") });
  const list = h("div", { class: "list" });
  const LANG_TINTS = ["primary", "tertiary", "strong", "partial", "secondary"];
  const langs = [...new Set(repos.map((r) => r.language || "Code"))];
  const drawList = () => {
    const q = search.input.value.trim().toLowerCase();
    const shown = repos.filter((r) => !q || r.full_name.toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q));
    list.replaceChildren(...(shown.length ? shown.map((r) => h("button", { class: "li", type: "button", onclick: () => pick(r.full_name) },
      shape("cookie9", 48, LANG_TINTS[langs.indexOf(r.language || "Code") % LANG_TINTS.length], icon("code")),
      h("div", { class: "li-main" },
        h("div", { class: "title-m" }, repoName(r.full_name)),
        h("div", { class: "body-m var clamp-2" }, r.description || "No description"),
        h("div", { class: "li-meta" }, h("span", {}, r.language || "Code"), h("span", {}, `${r.stars} ★`), h("span", {}, `Updated ${(r.pushed_at || "").slice(0, 10)}`))),
      h("span", { class: "li-trail" }, icon("chevron_right"))))
      : [h("div", { class: "li" }, icon("search"), h("div", { class: "li-main" }, h("div", { class: "body-m" }, q ? `No repos match "${q}".` : `No public repos found on @${me.github()}. Push a project to GitHub, then reload this page.`)), h("span", {}))]));
  };
  search.input.addEventListener("input", drawList);
  drawList();

  const team = VB.textField({ id: "team-repo", label: "Team repo (owner/repo)", support: "A teammate's or organisation's repo you have commits in. Your questions will be about the files you changed.", attrs: { autocapitalize: "off", spellcheck: "false" } });
  paint(token,
    head("Pick a repo", "Pick a project you built, so you can answer questions about its code."),
    repos.length > 6 ? search.wrap : null,
    list,
    h("section", { class: "section" },
      h("div", { class: "card outlined" },
        h("div", { class: "section-head" }, shape("cookie6", 40, "tertiary", icon("group")), h("h2", { class: "title-l" }, "Verify a team repo instead")),
        h("form", {
          class: "fields", novalidate: true,
          onsubmit: (ev) => {
            ev.preventDefault();
            const repo = normaliseRepo(team.input.value);
            if (!REPO_RE.test(repo)) { team.setError("Type it as owner/repo, like your-team/hackathon-app."); return; }
            go(`#/analyzing?repo=${enc(repo)}`);
          },
        }, team.wrap, h("div", { class: "actions end" }, button("Start", { type: "submit", iconAfter: "arrow_forward" }))))));
}

// ---------- Analyzing and "What we found" ----------

async function showAnalyzing(token, repo) {
  frame(null);
  const clock = h("span", { class: "num" }, "0:00");
  const started = Date.now();
  const clockTimer = setInterval(() => { if (!clock.isConnected) return clearInterval(clockTimer); clock.textContent = fmt((Date.now() - started) / 1000); }, 500);
  const stages = [
    { state: "run", label: "Read the repo", sub: "Download it, then skip libraries, build output and generated files" },
    { state: "queued", label: "Find the skills it shows", sub: "Rank files by how often other files import them" },
    { state: "queued", label: "Write 5 questions", sub: "Each one about real lines in your files" },
  ];
  const status = h("span", { class: "status run" }, h("span", { class: "dot" }), "Running ", clock);
  const pipeHost = h("div", {}, VB.pipeline(stages));
  paint(token, h("div", { class: "center-stage" },
    h("h1", { class: "headline-l" }, `Reading ${repoName(repo)}`),
    h("p", { class: "body-l var" }, "This usually takes 15 to 30 seconds. Keep this page open."),
    h("div", { class: "run-card", role: "status", "aria-label": `Reading ${repo}` },
      h("div", { class: "run-head" }, VB.brandMark(), h("span", { class: "mono" }, `verify ${repo}`), status),
      pipeHost,
      VB.scanner(repo))));
  try {
    const a = await api("/api/analyze", { method: "POST", body: { student_id: me.id(), repo_full_name: repo } });
    if (token !== viewToken) return;
    tab.set("vb_last_analysis", JSON.stringify(a));
    tab.set("vb_session_id", a.session_id);
    viva.start(a);
    // Every step is finished now: fill each one in with what the API actually found
    clearInterval(clockTimer);
    const langs = Object.entries(a.repo.languages).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([n, v]) => `${n} ${v}%`).join(", ");
    const done = [
      { state: "pass", label: "Read the repo", sub: `Kept ${VB.count(a.repo.files_read, "file")}${langs ? `: ${langs}` : ""}` },
      { state: "pass", label: "Find the skills it shows", sub: a.repo_skills.map((x) => TAG_NAME[x.tag] || x.tag).join(", ") || "None found" },
      { state: "pass", label: "Write 5 questions", sub: `${VB.count(a.questions.length, "question")} on real lines` },
    ];
    status.className = "status pass";
    status.replaceChildren(h("span", { class: "dot" }), `Done in ${fmt((Date.now() - started) / 1000)}`);
    for (let i = 0; i < done.length; i++) {
      pipeHost.replaceChildren(VB.pipeline(done.map((d, j) => (j <= i ? d : { ...stages[j], state: "run" }))));
      await sleep(320);
      if (token !== viewToken) return;
    }
    await sleep(650);
    if (token !== viewToken) return;
    go("#/found", true);
  } catch (e) {
    clearInterval(clockTimer);
    if (token !== viewToken) return;
    paint(token, h("div", { class: "center-stage" },
      h("h1", { class: "headline-l" }, `We couldn't start the viva on ${repoName(repo)}`),
      VB.banner(e.message),
      h("div", { class: "actions" }, button("Try again", { iconName: "refresh", onclick: () => render() }), button("Pick another repo", { kind: "text", href: "#/repos" }))));
  }
}

function showFound(token) {
  frame(null);
  const a = JSON.parse(tab.get("vb_last_analysis") || "null");
  if (!a) return go("#/home", true);
  const langs = Object.entries(a.repo.languages).sort((x, y) => y[1] - x[1]);
  const top = langs.slice(0, 4);
  const other = langs.slice(4).reduce((sum, [, v]) => sum + v, 0);
  if (other > 0) top.push(["Other", Math.round(other * 10) / 10]);
  const bar = h("div", { class: "lang-bar", role: "img", "aria-label": top.map(([n, v]) => `${n} ${v}%`).join(", ") },
    top.map(([, v], i) => { const sp = h("span", { class: `l${i}` }); sp.style.flexGrow = String(v); return sp; }));
  paint(token,
    head(`We read ${repoName(a.repo.full_name)}`, `${VB.count(a.repo.files_read, "file")} read. Here's what your code shows.`),
    h("div", { class: "card" }, bar, h("div", { class: "lang-legend" }, top.map(([n, v], i) => h("span", {}, h("span", { class: `dot l${i}` }), `${n} ${v}%`)))),
    a.contribution.team_repo
      ? h("div", { class: "card tertiary" },
        h("div", { class: "section-head" }, icon("group"), h("h2", { class: "title-m" }, "Team repo")),
        h("p", { class: "body-m" }, `You made ${VB.count(a.contribution.your_commits, "commit")} here. Your questions are about the files you changed:`),
        h("ul", { class: "points" }, a.contribution.focus_files.slice(0, 5).map((f) => h("li", {}, icon("description", "sm"), h("span", { class: "mono" }, f)))))
      : null,
    section("What your code shows",
      h("div", { class: "list" }, a.repo_skills.map((sk) => h("div", { class: "li skill-found" },
        shape("circle", 48, "", icon(TAG_ICON[sk.tag] || "code")),
        h("div", { class: "li-main" }, h("div", { class: "title-m" }, TAG_NAME[sk.tag] || sk.tag), h("div", { class: "body-m var" }, sk.evidence)))))),
    h("div", { class: "section" },
      h("div", { class: "card filled" },
        h("div", { class: "chips" }, chip("5 questions", "fact", "forum"), chip("90 seconds each", "fact", "timer"), chip("Speak or type", "fact", "mic"), chip("Any language", "fact", "translate")),
        h("p", { class: "body-m var" }, "Each question points at specific lines of this code. There are no trick questions, and no score shows until the end.")),
      h("div", { class: "actions end" }, button("Start question 1", { kind: "lg", iconAfter: "arrow_forward", onclick: () => go("#/viva", true) }))));
}

// ---------- The viva ----------

const viva = {
  s: null, // { sessionId, questions, current, followUp, answered, loading, error, failed, done, timeLimit }
  input: { tab: "voice", text: "", pasted: false, shownAt: Date.now(), shownKey: null, rec: null },

  start(a) {
    this.s = { sessionId: a.session_id, questions: a.questions, current: a.questions[0] ? a.questions[0].id : null, followUp: null,
      answered: [], loading: false, error: null, failed: null, done: false, timeLimit: a.time_limit_s || 90 };
    this.resetInput();
  },

  resetInput() {
    this.input = { tab: this.input.tab, text: "", pasted: false, shownAt: Date.now(), shownKey: null, rec: null };
  },

  async resume(sessionId) {
    const v = await api(`/api/viva/${enc(sessionId)}`);
    this.s = { sessionId: v.session_id, questions: v.questions, current: v.status === "done" ? null : v.current_question_id,
      followUp: v.pending_follow_up ? v.pending_follow_up.follow_up : null, answered: v.answered,
      loading: false, error: null, failed: null, done: v.status === "done", timeLimit: 90 };
    this.resetInput();
  },

  async send(body) {
    const s = this.s;
    s.loading = true; s.error = null; s.failed = null;
    try {
      const r = await api(`/api/viva/${enc(s.sessionId)}/answer`, { method: "POST", body });
      if (body.mode === "voice" && r.transcript) VB.snackbar(`Saved. We heard: “${r.transcript}”`, { timeout: 9000 });
      else VB.snackbar(r.follow_up ? "Saved. You get one more chance on this question." : "Answer saved.", { timeout: 3000 });
      if (r.follow_up) {
        s.followUp = r.follow_up;
      } else {
        s.followUp = null;
        if (!s.answered.includes(r.question_id)) s.answered.push(r.question_id);
        s.current = r.next_question_id;
        s.done = r.done;
      }
      this.resetInput();
    } catch (e) {
      if (e.code === "ALREADY_ANSWERED") { await this.resume(s.sessionId); return; }
      s.error = e;
      s.failed = body;
    } finally {
      if (this.s === s) s.loading = false;
    }
  },

  submit(fields) {
    const s = this.s;
    if (!s || !s.current || s.loading) return Promise.resolve();
    return this.send({ question_id: s.current, is_follow_up: s.followUp !== null, ...fields });
  },
};

const recorder = {
  media: null, stream: null, chunks: [], startedAt: 0, mime: "", stopTimer: null, audio: null, analyser: null, frame: 0,
  get active() { return !!this.media; },
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]
      .find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
    this.media = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime } : undefined);
    this.chunks = [];
    this.media.ondataavailable = (ev) => { if (ev.data && ev.data.size) this.chunks.push(ev.data); };
    this.media.start();
    this.startedAt = Date.now();
    this.stopTimer = setTimeout(() => { if (this.active) stopAndKeep(); }, MAX_RECORDING_S * 1000);
    this.listen();
  },
  // The waveform under the mic shows the student's real voice level
  listen() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.audio = new Ctx();
      const src = this.audio.createMediaStreamSource(this.stream);
      this.analyser = this.audio.createAnalyser();
      this.analyser.fftSize = 512;
      src.connect(this.analyser);
      const data = new Uint8Array(this.analyser.fftSize);
      const levels = new Array(28).fill(0); // the last 28 loudness samples, newest on the right
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
          document.querySelectorAll("#wave span").forEach((bar, i) => { bar.style.height = `${Math.max(6, Math.round(levels[i] * 48))}px`; });
        }
        this.frame = requestAnimationFrame(draw);
      };
      this.frame = requestAnimationFrame(draw);
    } catch { /* no waveform, recording still works */ }
  },
  quiet() {
    cancelAnimationFrame(this.frame);
    this.analyser = null;
    if (this.audio) { this.audio.close().catch(() => {}); this.audio = null; }
  },
  stop() {
    return new Promise((resolve) => {
      if (!this.media) return resolve(null);
      const media = this.media;
      const stream = this.stream;
      const chunks = this.chunks;
      this.media = null; // stopped from now on, so a second stop can't throw this recording away
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

async function stopAndKeep() {
  if (!recorder.active) return;
  const rec = await recorder.stop();
  viva.input.rec = rec;
  if (!rec) viva.s.error = { message: "That recording was too short. Please try again.", code: "LOCAL" };
  drawViva();
}

function fmt(seconds) {
  const sec = Math.max(0, Math.round(seconds));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

let timerRing = null;

function comment(kind, meta, ...body) {
  return h("div", { class: `comment ${kind}`.trim() },
    h("span", { class: "comment-mark", "aria-hidden": "true" }, VB.brandMark()),
    h("div", { class: "comment-body" }, h("div", { class: "comment-meta" }, meta), body));
}

function drawViva() {
  const s = viva.s;
  if (!s) return;
  if (s.done) { go("#/done", true); return; }
  const q = s.questions.find((x) => x.id === s.current);
  if (!q) return;
  const key = `${q.id}|${s.followUp || ""}`;
  const fresh = viva.input.shownKey !== key;
  if (fresh) { viva.input.shownKey = key; viva.input.shownAt = Date.now(); } // the clock starts when the question first shows
  const a = JSON.parse(tab.get("vb_last_analysis") || "null");
  const mine = a && a.session_id === s.sessionId && a.contribution.focus_files.includes(q.file);
  const idx = s.questions.findIndex((x) => x.id === q.id);
  const left = s.timeLimit - (Date.now() - viva.input.shownAt) / 1000;
  const busy = s.loading;

  const seg = h("div", { class: "seg", role: "tablist", "aria-label": "How to answer" },
    [["voice", "Speak", "mic"], ["text", "Type", "keyboard"]].map(([id, label, iconName]) => h("button", {
      type: "button", role: "tab", "aria-selected": String(viva.input.tab === id), disabled: busy || recorder.active,
      onclick: () => { viva.input.tab = id; drawViva(); },
    }, icon(iconName), label)));

  let area;
  if (viva.input.tab === "voice") {
    const rec = viva.input.rec;
    timerRing = VB.ring(Math.max(0, left / s.timeLimit) * 100, { size: 136, stroke: 4, label: "Time left" });
    const mic = h("button", {
      type: "button", class: `mic${recorder.active ? " recording" : ""}`, disabled: busy,
      "aria-label": recorder.active ? "Stop recording" : rec ? "Record again" : "Start recording",
      onclick: async () => {
        if (recorder.active) return stopAndKeep();
        viva.s.error = null;
        viva.input.rec = null;
        try { await recorder.start(); } catch {
          viva.s.error = { message: "We couldn't use your microphone. You can type your answer instead.", code: "LOCAL" };
          viva.input.tab = "text";
        }
        drawViva();
      },
    }, icon(recorder.active ? "stop" : "mic"));
    area = h("div", { class: "voice" },
      h("div", { class: "mic-wrap" }, timerRing, mic),
      h("div", { class: `wave${recorder.active ? "" : " idle"}`, id: "wave", "aria-hidden": "true" }, Array.from({ length: 28 }, () => h("span"))),
      h("p", { class: "voice-status body-m", id: "rec-status" }, recorder.active ? "Recording. Tap to stop." : rec ? `Recorded ${fmt(rec.seconds)}. Send it, or tap the mic to record again.` : "Tap the mic and explain in your own words."),
      rec && !recorder.active ? h("div", { class: "actions" },
        button(busy ? "Saving your answer…" : "Send answer", { kind: "lg", iconName: "check", disabled: busy, onclick: () => viva.submit({ mode: "voice", audio_base64: rec.base64, audio_mime: rec.mime, duration_s: rec.seconds }).then(drawViva) })) : null);
  } else {
    timerRing = null;
    const box = VB.textField({ id: "answer", label: "Your answer", multiline: true, attrs: { maxlength: "6000", placeholder: "Explain in your own words. Any language is fine.", disabled: busy } });
    box.input.value = viva.input.text;
    box.input.addEventListener("input", () => { viva.input.text = box.input.value; });
    box.input.addEventListener("paste", () => { viva.input.pasted = true; });
    area = h("div", { class: "fields" }, box.wrap,
      h("div", { class: "actions end" }, button(busy ? "Saving your answer…" : "Send answer", {
        kind: "lg", iconName: "check", disabled: busy,
        onclick: () => {
          if (!viva.input.text.trim()) { viva.s.error = { message: "Type an answer first.", code: "LOCAL" }; return drawViva(); }
          const seconds = Math.min(3600, Math.round((Date.now() - viva.input.shownAt) / 1000));
          return viva.submit({ mode: "text", answer_text: viva.input.text, duration_s: seconds, pasted: viva.input.pasted }).then(drawViva);
        },
      })));
  }

  const err = s.error;
  const errorBox = err ? VB.banner(err.message, {
    action: RETRYABLE.has(err.code) && s.failed ? button("Try again", { kind: "text", iconName: "refresh", onclick: () => viva.send(s.failed).then(drawViva) }) : null,
  }) : null;

  app.replaceChildren(
    h("div", { class: "viva-bar" },
      h("div", { class: "row" },
        h("button", {
          class: "icon-btn", type: "button", "aria-label": "Leave the viva",
          onclick: async () => {
            if (await VB.confirm({ title: "Leave the viva?", text: "Your answers so far are saved. You can continue from your home page.", confirmText: "Leave", iconName: "logout" })) {
              recorder.discard();
              go("#/home");
            }
          },
        }, icon("close")),
        h("span", { class: "title-m" }, `Question ${idx + 1} of ${s.questions.length}`),
        h("span", { class: "spacer" }),
        h("span", { class: "timer", id: "timer" }, icon("timer", "sm"), h("span", { id: "timer-text" }, fmt(left)))),
      VB.pipeline(s.questions.map((x, i) => ({
        state: s.answered.includes(x.id) ? "done" : x.id === q.id ? "run" : "queued",
        sub: TAG_NAME[x.skill] || x.skill,
        aria: `Question ${i + 1}, ${TAG_NAME[x.skill] || x.skill}: ${s.answered.includes(x.id) ? "answered" : x.id === q.id ? "now" : "next"}`,
      })), { row: true, tests: true, label: `${s.answered.length} of ${s.questions.length} answered` })),
    h("div", { class: "viva-body" },
      // The question is a review comment on the student's own file; a follow-up is a reply in the same thread
      h("div", { class: "thread" },
        comment(s.followUp ? "muted" : "", [h("strong", {}, "VerifiedBuild"), h("span", {}, "asked about"), h("span", { class: "mono" }, `${q.file}, lines ${q.lines}`)],
          h("div", { class: "chips" },
            chip({ easy: "Easy", medium: "Medium", hard: "Hard" }[q.difficulty] || q.difficulty, "fact"),
            chip(TAG_NAME[q.skill] || q.skill, "primary", TAG_ICON[q.skill]),
            mine ? chip("You changed this file", "tertiary", "commit") : null),
          h("p", { class: `question-text${s.followUp ? " muted" : ""}` }, q.question)),
        s.followUp ? comment("reply followup", [h("strong", {}, "Follow-up"), h("span", {}, "one more chance on this question")], h("p", {}, s.followUp)) : null),
      VB.codeBlock(q.file, q.lines, q.snippet, q.snippet_start_line),
      h("div", { class: "answer-panel" }, seg, area, errorBox)));
  if (fresh) window.scrollTo({ top: 0, behavior: "smooth" }); // a new question or follow-up starts at the top
}

function tick() {
  const el = document.getElementById("timer");
  if (!el || !viva.s) return;
  const left = viva.s.timeLimit - (Date.now() - viva.input.shownAt) / 1000;
  document.getElementById("timer-text").textContent = left > 0 ? fmt(left) : "Time's up";
  el.classList.toggle("low", left > 0 && left <= 15);
  el.classList.toggle("up", left <= 0);
  if (timerRing && timerRing.isConnected) timerRing.set(Math.max(0, left / viva.s.timeLimit) * 100);
  if (left <= 0 && recorder.active) stopAndKeep();
  const status = document.getElementById("rec-status");
  if (status && recorder.active) status.textContent = `Recording ${fmt((Date.now() - recorder.startedAt) / 1000)}. Tap to stop.`;
}

async function showViva(token) {
  frame("viva");
  const sessionId = tab.get("vb_session_id");
  if (!viva.s || viva.s.sessionId !== sessionId) {
    if (!sessionId) return go("#/home", true);
    paint(token, VB.loadingView("Loading your viva…"));
    try {
      await viva.resume(sessionId);
    } catch (e) {
      if (e.code !== "SESSION_NOT_FOUND") throw e;
      tab.del("vb_session_id"); // that viva no longer exists: start again from home
      return go("#/home", true);
    }
    if (token !== viewToken) return;
  }
  drawViva();
  ticker = setInterval(tick, 1000);
}

async function showDone(token) {
  frame(null);
  tab.del("vb_session_id");
  const a = JSON.parse(tab.get("vb_last_analysis") || "null");
  paint(token, VB.loadingView("Scoring your answers…"));
  const report = await api(`/api/report/${enc(me.id())}`);
  const verified = a ? report.hackathons.filter((x) => x.verified && x.repo_full_name.toLowerCase() === a.repo.full_name.toLowerCase()) : [];
  const repoFull = a ? a.repo.full_name : (report.evidence[0] ? report.evidence[0].repo_full_name : "");
  const evidence = report.evidence.filter((e) => !repoFull || e.repo_full_name.toLowerCase() === repoFull.toLowerCase());
  paint(token, h("div", { class: "center-stage done-stage run-done" },
    report.status === "done" ? VB.scoreSeal(report, 220, { draw: true }) : null,
    h("h1", { class: "display-s" }, "Viva complete"),
    h("p", { class: "body-l var" }, "Your report is ready. It stays private until you apply to an internship."),
    report.status === "done" ? h("div", { class: "run-card" },
      h("div", { class: "run-head" }, VB.brandMark(), h("span", { class: "mono" }, `verify ${repoFull}`), h("span", { class: "status pass" }, h("span", { class: "dot" }), "Finished")),
      VB.pipeline(evidence.map((e, i) => ({ state: VB.RUN_STATE[levelOf(e.score * 10)], label: `Question ${i + 1}`, sub: TAG_NAME[e.skill] || e.skill, when: `${e.score}/10` })), { label: "Your 5 answers" }),
      VB.skillBadges(report.skills, { cascade: true, only: (x) => x.score !== undefined })) : null,
    verified.map((x) => VB.banner(`This viva also verified your hackathon: ${RESULT_LABEL[x.result]} at ${x.event} ${x.year}.`, { kind: "ok", iconName: "emoji_events" })),
    h("div", { class: "actions" }, button("See my report", { href: "#/report", kind: "lg", iconName: "verified" }), button("Find internships", { href: "#/internships", kind: "lg tonal", iconName: "work" }))));
}

// ---------- Report and internships ----------

async function apply(m) {
  const box = h("input", { type: "checkbox", id: "consent" });
  const ok = await VB.confirm({
    title: `Apply to ${m.venture}?`,
    text: `${m.title}. Applying shares your VerifiedBuild report (scores, answers, code evidence and hackathons) with ${m.venture} for this role. Nobody else sees it.`,
    confirmText: "Apply", iconName: "work",
    extra: h("label", { class: "check body-m", for: "consent" }, box, `I agree to share my report with ${m.venture}.`),
    gate: box,
  });
  if (!ok || !box.checked) return;
  try {
    await api("/api/apply", { method: "POST", body: { student_id: me.id(), listing_id: m.listing_id, share_consent: true } });
    justApplied.add(m.listing_id);
    VB.snackbar(`Applied to ${m.venture}. They can now see your report.`);
  } catch (e) {
    if (e.code !== "ALREADY_APPLIED") VB.snackbar(e.message);
  }
  render();
}

const justApplied = new Set(); // the stamp lands once, right after applying
const applyAction = (m) => {
  if (!m.applied) return button("Apply", { iconName: "work", onclick: () => apply(m) });
  const fresh = justApplied.delete(m.listing_id);
  return VB.stampApplied(fresh);
};

async function loadReport() {
  const [r, listings] = await Promise.all([api(`/api/report/${enc(me.id())}`), api("/api/listings").then((x) => x.listings).catch(() => [])]);
  return { r, byId: Object.fromEntries(listings.map((l) => [l.id, l])), listings };
}

function notYet(token, title) {
  return paint(token,
    head(title, "Finish a viva first. Your scores, matches and report appear here after your fifth answer."),
    h("div", { class: "actions" }, button("Pick a repo", { href: "#/repos", kind: "lg", iconAfter: "arrow_forward" })));
}

async function showInternships(token) {
  frame("internships");
  paint(token, VB.loadingView("Loading internships…"));
  const { r, byId, listings } = await loadReport();
  if (r.status !== "done") {
    return paint(token,
      head("Internships", "Finish a viva to see how well you match each one. Only skills you show count."),
      h("div", { class: "list" }, listings.map((l) => h("div", { class: "li" },
        shape("cookie6", 40, "secondary", h("span", { class: "label-l" }, l.venture.slice(0, 1))),
        h("div", { class: "li-main" }, h("div", { class: "title-m" }, l.title), h("div", { class: "body-m var clamp-2" }, `${l.venture}. ${l.description}`)),
        h("span", {})))),
      h("div", { class: "section actions" }, button("Pick a repo", { href: "#/repos", kind: "lg", iconAfter: "arrow_forward" })));
  }
  paint(token,
    head("Internships", "Matched on the skills and hackathons you verified. Applying shares your report with that company only."),
    h("div", { class: "matches" }, r.matches.map((m, i) => VB.matchCard(m, byId[m.listing_id], { top: i === 0 && m.match > 0, action: applyAction(m), report: r }))));
}

async function showReport(token) {
  frame("report");
  paint(token, VB.loadingView("Loading your report…"));
  const { r, byId } = await loadReport();
  if (r.status !== "done") return notYet(token, "Your report");
  paint(token,
    h("div", { class: "section" }, VB.credential(r, "you")),
    section("Verified skills", h("p", { class: "section-note" }, "From your answers. 70 and up is strong, 40 to 69 partial."), VB.skillStamps(r.skills)),
    section("Resume → viva", h("p", { class: "section-note" }, "+ means you showed it without claiming it. − means it's on your resume but this viva didn't show it, so it doesn't count yet."), VB.claimsList(r.claimed_vs_verified, "you")),
    section("Internships for you", h("p", { class: "section-note" }, "Each match adds up verified skills, shared interests and verified hackathons. No AI in this number."),
      h("div", { class: "matches" }, r.matches.slice(0, 3).map((m, i) => VB.matchCard(m, byId[m.listing_id], { top: i === 0 && m.match > 0, action: applyAction(m), report: r })),
      h("div", {}, button("See all internships", { href: "#/internships", kind: "text", iconAfter: "arrow_forward" })))),
    r.hackathons.length ? section("Your hackathons", VB.hackathonList(r.hackathons, "you")) : null,
    section("Your answers", h("p", { class: "section-note" }, "Each question was about the code shown beside it."), h("div", { class: "evidence" }, r.evidence.map((e, i) => VB.evidenceSheet(e, i, "you")))),
    r.build_history ? section("How the repo was built", h("p", { class: "section-note" }, "Facts from GitHub. They don't change your score."), VB.buildHistory(r.build_history, "you")) : null);
}

// ---------- Router ----------

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  return { parts: path.split("/").filter(Boolean), query: new URLSearchParams(qs || "") };
}

async function render() {
  const token = ++viewToken;
  if (ticker) { clearInterval(ticker); ticker = null; }
  const { parts, query } = parseHash();
  const page = parts[0] || "";
  if (page !== "viva" && recorder.active) recorder.discard();
  if (!me.id()) return showSignup(token);
  try {
    if (page === "repos") await showRepos(token);
    else if (page === "analyzing" && query.get("repo")) await showAnalyzing(token, query.get("repo"));
    else if (page === "found") showFound(token);
    else if (page === "viva") await showViva(token);
    else if (page === "done") await showDone(token);
    else if (page === "report") await showReport(token);
    else if (page === "internships") await showInternships(token);
    else await showHome(token);
  } catch (e) {
    if (token !== viewToken) return;
    if (e.code === "STUDENT_NOT_FOUND") { me.forget(); return showSignup(token, "We couldn't find your profile. Please sign up again."); }
    paint(token, h("div", { class: "center-stage" }, VB.banner(e.message, { action: button("Try again", { kind: "text", iconName: "refresh", onclick: () => render() }) })));
  }
}

accountButton.addEventListener("click", async () => {
  if (!await VB.confirm({
    title: "Sign out on this device?",
    text: `You're signed in as @${me.github()}. Your profile and results stay saved. Sign up again with the same GitHub to start fresh.`,
    confirmText: "Sign out", iconName: "logout",
  })) return;
  me.forget();
  accountButton.replaceChildren();
  go("#/");
  render();
});
window.addEventListener("hashchange", render);
render();
