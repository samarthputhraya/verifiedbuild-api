// Shared UI for the student app, the recruiter dashboard and the landing page.
// React-style components on Preact (via htm, no build step). Text from the API is always rendered as text.

import { html, render, Component, useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "/vendor/preact-htm.js";
export { html, render, Component, useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback };

// ---------- Vocabularies ----------

export const TAGS = [["backend", "Backend"], ["frontend", "Frontend"], ["data", "Data"], ["ai_ml", "AI/ML"], ["devops", "DevOps"], ["security", "Security"]];
export const TAG_NAME = Object.fromEntries(TAGS);
export const TAG_ICON = { backend: "server", frontend: "globe", data: "database", ai_ml: "cpu", devops: "cloud", security: "shield" };
export const LEVEL_LABEL = { strong: "Strong", partial: "Partial", not_verified: "Not verified", not_shown: "Not shown" };
export const RESULT_LABEL = { winner: "Winner", finalist: "Finalist", participant: "Participant" };
export const INTERESTS = [
  ["ai", "AI"], ["data", "Data"], ["web", "Web"], ["mobile", "Mobile"], ["saas", "SaaS"], ["fintech", "FinTech"],
  ["edtech", "EdTech"], ["hrtech", "HR-Tech"], ["security", "Security"], ["devtools", "Dev tools"], ["growth", "Growth"], ["healthcare", "Healthcare"],
];
export const INTEREST_LABEL = Object.fromEntries(INTERESTS);
export const SKILL_CHIPS = [
  "Python", "JavaScript", "TypeScript", "Java", "C++", "React", "Next.js", "HTML/CSS", "Flutter", "Android",
  "Node.js", "FastAPI", "Django", "Flask", "Spring", "SQL", "MongoDB", "Pandas", "Machine Learning", "Deep Learning",
  "LLMs/GenAI", "Docker", "Cloud (AWS/GCP/Azure)", "CI/CD", "Security",
];

// ---------- Helpers ----------

export const enc = encodeURIComponent;
export const githubUser = (u) => `https://github.com/${enc(u)}`;
export const githubRepo = (full) => `https://github.com/${full.split("/").map(enc).join("/")}`;
export const levelOf = (score) => (score === undefined || score === null ? "not_shown" : score >= 70 ? "strong" : score >= 40 ? "partial" : "not_verified");
export const pct = (x) => `${Math.round(x * 100)}%`;
export const repoName = (full) => (full || "").split("/").pop();
export const count = (n, one, many) => `${n} ${n === 1 ? one : many || `${one}s`}`;
export const fmt = (seconds) => { const s = Math.max(0, Math.round(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export function ago(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export class ApiError extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status; }
}

// One call to the API. Throws ApiError with the API's plain-English message.
export async function api(path, { method = "GET", body, headers = {}, raw = false } = {}) {
  const opts = { method, headers: { Accept: raw ? "text/csv" : "application/json", ...headers }, cache: "no-store" };
  if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(path, opts); } catch { throw new ApiError("NETWORK", "Can't reach Proofolio. Check your connection and try again.", 0); }
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    const e = data && data.error;
    throw new ApiError((e && e.code) || `HTTP_${res.status}`, (e && e.message) || "Something went wrong. Try again.", res.status);
  }
  return raw ? res : res.json();
}

export function store(storage) {
  const memory = {};
  return {
    get(k) { try { return storage.getItem(k) ?? memory[k] ?? null; } catch { return memory[k] ?? null; } },
    set(k, v) { memory[k] = v; try { storage.setItem(k, v); } catch { /* memory only */ } },
    del(k) { delete memory[k]; try { storage.removeItem(k); } catch { /* nothing stored */ } },
  };
}

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const on = () => setHash(location.hash); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  const raw = hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  return { parts: path.split("/").filter(Boolean), query: new URLSearchParams(qs || ""), hash };
}
export const go = (hash, replace = false) => { if (replace) location.replace(hash); else location.hash = hash; };

export function useMedia(query) {
  const mq = useMemo(() => window.matchMedia(query), [query]);
  const [m, setM] = useState(mq.matches);
  useEffect(() => { const on = () => setM(mq.matches); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, [mq]);
  return m;
}

// ---------- Icons (Lucide, ISC licence) ----------

const PATHS = {
  check: "M20 6 9 17l-5-5", x: "M18 6 6 18M6 6l12 12",
  "chevron-right": "m9 18 6-6-6-6", "chevron-left": "m15 18-6-6 6-6", "chevron-down": "m6 9 6 6 6-6",
  "arrow-right": "M5 12h14M12 5l7 7-7 7", "arrow-left": "M19 12H5M12 19l-7-7 7-7",
  mic: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3",
  stop: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
  keyboard: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10",
  search: "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm10 18-4.3-4.3", plus: "M5 12h14M12 5v14",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  external: "M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5",
  code: "m16 18 6-6-6-6M8 6l-6 6 6 6", briefcase: "M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  trophy: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z",
  file: "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2zM14 2v6h6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 3",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 16v-4M12 8h.01", alert: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v4M12 16h.01",
  "check-circle": "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3",
  refresh: "M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  home: "m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  verified: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76ZM9 12l2 2 4-4",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 7l-10 7L2 7",
  building: "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18zM2 22h20M9 6h2M13 6h2M9 10h2M13 10h2M9 14h2M13 14h2M10 22v-4h4v4",
  commit: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 12h6M15 12h6",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  database: "M12 2c-5 0-9 1.3-9 3s4 3 9 3 9-1.3 9-3-4-3-9-3zM3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  cpu: "M5 5h14v14H5zM9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3",
  cloud: "M17.5 19a4.5 4.5 0 0 0 .5-8.97A7 7 0 0 0 4.7 12.2 3.5 3.5 0 0 0 6.5 19z",
  server: "M4 3h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM4 13h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zM6 7h.01M6 17h.01",
  clipboard: "M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
  message: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  languages: "m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6",
  loader: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01", layers: "m12 2 10 5-10 5L2 7l10-5zM2 12l10 5 10-5M2 17l10 5 10-5",
};
export function Icon({ name, size = "", cls = "" }) {
  const d = PATHS[name];
  if (!d) console.warn(`No icon "${name}"`);
  return html`<svg class=${`ic ${size} ${cls}`.trim()} viewBox="0 0 24 24" aria-hidden="true"><path d=${d || ""} /></svg>`;
}
export const Spinner = ({ size = "" }) => html`<${Icon} name="loader" size=${size} cls="spin" />`;

// The logo: a check in a rounded square
export const Mark = () => html`<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="6" fill="var(--brand)" /><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>`;

// ---------- Controls ----------

export function Button({ kind = "", size = "", icon, iconAfter, href, onClick, type = "button", disabled, busy, block, label, children, cls = "" }) {
  const c = `btn ${kind} ${size} ${block ? "block" : ""} ${cls}`.trim();
  const inner = html`${busy ? html`<${Spinner} />` : icon ? html`<${Icon} name=${icon} cls="before" />` : null}${children}${iconAfter && !busy ? html`<${Icon} name=${iconAfter} cls="after" />` : null}`;
  if (href) return html`<a class=${c} href=${href} aria-label=${label} aria-disabled=${disabled ? "true" : null}>${inner}</a>`;
  return html`<button class=${c} type=${type} onClick=${onClick} disabled=${disabled || busy} aria-label=${label}>${inner}</button>`;
}
export const IconButton = ({ icon, label, onClick, disabled, cls = "" }) => html`<button class=${`icon-btn ${cls}`.trim()} type="button" onClick=${onClick} disabled=${disabled} aria-label=${label} title=${label}><${Icon} name=${icon} /></button>`;

// A labelled text field. state: "" | "error" | "ok"; hint is shown under the field in that state's colour.
export function Field({ id, label, optional, hint, state = "", prefix, trail, type = "text", value, onInput, multiline, attrs = {}, children }) {
  const prefixRef = useRef(null);
  const [pw, setPw] = useState(0);
  useLayoutEffect(() => { if (prefixRef.current) setPw(prefixRef.current.offsetWidth); }, [prefix]);
  const control = children || (multiline
    ? html`<textarea class="textarea" id=${id} value=${value} onInput=${onInput} aria-invalid=${state === "error" ? "true" : null} aria-describedby=${`${id}-hint`} ...${attrs} />`
    : html`<input class="input" id=${id} type=${type} value=${value} onInput=${onInput} aria-invalid=${state === "error" ? "true" : null} aria-describedby=${`${id}-hint`} ...${attrs} />`);
  return html`<div class=${`field ${state === "error" ? "invalid" : state}`.trim()}>
    ${label ? html`<label class="label" for=${id}>${label}${optional ? html` <span class="opt">(optional)</span>` : null}</label>` : null}
    <div class=${`control${prefix ? " has-prefix" : ""}`} style=${prefix ? `--prefix-w:${pw}px` : null}>
      ${prefix ? html`<span class="prefix" ref=${prefixRef} aria-hidden="true">${prefix}</span>` : null}
      ${control}
      ${trail ? html`<span class="trail">${trail}</span>` : null}
    </div>
    ${hint ? html`<div class="hint" id=${`${id}-hint`} aria-live="polite">${state === "error" ? html`<${Icon} name="alert" size="sm" />` : state === "ok" ? html`<${Icon} name="check-circle" size="sm" />` : null}<span>${hint}</span></div>` : null}
  </div>`;
}
export function Select({ id, label, options, value, onChange }) {
  return html`<${Field} id=${id} label=${label}>
    <select class="select" id=${id} value=${value} onChange=${onChange}>${options.map(([v, t]) => html`<option value=${v} selected=${v === value}>${t}</option>`)}</select>
    <span class="chev"><${Icon} name="chevron-down" /></span>
  <//>`;
}
export const Checkbox = ({ id, checked, onChange, children }) => html`<label class="check" for=${id}><input type="checkbox" id=${id} checked=${checked} onChange=${onChange} /><span>${children}</span></label>`;

export function ChipGroup({ options, selected, onChange, label }) {
  return html`<div class="chips" role="group" aria-label=${label}>${options.map(([value, text]) => html`<button type="button" class="chip" aria-pressed=${String(selected.has(value))} onClick=${() => { const next = new Set(selected); if (next.has(value)) next.delete(value); else next.add(value); onChange(next); }}><${Icon} name="check" size="sm" />${text}</button>`)}</div>`;
}

export const Tag = ({ kind = "", plain, children }) => html`<span class=${`tag ${kind} ${plain ? "plain" : ""}`.trim()}>${children}</span>`;
export const LevelTag = ({ level }) => html`<${Tag} kind=${level}>${LEVEL_LABEL[level] || level}<//>`;
export const Seg = ({ options, value, onChange, disabled, label }) => html`<div class="seg" role="tablist" aria-label=${label}>${options.map(([id, text, icon]) => html`<button type="button" role="tab" aria-selected=${String(value === id)} disabled=${disabled} onClick=${() => onChange(id)}>${icon ? html`<${Icon} name=${icon} />` : null}${text}</button>`)}</div>`;

export function Avatar({ username, size = "" }) {
  const [broken, setBroken] = useState(false);
  const initial = (username || "?").slice(0, 1).toUpperCase();
  if (broken || !username) return html`<span class=${`avatar avatar-fallback ${size}`.trim()} aria-hidden="true">${initial}</span>`;
  return html`<img class=${`avatar ${size}`.trim()} alt="" src=${`https://github.com/${enc(username)}.png?size=144`} loading="lazy" referrerpolicy="no-referrer" onError=${() => setBroken(true)} />`;
}

export const Progress = ({ value, indeterminate, label }) => html`<div class=${`progress${indeterminate ? " indeterminate" : ""}`} role="progressbar" aria-label=${label} aria-valuenow=${indeterminate ? null : value}><span style=${indeterminate ? null : `width:${value}%`}></span></div>`;
export const Segments = ({ total, done, now }) => html`<div class="segments" role="progressbar" aria-valuemin="0" aria-valuemax=${total} aria-valuenow=${done} aria-label=${`${done} of ${total} done`}>${Array.from({ length: total }, (_, i) => html`<span class=${i < done ? "done" : i === now ? "now" : ""}></span>`)}</div>`;
export const Skeleton = ({ w = "100%", h = "0.875rem", cls = "" }) => html`<div class=${`skeleton ${cls}`} style=${`width:${w};height:${h}`} aria-hidden="true"></div>`;
export const SkeletonList = ({ rows = 3 }) => html`<div class="list" aria-busy="true" aria-label="Loading">${Array.from({ length: rows }, () => html`<div class="item"><${Skeleton} w="2.25rem" h="2.25rem" /><div class="item-main stack-sm"><${Skeleton} w="40%" /><${Skeleton} w="70%" h="0.75rem" /></div><span></span></div>`)}</div>`;
export const Empty = ({ icon = "info", title, text, children }) => html`<div class="empty"><span class="ic-box"><${Icon} name=${icon} size="lg" /></span>${title ? html`<div class="h3">${title}</div>` : null}${text ? html`<p class="small">${text}</p>` : null}${children}</div>`;
export const Banner = ({ kind = "", icon, children, action }) => html`<div class=${`banner ${kind}`.trim()} role=${kind === "info" || kind === "ok" ? "status" : "alert"}><${Icon} name=${icon || (kind === "ok" ? "check-circle" : kind === "info" ? "info" : "alert")} /><div><p>${children}</p>${action || null}</div></div>`;

// A bar for a skill score, coloured by its level
export const Bar = ({ value, level }) => {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (el) requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = `${value || 0}%`; })); }, [value]);
  return html`<div class=${`bar ${level || ""}`.trim()} role="img" aria-label=${value === undefined ? "Not asked" : `${value} out of 100`}><span ref=${ref}></span></div>`;
};

// ---------- Toasts and dialogs ----------

const listeners = new Set();
let toastSeq = 0;
let toasts = [];
const emit = () => listeners.forEach((fn) => fn(toasts));
export function toast(text, { actionText, onAction, timeout = 6000 } = {}) {
  const id = ++toastSeq;
  toasts = [{ id, text, actionText, onAction }]; // one at a time, like a snackbar
  emit();
  const close = () => { toasts = toasts.filter((t) => t.id !== id); emit(); };
  if (timeout) setTimeout(close, timeout);
  return close;
}
export function Toasts() {
  const [list, setList] = useState(toasts);
  useEffect(() => { listeners.add(setList); return () => listeners.delete(setList); }, []);
  if (!list.length) return null;
  return html`<div class="toasts" role="status" aria-live="polite">${list.map((t) => html`<div class="toast" key=${t.id}><p>${t.text}</p>${t.actionText ? html`<button class="btn sm" type="button" onClick=${() => { toasts = toasts.filter((x) => x !== t); emit(); t.onAction(); }}>${t.actionText}</button>` : null}<button class="icon-btn" type="button" aria-label="Dismiss" onClick=${() => { toasts = toasts.filter((x) => x !== t); emit(); }}><${Icon} name="x" /></button></div>`)}</div>`;
}

// confirm({ title, text, confirmText, danger, consent }) resolves true when confirmed. With consent text, a box must be ticked first.
let dialogState = null;
const dialogListeners = new Set();
export function confirm(opts) {
  return new Promise((resolve) => {
    dialogState = { ...opts, resolve };
    dialogListeners.forEach((fn) => fn(dialogState));
  });
}
export function DialogHost() {
  const [d, setD] = useState(dialogState);
  const [ticked, setTicked] = useState(false);
  const ref = useRef(null);
  useEffect(() => { dialogListeners.add(setD); return () => dialogListeners.delete(setD); }, []);
  useEffect(() => { setTicked(false); const el = ref.current; if (d && el && !el.open) el.showModal(); }, [d]);
  if (!d) return null;
  const finish = (ok) => { const r = d.resolve; dialogState = null; setD(null); r(ok); };
  return html`<dialog ref=${ref} aria-labelledby="dlg-title" onClose=${() => finish(false)} onCancel=${(e) => { e.preventDefault(); finish(false); }}>
    <div class="dialog-body">
      <h2 class="h2" id="dlg-title">${d.title}</h2>
      ${d.text ? html`<p>${d.text}</p>` : null}
      ${d.consent ? html`<${Checkbox} id="dlg-consent" checked=${ticked} onChange=${(e) => setTicked(e.target.checked)}>${d.consent}<//>` : null}
    </div>
    <div class="dialog-actions">
      <${Button} kind="secondary" onClick=${() => finish(false)}>Cancel<//>
      <${Button} kind=${d.danger ? "danger" : ""} disabled=${d.consent ? !ticked : false} onClick=${() => finish(true)}>${d.confirmText || "Confirm"}<//>
    </div>
  </dialog>`;
}

// ---------- Code ----------

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
// Per line, a list of strings and {cls, text} tokens. Never HTML.
export function highlight(lines, file) {
  const lang = langOf(file);
  const hashComments = lang === "py";
  const kw = KW_SET[lang];
  let open = null;
  return lines.map((line) => {
    const out = [];
    let plain = "";
    const push = (cls, text) => { if (plain) { out.push(plain); plain = ""; } out.push({ cls, text }); };
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
export function Code({ file, lines, snippet, startLine, repo }) {
  const rows = useMemo(() => highlight((snippet || "").split("\n"), file), [snippet, file]);
  return html`<figure class="code">
    <figcaption class="code-head"><${Icon} name="file" size="sm" /><span class="file">${repo ? `${repoName(repo)}/${file}` : file}</span><span class="lines">lines ${lines}</span></figcaption>
    <pre class="code-body" tabindex="0" aria-label=${`Code from ${file}, lines ${lines}`}>${rows.map((parts, i) => html`<span class="code-line"><span class="code-ln">${startLine + i}</span><span class="code-tx">${parts.length ? parts.map((p) => (typeof p === "string" ? p : html`<span class=${p.cls}>${p.text}</span>`)) : " "}</span></span>`)}</pre>
  </figure>`;
}

// ---------- Report pieces ----------

const words = (who) => (who === "you"
  ? { claimed: "You claimed this", by: "by you", answer: "Your answer" }
  : { claimed: "They claimed this", by: "by this student", answer: "Their answer" });

export function SkillRows({ skills }) {
  return html`<div class="skill-rows" role="list">${TAGS.map(([tag, name]) => {
    const score = skills[tag];
    const level = levelOf(score);
    return html`<div class=${`skill-row ${level}`} role="listitem">
      <span class="name"><${Icon} name=${TAG_ICON[tag]} />${name}</span>
      <${Bar} value=${score} level=${level} />
      <span class="v">${score === undefined ? "–" : score}</span>
      <${LevelTag} level=${level} />
    </div>`;
  })}</div>`;
}

export function ClaimsList({ rows, who }) {
  const w = words(who);
  return html`<div class="claims" role="list">${rows.map((r) => {
    const skill = TAG_NAME[r.tag] || r.tag;
    const shown = r.level === "strong" || r.level === "partial";
    const note = !r.claimed ? "Not claimed, but shown in the viva" : shown ? `${w.claimed}. Shown as ${skill}.` : r.level === "not_shown" ? `${w.claimed}. This repo had no ${skill} question.` : `${w.claimed}. Not shown in the ${skill} answers.`;
    return html`<div class=${`claim${r.claimed ? "" : " extra"}`} role="listitem"><div><div class="t">${r.claimed ? r.name : skill}</div><div class="d">${note}</div></div><${LevelTag} level=${r.level} /></div>`;
  })}</div>`;
}

export function HackathonList({ items, who, action }) {
  const w = words(who);
  return html`<div class="list">${items.map((x) => html`<div class="item">
    <span class=${`ic-box${x.verified ? " brand" : ""}`}><${Icon} name="trophy" /></span>
    <div class="item-main">
      <div class="item-title">${RESULT_LABEL[x.result] || x.result}, ${x.event} ${x.year}</div>
      <div class="item-meta"><a href=${githubRepo(x.repo_full_name)} target="_blank" rel="noopener noreferrer">${x.repo_full_name}</a><span>Team of ${x.team_size}</span>${x.verified && x.your_commit_share !== null ? html`<span>${pct(x.your_commit_share)} of commits ${w.by}</span>` : null}</div>
      <div class="facts">${x.verified ? html`<${Tag} kind="ok">Verified<//><${Tag} plain kind="outline">Viva ${x.viva_score}/100<//>` : html`<${Tag}>Not verified yet<//>`}</div>
    </div>
    <div class="item-trail">${action ? action(x) : null}</div>
  </div>`)}</div>`;
}

export const Dots = ({ score }) => html`<span class="dots" role="img" aria-label=${`${score} out of 10`}>${Array.from({ length: 10 }, (_, i) => html`<span class=${i < score ? "on" : ""}></span>`)}</span>`;

export function EvidenceSheet({ e, i, who }) {
  const w = words(who);
  return html`<article class="sheet" aria-label=${`Answer ${i + 1}`}>
    <div class="sheet-head"><span class="n">${i + 1}</span><${Tag} kind=${levelOf(e.score * 10)}>${TAG_NAME[e.skill] || e.skill}<//><span class="sc"><${Dots} score=${e.score} />${e.score}/10</span></div>
    <p class="sheet-q">${e.question}</p>
    <div class="sheet-cols">
      <${Code} file=${e.file} lines=${e.lines} snippet=${e.snippet} startLine=${e.snippet_start_line} repo=${e.repo_full_name} />
      <div class="said">
        ${e.evidence_quote ? html`<blockquote class="quote">${e.evidence_quote}</blockquote>` : null}
        <p class="small muted">${w.answer}: ${e.answer_excerpt}</p>
        ${e.covered.length ? html`<div><div class="label">Covered</div><ul class="points covered">${e.covered.map((x) => html`<li><${Icon} name="check-circle" size="sm" /><span>${x}</span></li>`)}</ul></div>` : null}
        ${e.missed.length ? html`<div><div class="label">Missed</div><ul class="points missed">${e.missed.map((x) => html`<li><${Icon} name="info" size="sm" /><span>${x}</span></li>`)}</ul></div>` : null}
        <div class="facts">
          <${Tag} plain kind="outline">${e.mode === "voice" ? "Spoken" : "Typed"}<//>
          ${e.duration_s !== null && e.duration_s !== undefined ? html`<${Tag} plain kind="outline">${e.duration_s} s<//>` : null}
          ${e.had_follow_up ? html`<${Tag} plain kind="outline">Follow-up asked<//>` : null}
          ${e.pasted ? html`<${Tag} plain kind="outline">Text was pasted<//>` : null}
        </div>
      </div>
    </div>
  </article>`;
}

export function BuildHistory({ bh, who }) {
  const w = words(who);
  const big = bh.commits > 100;
  const stat = (k, v) => html`<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  return html`<div class="stats">
    ${stat(big ? "Commits (last 100)" : "Commits", bh.commits)}
    ${stat("Days, first to last commit", bh.span_days)}
    ${stat("Days with commits", bh.active_days)}
    ${stat(`Authors · ${pct(bh.your_commit_share)} of commits ${w.by}`, bh.authors)}
    ${stat("Median lines per commit", bh.median_lines_per_commit)}
  </div>`;
}

export function MatchCard({ m, listing, top, action }) {
  return html`<div class=${`match${top ? " top" : ""}`}>
    <div class="item-title">${m.title}</div>
    <div class="pct">${m.match}%<small>match</small></div>
    <div class="desc small muted">${listing && listing.description ? `${m.venture}. ${listing.description}` : m.venture}</div>
    <p class="why">${m.why}</p>
    ${action ? html`<div class="actions">${action}</div>` : null}
  </div>`;
}

// A top app bar that shows a border once the page scrolls
export function useScrolled() {
  const [s, setS] = useState(false);
  useEffect(() => { const on = () => setS(window.scrollY > 4); window.addEventListener("scroll", on, { passive: true }); on(); return () => window.removeEventListener("scroll", on); }, []);
  return s;
}
