"use strict";
// VerifiedBuild recruiter dashboard. Plain JavaScript, no build step, served by the API itself.
// Shared components live in /common.js (the VB object).

const { h, enc, chip, icon, shape, button, api: callApi, levelOf, ago, TAGS, TAG_NAME, pct } = VB;
const POLL_MS = 5000;
const KEY = "vb_admin_key";
const session = VB.store(window.sessionStorage);
const wide = window.matchMedia("(min-width: 1200px)");

const app = document.getElementById("app");
const live = document.getElementById("live");
const signoutButton = document.getElementById("signout");
signoutButton.append(icon("logout"));
VB.watchScroll(document.getElementById("appbar"));

let viewToken = 0; // bumps on every navigation, so a slow fetch or poll never paints over a newer view
let pollTimer = null;

const api = (path, opts = {}) => callApi(path, { ...opts, headers: opts.admin ? { "X-Admin-Key": session.get(KEY) || "" } : {} });

function paint(token, ...nodes) {
  if (token !== viewToken) return false;
  app.replaceChildren(...nodes.flat().filter((n) => n !== null && n !== undefined && n !== false));
  return true;
}

const head = (title, sub, back, trailing) => h("div", { class: "page-head" },
  back ? h("a", { class: "btn text back", href: back[0] }, icon("arrow_back"), back[1]) : null,
  h("div", { class: "section-head" }, h("h1", { class: "headline-l" }, title), trailing || null),
  sub ? h("p", { class: "body-l var" }, sub) : null);

const section = (title, note, ...children) => h("section", { class: "section" },
  h("div", { class: "section-head" }, h("h2", { class: "title-l" }, title)), note ? h("p", { class: "section-note" }, note) : null, children);

function setLive(state) {
  live.replaceChildren(state ? chip(state === "ok" ? "Updating live" : "Reconnecting", `live${state === "ok" ? "" : " stale"}`) : "");
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  setLive(null);
}

function startPolling(token, refresh) {
  stopPolling();
  setLive("ok");
  pollTimer = setInterval(async () => {
    if (token !== viewToken || document.hidden) return;
    try {
      await refresh();
      setLive("ok");
    } catch (e) {
      if (e.code === "BAD_ADMIN_KEY") return signOut(e.message);
      setLive("stale");
    }
  }, POLL_MS);
}

// ---------- Sign in ----------

function showSignin(message) {
  ++viewToken;
  stopPolling();
  signoutButton.hidden = true;
  const pass = VB.textField({ id: "passcode", label: "Passcode", type: "password", attrs: { autocomplete: "current-password" } });
  if (message) pass.setError(message);
  const submit = button("Sign in", { type: "submit", kind: "lg", iconAfter: "arrow_forward" });
  const form = h("form", {
    class: "signin", novalidate: true,
    onsubmit: async (ev) => {
      ev.preventDefault();
      if (!pass.input.value.trim()) { pass.setError("Enter the passcode."); return; }
      submit.disabled = true;
      session.set(KEY, pass.input.value.trim());
      try {
        await api("/api/admin/verify", { admin: true });
        location.hash = "#/";
        render();
      } catch (e) {
        session.del(KEY);
        pass.setError(e.message);
        submit.disabled = false;
        pass.input.focus();
      }
    },
  },
    VB.seal({ empty: true, size: 72, seed: "recruiter", center: icon("lock") }),
    h("div", { class: "fields" },
      h("h1", { class: "headline-m" }, "Recruiter sign-in"),
      h("p", { class: "body-m var" }, "Enter the passcode from the VerifiedBuild team to see who applied to your internships, ranked by the skills they verified.")),
    pass.wrap,
    h("div", { class: "actions end" }, submit));
  app.replaceChildren(form);
  pass.input.focus();
}

function signOut(message) {
  session.del(KEY);
  location.hash = "#/";
  showSignin(message);
}

function showError(e) {
  if (e.code === "BAD_ADMIN_KEY") return signOut(e.message);
  app.replaceChildren(h("div", { class: "section" }, VB.banner(e.message, { action: button("Try again", { kind: "text", iconName: "refresh", onclick: () => render() }) })));
}

// ---------- Internships, each with its applicants ----------

function weightBars(required) {
  const weights = Object.entries(required).sort((a, b) => b[1] - a[1]);
  const total = weights.reduce((sum, [, w]) => sum + w, 0) || 1;
  return h("div", { class: "weights", "aria-label": "Skills this role needs" }, weights.map(([tag, w]) => {
    const fill = h("span");
    fill.style.width = pct(w / total);
    return h("div", { class: "weight" }, h("span", {}, TAG_NAME[tag] || tag), h("span", { class: "track" }, fill), h("span", { class: "num" }, pct(w / total)));
  }));
}

function listingCard(listing, shortlist) {
  const candidates = shortlist.candidates || [];
  const top = candidates[0];
  return h("a", { class: "listing-card", href: `#/listing/${enc(listing.id)}` },
    h("div", { class: "listing-top" },
      shape("cookie6", 48, "secondary", h("span", { class: "title-m" }, listing.venture.slice(0, 1))),
      h("div", {}, h("div", { class: "title-l" }, listing.title), h("div", { class: "body-m var" }, listing.venture))),
    h("p", { class: "body-m var clamp-2" }, listing.description),
    weightBars(listing.required_skills),
    h("div", { class: "listing-foot" },
      h("span", { class: `count-badge${candidates.length ? "" : " zero"}` }, String(candidates.length)),
      h("span", { class: "body-m" }, candidates.length ? (candidates.length === 1 ? "applicant" : "applicants") : "No applicants yet"),
      h("span", { class: "spacer" }),
      top ? h("span", { class: "body-s var" }, `Top: ${top.name}, ${top.match}%`) : null,
      icon("chevron_right")));
}

async function showListings(token) {
  paint(token, VB.loadingView("Loading internships…"));
  let lastJson = "";
  const draw = async () => {
    const { listings } = await api("/api/listings");
    const shortlists = await Promise.all(listings.map((l) => api(`/api/admin/shortlist/${enc(l.id)}`, { admin: true })));
    const json = JSON.stringify(shortlists);
    if (json === lastJson) return;
    lastJson = json;
    const applications = shortlists.reduce((n, sl) => n + sl.candidates.length, 0);
    paint(token,
      head("Internships", applications
        ? `${VB.count(applications, "application")} so far. Students appear here when they apply and agree to share their report.`
        : "No applications yet. Students appear here when they apply and agree to share their report."),
      h("div", { class: "listing-grid" }, listings.map((l, i) => listingCard(l, shortlists[i]))));
  };
  await draw();
  startPolling(token, draw);
}

// ---------- Ranked applicants for one internship ----------

function candidateItem(c, listingId, { isNew, selected, onSelect }) {
  const skills = TAGS.filter(([tag]) => c.skills[tag] !== undefined);
  const href = `#/candidate/${enc(c.student_id)}?listing=${enc(listingId)}`;
  return h("a", {
    class: `li cand${isNew ? " new" : ""}${selected ? " selected" : ""}`, href, "aria-current": selected ? "true" : null,
    onclick: (ev) => { if (onSelect && wide.matches) { ev.preventDefault(); onSelect(c.student_id); } },
  },
    h("span", { class: "rank", "aria-label": `Rank ${c.rank}` }, String(c.rank)),
    VB.seal({ skills: c.skills, seed: c.github_username, size: 52, center: VB.avatar(c.github_username) }),
    h("div", { class: "li-main" },
      h("div", { class: "title-m" }, c.name),
      h("div", { class: "li-meta" }, h("span", {}, c.college), h("span", {}, `Applied ${ago(c.applied_at)}`)),
      h("div", { class: "mini-skills badges" }, skills.map(([tag, name]) => VB.badge(name.toLowerCase(), String(c.skills[tag]), levelOf(c.skills[tag]))),
        (c.hackathons || []).length ? chip(`${c.hackathons.length} verified hackathon${c.hackathons.length > 1 ? "s" : ""}`, "tertiary", "emoji_events") : null)),
    h("span", { class: "cand-match", "aria-label": `${c.match}% match` }, h("span", { class: "pct" }, `${c.match}%`), h("span", { class: "lbl" }, "match")));
}

async function downloadCsv(listingId, btn) {
  btn.disabled = true;
  try {
    const res = await api(`/api/admin/shortlist/${enc(listingId)}/csv`, { admin: true, raw: true });
    const url = URL.createObjectURL(await res.blob());
    const a = h("a", { href: url, download: `shortlist-${listingId}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    VB.snackbar("CSV downloaded.");
  } catch (e) {
    if (e.code === "BAD_ADMIN_KEY") return signOut(e.message);
    VB.snackbar(e.message);
  } finally {
    btn.disabled = false;
  }
}

async function showShortlist(token, listingId, selectedId) {
  paint(token, VB.loadingView("Loading applicants…"));
  let known = null;
  let lastJson = "";
  let selected = selectedId;
  let sl = null;
  // The full listing (with its skill weights), so each match can show its formula
  const full = await api("/api/listings").then((x) => x.listings.find((l) => l.id === listingId)).catch(() => null);
  const listEl = h("div", { class: "list split-list" });
  const detail = h("div", { class: "split-detail" });
  const select = async (id) => {
    selected = id;
    history.replaceState(null, "", `#/listing/${enc(listingId)}?c=${enc(id)}`);
    drawList(new Set());
    detail.replaceChildren(VB.loadingView("Loading report…"));
    try {
      const r = await api(`/api/report/${enc(id)}`);
      if (token === viewToken && selected === id) detail.replaceChildren(...reportNodes(r, full || sl.listing));
    } catch (e) { detail.replaceChildren(VB.banner(e.message)); }
  };
  const drawList = (fresh) => listEl.replaceChildren(...sl.candidates.map((c) => candidateItem(c, listingId, { isNew: fresh.has(c.student_id), selected: wide.matches && c.student_id === selected, onSelect: select })));
  const draw = async () => {
    sl = await api(`/api/admin/shortlist/${enc(listingId)}`, { admin: true });
    const json = JSON.stringify(sl);
    if (json === lastJson) return;
    lastJson = json;
    const ids = sl.candidates.map((c) => c.student_id);
    const fresh = new Set(known ? ids.filter((id) => !known.has(id)) : []);
    known = new Set(ids);
    if (fresh.size) {
      const names = sl.candidates.filter((c) => fresh.has(c.student_id)).map((c) => c.name).join(", ");
      VB.snackbar(`New applicant: ${names}`, { actionText: wide.matches ? "View" : null, onAction: () => select([...fresh][0]) });
    }
    const csv = button("Download CSV", { kind: "outlined", iconName: "download" });
    csv.addEventListener("click", () => downloadCsv(listingId, csv));
    if (!sl.candidates.length) {
      return paint(token,
        head(sl.listing.title, `${sl.listing.venture}. Ranked by match on verified skills and verified hackathons, then by overall score.`, ["#/", "All internships"]),
        h("div", { class: "section" }, h("div", { class: "split-detail" }, h("div", { class: "empty-detail" },
          shape("cookie9", 72, "secondary", icon("group", "lg")),
          h("h2", { class: "title-l" }, "No applicants yet"),
          h("p", { class: "body-m" }, "Students appear here the moment they apply and agree to share their report. This page updates by itself.")))));
    }
    drawList(fresh);
    // After a reload the URL already names a candidate, but the detail pane is still empty
    if (wide.matches && (!selected || !ids.includes(selected) || !detail.firstChild)) select(ids.includes(selected) ? selected : ids[0]);
    paint(token,
      head(sl.listing.title, `${sl.listing.venture}. ${VB.count(sl.candidates.length, "applicant")}, ranked by match on verified skills and verified hackathons, then by overall score.`, ["#/", "All internships"], csv),
      h("div", { class: "split section" }, listEl, wide.matches ? detail : null));
  };
  await draw();
  startPolling(token, draw);
}

// ---------- One candidate's report ----------

function reportNodes(r, listing) {
  const nodes = [VB.credential(r, "them")];
  if (r.status !== "done") return nodes.concat(h("div", { class: "section" }, VB.banner("This student hasn't finished a viva yet, so there are no scores to show.", { kind: "info", iconName: "info" })));
  const forThis = listing ? r.matches.find((m) => m.listing_id === listing.id) : null;
  if (forThis) nodes.push(h("div", { class: "section" }, VB.matchCard(forThis, listing, { top: true, report: r })));
  nodes.push(
    section("Verified skills", "From their answers. 70 and up is strong, 40 to 69 partial.", VB.skillStamps(r.skills)),
    section("Resume → viva", "+ was shown in the viva without being claimed. − is on the resume but wasn't shown here. Only shown skills count toward matches.", VB.claimsList(r.claimed_vs_verified, "them")));
  if (r.hackathons.length) nodes.push(section("Hackathons", "Verified when the student finishes a viva on its repo. On team repos the questions are about the files they changed.", VB.hackathonList(r.hackathons, "them")));
  nodes.push(section("Answers", "Each question was about the code shown beside it.", h("div", { class: "evidence" }, r.evidence.map((e, i) => VB.evidenceSheet(e, i, "them")))));
  if (r.build_history) nodes.push(section("How the repo was built", "Facts from GitHub. They don't change the score.", VB.buildHistory(r.build_history, "them")));
  nodes.push(section("Matches across all internships", null, h("div", { class: "list" }, r.matches.map((m) => h("div", { class: "li" },
    VB.ring(m.match, { size: 48, stroke: 4, label: `${m.match}% match`, children: h("span", { class: "label-m" }, `${m.match}%`) }),
    h("div", { class: "li-main" }, h("div", { class: "title-m" }, `${m.title}, ${m.venture}`), h("div", { class: "body-s var" }, m.why)),
    h("span", { class: "li-trail" }, m.applied ? VB.stampApplied(false) : null))))));
  return nodes;
}

async function showCandidate(token, studentId, listingId) {
  paint(token, VB.loadingView("Loading report…"));
  const [r, listings] = await Promise.all([api(`/api/report/${enc(studentId)}`), api("/api/listings").then((x) => x.listings).catch(() => [])]);
  const listing = listings.find((l) => l.id === listingId) || null;
  const back = h("a", { class: "btn text back", href: listingId ? `#/listing/${enc(listingId)}` : "#/" }, icon("arrow_back"), listingId ? "Back to applicants" : "All internships");
  paint(token, h("div", { class: "page-head" }, back), ...reportNodes(r, listing));
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
    if (parts[0] === "listing" && parts[1]) await showShortlist(token, decodeURIComponent(parts[1]), query.get("c"));
    else if (parts[0] === "candidate" && parts[1]) await showCandidate(token, decodeURIComponent(parts[1]), query.get("listing"));
    else await showListings(token);
  } catch (e) {
    if (token === viewToken) showError(e);
  }
}

signoutButton.addEventListener("click", () => signOut());
window.addEventListener("hashchange", render);
wide.addEventListener("change", render);
render();
