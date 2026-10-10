"use strict";
// Shared by the recruiter dashboard (web/recruiter) and the student app (web/app).
// Text from the API is always inserted as text, never as HTML.

const VB = (() => {
  const TAGS = [["backend", "Backend"], ["frontend", "Frontend"], ["data", "Data"], ["ai_ml", "AI/ML"], ["devops", "DevOps"], ["security", "Security"]];
  const TAG_NAME = Object.fromEntries(TAGS);
  const LEVEL_LABEL = { strong: "Strong", partial: "Partial", not_verified: "Not verified", not_shown: "Not shown" };
  const RESULT_LABEL = { winner: "Winner", finalist: "Finalist", participant: "Participant" };
  const INTERESTS = [
    ["ai", "AI"], ["data", "Data"], ["web", "Web"], ["mobile", "Mobile"], ["saas", "SaaS"], ["fintech", "FinTech"],
    ["edtech", "EdTech"], ["hrtech", "HR-Tech"], ["security", "Security"], ["devtools", "Dev tools"], ["growth", "Growth"], ["healthcare", "Healthcare"],
  ];
  const INTEREST_LABEL = Object.fromEntries(INTERESTS);
  const SKILL_CHIPS = [
    "Python", "JavaScript", "TypeScript", "Java", "C++", "React", "Next.js", "HTML/CSS", "Flutter", "Android",
    "Node.js", "FastAPI", "Django", "Flask", "Spring", "SQL", "MongoDB", "Pandas", "Machine Learning", "Deep Learning",
    "LLMs/GenAI", "Docker", "Cloud (AWS/GCP/Azure)", "CI/CD", "Security",
  ];

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
  const repoName = (full) => (full || "").split("/").pop();

  function ago(iso) {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return "";
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  class ApiError extends Error {
    constructor(code, message, status) { super(message); this.code = code; this.status = status; }
  }

  // One call to the API. Throws ApiError with the API's plain-English message.
  async function api(path, { method = "GET", body, headers = {}, raw = false } = {}) {
    const opts = { method, headers: { Accept: raw ? "text/csv" : "application/json", ...headers }, cache: "no-store" };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(path, opts);
    } catch {
      throw new ApiError("NETWORK", "Can't reach the VerifiedBuild API. Check the connection and try again.", 0);
    }
    if (!res.ok) {
      let data = null;
      try { data = await res.json(); } catch { /* not JSON */ }
      const e = data && data.error;
      throw new ApiError((e && e.code) || `HTTP_${res.status}`, (e && e.message) || "Something went wrong. Try again.", res.status);
    }
    return raw ? res : res.json();
  }

  function chip(text, kind) {
    return h("span", { class: `chip ${kind || ""}` }, text);
  }

  const levelChip = (level) => chip(LEVEL_LABEL[level] || level, level);

  function bar(fraction, fillClass) {
    const fill = h("span", { class: `weight-fill ${fillClass || ""}` });
    fill.style.display = "block";
    fill.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
    return h("span", { class: "weight-track" }, fill);
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

  // who: "them" in the recruiter dashboard, "you" in the student app
  const words = (who) => (who === "you"
    ? { claimedCol: "Claimed on your profile", by: "by you", answer: "Your answer", student: "you" }
    : { claimedCol: "Claimed on their profile", by: "by this student", answer: "Their answer", student: "this student" });

  function claimedTable(rows, who) {
    const w = words(who);
    return h("table", { class: "two-col" },
      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, w.claimedCol), h("th", { scope: "col" }, "Shown in the viva"))),
      h("tbody", {}, rows.map((r) => h("tr", {},
        h("td", {}, r.claimed ? r.name : h("span", { class: "faint" }, "Not claimed")),
        h("td", {}, h("span", { class: "row-gap" }, r.claimed ? null : h("span", {}, TAG_NAME[r.tag] || r.tag), levelChip(r.level)))))));
  }

  function skillBars(skills) {
    return h("div", { class: "skillbars" }, TAGS.map(([tag, name]) => {
      const score = skills[tag];
      const level = levelOf(score);
      return h("div", { class: "skillbar" },
        h("span", {}, name),
        bar(score === undefined ? 0 : score / 100, `fill-${level}`),
        h("span", { class: score === undefined ? "faint small" : "small" }, score === undefined ? "Not shown" : `${score} ${LEVEL_LABEL[level]}`));
    }));
  }

  // action(x) returns an extra node for a row, e.g. a "Verify now" or "Remove" button
  function hackathonRows(items, who, action) {
    const w = words(who);
    return items.map((x) => h("div", { class: "hack" },
      h("div", {},
        h("div", {}, h("strong", {}, `${RESULT_LABEL[x.result] || x.result}, ${x.event} ${x.year}`)),
        h("div", { class: "small soft row-gap" },
          h("a", { href: githubRepo(x.repo_full_name), target: "_blank", rel: "noopener noreferrer" }, x.repo_full_name),
          h("span", {}, `Team of ${x.team_size}`),
          x.verified && x.your_commit_share !== null ? h("span", {}, `${pct(x.your_commit_share)} of commits ${w.by}`) : null)),
      h("div", { class: "row-gap" },
        x.verified ? [chip("Verified", "strong"), h("span", { class: "small" }, `Viva ${x.viva_score}/100`)] : chip("Not verified yet", "not_shown"),
        action ? action(x) : null)));
  }

  function evidenceSheet(e, i, who) {
    const w = words(who);
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
        h("p", { class: "said-excerpt" }, `${w.answer}: ${e.answer_excerpt}`),
        e.covered.length ? h("div", {}, h("div", { class: "small" }, h("strong", {}, "Covered")), h("ul", { class: "points covered" }, e.covered.map((x) => h("li", {}, x)))) : null,
        e.missed.length ? h("div", {}, h("div", { class: "small" }, h("strong", {}, "Missed")), h("ul", { class: "points missed" }, e.missed.map((x) => h("li", {}, x)))) : null,
        scoreBar(e.score),
        h("div", { class: "row-gap small" }, facts)));
  }

  const count = (n, one, many) => `${n} ${n === 1 ? one : many || `${one}s`}`;

  function buildHistoryFacts(bh, who) {
    const w = words(who);
    const days = count(bh.span_days, "day");
    const active = bh.span_days > 1 ? `, with commits on ${bh.active_days} of them.` : ".";
    return h("div", { class: "facts-list" },
      h("p", {}, bh.commits > 100
        ? `${bh.commits} commits in total. The last 100 span ${days}${active}`
        : `${count(bh.commits, "commit")} over ${days}${active}`),
      h("p", {}, `${count(bh.authors, "author")} in ${bh.commits > 100 ? "the last 100 commits" : "the history"}, ${pct(bh.your_commit_share)} of those commits ${w.by}.`),
      h("p", {}, `Median ${count(bh.median_lines_per_commit, "line")} changed per commit.`));
  }

  function store(storage) {
    let memory = {};
    return {
      get(k) { try { return storage.getItem(k) ?? memory[k] ?? null; } catch { return memory[k] ?? null; } },
      set(k, v) { memory[k] = v; try { storage.setItem(k, v); } catch { /* memory only */ } },
      del(k) { delete memory[k]; try { storage.removeItem(k); } catch { /* nothing stored */ } },
    };
  }

  return {
    TAGS, TAG_NAME, LEVEL_LABEL, RESULT_LABEL, INTERESTS, INTEREST_LABEL, SKILL_CHIPS,
    h, enc, githubUser, githubRepo, levelOf, pct, repoName, ago, ApiError, api,
    chip, levelChip, bar, codeBlock, scoreBar, claimedTable, skillBars, hackathonRows, evidenceSheet, buildHistoryFacts, store,
  };
})();
