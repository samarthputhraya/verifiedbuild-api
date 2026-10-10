"use strict";
// VerifiedBuild recruiter dashboard. Plain JavaScript, no build step. The API serves this page,
// so every call is same-origin. Text from the API is always inserted as text, never as HTML.

const TAGS = [["backend", "Backend"], ["frontend", "Frontend"], ["data", "Data"], ["ai_ml", "AI/ML"], ["devops", "DevOps"], ["security", "Security"]];
const TAG_NAME = Object.fromEntries(TAGS);
const LEVEL_LABEL = { strong: "Strong", partial: "Partial", not_verified: "Not verified", not_shown: "Not shown" };
const RESULT_LABEL = { winner: "Winner", finalist: "Finalist", participant: "Participant" };
const INTEREST_LABEL = {
  ai: "AI", data: "Data", web: "Web", mobile: "Mobile", saas: "SaaS", fintech: "FinTech", edtech: "EdTech",
  hrtech: "HR-Tech", security: "Security", devtools: "Dev tools", growth: "Growth", healthcare: "Healthcare",
};
const POLL_MS = 5000;
const KEY_STORE = "vb_admin_key";

const app = document.getElementById("app");
const signoutButton = document.getElementById("signout");
const announcer = document.createElement("div");
announcer.className = "sr-only";
announcer.setAttribute("role", "status");
document.body.append(announcer);

let viewToken = 0; // bumps on every navigation, so a slow fetch or poll never paints over a newer view
let pollTimer = null;
let memoryKey = ""; // used when sessionStorage is blocked (e.g. some private windows)

// ---------- Helpers ----------

function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const enc = encodeURIComponent;
const githubUser = (u) => `https://github.com/${enc(u)}`;
const githubRepo = (full) => `https://github.com/${full.split("/").map(enc).join("/")}`;
const levelOf = (score) => (score === undefined || score === null ? "not_shown" : score >= 70 ? "strong" : score >= 40 ? "partial" : "not_verified");
const pct = (x) => `${Math.round(x * 100)}%`;

function ago(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function getKey() {
  try { return sessionStorage.getItem(KEY_STORE) || memoryKey; } catch { return memoryKey; }
}
function setKey(value) {
  memoryKey = value;
  try { sessionStorage.setItem(KEY_STORE, value); } catch { /* memory only */ }
}
function clearKey() {
  memoryKey = "";
  try { sessionStorage.removeItem(KEY_STORE); } catch { /* nothing stored */ }
}

class ApiError extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status; }
}

async function api(path, { admin = false, raw = false } = {}) {
  const headers = { Accept: raw ? "text/csv" : "application/json" };
  if (admin) headers["X-Admin-Key"] = getKey();
  let res;
  try {
    res = await fetch(path, { headers, cache: "no-store" });
  } catch {
    throw new ApiError("NETWORK", "Can't reach the VerifiedBuild API. Check the connection and try again.", 0);
  }
  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch { /* not JSON */ }
    const e = body && body.error;
    throw new ApiError((e && e.code) || `HTTP_${res.status}`, (e && e.message) || "Something went wrong. Try again.", res.status);
  }
  return raw ? res : res.json();
}

function paint(token, ...nodes) {
  if (token !== viewToken) return false;
  app.replaceChildren(...nodes);
  return true;
}

function loading(text) {
  return h("p", { class: "soft" }, text);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function startPolling(token, refresh, statusEl) {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (token !== viewToken || document.hidden) return;
    try {
      await refresh();
      statusEl.classList.remove("is-stale");
      statusEl.textContent = "Updating live";
    } catch (e) {
      if (e.code === "BAD_ADMIN_KEY") return signOut(e.message);
      statusEl.classList.add("is-stale");
      statusEl.textContent = "Couldn't refresh. Trying again.";
    }
  }, POLL_MS);
}

function chip(text, kind) {
  return h("span", { class: `chip ${kind || ""}` }, text);
}

function levelChip(level) {
  return chip(LEVEL_LABEL[level] || level, level);
}

function codeBlock(fileLabel, snippet, startLine) {
  const lines = (snippet || "").split("\n");
  return h("pre", { class: "code", tabindex: "0", "aria-label": `Code from ${fileLabel}` },
    h("span", { class: "code-file" }, fileLabel),
    lines.map((text, i) => h("span", { class: "code-line" },
      h("span", { class: "code-ln" }, String(startLine + i)),
      h("span", { class: "code-tx" }, text.length ? text : " "))));
}

function scoreBar(score) {
  return h("div", { class: "score-bar", role: "img", "aria-label": `${score} out of 10` },
    Array.from({ length: 10 }, (_, i) => h("span", { class: i < score ? "on" : "" })));
}

// ---------- Views ----------

function showSignin(message) {
  ++viewToken;
  stopPolling();
  signoutButton.hidden = true;
  const input = h("input", { type: "password", id: "passcode", autocomplete: "current-password", required: true });
  const error = h("p", { class: "notice", hidden: !message }, message || "");
  const button = h("button", { type: "submit" }, "Sign in");
  const form = h("form", {
    class: "signin",
    onsubmit: async (ev) => {
      ev.preventDefault();
      button.disabled = true;
      error.hidden = true;
      setKey(input.value.trim());
      try {
        await api("/api/admin/verify", { admin: true });
        location.hash = "#/";
        render();
      } catch (e) {
        clearKey();
        error.textContent = e.message;
        error.hidden = false;
        button.disabled = false;
        input.focus();
      }
    },
  },
    h("h1", {}, "Recruiter sign-in"),
    h("p", { class: "soft" }, "Enter the passcode from the VerifiedBuild team to see who applied to your internships."),
    h("label", { for: "passcode" }, "Passcode", input),
    error,
    h("div", {}, button));
  app.replaceChildren(form);
  input.focus();
}

function signOut(message) {
  clearKey();
  location.hash = "#/";
  showSignin(message);
}

function showError(e) {
  if (e.code === "BAD_ADMIN_KEY") return signOut(e.message);
  app.replaceChildren(h("div", { class: "empty" },
    h("p", { class: "notice" }, e.message),
    h("div", {}, h("button", { onclick: () => render() }, "Try again"))));
}

// Internships, each with its applicants

function listingRow(listing, shortlist) {
  const weights = Object.entries(listing.required_skills).sort((a, b) => b[1] - a[1]);
  const total = weights.reduce((s, [, w]) => s + w, 0) || 1;
  const candidates = shortlist.candidates || [];
  const top = candidates[0];
  return h("a", { class: "listing", href: `#/listing/${enc(listing.id)}` },
    h("div", {},
      h("div", { class: "venture" }, listing.venture),
      h("div", { class: "listing-title" }, listing.title),
      h("p", { class: "soft small" }, listing.description)),
    h("div", { class: "weights", "aria-label": "Skills this role needs" },
      weights.map(([tag, w]) => h("div", { class: "weight" },
        h("span", {}, TAG_NAME[tag] || tag),
        h("span", { class: "weight-track" }, (() => { const f = h("span", { class: "weight-fill" }); f.style.width = pct(w / total); f.style.display = "block"; return f; })()),
        h("span", { class: "faint" }, pct(w / total))))),
    candidates.length
      ? h("div", { class: "applied" },
        h("div", { class: "applied-count" }, String(candidates.length)),
        h("div", { class: "small soft" }, candidates.length === 1 ? "applicant" : "applicants"),
        h("div", { class: "small" }, `Top match: ${top.name}, ${top.match}%`))
      : h("div", { class: "applied none" }, "No applicants yet"));
}

async function showListings(token) {
  paint(token, loading("Loading internships…"));
  const status = h("span", { class: "live" }, "Updating live");
  let lastJson = "";
  const draw = async () => {
    const { listings } = await api("/api/listings");
    const shortlists = await Promise.all(listings.map((l) => api(`/api/admin/shortlist/${enc(l.id)}`, { admin: true })));
    const json = JSON.stringify(shortlists);
    if (json === lastJson) return;
    lastJson = json;
    const applicants = shortlists.reduce((n, s) => n + s.candidates.length, 0);
    paint(token,
      h("div", { class: "page-head" },
        h("div", { class: "grow" },
          h("h1", {}, "Internships"),
          h("p", { class: "soft" }, applicants
            ? `${applicants} ${applicants === 1 ? "application" : "applications"} so far. Students appear here when they apply and agree to share their report.`
            : "No applications yet. Students appear here when they apply and agree to share their report.")),
        status),
      h("div", { class: "listings" }, listings.map((l, i) => listingRow(l, shortlists[i]))));
  };
  await draw();
  startPolling(token, draw, status);
}

// Ranked applicants for one internship

function candidateRow(c, listingId, isNew) {
  const skills = TAGS.filter(([tag]) => c.skills[tag] !== undefined);
  const evidence = c.top_evidence;
  return h("li", { class: `candidate${isNew ? " is-new" : ""}` },
    h("div", { class: "rank", "aria-label": `Rank ${c.rank}` }, String(c.rank)),
    h("div", { class: "cand-main" },
      h("div", { class: "cand-name" }, h("a", { href: `#/candidate/${enc(c.student_id)}?listing=${enc(listingId)}` }, c.name)),
      h("div", { class: "row-gap soft small" },
        h("span", {}, c.college),
        h("a", { href: githubUser(c.github_username), target: "_blank", rel: "noopener noreferrer" }, `@${c.github_username}`),
        c.repo_full_name ? h("span", {}, c.repo_full_name) : null,
        h("span", {}, `Applied ${ago(c.applied_at)}`)),
      h("div", { class: "mini-skills", "aria-label": "Verified skills" },
        skills.map(([tag, name]) => chip(`${name} ${c.skills[tag]}`, levelOf(c.skills[tag])))),
      (c.hackathons || []).length
        ? h("div", { class: "row-gap small" }, c.hackathons.map((x) =>
          h("span", {}, chip("Verified hackathon", "strong"), " ", `${RESULT_LABEL[x.result] || x.result}, ${x.event} ${x.year}, viva ${x.viva_score}`)))
        : null,
      evidence ? h("p", { class: "quote-line small" }, `“${evidence.answer_excerpt}” `, h("span", { class: "faint" }, `(${evidence.score}/10)`)) : null,
      h("div", { class: "row-gap small soft" },
        chip(`Spoken ${c.answer_modes.voice}`, "fact"),
        chip(`Typed ${c.answer_modes.text}`, "fact"),
        chip(`Pasted ${c.answer_modes.pasted}`, "fact"))),
    h("div", { class: "match" },
      h("div", { class: "match-num" }, `${c.match}%`),
      h("div", { class: "match-label" }, "match"),
      h("div", { class: "small soft" }, `Overall ${c.overall}`)));
}

async function downloadCsv(listingId, button) {
  button.disabled = true;
  try {
    const res = await api(`/api/admin/shortlist/${enc(listingId)}/csv`, { admin: true, raw: true });
    const url = URL.createObjectURL(await res.blob());
    const a = h("a", { href: url, download: `shortlist-${listingId}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    if (e.code === "BAD_ADMIN_KEY") return signOut(e.message);
    alert(e.message);
  } finally {
    button.disabled = false;
  }
}

async function showShortlist(token, listingId) {
  paint(token, loading("Loading applicants…"));
  const status = h("span", { class: "live" }, "Updating live");
  let known = null;
  let lastJson = "";
  const draw = async () => {
    const sl = await api(`/api/admin/shortlist/${enc(listingId)}`, { admin: true });
    const json = JSON.stringify(sl);
    if (json === lastJson) return;
    lastJson = json;
    const ids = sl.candidates.map((c) => c.student_id);
    const fresh = new Set(known ? ids.filter((id) => !known.has(id)) : []);
    known = new Set(ids);
    const csvButton = h("button", { class: "quiet", onclick: () => downloadCsv(listingId, csvButton) }, "Download CSV");
    paint(token,
      h("div", { class: "page-head" },
        h("div", { class: "grow" },
          h("a", { class: "crumb", href: "#/" }, "All internships"),
          h("h1", {}, sl.listing.title),
          h("p", { class: "soft" }, `${sl.listing.venture}. Ranked by match on verified skills and verified hackathons, then by overall score.`)),
        h("div", { class: "row-gap" }, status, csvButton)),
      sl.candidates.length
        ? h("ol", { class: "ranked" }, sl.candidates.map((c) => candidateRow(c, listingId, fresh.has(c.student_id))))
        : h("div", { class: "empty" },
          h("h2", {}, "No applicants yet"),
          h("p", { class: "soft" }, "Students appear here the moment they apply and agree to share their report. This page updates by itself.")));
    if (fresh.size) {
      const names = sl.candidates.filter((c) => fresh.has(c.student_id)).map((c) => c.name).join(", ");
      announcer.textContent = `New applicant: ${names}`;
    }
  };
  await draw();
  startPolling(token, draw, status);
}

// One candidate's full report

function claimedTable(rows) {
  return h("table", { class: "two-col" },
    h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Claimed on their profile"), h("th", { scope: "col" }, "Shown in the viva"))),
    h("tbody", {}, rows.map((r) => h("tr", {},
      h("td", {}, r.claimed ? r.name : h("span", { class: "faint" }, "Not claimed")),
      h("td", {}, h("span", { class: "row-gap" }, r.claimed ? null : h("span", {}, TAG_NAME[r.tag] || r.tag), levelChip(r.level)))))));
}

function skillBars(skills) {
  return h("div", { class: "skillbars" }, TAGS.map(([tag, name]) => {
    const score = skills[tag];
    const level = levelOf(score);
    const fill = h("span", { class: `weight-fill fill-${level}` });
    fill.style.display = "block";
    fill.style.width = score === undefined ? "0%" : `${score}%`;
    return h("div", { class: "skillbar" },
      h("span", {}, name),
      h("span", { class: "weight-track" }, fill),
      h("span", { class: score === undefined ? "faint small" : "small" }, score === undefined ? "Not shown" : `${score} ${LEVEL_LABEL[level]}`));
  }));
}

function hackathonRows(items) {
  return items.map((x) => h("div", { class: "hack" },
    h("div", {},
      h("div", {}, h("strong", {}, `${RESULT_LABEL[x.result] || x.result}, ${x.event} ${x.year}`)),
      h("div", { class: "small soft row-gap" },
        h("a", { href: githubRepo(x.repo_full_name), target: "_blank", rel: "noopener noreferrer" }, x.repo_full_name),
        h("span", {}, `Team of ${x.team_size}`),
        x.verified && x.your_commit_share !== null ? h("span", {}, `${pct(x.your_commit_share)} of commits by this student`) : null)),
    x.verified
      ? h("div", { class: "row-gap" }, chip("Verified", "strong"), h("span", { class: "small" }, `Viva ${x.viva_score}/100`))
      : chip("Not verified yet", "not_shown")));
}

function evidenceSheet(e, i) {
  const facts = [
    chip(e.mode === "voice" ? "Spoken" : "Typed", "fact"),
    e.duration_s !== null && e.duration_s !== undefined ? chip(`${e.duration_s} s`, "fact") : null,
    e.had_follow_up ? chip("Follow-up asked", "fact") : null,
    e.pasted ? chip("Text was pasted", "fact") : null,
  ];
  return h("article", { class: "sheet", "aria-label": `Answer ${i + 1}` },
    h("div", { class: "sheet-q" },
      h("div", { class: "row-gap small" }, h("strong", {}, `Question ${i + 1}`), chip(TAG_NAME[e.skill] || e.skill, levelOf(e.score * 10)), h("span", {}, `${e.score}/10`)),
      h("p", { class: "q-text" }, e.question)),
    h("div", { class: "code-col" }, codeBlock(`${e.repo_full_name}  ${e.file}  lines ${e.lines}`, e.snippet, e.snippet_start_line)),
    h("div", { class: "said" },
      e.evidence_quote ? h("p", { class: "said-quote" }, e.evidence_quote) : null,
      h("p", { class: "said-excerpt" }, `Their answer: ${e.answer_excerpt}`),
      e.covered.length ? h("div", {}, h("div", { class: "small" }, h("strong", {}, "Covered")), h("ul", { class: "points covered" }, e.covered.map((x) => h("li", {}, x)))) : null,
      e.missed.length ? h("div", {}, h("div", { class: "small" }, h("strong", {}, "Missed")), h("ul", { class: "points missed" }, e.missed.map((x) => h("li", {}, x)))) : null,
      scoreBar(e.score),
      h("div", { class: "row-gap small" }, facts)));
}

async function showCandidate(token, studentId, listingId) {
  paint(token, loading("Loading report…"));
  const r = await api(`/api/report/${enc(studentId)}`);
  const repos = [...new Set(r.evidence.map((e) => e.repo_full_name))];
  const back = listingId
    ? h("a", { class: "crumb", href: `#/listing/${enc(listingId)}` }, "Back to applicants")
    : h("a", { class: "crumb", href: "#/" }, "All internships");
  const bh = r.build_history;
  const nodes = [
    h("div", { class: "report-head" },
      h("div", { class: "grow", style: null },
        back,
        h("h1", {}, r.student.name),
        h("div", { class: "row-gap soft" },
          h("span", {}, r.student.college),
          h("a", { href: githubUser(r.student.github_username), target: "_blank", rel: "noopener noreferrer" }, `@${r.student.github_username}`)),
        repos.length
          ? h("p", { class: "small soft" }, repos.length > 1 ? `Based on vivas on ${repos.length} repos: ${repos.join(", ")}` : `Based on a viva on ${repos[0]}`)
          : null),
      r.status === "done"
        ? h("div", { class: "overall" }, h("div", { class: "overall-num" }, String(r.overall)), h("div", { class: "small soft" }, "overall, out of 100"))
        : null),
  ];
  if (r.status !== "done") {
    nodes.push(h("p", { class: "notice" }, "This student hasn't finished a viva yet, so there are no scores to show."));
    return paint(token, ...nodes);
  }
  nodes.push(
    h("section", { class: "block" },
      h("h2", {}, "Claimed and shown"),
      h("p", { class: "block-note" }, "Only skills shown in the viva count toward matches."),
      claimedTable(r.claimed_vs_verified)),
    h("section", { class: "block" },
      h("h2", {}, "Verified skills"),
      skillBars(r.skills)));
  if (r.hackathons.length) {
    nodes.push(h("section", { class: "block" },
      h("h2", {}, "Hackathons"),
      h("p", { class: "block-note" }, "A hackathon is verified when the student finishes a viva on its repo. On team repos the questions are about the files they changed."),
      h("div", {}, hackathonRows(r.hackathons))));
  }
  nodes.push(h("section", { class: "block" },
    h("h2", {}, "Answers"),
    h("p", { class: "block-note" }, "Each question was about the code shown. Their words sit beside it."),
    h("div", { class: "evidence" }, r.evidence.map(evidenceSheet))));
  if (bh) {
    nodes.push(h("section", { class: "block" },
      h("h2", {}, "How the repo was built"),
      h("div", { class: "facts-list" },
        h("p", {}, bh.commits > 100
          ? `${bh.commits} commits in total. The last 100 span ${bh.span_days} days, with commits on ${bh.active_days} of them.`
          : `${bh.commits} commits over ${bh.span_days} days, with commits on ${bh.active_days} of them.`),
        h("p", {}, `${bh.authors} ${bh.authors === 1 ? "author" : "authors"} in ${bh.commits > 100 ? "the last 100 commits" : "the history"}, ${pct(bh.your_commit_share)} of those commits by this student.`),
        h("p", {}, `Median ${bh.median_lines_per_commit} lines changed per commit.`)),
      h("p", { class: "block-note" }, "Facts from GitHub. They don't change the score.")));
  }
  nodes.push(h("section", { class: "block" },
    h("h2", {}, "Matches across all internships"),
    h("div", {}, r.matches.map((m) => h("div", { class: "hack" },
      h("div", {}, h("div", {}, h("strong", {}, `${m.title}, ${m.venture}`)), h("p", { class: "small soft" }, m.why)),
      h("div", { class: "row-gap" }, m.applied ? chip("Applied", "strong") : null, h("strong", {}, `${m.match}%`)))))));
  paint(token, ...nodes);
  window.scrollTo(0, 0);
}

// ---------- Router ----------

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  return { parts: path.split("/").filter(Boolean), query: new URLSearchParams(qs || "") };
}

async function render() {
  const token = ++viewToken;
  stopPolling();
  if (!getKey()) return showSignin();
  signoutButton.hidden = false;
  const { parts, query } = parseHash();
  try {
    if (parts[0] === "listing" && parts[1]) await showShortlist(token, decodeURIComponent(parts[1]));
    else if (parts[0] === "candidate" && parts[1]) await showCandidate(token, decodeURIComponent(parts[1]), query.get("listing"));
    else await showListings(token);
  } catch (e) {
    if (token === viewToken) showError(e);
  }
}

signoutButton.addEventListener("click", () => signOut());
window.addEventListener("hashchange", render);
render();
