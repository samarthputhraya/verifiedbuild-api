"use strict";
// VerifiedBuild recruiter dashboard. Plain JavaScript, no build step, served by the API itself.
// Shared rendering lives in /common.js (the VB object).

const { h, enc, chip, api: callApi, githubUser, levelOf, ago, TAGS, TAG_NAME, RESULT_LABEL, pct } = VB;
const POLL_MS = 5000;
const KEY = "vb_admin_key";
const session = VB.store(window.sessionStorage);

const app = document.getElementById("app");
const signoutButton = document.getElementById("signout");
const announcer = h("div", { class: "sr-only", role: "status" });
document.body.append(announcer);

let viewToken = 0; // bumps on every navigation, so a slow fetch or poll never paints over a newer view
let pollTimer = null;

const api = (path, opts = {}) => callApi(path, { ...opts, headers: opts.admin ? { "X-Admin-Key": session.get(KEY) || "" } : {} });

function paint(token, ...nodes) {
  if (token !== viewToken) return false;
  app.replaceChildren(...nodes.flat().filter((n) => n !== null && n !== undefined && n !== false));
  return true;
}

const loading = (text) => h("p", { class: "soft" }, text);

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

// ---------- Sign in ----------

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
      session.set(KEY, input.value.trim());
      try {
        await api("/api/admin/verify", { admin: true });
        location.hash = "#/";
        render();
      } catch (e) {
        session.del(KEY);
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
  session.del(KEY);
  location.hash = "#/";
  showSignin(message);
}

function showError(e) {
  if (e.code === "BAD_ADMIN_KEY") return signOut(e.message);
  app.replaceChildren(h("div", { class: "empty" },
    h("p", { class: "notice" }, e.message),
    h("div", {}, h("button", { onclick: () => render() }, "Try again"))));
}

// ---------- Internships, each with its applicants ----------

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
        VB.bar(w / total),
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
    const applications = shortlists.reduce((n, s) => n + s.candidates.length, 0);
    paint(token,
      h("div", { class: "page-head" },
        h("div", { class: "grow" },
          h("h1", {}, "Internships"),
          h("p", { class: "soft" }, applications
            ? `${applications} ${applications === 1 ? "application" : "applications"} so far. Students appear here when they apply and agree to share their report.`
            : "No applications yet. Students appear here when they apply and agree to share their report.")),
        status),
      h("div", { class: "listings" }, listings.map((l, i) => listingRow(l, shortlists[i]))));
  };
  await draw();
  startPolling(token, draw, status);
}

// ---------- Ranked applicants for one internship ----------

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

// ---------- One candidate's full report ----------

async function showCandidate(token, studentId, listingId) {
  paint(token, loading("Loading report…"));
  const r = await api(`/api/report/${enc(studentId)}`);
  const repos = [...new Set(r.evidence.map((e) => e.repo_full_name))];
  const back = listingId
    ? h("a", { class: "crumb", href: `#/listing/${enc(listingId)}` }, "Back to applicants")
    : h("a", { class: "crumb", href: "#/" }, "All internships");
  const nodes = [
    h("div", { class: "report-head" },
      h("div", {},
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
      VB.claimedTable(r.claimed_vs_verified, "them")),
    h("section", { class: "block" },
      h("h2", {}, "Verified skills"),
      VB.skillBars(r.skills)));
  if (r.hackathons.length) {
    nodes.push(h("section", { class: "block" },
      h("h2", {}, "Hackathons"),
      h("p", { class: "block-note" }, "A hackathon is verified when the student finishes a viva on its repo. On team repos the questions are about the files they changed."),
      h("div", {}, VB.hackathonRows(r.hackathons, "them"))));
  }
  nodes.push(h("section", { class: "block" },
    h("h2", {}, "Answers"),
    h("p", { class: "block-note" }, "Each question was about the code shown. Their words sit beside it."),
    h("div", { class: "evidence" }, r.evidence.map((e, i) => VB.evidenceSheet(e, i, "them")))));
  if (r.build_history) {
    nodes.push(h("section", { class: "block" },
      h("h2", {}, "How the repo was built"),
      VB.buildHistoryFacts(r.build_history, "them"),
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
  if (!session.get(KEY)) return showSignin();
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
