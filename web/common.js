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

  // The logo: an ink disc with one guilloche strand and a check
  function brandMark() {
    const wave = [];
    for (let i = 0; i <= 180; i++) {
      const t = (i / 180) * Math.PI * 2;
      const r = 37 + 3 * Math.sin(12 * t);
      wave.push(`${(50 + r * Math.cos(t)).toFixed(1)} ${(50 + r * Math.sin(t)).toFixed(1)}`);
    }
    return s("svg", { class: "brand-mark", viewBox: "0 0 100 100", "aria-hidden": "true" },
      s("circle", { class: "bm-disc", cx: 50, cy: 50, r: 48 }),
      s("path", { class: "bm-wave", d: `M${wave.join("L")}Z` }),
      s("path", { class: "bm-check", d: "M31 52 L44 65 L70 38" }));
  }

  // ---------- The seal: a guilloche rosette drawn from one student's scores ----------

  // A small seeded random generator, so the same student always gets the same seal
  function seeded(text) {
    let h32 = 2166136261;
    for (const ch of String(text || "")) { h32 ^= ch.charCodeAt(0); h32 = Math.imul(h32, 16777619); }
    let a = h32 >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  let sealCount = 0;
  const FOIL_STOPS = ["f1", "f2", "f3", "f4", "f5", "f1"];
  function foilGradient(id, len = 140) {
    return s("linearGradient", { id, class: "foil", gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: len, y2: len, spreadMethod: "reflect" },
      FOIL_STOPS.map((cls, i) => s("stop", { class: cls, offset: (i / (FOIL_STOPS.length - 1)).toFixed(2) })));
  }

  // skills: { tag: score }. Each of the 6 skills is one band of the rosette, outermost first; a higher score
  // makes a deeper wave, and a skill that wasn't asked is a faint dotted ring. The seed sets the waves' phase.
  function seal({ skills = {}, seed = "", size = 200, micro = null, draw = false, empty = false, label, center } = {}) {
    const id = `foil-${++sealCount}`;
    const rand = seeded(seed);
    const small = size < 96;
    const steps = small ? 200 : 420;
    const strands = small ? 3 : 4;
    const radii = [80, 70.5, 61, 51.5, 42, 33];
    const bands = [];
    TAGS.forEach(([tag], k) => {
      const score = skills[tag];
      const R = radii[k];
      const n = [34, 30, 26, 22, 18, 14][k] + 2 * Math.floor(rand() * 3);
      const phase = rand() * Math.PI * 2;
      const wob = rand() * Math.PI * 2;
      if (empty || score === undefined || score === null) {
        bands.push(s("circle", { class: "band flat", cx: 100, cy: 100, r: R, pathLength: 1, "stroke-width": small ? 1.4 : 0.8 }));
        return;
      }
      const A = 1.2 + 3.6 * Math.max(0, Math.min(100, score)) / 100;
      for (let j = 0; j < strands; j++) {
        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const t = (i / steps) * Math.PI * 2;
          const r = R + A * (0.82 + 0.18 * Math.sin(2 * t + wob)) * Math.sin(n * t + phase + (j * Math.PI * 2) / strands);
          pts.push(`${(100 + r * Math.cos(t)).toFixed(2)} ${(100 + r * Math.sin(t)).toFixed(2)}`);
        }
        bands.push(s("path", { class: "band", d: `M${pts.join("L")}Z`, pathLength: 1, stroke: `url(#${id})`, "stroke-width": small ? 0.9 : 0.62 }));
      }
    });
    const parts = [s("defs", {}, foilGradient(id), micro ? s("path", { id: `${id}-rim`, d: "M100 8 a92 92 0 1 1 -0.01 0" }) : null)];
    if (!small) parts.push(s("circle", { class: "rim", cx: 100, cy: 100, r: 97, "stroke-width": 0.6 }), s("circle", { class: "rim", cx: 100, cy: 100, r: 88, "stroke-width": 0.4 }));
    if (micro) {
      const text = s("text", { class: "micro" }, s("textPath", { href: `#${id}-rim` }, `${micro} · `.repeat(Math.max(1, Math.ceil(170 / (micro.length + 3))))));
      parts.push(text);
    }
    parts.push(...bands, s("circle", { class: "disc", cx: 100, cy: 100, r: 25 }));
    const el = h("div", { class: `seal${small ? " small" : ""}${draw ? " draw" : ""}${empty ? " empty" : ""}`, role: label ? "img" : null, "aria-label": label || null, "aria-hidden": label ? null : "true" },
      s("svg", { viewBox: "0 0 200 200" }, parts), center ? h("div", { class: "seal-in" }, center) : null);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.setProperty("--seal", `${size}px`);
    initTilt();
    return el;
  }

  // The overall score in the middle of a seal; with draw, it counts up once the lines are drawn
  function sealScore(overall, { of = "out of 100", countUp = false } = {}) {
    const big = h("span", { class: "big" }, countUp ? "0" : String(overall));
    if (countUp) {
      const start = performance.now() + 1100;
      const step = (now) => {
        const p = Math.max(0, Math.min(1, (now - start) / 900));
        big.textContent = String(Math.round(overall * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    return [big, of ? h("span", { class: "of" }, of) : null];
  }

  // Tilt the phone (or move the mouse) and the foil shifts, like a hologram on a banknote
  const tilt = { x: 0, y: 0, frame: 0, ready: false };
  function applyTilt() {
    tilt.frame = 0;
    const root = document.documentElement.style;
    root.setProperty("--tilt-x", tilt.x.toFixed(3));
    root.setProperty("--tilt-y", tilt.y.toFixed(3));
    const transform = `rotate(${(tilt.x * 40).toFixed(1)} 100 100) translate(${(tilt.x * 36).toFixed(1)} ${(tilt.y * 36).toFixed(1)})`;
    document.querySelectorAll("linearGradient.foil").forEach((g) => g.setAttribute("gradientTransform", transform));
  }
  function setTilt(x, y) {
    tilt.x = Math.max(-1, Math.min(1, x));
    tilt.y = Math.max(-1, Math.min(1, y));
    if (!tilt.frame) tilt.frame = requestAnimationFrame(applyTilt);
  }
  function initTilt() {
    if (tilt.ready) return;
    tilt.ready = true;
    window.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") setTilt((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1); }, { passive: true });
    window.addEventListener("deviceorientation", (e) => { if (e.gamma !== null) setTilt(e.gamma / 28, ((e.beta || 45) - 45) / 28); }, { passive: true });
    // iPhones ask first, on a tap
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === "function") {
      window.addEventListener("pointerdown", () => D.requestPermission().catch(() => {}), { once: true });
    }
  }

  // A record number from the student's id, e.g. VB-78DE-E06D
  const recordNo = (id) => { const x = String(id || "").replace(/[^0-9a-f]/gi, "").toUpperCase().padEnd(8, "0"); return `VB-${x.slice(0, 4)}-${x.slice(4, 8)}`; };

  // The fine wavy strip along the top of a credential
  function guillocheStrip(seed) {
    const rand = seeded(`${seed}-strip`);
    const id = `foil-${++sealCount}`;
    const paths = [];
    for (let j = 0; j < 5; j++) {
      const period = 22 + Math.floor(rand() * 3) * 6;
      const amp = 6 + rand() * 6;
      const ph = rand() * Math.PI * 2;
      const pts = [];
      for (let x = 0; x <= 600; x += 2) pts.push(`${x} ${(18 + amp * Math.sin((x / period) * Math.PI * 2 + ph + j * 1.1)).toFixed(2)}`);
      paths.push(s("path", { d: `M${pts.join("L")}`, stroke: `url(#${id})`, "vector-effect": "non-scaling-stroke" }));
    }
    initTilt();
    return s("svg", { class: "cred-strip", viewBox: "0 0 600 36", preserveAspectRatio: "none", "aria-hidden": "true" }, s("defs", {}, foilGradient(id, 260)), paths);
  }

  // Code-shaped bars that scroll past a scan line while the repo is read
  function scanner(seed) {
    const rand = seeded(seed);
    const kinds = ["sc-kw", "sc-tx", "sc-fn", "sc-tx", "sc-str", "sc-num", "sc-tx", "sc-com"];
    let indent = 0;
    const rows = [];
    for (let i = 0; i < 26; i++) {
      if (rand() < 0.25) indent = Math.max(0, indent - 1); else if (rand() < 0.3) indent = Math.min(3, indent + 1);
      const toks = [];
      const n = rand() < 0.12 ? 0 : 1 + Math.floor(rand() * 4);
      for (let k = 0; k < n; k++) toks.push([kinds[Math.floor(rand() * kinds.length)], (1 + rand() * 5.5).toFixed(2)]);
      rows.push([String(i + 1), indent * 1.1, toks]);
    }
    // Built twice, so the scroll loops without a jump
    const draw = () => rows.map(([ln, indentRem, toks]) => {
      const pad = h("span");
      pad.style.width = `${indentRem}rem`;
      return h("div", { class: "scanner-row" }, h("span", { class: "ln" }, ln), pad, toks.map(([cls, w]) => { const t = h("i", { class: cls }); t.style.width = `${w}rem`; return t; }));
    });
    return h("div", { class: "scanner", "aria-hidden": "true" }, h("div", { class: "scanner-rows" }, draw(), draw()));
  }

  // A run as stages, like a CI pipeline. state: queued, run, pass, part, fail or done (answered, no score shown)
  function pipeline(stages, { row = false, tests = false, label } = {}) {
    const mark = (st, i) => (st.state === "pass" || st.state === "done" ? icon("check")
      : st.state === "fail" ? icon("close") : st.state === "part" ? "~" : String(i + 1));
    return h("ol", { class: `pipeline${row ? " across" : ""}${tests ? " tests" : ""}`, "aria-label": label || null },
      stages.map((st, i) => h("li", { class: `stage ${st.state}`, "aria-label": st.aria || null },
        h("span", { class: "node", "aria-hidden": "true" }, mark(st, i)),
        h("span", { class: "what" }, st.label ? h("b", {}, st.label) : null, st.sub ? h("small", {}, st.sub) : null),
        st.when ? h("span", { class: "when" }, st.when) : null)));
  }
  const RUN_STATE = { strong: "pass", partial: "part", not_verified: "fail", not_shown: "queued" };

  // A build badge, as on a README: skill on the left, result on the right
  const SHORT_LEVEL = { strong: "strong", partial: "partial", not_verified: "not verified", not_shown: "not shown" };
  function badge(key, value, level) {
    return h("span", { class: `badge ${level}` }, h("span", { class: "k" }, key), h("span", { class: "v" }, value));
  }
  function skillBadges(skills, { lg = false, cascade = false, only = null, delay = 1300 } = {}) {
    const rows = TAGS.map(([tag, name]) => ({ tag, name, score: skills[tag] }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      .filter((x) => !only || only(x));
    return h("div", { class: `badges${lg ? " lg" : ""}${cascade ? " cascade" : ""}`, role: "list", "aria-label": "Verified skills" },
      rows.map((x, i) => {
        const level = levelOf(x.score);
        const b = badge(x.name.toLowerCase(), x.score === undefined ? SHORT_LEVEL.not_shown : `${x.score} ${SHORT_LEVEL[level]}`, level);
        b.setAttribute("role", "listitem");
        if (cascade) b.style.animationDelay = `${delay + i * 110}ms`;
        return b;
      }));
  }

  // The match formula, split into its three parts: verified skills (60), interests (25) and verified hackathons (15).
  // Skills and hackathons are recomputed here from the report; interests are what remains of the API's match.
  const RESULT_WEIGHT = { winner: 1, finalist: 0.8, participant: 0.6 };
  function matchBreakdown(m, listing, report) {
    if (!listing || !report) return null;
    const weights = Object.entries(listing.required_skills || {});
    const total = weights.reduce((sum, [, w]) => sum + w, 0);
    if (!total) return null;
    const fit = weights.reduce((sum, [tag, w]) => sum + w * ((report.skills[tag] || 0) / 100), 0) / total;
    const hack = Math.max(0, ...report.hackathons.filter((x) => x.verified && x.viva_score !== null).map((x) => (x.viva_score / 100) * (RESULT_WEIGHT[x.result] || 0)));
    const skillPts = Math.round(60 * fit);
    const hackPts = Math.round(15 * hack);
    const intPts = m.match - skillPts - hackPts;
    if (intPts < -1 || intPts > 26) return null; // doesn't add up, so show nothing rather than a wrong split
    const parts = [["b-skill", "Skills", skillPts], ["b-int", "Interests", Math.max(0, intPts)], ["b-hack", "Hackathons", hackPts]];
    const bar = h("div", { class: "breakdown-bar", "aria-hidden": "true" });
    parts.forEach(([cls, , pts]) => { const sp = h("span", { class: cls }); sp.style.width = "0%"; bar.append(sp); requestAnimationFrame(() => requestAnimationFrame(() => { sp.style.width = `${pts}%`; })); });
    return h("div", { class: "breakdown", role: "img", "aria-label": `Match ${m.match}: skills ${skillPts}, interests ${Math.max(0, intPts)}, hackathons ${hackPts}` },
      bar, h("div", { class: "breakdown-key" }, parts.map(([cls, name, pts]) => h("span", {}, h("i", { class: cls }), `${name} ${pts}`))));
  }

  // One block per answer across the top of a record, coloured by its level
  function statusRail(evidence) {
    return h("div", { class: "status-rail", "aria-hidden": "true" }, evidence.map((e) => h("span", { class: levelOf(e.score * 10) })));
  }

  function stampApplied(fresh) {
    return h("span", { class: `stamp-applied${fresh ? " fresh" : ""}` }, icon("check_circle"), "Applied");
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
    return s("svg", { class: "spinner", viewBox: "0 0 48 48", "aria-hidden": "true" },
      s("circle", { class: "sp-track", cx: 24, cy: 24, r: 20 }),
      s("circle", { class: "sp-bar", cx: 24, cy: 24, r: 20, "stroke-dasharray": "34 92" }));
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

  // The student's seal with the overall score in the middle
  function scoreSeal(r, size = 200, { draw = false } = {}) {
    return seal({ skills: r.skills, seed: r.student.github_username, size, draw, micro: size >= 180 ? `${r.student.github_username} ${recordNo(r.student.student_id || r.student.id)} verified by viva` : null,
      label: `Overall ${r.overall} out of 100`, center: sealScore(r.overall, { countUp: draw }) });
  }

  // The top of a report: who it belongs to, the record number and the seal
  function credential(r, who, { extra } = {}) {
    const repos = [...new Set(r.evidence.map((e) => e.repo_full_name))];
    const sid = r.student.student_id || r.student.id || r.student.github_username;
    return h("article", { class: "credential", "aria-label": "Verified skill record" },
      r.status === "done" ? statusRail(r.evidence) : h("div", { class: "status-rail" }),
      h("div", { class: "cred-head" }, h("span", { class: "title-m" }, "Verified skill record"), h("span", { class: "record-no" }, recordNo(sid))),
      h("div", { class: "cred-body" },
        h("div", { class: "holder" },
          h("div", { class: "holder-id" }, avatar(r.student.github_username, "lg"),
            h("div", {}, h("h1", { class: "headline-m" }, r.student.name),
              h("div", { class: "li-meta body-m" }, h("span", {}, r.student.college),
                who === "you" ? h("span", {}, `@${r.student.github_username}`) : h("a", { href: githubUser(r.student.github_username), target: "_blank", rel: "noopener noreferrer" }, `@${r.student.github_username}`)))),
          h("div", { class: "chips" }, repos.map((x) => chip(repoName(x), "fact", "code"))),
          r.status === "done" ? skillBadges(r.skills, { lg: true }) : null,
          extra || null),
        r.status === "done" ? scoreSeal(r, 196) : seal({ empty: true, size: 150, seed: r.student.github_username, center: h("span", { class: "of" }, "Not verified yet") })),
      h("div", { class: "cred-foot" },
        h("span", {}, icon("verified"), `Verified by a 5-question viva on ${repos.length === 1 ? "this repo" : `${repos.length} repos`}`),
        h("span", {}, `${count(r.evidence.length, "answer")} with evidence`)));
  }

  function skillStamps(skills) {
    const rows = TAGS.map(([tag, name]) => {
      const score = skills[tag];
      const level = levelOf(score);
      const fill = h("span");
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = `${score || 0}%`; }));
      return h("div", { class: `ledger-row ${level}`, role: "listitem" },
        h("span", { class: "name" }, icon(TAG_ICON[tag]), name),
        h("span", { class: `engraved ${level}`, role: "img", "aria-label": score === undefined ? "Not asked" : `${score} out of 100` }, fill),
        h("span", { class: "score" }, score === undefined ? "–" : String(score)),
        levelChip(level));
    });
    return h("div", { class: "ledger", role: "list" }, rows);
  }

  // Claimed vs verified as a diff from the resume to the viva: "+" was shown but not claimed,
  // "−" was claimed but not shown (yet), and a plain line is claimed and shown.
  function claimsList(rows, who) {
    const w = words(who);
    const line = (r) => {
      const skill = TAG_NAME[r.tag] || r.tag;
      const shown = r.level === "strong" || r.level === "partial";
      const kind = !r.claimed ? "add" : shown ? "same" : "del";
      const mk = kind === "add" ? "+" : kind === "del" ? "−" : " ";
      const note = !r.claimed ? `Not on the resume, shown in the viva`
        : shown ? `${w.claimed}. Shown as ${skill}`
          : r.level === "not_shown" ? `${w.claimed}. This repo had no ${skill} question` : `${w.claimed}. Not shown in the ${skill} answers`;
      return h("div", { class: `diff-row ${kind}`, role: "listitem" },
        h("span", { class: "mk", "aria-hidden": "true" }, mk),
        h("span", { class: "what" }, h("b", {}, r.claimed ? r.name : skill), h("small", {}, note)),
        levelChip(r.level));
    };
    return h("div", { class: "diff" },
      h("div", { class: "diff-head", "aria-hidden": "true" }, h("span", {}, "resume → viva"), h("span", {}, `${rows.filter((r) => !r.claimed).length} added`)),
      h("div", { role: "list" }, rows.map(line)));
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

  // An internship match as a ticket: the match on the stub, the role and the reason on the right
  function matchCard(m, listing, { top, action, report } = {}) {
    return h("div", { class: `match-card${top ? " top" : ""}` },
      h("div", { class: "ticket-stub", role: "img", "aria-label": `${m.match}% match` },
        h("span", { class: "pct" }, String(m.match), h("small", {}, "%")), h("span", { class: "lbl" }, "match")),
      h("div", { class: "ticket-main" },
        h("div", { class: "title-m" }, m.title),
        h("div", { class: "body-m var" }, listing && listing.description ? `${m.venture}. ${listing.description}` : m.venture),
        h("p", { class: "why" }, m.why),
        matchBreakdown(m, listing, report),
        action ? h("div", { class: "actions" }, action) : null));
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
    seal, sealScore, scoreSeal, credential, recordNo, guillocheStrip, scanner, stampApplied,
    pipeline, RUN_STATE, badge, skillBadges, matchBreakdown, statusRail,
    chip, levelChip, filterChips, button, textField, selectField, banner, snackbar, confirm,
    highlight, codeBlock, skillStamps, claimsList, hackathonList, scoreDots, evidenceSheet, buildHistory, matchCard, watchScroll,
  };
})();
