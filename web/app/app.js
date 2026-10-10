"use strict";
// VerifiedBuild student app (web). Same API and the same flow as the Android app:
// sign up → pick a repo → "what we found" → 5 questions (voice or text) → report → apply.
// Plain JavaScript, no build step. Shared rendering lives in /common.js (the VB object).

const { h, enc, chip, api, levelOf, repoName, TAG_NAME, RESULT_LABEL, INTERESTS, INTEREST_LABEL, SKILL_CHIPS } = VB;
const local = VB.store(window.localStorage);
const tab = VB.store(window.sessionStorage);
const app = document.getElementById("app");
const signoutButton = document.getElementById("signout");

const RETRYABLE = new Set(["AI_FAILED", "NETWORK", "DB_UNAVAILABLE", "DB_ERROR", "INTERNAL", "HTTP_500", "HTTP_502", "HTTP_503", "HTTP_504"]);
const MAX_RECORDING_S = 120;
const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;

let viewToken = 0;
let ticker = null; // the viva timer

const me = {
  id: () => local.get("vb_student_id"),
  name: () => local.get("vb_student_name") || "",
  github: () => local.get("vb_github") || "",
  save(id, name, github) { local.set("vb_student_id", id); local.set("vb_student_name", name); local.set("vb_github", github); },
  forget() { ["vb_student_id", "vb_student_name", "vb_github"].forEach((k) => local.del(k)); tab.del("vb_last_analysis"); },
};

// ---------- Small helpers ----------

function go(hash, replace = false) {
  if (replace) location.replace(hash); else location.hash = hash;
}

function paint(token, ...nodes) {
  if (token !== viewToken) return false;
  app.replaceChildren(...nodes.flat().filter((n) => n !== null && n !== undefined && n !== false));
  window.scrollTo(0, 0);
  return true;
}

const loading = (text) => h("p", { class: "soft" }, text);
const notice = (text) => h("p", { class: "notice" }, text);

function normaliseUsername(raw) {
  let s = (raw || "").trim().replace(/^https?:\/\//i, "").replace(/^github\.com\//i, "").replace(/^@/, "");
  return s.split("/")[0];
}

function normaliseRepo(raw) {
  const s = (raw || "").trim().replace(/^https?:\/\//i, "").replace(/^github\.com\//i, "");
  const [owner, name] = s.split("/");
  return owner && name ? `${owner}/${name.replace(/\.git$/, "")}` : s;
}

function toggleGroup(options, selected, label) {
  return h("div", { class: "toggles", role: "group", "aria-label": label }, options.map(([value, text]) => {
    const b = h("button", { type: "button", class: "toggle", "aria-pressed": String(selected.has(value)) }, text);
    b.addEventListener("click", () => {
      if (selected.has(value)) selected.delete(value); else selected.add(value);
      b.setAttribute("aria-pressed", String(selected.has(value)));
    });
    return b;
  }));
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function confirmDialog({ title, text, confirm, extra, gate }) {
  return new Promise((resolve) => {
    const yes = h("button", { value: "yes", disabled: !!gate }, confirm);
    if (gate) gate.addEventListener("change", () => { yes.disabled = !gate.checked; }); // e.g. a consent box that must be ticked
    const d = h("dialog", {},
      h("form", { method: "dialog", class: "form-grid" },
        h("h2", {}, title),
        text ? h("p", { class: "soft" }, text) : null,
        extra || null,
        h("div", { class: "actions" },
          yes,
          h("button", { value: "no", class: "quiet" }, "Cancel"))));
    d.addEventListener("close", () => { d.remove(); resolve(d.returnValue === "yes"); });
    document.body.append(d);
    d.showModal();
  });
}

// ---------- Sign up ----------

function showSignup(token, message) {
  signoutButton.hidden = true;
  const interests = new Set();
  const skills = new Set();
  let resume = null; // { base64, name }
  const name = h("input", { type: "text", id: "name", maxlength: "100", autocomplete: "name", required: true });
  const email = h("input", { type: "text", id: "email", maxlength: "200", autocomplete: "email", inputmode: "email", required: true });
  const college = h("input", { type: "text", id: "college", maxlength: "150", required: true });
  const github = h("input", { type: "text", id: "github", maxlength: "100", autocapitalize: "off", spellcheck: "false", required: true });
  const fileInput = h("input", { type: "file", id: "resume", accept: "application/pdf" });
  const fileNote = h("p", { class: "small soft" }, "No resume attached.");
  const error = h("p", { class: "notice", hidden: !message }, message || "");
  const submit = h("button", { type: "submit" }, "Create my profile");
  const withoutResume = h("button", { type: "button", class: "quiet", hidden: true }, "Continue without resume");

  fileInput.addEventListener("change", async () => {
    const f = fileInput.files && fileInput.files[0];
    resume = null;
    if (!f) { fileNote.textContent = "No resume attached."; return; }
    if (f.type && f.type !== "application/pdf") { fileNote.textContent = "Please pick a PDF file."; fileInput.value = ""; return; }
    if (f.size > 5 * 1024 * 1024) { fileNote.textContent = "That PDF is over 5 MB. Please pick a smaller file."; fileInput.value = ""; return; }
    resume = { base64: await readFileAsBase64(f), name: f.name };
    fileNote.textContent = `Attached: ${f.name}`;
  });

  async function send(useResume) {
    error.hidden = true;
    withoutResume.hidden = true;
    const gh = normaliseUsername(github.value);
    const problems = [];
    if (!name.value.trim()) problems.push("Enter your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) problems.push("Enter an email like name@college.edu.");
    if (!college.value.trim()) problems.push("Enter your college.");
    if (!USERNAME_RE.test(gh)) problems.push("That doesn't look like a GitHub username.");
    if (!interests.size) problems.push("Pick at least one interest.");
    if (!(useResume && resume) && !skills.size) problems.push("Upload a resume or pick at least one skill.");
    if (problems.length) { error.textContent = problems.join(" "); error.hidden = false; return; }
    submit.disabled = true;
    submit.textContent = useResume && resume ? "Checking your GitHub and reading your resume…" : "Checking your GitHub…";
    try {
      const r = await api("/api/students", {
        method: "POST",
        body: {
          name: name.value.trim(), email: email.value.trim(), college: college.value.trim(), github_username: gh,
          interests: [...interests], skills: skills.size ? [...skills] : null,
          resume_base64: useResume && resume ? resume.base64 : null, resume_mime: useResume && resume ? "application/pdf" : null,
        },
      });
      me.save(r.student_id, name.value.trim(), r.github_username);
      go("#/home", true);
    } catch (e) {
      error.textContent = e.message;
      error.hidden = false;
      if (e.code === "RESUME_UNREADABLE" && skills.size) withoutResume.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = "Create my profile";
    }
  }
  withoutResume.addEventListener("click", () => send(false));

  paint(token,
    h("div", { class: "page-head" }, h("div", { class: "grow" },
      h("h1", {}, "Show what you can really build."),
      h("p", { class: "soft" }, "Pick one of your GitHub repos and answer 5 questions about your own code, by speaking or typing, in any language. Internships are matched on the skills you show."))),
    h("form", { class: "form-grid", onsubmit: (ev) => { ev.preventDefault(); send(true); } },
      h("label", { for: "name" }, "Full name", name),
      h("label", { for: "email" }, "Email", email),
      h("label", { for: "college" }, "College", college),
      h("label", { for: "github" }, "GitHub username", h("span", { class: "field-hint" }, "We only read your public repos."), github),
      h("fieldset", {}, h("legend", {}, "Interests"), toggleGroup(INTERESTS, interests, "Interests")),
      h("fieldset", {},
        h("legend", {}, "Your skills"),
        h("p", { class: "small soft" }, "With a resume, we read your skills from it. Without one, we use the chips you pick."),
        h("label", { for: "resume" }, "Resume (PDF, under 5 MB)", fileInput),
        fileNote,
        toggleGroup(SKILL_CHIPS.map((s) => [s, s]), skills, "Skills")),
      error,
      h("div", { class: "actions" }, submit, withoutResume)));
  name.focus();
}

// ---------- Home ----------

function hackathonForm(token, repos) {
  const event = h("input", { type: "text", id: "h-event", maxlength: "120", placeholder: "e.g. Smart City Hackathon", required: true });
  const year = h("input", { type: "number", id: "h-year", min: "2000", max: "2100", value: String(new Date().getFullYear()) });
  const result = h("select", { id: "h-result" }, ["winner", "finalist", "participant"].map((r) => h("option", { value: r }, RESULT_LABEL[r])));
  const team = h("input", { type: "number", id: "h-team", min: "1", max: "20", value: "1" });
  const repoSelect = h("select", { id: "h-repo" },
    h("option", { value: "" }, repos.length ? "Pick one of your repos" : "No public repos found"),
    repos.map((r) => h("option", { value: r.full_name }, r.full_name)));
  const repoText = h("input", { type: "text", id: "h-repo-other", placeholder: "owner/repo", autocapitalize: "off", spellcheck: "false" });
  const error = h("p", { class: "notice", hidden: true });
  const add = h("button", { type: "submit" }, "Add hackathon");
  return h("details", { class: "add-box" },
    h("summary", {}, "Add a hackathon"),
    h("form", {
      class: "form-grid",
      onsubmit: async (ev) => {
        ev.preventDefault();
        error.hidden = true;
        const repo = normaliseRepo(repoText.value) || repoSelect.value;
        if (!event.value.trim()) { error.textContent = "Enter the hackathon's name."; error.hidden = false; return; }
        if (!REPO_RE.test(repo)) { error.textContent = "Pick one of your repos, or type a team repo as owner/repo."; error.hidden = false; return; }
        add.disabled = true;
        try {
          await api(`/api/students/${enc(me.id())}/hackathons`, {
            method: "POST",
            body: { event: event.value.trim(), year: Number(year.value), result: result.value, team_size: Number(team.value), repo_full_name: repo },
          });
          if (token === viewToken) render();
        } catch (e) {
          error.textContent = e.message;
          error.hidden = false;
        } finally {
          add.disabled = false;
        }
      },
    },
      h("label", { for: "h-event" }, "Hackathon", event),
      h("div", { class: "row-gap" },
        h("label", { for: "h-year" }, "Year", year),
        h("label", { for: "h-result" }, "Result", result),
        h("label", { for: "h-team" }, "Team size", team)),
      h("label", { for: "h-repo" }, "Project repo", repoSelect),
      h("label", { for: "h-repo-other" }, "Or a teammate's or organisation's repo", h("span", { class: "field-hint" }, "You need commits in it. On team repos, your viva asks about the files you changed."), repoText),
      error,
      h("div", {}, add)));
}

async function showHome(token) {
  paint(token, loading("Loading your profile…"));
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
  const first = me.name().split(" ")[0] || report.student.name;
  const inProgress = report.viva_in_progress;
  const cards = [];
  if (report.status === "done") {
    cards.push(h("section", { class: "panel" },
      h("h2", {}, "Your verified profile"),
      h("div", { class: "row-gap" }, h("span", { class: "overall-num" }, String(report.overall)), h("span", { class: "soft" }, "out of 100, from your answers")),
      h("div", { class: "actions" },
        h("a", { class: "button", href: "#/report" }, "View report"),
        h("a", { class: "button quiet", href: "#/repos" }, "Verify another repo"))));
  }
  if (inProgress) {
    cards.push(h("section", { class: "panel" },
      h("h2", {}, "Finish your viva"),
      h("p", { class: "soft" }, `${repoName(inProgress.repo_full_name)}, ${inProgress.answered} of ${inProgress.total} answered`),
      h("div", {}, h("button", { onclick: () => { tab.set("vb_session_id", inProgress.session_id); go("#/viva"); } }, "Continue"))));
  }
  if (report.status !== "done" && !inProgress) {
    cards.push(h("section", { class: "panel" },
      h("h2", {}, "Verify your skills"),
      h("p", { class: "soft" }, "Pick one of your GitHub repos. We'll read the code and ask you 5 questions about it. It takes about 8 minutes."),
      h("div", {}, h("a", { class: "button", href: "#/repos" }, "Pick a repo"))));
  }
  const hackRows = VB.hackathonRows(report.hackathons, "you", (x) => h("span", { class: "row-gap" },
    x.verified ? null : h("button", { class: "quiet", onclick: () => go(`#/analyzing?repo=${enc(x.repo_full_name)}`) }, "Verify now"),
    h("button", {
      class: "quiet",
      onclick: async () => {
        if (!await confirmDialog({ title: `Remove ${x.event} ${x.year}?`, text: "This takes it off your profile.", confirm: "Remove" })) return;
        try { await api(`/api/students/${enc(me.id())}/hackathons/${enc(x.hackathon_id)}`, { method: "DELETE" }); render(); } catch (e) { alert(e.message); }
      },
    }, "Remove")));
  const matches = report.status === "done"
    ? h("div", {}, report.matches.slice(0, 3).map((m) => h("div", { class: "hack" },
      h("div", {}, h("strong", {}, `${m.title}, ${m.venture}`), h("p", { class: "small soft" }, m.why)),
      h("strong", {}, `${m.match}%`))), h("p", {}, h("a", { href: "#/report" }, "See all and apply")))
    : h("div", {}, listings.map((l) => h("div", { class: "hack" }, h("div", {}, h("strong", {}, l.title), h("div", { class: "small soft" }, l.venture)))),
      h("p", { class: "small soft" }, "Finish a viva to see how well you match each one."));
  paint(token,
    h("div", { class: "page-head" }, h("div", { class: "grow" },
      h("h1", {}, `Hi, ${first}`),
      h("div", { class: "row-gap soft" }, h("span", {}, `@${report.student.github_username}`), h("span", {}, report.student.college)))),
    h("div", { class: "form-grid" }, cards),
    h("section", { class: "block" },
      h("h2", {}, "Your hackathons"),
      report.hackathons.length
        ? h("div", {}, hackRows)
        : h("p", { class: "soft" }, "Add the hackathons you've done. Each one counts toward your matches once you verify it with a viva on its repo."),
      hackathonForm(token, repos)),
    h("section", { class: "block" }, h("h2", {}, "Internships"), matches));
}

// ---------- Pick a repo ----------

async function showRepos(token) {
  paint(token, loading("Loading your repos…"));
  const { repos } = await api(`/api/github/${enc(me.github())}/repos`);
  const pick = async (full) => {
    if (await confirmDialog({
      title: `Verify ${repoName(full)}?`,
      text: "We'll read the code and ask you 5 questions about it. Answer by speaking or typing, in any language. Each question has 90 seconds.",
      confirm: "Start",
    })) go(`#/analyzing?repo=${enc(full)}`);
  };
  const team = h("input", { type: "text", id: "team-repo", placeholder: "owner/repo", autocapitalize: "off", spellcheck: "false" });
  const teamError = h("p", { class: "notice", hidden: true });
  paint(token,
    h("div", { class: "page-head" }, h("div", { class: "grow" },
      h("a", { class: "crumb", href: "#/home" }, "Back"),
      h("h1", {}, "Pick a repo"),
      h("p", { class: "soft" }, "Pick a project you built, so you can answer questions about its code."))),
    repos.length
      ? h("ul", { class: "repo-list" }, repos.map((r) => h("li", { class: "repo-item" },
        h("button", { onclick: () => pick(r.full_name) },
          h("span", { class: "repo-name" }, repoName(r.full_name)),
          h("span", { class: "small soft" }, r.description || "No description"),
          h("span", { class: "small faint" }, `${r.language || "Code"}, ★ ${r.stars}, updated ${(r.pushed_at || "").slice(0, 10)}`)))))
      : h("p", { class: "soft" }, `No public repos found on @${me.github()}. Push a project to GitHub, then reload this page.`),
    h("section", { class: "block" },
      h("h2", {}, "Verify a team repo instead"),
      h("form", {
        class: "form-grid",
        onsubmit: (ev) => {
          ev.preventDefault();
          const repo = normaliseRepo(team.value);
          if (!REPO_RE.test(repo)) { teamError.textContent = "Type it as owner/repo, like your-team/hackathon-app."; teamError.hidden = false; return; }
          go(`#/analyzing?repo=${enc(repo)}`);
        },
      },
        h("label", { for: "team-repo" }, "Repo", h("span", { class: "field-hint" }, "A teammate's or organisation's repo you have commits in. Your questions will be about the files you changed."), team),
        teamError,
        h("div", {}, h("button", { type: "submit" }, "Start")))));
}

// ---------- Analyzing and "What we found" ----------

async function showAnalyzing(token, repo) {
  paint(token, h("div", { class: "form-grid" },
    h("h1", {}, `Reading ${repoName(repo)}`),
    h("p", { class: "soft" }, "We're reading the code and writing 5 questions about it. This usually takes 15–30 seconds."),
    h("div", { class: "progress", role: "progressbar", "aria-label": "Working" }, h("span", { class: "indeterminate" }))));
  try {
    const a = await api("/api/analyze", { method: "POST", body: { student_id: me.id(), repo_full_name: repo } });
    if (token !== viewToken) return;
    tab.set("vb_last_analysis", JSON.stringify(a));
    tab.set("vb_session_id", a.session_id);
    viva.start(a);
    go("#/found", true);
  } catch (e) {
    if (token !== viewToken) return;
    paint(token, h("div", { class: "form-grid" },
      h("h1", {}, `We couldn't start the viva on ${repoName(repo)}`),
      notice(e.message),
      h("div", { class: "actions" },
        h("button", { onclick: () => render() }, "Try again"),
        h("a", { class: "button quiet", href: "#/repos" }, "Pick another repo"))));
  }
}

const LANG_COLOURS = ["var(--action)", "var(--strong)", "var(--partial)", "var(--weak)", "var(--ink-faint)"];

function showFound(token) {
  const a = JSON.parse(tab.get("vb_last_analysis") || "null");
  if (!a) return go("#/home", true);
  const langs = Object.entries(a.repo.languages).sort((x, y) => y[1] - x[1]);
  const top = langs.slice(0, 4);
  const other = langs.slice(4).reduce((s, [, v]) => s + v, 0);
  if (other > 0) top.push(["Other", Math.round(other * 10) / 10]);
  const stack = h("div", { class: "stack-bar", role: "img", "aria-label": top.map(([n, v]) => `${n} ${v}%`).join(", ") },
    top.map(([, v], i) => { const s = h("span"); s.style.width = `${v}%`; s.style.background = LANG_COLOURS[i]; return s; }));
  paint(token,
    h("div", { class: "page-head" }, h("div", { class: "grow" },
      h("h1", {}, `We read ${repoName(a.repo.full_name)}`),
      h("p", { class: "soft" }, `${a.repo.files_read} files read.`))),
    h("div", { class: "form-grid" },
      stack,
      h("div", { class: "lang-legend" }, top.map(([n, v], i) => {
        const sw = h("span", { class: "swatch" }); sw.style.background = LANG_COLOURS[i];
        return h("span", {}, sw, `${n} ${v}%`);
      })),
      a.contribution.team_repo
        ? h("section", { class: "panel" },
          h("h2", {}, "Team repo"),
          h("p", {}, `You made ${a.contribution.your_commits} commits here. Your questions are about the files you changed:`),
          h("ul", { class: "points" }, a.contribution.focus_files.slice(0, 5).map((f) => h("li", { class: "mono" }, f))))
        : null,
      h("section", { class: "block" },
        h("h2", {}, "What your code shows"),
        h("div", {}, a.repo_skills.map((s) => h("div", { class: "hack" }, h("div", {}, chip(TAG_NAME[s.tag] || s.tag, "strong")), h("p", { class: "small" }, s.evidence))))),
      h("p", { class: "soft" }, "Your 5 questions point at specific lines of this code. Each has 90 seconds. Speak or type, in any language."),
      h("div", {}, h("button", { onclick: () => go("#/viva", true) }, "Start question 1"))));
}

// ---------- The viva ----------

const viva = {
  s: null, // { sessionId, questions, current, followUp, answered, lastTranscript, loading, error, failed, done, timeLimit }
  input: { tab: "voice", text: "", pasted: false, shownAt: Date.now(), shownKey: null, rec: null },

  start(a) {
    this.s = { sessionId: a.session_id, questions: a.questions, current: a.questions[0] ? a.questions[0].id : null, followUp: null,
      answered: [], lastTranscript: null, loading: false, error: null, failed: null, done: false, timeLimit: a.time_limit_s || 90 };
    this.resetInput();
  },

  resetInput() {
    this.input = { tab: this.input.tab, text: "", pasted: false, shownAt: Date.now(), shownKey: null, rec: null };
  },

  async resume(sessionId) {
    const v = await api(`/api/viva/${enc(sessionId)}`);
    this.s = { sessionId: v.session_id, questions: v.questions, current: v.status === "done" ? null : v.current_question_id,
      followUp: v.pending_follow_up ? v.pending_follow_up.follow_up : null, answered: v.answered, lastTranscript: null,
      loading: false, error: null, failed: null, done: v.status === "done", timeLimit: 90 };
    this.resetInput();
  },

  async send(body) {
    const s = this.s;
    s.loading = true; s.error = null; s.failed = null;
    try {
      const r = await api(`/api/viva/${enc(s.sessionId)}/answer`, { method: "POST", body });
      s.lastTranscript = r.transcript;
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
      if (e.code === "ALREADY_ANSWERED") { await this.resume(s.sessionId); this.s.lastTranscript = null; return; }
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
  media: null, stream: null, chunks: [], startedAt: 0, mime: "", stopTimer: null,
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
  },
  stop() {
    return new Promise((resolve) => {
      if (!this.media) return resolve(null);
      const media = this.media;
      const stream = this.stream;
      const chunks = this.chunks;
      this.media = null; // stopped from now on, so a second stop can't throw this recording away
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
    this.media.onstop = () => { this.stream.getTracks().forEach((t) => t.stop()); };
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
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function drawViva() {
  const s = viva.s;
  if (!s) return;
  if (s.done) { go("#/done", true); return; }
  const q = s.questions.find((x) => x.id === s.current);
  if (!q) return;
  const key = `${q.id}|${s.followUp || ""}`;
  if (viva.input.shownKey !== key) { viva.input.shownKey = key; viva.input.shownAt = Date.now(); } // the clock starts when the question first shows
  const a = JSON.parse(tab.get("vb_last_analysis") || "null");
  const mine = a && a.session_id === s.sessionId && a.contribution.focus_files.includes(q.file);
  const n = s.questions.findIndex((x) => x.id === q.id) + 1;
  const progress = h("div", { class: "progress" }, (() => { const p = h("span"); p.style.width = `${(s.answered.length / s.questions.length) * 100}%`; return p; })());
  const timer = h("span", { class: "timer", id: "timer" }, fmt(s.timeLimit - (Date.now() - viva.input.shownAt) / 1000));
  const busy = s.loading;

  const tabs = h("div", { class: "tabs", role: "tablist" },
    [["voice", "Speak"], ["text", "Type"]].map(([id, label]) => h("button", {
      type: "button", role: "tab", "aria-selected": String(viva.input.tab === id), disabled: busy || recorder.active,
      onclick: () => { viva.input.tab = id; drawViva(); },
    }, label)));

  let area;
  if (viva.input.tab === "voice") {
    const rec = viva.input.rec;
    const micButton = h("button", {
      type: "button", class: `mic${recorder.active ? " recording" : ""}`, disabled: busy,
      "aria-label": recorder.active ? "Stop recording" : "Start recording",
      onclick: async () => {
        if (recorder.active) return stopAndKeep();
        viva.s.error = null;
        try { await recorder.start(); } catch {
          viva.s.error = { message: "We couldn't use your microphone. You can type your answer instead.", code: "LOCAL" };
          viva.input.tab = "text";
        }
        drawViva();
      },
    }, recorder.active ? "Stop" : "Speak");
    area = h("div", { class: "answer-area" },
      h("div", { class: "mic-row" }, micButton,
        h("p", { class: "soft", id: "rec-status" }, recorder.active ? "Recording… tap to stop." : rec ? `Recorded ${fmt(rec.seconds)}.` : "Tap to start speaking.")),
      rec && !recorder.active ? h("div", { class: "actions" },
        h("button", { disabled: busy, onclick: () => viva.submit({ mode: "voice", audio_base64: rec.base64, audio_mime: rec.mime, duration_s: rec.seconds }).then(drawViva) }, busy ? "Saving your answer…" : "Submit answer"),
        h("button", { class: "quiet", disabled: busy, onclick: () => { viva.input.rec = null; drawViva(); } }, "Record again")) : null);
  } else {
    const box = h("textarea", { id: "answer", maxlength: "6000", placeholder: "Explain in your own words. Any language is fine.", disabled: busy, "aria-label": "Your answer" });
    box.value = viva.input.text;
    box.addEventListener("input", () => { viva.input.text = box.value; });
    box.addEventListener("paste", () => { viva.input.pasted = true; });
    area = h("div", { class: "answer-area" }, box,
      h("div", {}, h("button", {
        disabled: busy,
        onclick: () => {
          if (!viva.input.text.trim()) { viva.s.error = { message: "Please type an answer first.", code: "LOCAL" }; return drawViva(); }
          const seconds = Math.min(3600, Math.round((Date.now() - viva.input.shownAt) / 1000));
          return viva.submit({ mode: "text", answer_text: viva.input.text, duration_s: seconds, pasted: viva.input.pasted }).then(drawViva);
        },
      }, busy ? "Saving your answer…" : "Submit answer")));
  }

  const err = s.error;
  const errorBox = err ? h("div", { class: "form-grid" }, notice(err.message),
    RETRYABLE.has(err.code) && s.failed
      ? h("div", {}, h("button", { onclick: () => viva.send(s.failed).then(drawViva) }, "Try again"))
      : null) : null;

  app.replaceChildren(
    h("div", { class: "viva-top" },
      h("div", { class: "row-gap" },
        h("strong", {}, `Question ${n} of ${s.questions.length}`),
        h("span", { class: "spacer" }),
        timer,
        h("button", {
          class: "quiet", type: "button",
          onclick: async () => {
            if (await confirmDialog({ title: "Leave the viva?", text: "Your answers so far are saved. You can continue from your home page.", confirm: "Leave" })) {
              recorder.discard();
              go("#/home");
            }
          },
        }, "Leave")),
      progress),
    h("div", { class: "form-grid" },
      s.lastTranscript ? h("div", { class: "heard" },
        h("p", {}, `Answer saved. We heard: “${s.lastTranscript}”`),
        h("button", { class: "quiet", type: "button", "aria-label": "Dismiss", onclick: () => { s.lastTranscript = null; drawViva(); } }, "Close")) : null,
      h("div", { class: "row-gap" },
        chip({ easy: "Easy", medium: "Medium", hard: "Hard" }[q.difficulty] || q.difficulty, "not_shown"),
        chip(TAG_NAME[q.skill] || q.skill, "not_shown"),
        mine ? h("span", { class: "small soft" }, "You changed this file") : null),
      h("div", { class: "code-card" }, VB.codeBlock(`${q.file}  lines ${q.lines}`, q.snippet, q.snippet_start_line)),
      s.followUp
        ? [h("div", { class: "followup" }, h("strong", {}, "One more chance on this question"), h("p", {}, s.followUp)), h("p", { class: "question muted" }, q.question)]
        : h("p", { class: "question" }, q.question),
      tabs, area, errorBox));
}

function tick() {
  const el = document.getElementById("timer");
  if (!el || !viva.s) return;
  const left = viva.s.timeLimit - (Date.now() - viva.input.shownAt) / 1000;
  el.textContent = left > 0 ? fmt(left) : "Time's up. Submit what you have.";
  el.classList.toggle("up", left <= 0);
  if (left <= 0 && recorder.active) stopAndKeep();
  const status = document.getElementById("rec-status");
  if (status && recorder.active) status.textContent = `Recording ${fmt((Date.now() - recorder.startedAt) / 1000)}… tap to stop.`;
}

async function showViva(token) {
  const sessionId = tab.get("vb_session_id");
  if (!viva.s || viva.s.sessionId !== sessionId) {
    if (!sessionId) return go("#/home", true);
    paint(token, loading("Loading your viva…"));
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
  tab.del("vb_session_id");
  const a = JSON.parse(tab.get("vb_last_analysis") || "null");
  paint(token, loading("Saving your results…"));
  const report = await api(`/api/report/${enc(me.id())}`);
  const verified = a ? report.hackathons.filter((x) => x.verified && x.repo_full_name.toLowerCase() === a.repo.full_name.toLowerCase()) : [];
  paint(token, h("div", { class: "form-grid" },
    h("h1", {}, "Viva complete"),
    h("p", { class: "soft" }, "Your report is ready."),
    verified.map((x) => h("div", { class: "heard" }, h("p", {}, `This viva also verified: ${RESULT_LABEL[x.result]} at ${x.event} ${x.year}.`))),
    h("div", { class: "actions" },
      h("a", { class: "button", href: "#/report" }, "See my report"),
      h("a", { class: "button quiet", href: "#/home" }, "Back to home"))));
}

// ---------- Report ----------

async function apply(m, listing) {
  const box = h("input", { type: "checkbox", id: "consent" });
  const ok = await confirmDialog({
    title: `Apply to ${m.title} at ${m.venture}?`,
    text: `Applying shares your VerifiedBuild report (scores, answers, code evidence and hackathons) with ${m.venture} for this role. Nobody else sees it.`,
    confirm: "Apply",
    extra: h("label", { class: "check", for: "consent" }, box, `I agree to share my report with ${m.venture}.`),
    gate: box,
  });
  if (!ok || !box.checked) return;
  try {
    await api("/api/apply", { method: "POST", body: { student_id: me.id(), listing_id: m.listing_id, share_consent: true } });
  } catch (e) {
    if (e.code !== "ALREADY_APPLIED") alert(e.message);
  }
  render();
}

async function showReport(token) {
  paint(token, loading("Loading your report…"));
  const [r, listings] = await Promise.all([api(`/api/report/${enc(me.id())}`), api("/api/listings").then((x) => x.listings).catch(() => [])]);
  if (r.status !== "done") {
    return paint(token, h("div", { class: "form-grid" },
      h("h1", {}, "Finish your viva to see your scores"),
      h("div", {}, h("a", { class: "button", href: "#/home" }, "Back to home"))));
  }
  const byId = Object.fromEntries(listings.map((l) => [l.id, l]));
  const repos = [...new Set(r.evidence.map((e) => e.repo_full_name))];
  paint(token,
    h("div", { class: "report-head" },
      h("div", {},
        h("a", { class: "crumb", href: "#/home" }, "Back to home"),
        h("h1", {}, r.student.name),
        h("p", { class: "small soft" }, repos.length > 1 ? `Based on vivas on ${repos.length} repos: ${repos.join(", ")}` : `Based on a viva on ${repos[0]}`)),
      h("div", { class: "overall" }, h("div", { class: "overall-num" }, String(r.overall)), h("div", { class: "small soft" }, "overall, out of 100"))),
    h("section", { class: "block" },
      h("h2", {}, "You said, you showed"),
      h("p", { class: "block-note" }, "Only what you showed counts toward matches."),
      VB.claimedTable(r.claimed_vs_verified, "you")),
    h("section", { class: "block" }, h("h2", {}, "Verified skills"), VB.skillBars(r.skills)),
    r.hackathons.length ? h("section", { class: "block" }, h("h2", {}, "Your hackathons"), h("div", {}, VB.hackathonRows(r.hackathons, "you"))) : null,
    h("section", { class: "block" },
      h("h2", {}, "Internships matched on what you showed"),
      h("div", {}, r.matches.map((m) => h("div", { class: "hack" },
        h("div", {},
          h("strong", {}, `${m.title}, ${m.venture}`),
          byId[m.listing_id] ? h("p", { class: "small" }, byId[m.listing_id].description) : null,
          h("p", { class: "small soft" }, m.why)),
        h("div", { class: "row-gap" },
          h("strong", {}, `${m.match}%`),
          m.applied ? chip("Applied", "strong") : h("button", { onclick: () => apply(m, byId[m.listing_id]) }, "Apply")))))),
    h("section", { class: "block" },
      h("h2", {}, "Your answers"),
      h("p", { class: "block-note" }, "Each question was about the code shown. Your words sit beside it."),
      h("div", { class: "evidence" }, r.evidence.map((e, i) => VB.evidenceSheet(e, i, "you")))),
    r.build_history ? h("section", { class: "block" },
      h("h2", {}, "How the repo was built"),
      VB.buildHistoryFacts(r.build_history, "you"),
      h("p", { class: "block-note" }, "Facts from GitHub. They don't change your score.")) : null);
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
  signoutButton.hidden = false;
  try {
    if (page === "repos") await showRepos(token);
    else if (page === "analyzing" && query.get("repo")) await showAnalyzing(token, query.get("repo"));
    else if (page === "found") showFound(token);
    else if (page === "viva") await showViva(token);
    else if (page === "done") await showDone(token);
    else if (page === "report") await showReport(token);
    else await showHome(token);
  } catch (e) {
    if (token !== viewToken) return;
    if (e.code === "STUDENT_NOT_FOUND") { me.forget(); return showSignup(token, "We couldn't find your profile. Please sign up again."); }
    paint(token, h("div", { class: "form-grid" }, notice(e.message), h("div", {}, h("button", { onclick: () => render() }, "Try again"))));
  }
}

signoutButton.addEventListener("click", async () => {
  if (!await confirmDialog({ title: "Sign out on this device?", text: "Your profile and results stay saved. Sign up again with the same GitHub to start fresh.", confirm: "Sign out" })) return;
  me.forget();
  go("#/");
  render();
});
window.addEventListener("hashchange", render);
render();
