"use strict";
// Shared by the recruiter dashboard (web/recruiter), the student app (web/app) and the landing page.
// Material 3 Expressive components, built by hand (no framework). Text from the API is always
// inserted as text nodes, never as HTML.

const VB = (() => {
  const TAGS = [["backend", "Backend"], ["frontend", "Frontend"], ["data", "Data"], ["ai_ml", "AI/ML"], ["devops", "DevOps"], ["security", "Security"]];
  const TAG_NAME = Object.fromEntries(TAGS);
  const TAG_ICON = { backend: "dns", frontend: "web", data: "database", ai_ml: "neurology", devops: "cloud", security: "shield" };
  // Each skill gets its own Material shape, so a stamp reads at a glance
  const TAG_SHAPE = { backend: "cookie9", frontend: "clover", data: "sunny", ai_ml: "burst", devops: "cookie6", security: "cookie12" };
  const LEVEL_LABEL = { strong: "Strong", partial: "Partial", not_verified: "Not verified", not_shown: "Not shown" };
  const LEVEL_ICON = { strong: "verified", partial: "trending_up", not_verified: "error", not_shown: "info" };
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
  // The icon font is subset to these names (web/fonts/material-symbols-rounded.woff2). Add a name here and to the subset together.
  const ICONS = new Set(("account_circle add arrow_back arrow_forward check check_circle chevron_right close cloud code commit content_paste " +
    "database delete description dns download emoji_events error expand_more forum group history home info keyboard lock logout mail mic " +
    "neurology open_in_new person refresh schedule school search shield star stop timer translate trending_up upload_file verified web work").split(" "));

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

  const SVG_NS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, ...children) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
    children.flat().forEach((c) => c && el.append(c));
    return el;
  }

  const enc = encodeURIComponent;
  const githubUser = (u) => `https://github.com/${enc(u)}`;
  const githubRepo = (full) => `https://github.com/${full.split("/").map(enc).join("/")}`;
  const levelOf = (score) => (score === undefined || score === null ? "not_shown" : score >= 70 ? "strong" : score >= 40 ? "partial" : "not_verified");
  const pct = (x) => `${Math.round(x * 100)}%`;
  const repoName = (full) => (full || "").split("/").pop();
  const count = (n, one, many) => `${n} ${n === 1 ? one : many || `${one}s`}`;

  function ago(iso) {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return "";
    const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (sec < 60) return "just now";
    if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
    if (sec < 86400) return `${Math.round(sec / 3600)} h ago`;
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
      throw new ApiError("NETWORK", "Can't reach VerifiedBuild. Check your connection and try again.", 0);
    }
    if (!res.ok) {
      let data = null;
      try { data = await res.json(); } catch { /* not JSON */ }
      const e = data && data.error;
      throw new ApiError((e && e.code) || `HTTP_${res.status}`, (e && e.message) || "Something went wrong. Try again.", res.status);
    }
    return raw ? res : res.json();
  }

  function store(storage) {
    const memory = {};
    return {
      get(k) { try { return storage.getItem(k) ?? memory[k] ?? null; } catch { return memory[k] ?? null; } },
      set(k, v) { memory[k] = v; try { storage.setItem(k, v); } catch { /* memory only */ } },
      del(k) { delete memory[k]; try { storage.removeItem(k); } catch { /* nothing stored */ } },
    };
  }

  // ---------- Icons, shapes, avatars ----------

  function icon(name, cls) {
    if (!ICONS.has(name)) console.warn(`Icon "${name}" is not in the font subset`);
    return h("span", { class: `icon${cls ? ` ${cls}` : ""}`, "aria-hidden": "true" }, name);
  }

  // Material 3 Expressive shapes as polar curves: r(θ) = 50·(1 − k + k·cos(nθ))
  const SHAPES = { cookie4: [4, 0.09], cookie6: [6, 0.07], cookie7: [7, 0.06], cookie9: [9, 0.05], cookie12: [12, 0.035], clover: [4, 0.14, 45], sunny: [8, 0.07], burst: [10, 0.085], circle: [1, 0] };
  const pathCache = {};
  function shapePath(kind) {
    if (pathCache[kind]) return pathCache[kind];
    const [n, k, turn = 0] = SHAPES[kind] || SHAPES.circle;
    const rot = (turn * Math.PI) / 180 - Math.PI / 2;
    const pts = [];
    for (let i = 0; i < 240; i++) {
      const t = (i / 240) * Math.PI * 2;
      const r = 50 * (1 - k + k * Math.cos(n * t));
      pts.push(`${(50 + r * Math.cos(t + rot)).toFixed(2)} ${(50 + r * Math.sin(t + rot)).toFixed(2)}`);
    }
    return (pathCache[kind] = `M${pts.join("L")}Z`);
  }

  function shape(kind, size, tint, ...children) {
    return h("span", { class: `shape s${size} tint-${tint}` },
      s("svg", { viewBox: "0 0 100 100", "aria-hidden": "true" }, s("path", { d: shapePath(kind) })),
      h("span", { class: "shape-in" }, children));
  }

  function brandMark() {
    return s("svg", { class: "brand-mark", viewBox: "0 0 100 100", "aria-hidden": "true" },
      s("path", { d: shapePath("cookie9"), fill: "var(--md-primary)" }),
      s("path", { d: "M30 52 L44 66 L71 37", fill: "none", stroke: "var(--md-on-primary)", "stroke-width": "10", "stroke-linecap": "round", "stroke-linejoin": "round" }));
  }

  function avatar(username, cls) {
    const initial = (username || "?").slice(0, 1).toUpperCase();
    const img = h("img", { class: `avatar${cls ? ` ${cls}` : ""}`, alt: "", src: `https://github.com/${enc(username)}.png?size=144`, loading: "lazy", referrerpolicy: "no-referrer" });
    img.addEventListener("error", () => img.replaceWith(h("span", { class: `avatar avatar-fallback${cls ? ` ${cls}` : ""}`, "aria-hidden": "true" }, initial)));
    return img;
  }

  // ---------- Progress ----------

  function ring(value, { size = 56, stroke = 5, level = "", label, children } = {}) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const offset = (v) => (c * (1 - Math.max(0, Math.min(100, v)) / 100)).toFixed(2);
    const bar = s("circle", { class: "bar", cx: size / 2, cy: size / 2, r, "stroke-width": stroke, "stroke-dasharray": c.toFixed(2), "stroke-dashoffset": c.toFixed(2) });
    const el = h("span", { class: `ring ${level}`.trim(), role: "img", "aria-label": label || `${Math.round(value)}%` },
      s("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}` },
        s("circle", { class: "track", cx: size / 2, cy: size / 2, r, "stroke-width": stroke }), bar),
      h("span", { class: "ring-in" }, children));
    requestAnimationFrame(() => requestAnimationFrame(() => bar.setAttribute("stroke-dashoffset", offset(value))));
    el.set = (v) => bar.setAttribute("stroke-dashoffset", offset(v));
    return el;
  }

  function wavy(label) {
    let d = "M0 8";
    for (let x = 0; x < 800; x += 40) d += ` Q${x + 10} 2 ${x + 20} 8 T${x + 40} 8`;
    return h("div", { class: "wavy", role: "progressbar", "aria-label": label || "Working" },
      s("svg", { viewBox: "0 0 800 16", preserveAspectRatio: "none" }, s("path", { d })));
  }

  function spinner() {
    return s("svg", { class: "spinner", viewBox: "0 0 100 100", "aria-hidden": "true" }, s("path", { d: shapePath("burst") }));
  }

  const loadingView = (text) => h("div", { class: "loading", role: "status" }, spinner(), h("p", { class: "body-l" }, text));

  function stepsBar(total, done, now) {
    return h("div", { class: "progress-steps", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(total), "aria-valuenow": String(done), "aria-label": `${done} of ${total} done` },
      Array.from({ length: total }, (_, i) => h("span", { class: i < done ? "on" : i === now ? "now" : "" })));
  }

  // ---------- Chips, buttons, fields ----------

  function chip(text, kind, iconName) {
    return h("span", { class: `chip ${kind || ""}`.trim() }, iconName ? icon(iconName) : null, text);
  }

  const levelChip = (level) => chip(LEVEL_LABEL[level] || level, level, LEVEL_ICON[level]);

  function filterChips(options, selected, label, onChange) {
    return h("div", { class: "chips", role: "group", "aria-label": label }, options.map(([value, text]) => {
      const b = h("button", { type: "button", class: "chip-filter", "aria-pressed": String(selected.has(value)) }, icon("check"), text);
      b.addEventListener("click", () => {
        if (selected.has(value)) selected.delete(value); else selected.add(value);
        b.setAttribute("aria-pressed", String(selected.has(value)));
        if (onChange) onChange();
      });
      return b;
    }));
  }

  // iconAfter puts the icon after the label, e.g. "Next →"
  function button(text, { kind = "", iconName, iconAfter, href, onclick, type = "button", disabled, label } = {}) {
    const props = { class: `btn ${kind}`.trim(), onclick, disabled, "aria-label": label };
    const kids = [iconName ? icon(iconName) : null, text, iconAfter ? icon(iconAfter, "after") : null];
    return href ? h("a", { ...props, href }, kids) : h("button", { ...props, type }, kids);
  }

  // An outlined text field with a floating label, supporting text and an error state
  function textField({ id, label, type = "text", value = "", support = "", prefix, trail, multiline, attrs = {} }) {
    const input = h(multiline ? "textarea" : "input", { id, type: multiline ? null : type, placeholder: " ", ...attrs, "aria-describedby": `${id}-support` });
    if (value) input.value = value;
    const supportEl = h("div", { class: "field-support", id: `${id}-support`, "aria-live": "polite" });
    const box = h("div", { class: `field-box${prefix ? " has-prefix" : ""}` },
      prefix ? h("span", { class: "prefix" }, prefix) : null, input, h("label", { for: id }, label), trail ? h("span", { class: "trail" }, trail) : null);
    const wrap = h("div", { class: "field" }, box, supportEl);
    const set = (text, state) => {
      wrap.classList.toggle("invalid", state === "error");
      wrap.classList.toggle("ok", state === "ok");
      input.setAttribute("aria-invalid", String(state === "error"));
      supportEl.replaceChildren(...(text ? [state === "error" ? icon("error") : state === "ok" ? icon("check_circle") : null, h("span", {}, text)].filter(Boolean) : []));
    };
    set(support);
    return { wrap, input, box, setError: (t) => set(t, "error"), setOk: (t) => set(t, "ok"), setSupport: (t) => set(t) };
  }

  function selectField({ id, label, options, value }) {
    const select = h("select", { id }, options.map(([v, t]) => h("option", { value: v, selected: v === value }, t)));
    const wrap = h("div", { class: "field" }, h("div", { class: "field-box" }, select, h("label", { for: id }, label), h("span", { class: "select-arrow" }, icon("expand_more"))));
    return { wrap, select };
  }

  function banner(text, { kind = "", iconName = "error", action } = {}) {
    return h("div", { class: `banner ${kind}`.trim(), role: kind === "info" || kind === "ok" ? "status" : "alert" },
      icon(iconName), h("div", { class: "banner-body" }, h("p", { class: "body-m" }, text), action || null));
  }

  // ---------- Snackbar and dialogs ----------

  let snackHost = null;
  function snackbar(text, { actionText, onAction, timeout = 6000 } = {}) {
    if (!snackHost) { snackHost = h("div", { class: "snackbar-host", role: "status", "aria-live": "polite" }); document.body.append(snackHost); }
    const bar = h("div", { class: "snackbar" }, h("p", {}, text));
    const close = () => bar.remove();
    if (actionText) bar.append(h("button", { class: "btn text", type: "button", onclick: () => { close(); onAction(); } }, actionText));
    bar.append(h("button", { class: "icon-btn", type: "button", "aria-label": "Dismiss", onclick: close }, icon("close")));
    snackHost.replaceChildren(bar);
    if (timeout) setTimeout(close, timeout);
    return close;
  }

  function confirm({ title, text, confirmText, iconName, extra, gate, danger }) {
    return new Promise((resolve) => {
      const yes = h("button", { class: `btn ${danger ? "danger" : ""}`.trim(), value: "yes", disabled: !!gate }, confirmText);
      if (gate) gate.addEventListener("change", () => { yes.disabled = !gate.checked; }); // e.g. a consent box that must be ticked
      const d = h("dialog", { "aria-labelledby": "dlg-title" },
        h("form", { method: "dialog" },
          iconName ? h("span", { class: "dialog-icon" }, icon(iconName)) : null,
          h("h2", { id: "dlg-title" }, title),
          text ? h("p", {}, text) : null,
          extra || null,
          h("div", { class: "actions" }, h("button", { class: "btn text", value: "no" }, "Cancel"), yes)));
      d.addEventListener("close", () => { d.remove(); resolve(d.returnValue === "yes"); });
      document.body.append(d);
      d.showModal();
    });
  }

  // ---------- Code, with light syntax colouring ----------

  const KW = {
    py: "and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield match case self cls",
    js: "abstract async await break case catch class const continue debugger default delete do else enum export extends false finally for from function get if implements import in instanceof interface let new null of private protected public readonly return set static super switch this throw true try type typeof undefined var void while with yield",
    c: "abstract boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long new package private protected public return short static super switch synchronized this throw throws try void volatile while true false null fun val var when object data sealed override suspend companion func go defer chan map struct range nil let mut impl fn pub use mod match crate self trait where loop async await dyn string bool",
  };
  const KW_SET = Object.fromEntries(Object.entries(KW).map(([k, v]) => [k, new Set(v.split(" "))]));
  function langOf(file) {
    const ext = (file || "").split(".").pop().toLowerCase();
    if (["py", "pyw", "rb", "sh", "bash", "yml", "yaml", "toml", "r"].includes(ext)) return "py";
    if (["js", "jsx", "ts", "tsx", "mjs", "cjs", "vue", "svelte"].includes(ext)) return "js";
    return "c";
  }

  // Returns, per line, a list of text and <span class="tk-…"> nodes. Text only, never HTML.
  function highlight(lines, file) {
    const lang = langOf(file);
    const hashComments = lang === "py";
    const kw = KW_SET[lang];
    let open = null; // an unfinished block comment or triple-quoted string from an earlier line
    return lines.map((line) => {
      const out = [];
      let plain = "";
      const push = (cls, text) => { if (plain) { out.push(plain); plain = ""; } out.push(h("span", { class: cls }, text)); };
      let i = 0;
      while (i < line.length) {
        if (open) {
          const end = line.indexOf(open.end, i);
          const stop = end === -1 ? line.length : end + open.end.length;
          push(open.cls, line.slice(i, stop));
          if (end !== -1) open = null;
          i = stop;
          continue;
        }
        const rest = line.slice(i);
        const ch = line[i];
        if ((hashComments && ch === "#") || (!hashComments && rest.startsWith("//"))) { push("tk-com", rest); break; }
        if (!hashComments && rest.startsWith("/*")) { open = { end: "*/", cls: "tk-com" }; push("tk-com", "/*"); i += 2; continue; }
        if (lang === "py" && (rest.startsWith('"""') || rest.startsWith("'''"))) { open = { end: rest.slice(0, 3), cls: "tk-str" }; push("tk-str", rest.slice(0, 3)); i += 3; continue; }
        if (ch === '"' || ch === "'" || ch === "`") {
          let j = i + 1;
          while (j < line.length && line[j] !== ch) j += line[j] === "\\" ? 2 : 1;
          const stop = Math.min(j + 1, line.length);
          push("tk-str", line.slice(i, stop));
          i = stop;
          continue;
        }
        if (ch === "@" && /[A-Za-z_]/.test(line[i + 1] || "")) { const m = rest.match(/^@[\w.]+/); push("tk-dec", m[0]); i += m[0].length; continue; }
        if (/\d/.test(ch) && !/[\w$]/.test(line[i - 1] || "")) { const m = rest.match(/^\d[\d_]*(\.\d+)?([eE][+-]?\d+)?/); push("tk-num", m[0]); i += m[0].length; continue; }
        if (/[A-Za-z_$]/.test(ch)) {
          const word = rest.match(/^[A-Za-z_$][\w$]*/)[0];
          if (kw.has(word)) push("tk-kw", word);
          else if (/^\s*\(/.test(line.slice(i + word.length))) push("tk-fn", word);
          else plain += word;
          i += word.length;
          continue;
        }
        plain += ch;
        i += 1;
      }
      if (plain) out.push(plain);
      return out;
    });
  }

  function codeBlock(file, lines, snippet, startLine, repo) {
    const rows = (snippet || "").split("\n");
    return h("figure", { class: "editor" },
      h("figcaption", { class: "editor-tab" }, icon("code"), h("span", { class: "file" }, repo ? `${repoName(repo)}/${file}` : file), h("span", { class: "lines" }, `lines ${lines}`)),
      h("pre", { class: "code", tabindex: "0", "aria-label": `Code from ${file}, lines ${lines}` },
        highlight(rows, file).map((parts, i) => h("span", { class: "code-line" },
          h("span", { class: "code-ln" }, String(startLine + i)),
          h("span", { class: "code-tx" }, parts.length ? parts : " ")))));
  }

  // ---------- Report pieces ----------

  // who: "them" in the recruiter dashboard, "you" in the student app
  const words = (who) => (who === "you"
    ? { claimed: "You claimed this", by: "by you", answer: "Your answer" }
    : { claimed: "They claimed this", by: "by this student", answer: "Their answer" });

  function scoreBadge(overall, size = 120) {
    return h("div", { class: "score-badge", role: "img", "aria-label": `Overall ${overall} out of 100` },
      shape("burst", size, "solid", h("span", { class: "big num" }, String(overall)), h("span", { class: "of" }, "out of 100")));
  }

  function skillStamps(skills) {
    return h("div", { class: "stamps" }, TAGS.map(([tag, name]) => {
      const score = skills[tag];
      const level = levelOf(score);
      return h("div", { class: `stamp ${level}` },
        shape(TAG_SHAPE[tag], 72, level, icon(TAG_ICON[tag], "lg")),
        h("div", { class: "name body-m" }, name),
        score === undefined ? h("div", { class: "body-s var" }, "Not asked") : h("div", { class: "score num" }, String(score)),
        levelChip(level));
    }));
  }

  function claimsList(rows, who) {
    const w = words(who);
    return h("div", { class: "claims", role: "list" }, rows.map((r) => h("div", { class: "claim", role: "listitem" },
      h("div", {},
        h("div", { class: `said${r.claimed ? "" : " none"}` }, r.claimed ? r.name : `${TAG_NAME[r.tag] || r.tag}, not claimed`),
        h("div", { class: "body-s var" }, r.claimed ? `${w.claimed}. It counts as ${TAG_NAME[r.tag] || r.tag}.` : "Shown in the viva anyway")),
      h("span", { class: "arrow" }, icon("arrow_forward")),
      levelChip(r.level))));
  }

  // action(x) returns extra nodes for a row, e.g. "Verify now" and "Remove" buttons
  function hackathonList(items, who, action) {
    const w = words(who);
    return h("div", { class: "hacks" }, items.map((x) => h("div", { class: "li" },
      shape("cookie7", 48, x.verified ? "strong" : "not_shown", icon("emoji_events")),
      h("div", { class: "li-main" },
        h("div", { class: "title-m" }, `${RESULT_LABEL[x.result] || x.result}, ${x.event} ${x.year}`),
        h("div", { class: "li-meta" },
          h("a", { href: githubRepo(x.repo_full_name), target: "_blank", rel: "noopener noreferrer" }, x.repo_full_name),
          h("span", {}, `Team of ${x.team_size}`),
          x.verified && x.your_commit_share !== null ? h("span", {}, `${pct(x.your_commit_share)} of commits ${w.by}`) : null),
        h("div", { class: "chips" }, x.verified ? [chip("Verified", "strong", "verified"), chip(`Viva ${x.viva_score}/100`, "fact")] : chip("Not verified yet", "not_shown"))),
      h("div", { class: "li-trail" }, action ? action(x) : null))));
  }

  function scoreDots(score) {
    return h("span", { class: "score-dots", role: "img", "aria-label": `${score} out of 10` },
      Array.from({ length: 10 }, (_, i) => h("span", { class: i < score ? "on" : "" })));
  }

  function evidenceSheet(e, i, who) {
    const w = words(who);
    return h("article", { class: "sheet", "aria-label": `Answer ${i + 1}` },
      h("div", { class: "sheet-head" },
        h("span", { class: "qnum" }, String(i + 1)),
        chip(TAG_NAME[e.skill] || e.skill, levelOf(e.score * 10), TAG_ICON[e.skill]),
        h("span", { class: "score" }, scoreDots(e.score), `${e.score}/10`)),
      h("p", { class: "sheet-q" }, e.question),
      h("div", { class: "sheet-cols" },
        codeBlock(e.file, e.lines, e.snippet, e.snippet_start_line, e.repo_full_name),
        h("div", { class: "said-box" },
          e.evidence_quote ? h("blockquote", { class: "quote" }, e.evidence_quote) : null,
          h("p", { class: "excerpt" }, `${w.answer}: ${e.answer_excerpt}`),
          e.covered.length ? h("div", {}, h("div", { class: "label-l" }, "Covered"), h("ul", { class: "points covered" }, e.covered.map((x) => h("li", {}, icon("check_circle"), h("span", {}, x))))) : null,
          e.missed.length ? h("div", {}, h("div", { class: "label-l" }, "Missed"), h("ul", { class: "points missed" }, e.missed.map((x) => h("li", {}, icon("info"), h("span", {}, x))))) : null,
          h("div", { class: "facts" },
            chip(e.mode === "voice" ? "Spoken" : "Typed", "fact", e.mode === "voice" ? "mic" : "keyboard"),
            e.duration_s !== null && e.duration_s !== undefined ? chip(`${e.duration_s} s`, "fact", "timer") : null,
            e.had_follow_up ? chip("Follow-up asked", "fact", "forum") : null,
            e.pasted ? chip("Text was pasted", "fact", "content_paste") : null))));
  }

  function buildHistory(bh, who) {
    const w = words(who);
    const big = bh.commits > 100;
    const card = (iconName, value, label) => h("div", { class: "card" }, icon(iconName), h("div", { class: "big num" }, value), h("div", { class: "body-m var" }, label));
    return h("div", { class: "history" },
      card("commit", String(bh.commits), big ? "commits in total" : bh.commits === 1 ? "commit" : "commits"),
      card("schedule", String(bh.span_days), `${bh.span_days === 1 ? "day" : "days"} from first to last commit${big ? " (last 100)" : ""}`),
      card("history", String(bh.active_days), `${bh.active_days === 1 ? "day" : "days"} with commits`),
      card("group", String(bh.authors), `${bh.authors === 1 ? "author" : "authors"}, ${pct(bh.your_commit_share)} of commits ${w.by}`),
      card("code", String(bh.median_lines_per_commit), "median lines changed per commit"));
  }

  function matchCard(m, listing, { top, action } = {}) {
    return h("div", { class: `match-card${top ? " top" : ""}` },
      ring(m.match, { size: 64, stroke: 6, label: `${m.match}% match`, children: h("span", { class: "title-m" }, `${m.match}%`) }),
      h("div", { class: "title-m" }, m.title),
      h("div", { class: "body-m" }, listing && listing.description ? `${m.venture}. ${listing.description}` : m.venture),
      h("p", { class: "why" }, m.why),
      action ? h("div", { class: "actions" }, action) : null);
  }

  // The top app bar takes a container colour once the page scrolls
  function watchScroll(bar) {
    const set = () => bar.classList.toggle("scrolled", window.scrollY > 4);
    window.addEventListener("scroll", set, { passive: true });
    set();
  }

  return {
    TAGS, TAG_NAME, TAG_ICON, TAG_SHAPE, LEVEL_LABEL, RESULT_LABEL, INTERESTS, INTEREST_LABEL, SKILL_CHIPS,
    h, s, enc, githubUser, githubRepo, levelOf, pct, repoName, count, ago, ApiError, api, store,
    icon, shape, shapePath, brandMark, avatar, ring, wavy, spinner, loadingView, stepsBar,
    chip, levelChip, filterChips, button, textField, selectField, banner, snackbar, confirm,
    highlight, codeBlock, scoreBadge, skillStamps, claimsList, hackathonList, scoreDots, evidenceSheet, buildHistory, matchCard, watchScroll,
  };
})();
