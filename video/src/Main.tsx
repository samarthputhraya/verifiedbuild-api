// Proofolio demo video, version 2. Footage is recorded from the live app (capture/), narration is Gemini 2.5 Pro TTS,
// music is Lyria 2. Scene lengths follow the narration; footage is trimmed and re-timed to fit each scene.
// Story: the problem (with sources) → what Proofolio does → the live app, end to end → how it works → who gains and
// who pays → the brief, checked off.
import React, { useEffect, useState } from "react";
import {
  AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, Series, continueRender, delayRender, interpolate, spring,
  staticFile, useCurrentFrame, useVideoConfig, Easing,
} from "remotion";
import narration from "./narration.json";
import timeline from "./timeline.json";

export const FPS = 30;
const f = (sec: number) => Math.max(1, Math.round(sec * FPS));
type Narr = { key: string; file: string; text: string; seconds: number };
const N: Record<string, Narr> = Object.fromEntries((narration.scenes as Narr[]).map((s) => [s.key, s]));
const SM: Record<string, number> = (timeline as any).student.markers;
const RM: Record<string, number> = (timeline as any).recruiter.markers;
const LD: number = (timeline as any).landing.duration;
const ANSWER_S: number = (timeline as any).answer_q1_seconds;

const C = { blue: "#1f5eff", blueSoft: "#8fb0ff", white: "#f5f7fb", muted: "#a8b3c7", dim: "#6f7c93", violet: "#8b5cf6", teal: "#14b8a6", ok: "#22c55e", warn: "#f59e0b", bad: "#f87171", card: "rgba(255,255,255,0.06)", line: "rgba(255,255,255,0.12)" };
const FONT = "Inter, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

// When a phrase is spoken inside a narration clip, in frames from the clip's start (by its share of the characters)
const cue = (key: string, phrase: string) => {
  const n = N[key];
  const i = Math.max(0, n.text.indexOf(phrase));
  return f(0.28 + (i / n.text.length) * (n.seconds - 0.5));
};

// ---------- Footage plan ----------

type Part = { video: "student" | "recruiter" | "landing"; from: number; to: number; frames: number };
// Split `frames` across segments in proportion to their length, so they all play at the same speed
const fit = (segs: [number, number][], frames: number, video: Part["video"] = "student"): Part[] => {
  const total = segs.reduce((a, [s, e]) => a + (e - s), 0);
  let used = 0;
  return segs.map(([s, e], i) => {
    const fr = i === segs.length - 1 ? frames - used : Math.round(((e - s) / total) * frames);
    used += fr;
    return { video, from: s, to: e, frames: Math.max(1, fr) };
  });
};

const voiceA = Math.min(ANSWER_S, 4.6); // seconds of the spoken answer heard on its own
const voiceBFrames = f(N.voice.seconds + 0.7);
const matchPart1 = 1;
const matchPart2 = 1;

type Scene = { key: string; frames: number; narr?: string; narrAt?: number; footage?: boolean };
const pad = (k: string, extra: number) => f(N[k].seconds + extra);
const SCENES: Scene[] = [
  { key: "problem", frames: pad("problem", 1.0), narr: "problem", narrAt: f(0.5) },
  { key: "solution", frames: pad("solution", 0.9), narr: "solution", narrAt: f(0.3) },
  { key: "signup", frames: pad("signup", 0.7), narr: "signup", narrAt: f(0.3), footage: true },
  { key: "reading", frames: pad("reading", 0.8), narr: "reading", narrAt: f(0.3), footage: true },
  { key: "voice", frames: f(voiceA + 0.5) + voiceBFrames, narr: "voice", narrAt: f(voiceA + 0.6), footage: true },
  { key: "report", frames: pad("report", 0.8), narr: "report", narrAt: f(0.3), footage: true },
  { key: "match", frames: pad("match", 1.0), narr: "match", narrAt: f(0.3) },
  { key: "arch", frames: pad("arch", 0.9), narr: "arch", narrAt: f(0.3) },
  { key: "business", frames: pad("business", 1.0), narr: "business", narrAt: f(0.3) },
  { key: "close", frames: pad("close", 3.0), narr: "close", narrAt: f(0.3) },
];
const STARTS: number[] = [];
SCENES.reduce((acc, s) => { STARTS.push(acc); return acc + s.frames; }, 0);
export const totalFrames = () => SCENES.reduce((a, s) => a + s.frames, 0);
const idx = (k: string) => SCENES.findIndex((s) => s.key === k);
const NARR_SPANS = SCENES.map((s, i) => (s.narr ? [STARTS[i] + (s.narrAt || 0), STARTS[i] + (s.narrAt || 0) + f(N[s.narr].seconds)] : null)).filter(Boolean) as number[][];
const STUDENT_SPAN = [STARTS[idx("voice")] + f(0.5), STARTS[idx("voice")] + f(voiceA + 0.5)];
const SOLUTION_AT = STARTS[idx("solution")] + f(0.3) + cue("solution", "Proofolio does");

// ---------- Building blocks ----------

const useEnter = (delay = 0, damping = 18) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.8 } });
};

const Fade: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 9, frames - 9, frames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const x = 30 + 12 * Math.sin(frame / 260);
  const y = 42 + 8 * Math.cos(frame / 330);
  // The problem section is cooler and darker; the blue warms up when Proofolio arrives
  const warm = interpolate(frame, [SOLUTION_AT - 20, SOLUTION_AT + 40], [0.45, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1100px 760px at ${x}% ${y}%, rgba(31,94,255,${0.2 * warm}), transparent 62%), radial-gradient(900px 600px at ${100 - x}% ${100 - y}%, rgba(139,92,246,${0.1 * warm}), transparent 60%), linear-gradient(180deg, #080d19 0%, #0b1324 100%)` }} />
  );
};

const Mark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="6" fill={C.blue} /><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Check: React.FC<{ size?: number; color?: string }> = ({ size = 30, color = C.ok }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: "none" }}><circle cx="12" cy="12" r="11" fill={color === C.ok ? "rgba(34,197,94,0.16)" : "rgba(31,94,255,0.18)"} /><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Cross: React.FC<{ size?: number }> = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: "none" }}><circle cx="12" cy="12" r="11" fill="rgba(248,113,113,0.14)" /><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" fill="none" stroke={C.bad} strokeWidth="2.2" strokeLinecap="round" /></svg>
);

const Clip: React.FC<{ part: Part }> = ({ part }) => {
  const rate = Math.max(0.3, ((part.to - part.from) * FPS) / part.frames);
  return (
    <OffthreadVideo src={staticFile(`${part.video}.mp4`)} startFrom={Math.max(0, Math.round(part.from * FPS))} playbackRate={rate} muted
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
  );
};
const Clips: React.FC<{ parts: Part[] }> = ({ parts }) => (
  <Series>{parts.map((p, i) => <Series.Sequence key={i} durationInFrames={p.frames}><Clip part={p} /></Series.Sequence>)}</Series>
);

// A phone with the student app inside; zoom keyframes [frame, scale, originY%] move the camera into the screen
const Phone: React.FC<{ left: number; top?: number; scale?: number; zoom?: [number, number, number][]; children: React.ReactNode }> = ({ left, top = 74, scale = 1.0, zoom, children }) => {
  const frame = useCurrentFrame();
  const enter = useEnter(0, 20);
  let z = 1, oy = 50;
  if (zoom && zoom.length) {
    const fs = zoom.map((k) => k[0]);
    z = interpolate(frame, fs, zoom.map((k) => k[1]), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
    oy = interpolate(frame, fs, zoom.map((k) => k[2]), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  }
  const W = 430, H = 931;
  return (
    <div style={{ position: "absolute", left, top: top + (1 - enter) * 40, width: W, height: H, transform: `scale(${scale})`, transformOrigin: "50% 0%", opacity: enter }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 66, background: "linear-gradient(145deg, #2a2f3a, #0d0f14)", boxShadow: "0 60px 120px -30px rgba(0,0,0,0.75), 0 0 0 1.5px rgba(255,255,255,0.10) inset" }} />
      <div style={{ position: "absolute", left: 11, top: 11, right: 11, bottom: 11, borderRadius: 56, overflow: "hidden", background: "#fff" }}>
        <div style={{ width: "100%", height: "100%", transform: `scale(${z})`, transformOrigin: `0% ${oy}%` }}>{children}</div>
      </div>
      <div style={{ position: "absolute", left: W / 2 - 7, top: 22, width: 14, height: 14, borderRadius: 7, background: "#0b0d12", boxShadow: "0 0 0 2px rgba(255,255,255,0.05)" }} />
    </div>
  );
};

const Browser: React.FC<{ left: number; top: number; width: number; title: string; children: React.ReactNode }> = ({ left, top, width, title, children }) => {
  const enter = useEnter(0, 20);
  const vh = width / 1.6;
  return (
    <div style={{ position: "absolute", left, top: top + (1 - enter) * 30, width, opacity: enter, borderRadius: 16, overflow: "hidden", boxShadow: "0 50px 110px -30px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.10)" }}>
      <div style={{ height: 46, background: "#e9ecf1", display: "flex", alignItems: "center", gap: 9, padding: "0 18px" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
        <span style={{ marginLeft: 18, height: 32, padding: "0 16px", display: "flex", alignItems: "center", gap: 9, background: "#fff", borderRadius: "9px 9px 0 0", alignSelf: "flex-end", fontFamily: FONT, fontSize: 15, color: "#334155", fontWeight: 500 }}><Mark size={16} />{title}</span>
      </div>
      <div style={{ width, height: vh, background: "#fff" }}>{children}</div>
    </div>
  );
};

const Callout: React.FC<{ x: number; y: number; w?: number; delay?: number; kicker?: string; title: string; lines?: string[] }> = ({ x, y, w = 760, delay = 0, kicker, title, lines = [] }) => {
  const e = useEnter(delay);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, transform: `translateY(${(1 - e) * 24}px)`, opacity: e, fontFamily: FONT }}>
      {kicker ? <div style={{ color: C.blueSoft, fontSize: 26, fontWeight: 600, marginBottom: 16 }}>{kicker}</div> : null}
      <div style={{ color: C.white, fontSize: 58, lineHeight: 1.1, fontWeight: 690, letterSpacing: -1.4 }}>{title}</div>
      {lines.map((l, i) => <Line key={i} text={l} delay={delay + 12 + i * 10} />)}
    </div>
  );
};
const Line: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
  const e = useEnter(delay);
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginTop: 24, opacity: e, transform: `translateX(${(1 - e) * -16}px)` }}>
      <span style={{ marginTop: 3 }}><Check size={32} /></span>
      <span style={{ color: C.muted, fontSize: 32, lineHeight: 1.35, fontWeight: 460 }}>{text}</span>
    </div>
  );
};

// Captions: the narration, one sentence at a time, timed by its share of the clip
const Captions: React.FC<{ narrKey: string; at: number }> = ({ narrKey, at }) => {
  const frame = useCurrentFrame();
  const n = N[narrKey];
  const parts = n.text.split(/(?<=[.?!])\s+(?=[A-Z0-9"₹])/).flatMap((s) => (s.length > 120 ? s.split(/(?<=[,:])\s+/) : [s]));
  const lead = 0.28, total = n.seconds - lead - 0.2;
  const chars = parts.reduce((a, p) => a + p.length, 0);
  let acc = at + f(lead);
  const spans = parts.map((p) => { const st = acc; acc += (p.length / chars) * total * FPS; return [st, acc, p] as [number, number, string]; });
  const cur = spans.find(([s, e]) => frame >= s && frame < e + 6);
  if (!cur) return null;
  const o = interpolate(frame, [cur[0], cur[0] + 5], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, display: "flex", justifyContent: "center", opacity: o }}>
      <div style={{ maxWidth: 1500, padding: "12px 28px", borderRadius: 14, background: "rgba(6,10,20,0.82)", color: "#fff", fontFamily: FONT, fontSize: 32, lineHeight: 1.3, fontWeight: 520, textAlign: "center", boxShadow: "0 0 0 1px rgba(255,255,255,0.06)" }}>{cur[2]}</div>
    </div>
  );
};

const Source: React.FC<{ text: string; delay?: number; x?: number; y?: number }> = ({ text, delay = 0, x = 170, y = 948 }) => {
  const e = useEnter(delay);
  return <div style={{ position: "absolute", left: x, top: y, fontFamily: FONT, fontSize: 19, color: C.dim, opacity: e * 0.95 }}>{text}</div>;
};

const LiveBadge: React.FC = () => (
  <div style={{ position: "absolute", left: 48, top: 18, display: "flex", alignItems: "center", gap: 10, padding: "7px 16px", borderRadius: 999, background: "rgba(255,255,255,0.07)", boxShadow: `0 0 0 1px ${C.line}`, fontFamily: FONT, fontSize: 19, fontWeight: 600, color: C.muted }}>
    <span style={{ width: 9, height: 9, borderRadius: 5, background: C.ok }} />Recorded on the live app · sample student, AI-written answers
  </div>
);

// ---------- Problem ----------

const Stat: React.FC<{ big: string; label: string; src: string; delay: number; color?: string }> = ({ big, label, src, delay, color = C.white }) => {
  const e = useEnter(delay, 16);
  return (
    <div style={{ flex: 1, padding: "44px 44px 38px", borderRadius: 26, background: C.card, boxShadow: `0 0 0 1px ${C.line}`, opacity: e, transform: `translateY(${(1 - e) * 30}px)` }}>
      <div style={{ fontSize: 132, fontWeight: 760, letterSpacing: -5, color, lineHeight: 1 }}>{big}</div>
      <div style={{ fontSize: 34, color: C.white, fontWeight: 560, marginTop: 22, lineHeight: 1.25 }}>{label}</div>
      <div style={{ fontSize: 19, color: C.dim, marginTop: 18 }}>{src}</div>
    </div>
  );
};

const Hook: React.FC = () => {
  const at = f(0.6);
  const s2 = at + cue("hook", "And 84%");
  const s3 = at + cue("hook", "So every");
  const e3 = useEnter(s3, 16);
  return (
    <AbsoluteFill style={{ fontFamily: FONT, padding: "150px 170px 0" }}>
      <div style={{ display: "flex", gap: 36 }}>
        <Stat big="7.4 s" label="a recruiter's first look at a résumé" src="Ladders eye-tracking study, 2018" delay={at} />
        <Stat big="84%" label="of developers use or plan to use AI tools" src="Stack Overflow Developer Survey, 2025" delay={s2} color={C.blueSoft} />
      </div>
      <div style={{ marginTop: 64, fontSize: 60, fontWeight: 690, letterSpacing: -1.6, lineHeight: 1.15, color: C.white, opacity: e3, transform: `translateY(${(1 - e3) * 24}px)` }}>
        Every GitHub looks impressive.<br /><span style={{ color: C.muted }}>A repo alone no longer shows who can build.</span>
      </div>
    </AbsoluteFill>
  );
};

const SideCol: React.FC<{ who: string; icon: React.ReactNode; items: [string, string?][]; delay: number; step: number; src?: string }> = ({ who, icon, items, delay, step, src }) => {
  const e = useEnter(delay);
  return (
    <div style={{ flex: 1, padding: "44px 46px", borderRadius: 26, background: C.card, boxShadow: `0 0 0 1px ${C.line}`, opacity: e, transform: `translateY(${(1 - e) * 26}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>{icon}<span style={{ fontSize: 46, fontWeight: 700, color: C.white, letterSpacing: -1 }}>{who}</span></div>
      {items.map(([t, big], i) => <SideItem key={i} t={t} big={big} delay={delay + step * (i + 1)} />)}
      {src ? <div style={{ fontSize: 19, color: C.dim, marginTop: 26 }}>{src}</div> : null}
    </div>
  );
};
const SideItem: React.FC<{ t: string; big?: string; delay: number }> = ({ t, big, delay }) => {
  const e = useEnter(delay);
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "flex-start", marginTop: 32, opacity: e, transform: `translateX(${(1 - e) * -14}px)` }}>
      {big ? <span style={{ fontSize: 52, fontWeight: 760, color: C.bad, letterSpacing: -1.5, lineHeight: 1, minWidth: 120 }}>{big}</span> : <span style={{ marginTop: 4 }}><Cross size={34} /></span>}
      <span style={{ fontSize: 33, color: C.muted, lineHeight: 1.35 }}>{t}</span>
    </div>
  );
};
const PersonIcon = ({ color }: { color: string }) => (
  <svg width="56" height="56" viewBox="0 0 24 24"><rect width="24" height="24" rx="7" fill={color} opacity="0.2" /><circle cx="12" cy="9.5" r="3.4" fill="none" stroke={color} strokeWidth="1.8" /><path d="M5.8 18.6c1.3-2.7 3.5-4 6.2-4s4.9 1.3 6.2 4" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></svg>
);
const BuildingIcon = ({ color }: { color: string }) => (
  <svg width="56" height="56" viewBox="0 0 24 24"><rect width="24" height="24" rx="7" fill={color} opacity="0.2" /><path d="M7 18.5V6.5h7v12M14 10h3v8.5M5.5 18.5h13M9.5 9.5h2M9.5 12.5h2M9.5 15.5h2" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const Sides: React.FC = () => {
  const at = f(0.4);
  return (
    <AbsoluteFill style={{ fontFamily: FONT, padding: "120px 170px 0" }}>
      <div style={{ color: C.blueSoft, fontSize: 28, fontWeight: 600, marginBottom: 34, opacity: useEnter(at) }}>Both sides lose</div>
      <div style={{ display: "flex", gap: 36 }}>
        <SideCol who="Students" icon={<PersonIcon color={C.blueSoft} />} delay={at + cue("sides", "Students")} step={f(2.6)}
          items={[["Filtered out by keywords and CGPA"], ["A hackathon win is taken on trust"]]} />
        <SideCol who="Recruiters" icon={<BuildingIcon color={C.violet} />} delay={at + cue("sides", "Recruiters")} step={f(2.4)}
          items={[["Piles of look-alike applications"], ["of Indian recruiters say qualified talent got harder to find", "74%"]]}
          src="LinkedIn research, reported by People Matters, Jan 2026" />
      </div>
    </AbsoluteFill>
  );
};

const Gap: React.FC = () => {
  const at = f(0.4);
  const e1 = useEnter(at);
  const e2 = useEnter(at + cue("gap", "Nobody asks"), 15);
  return (
    <AbsoluteFill style={{ fontFamily: FONT, justifyContent: "center", padding: "0 170px" }}>
      <div style={{ fontSize: 40, color: C.muted, fontWeight: 520, opacity: e1, transform: `translateY(${(1 - e1) * 18}px)` }}>Coding tests are generic puzzles. AI solves those too.</div>
      <div style={{ fontSize: 96, color: C.white, fontWeight: 740, letterSpacing: -3, lineHeight: 1.06, marginTop: 40, opacity: e2, transform: `translateY(${(1 - e2) * 30}px)` }}>
        "Do you understand the code<br />you're showing me?"
      </div>
    </AbsoluteFill>
  );
};

// ---------- Solution ----------

const Intro: React.FC = () => {
  const at = f(0.4);
  const e = useEnter(4, 14);
  const steps = [["1", "Pick your own GitHub repo"], ["2", "Answer 5 questions about its code"], ["3", "Get a verified skill profile"]];
  const fitAt = at + cue("intro", "Internships are matched");
  const pills: [string, string][] = [["Skills", "verified by a viva on real code"], ["Interests", "picked at sign-up"], ["Hackathon performance", "verified by a viva on the project repo"]];
  return (
    <AbsoluteFill style={{ alignItems: "center", fontFamily: FONT, paddingTop: 150 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 30, transform: `scale(${0.85 + 0.15 * e})`, opacity: e }}>
        <Mark size={112} />
        <span style={{ fontSize: 118, fontWeight: 720, letterSpacing: -4, color: C.white }}>Proofolio</span>
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 56 }}>
        {steps.map(([n, t], i) => <Step key={n} n={n} t={t} delay={at + cue("intro", "Students answer") + i * f(1.0)} />)}
      </div>
      <div style={{ marginTop: 72, width: 1580, opacity: useEnter(fitAt) }}>
        <div style={{ color: C.blueSoft, fontSize: 26, fontWeight: 600, marginBottom: 20, textAlign: "center" }}>The Promtal brief: match students with internships on…</div>
        <div style={{ display: "flex", gap: 22 }}>
          {pills.map(([t, d], i) => <Pill key={t} t={t} d={d} delay={fitAt + f(0.9) + i * f(1.1)} />)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
const Step: React.FC<{ n: string; t: string; delay: number }> = ({ n, t, delay }) => {
  const e = useEnter(delay);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 26px", borderRadius: 18, background: C.card, boxShadow: `0 0 0 1px ${C.line}`, opacity: e, transform: `translateY(${(1 - e) * 22}px)` }}>
      <span style={{ width: 46, height: 46, borderRadius: 23, background: "rgba(31,94,255,0.22)", color: C.blueSoft, display: "grid", placeItems: "center", fontSize: 23, fontWeight: 700 }}>{n}</span>
      <span style={{ color: C.white, fontSize: 30, fontWeight: 560 }}>{t}</span>
    </div>
  );
};
const Pill: React.FC<{ t: string; d: string; delay: number }> = ({ t, d, delay }) => {
  const e = useEnter(delay);
  return (
    <div style={{ flex: 1, display: "flex", gap: 16, alignItems: "flex-start", padding: "24px 26px", borderRadius: 18, background: "rgba(34,197,94,0.07)", boxShadow: "0 0 0 1px rgba(34,197,94,0.28)", opacity: e, transform: `scale(${0.94 + 0.06 * e})` }}>
      <Check size={36} />
      <div><div style={{ color: C.white, fontSize: 31, fontWeight: 650 }}>{t}</div><div style={{ color: C.muted, fontSize: 23, marginTop: 6 }}>{d}</div></div>
    </div>
  );
};

// ---------- Live app ----------

const PhoneScene: React.FC<{ parts: Part[]; side: "left" | "right"; callout: React.ComponentProps<typeof Callout>; zoom?: [number, number, number][]; still?: string }> = ({ parts, side, callout, zoom, still }) => (
  <AbsoluteFill>
    <Phone left={side === "left" ? 250 : 1230} zoom={zoom}>{still ? <Img src={staticFile(still)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} /> : <Clips parts={parts} />}</Phone>
    <Callout {...callout} x={side === "left" ? 860 : 160} />
  </AbsoluteFill>
);

const Formula: React.FC = () => {
  const rows: [string, number, string][] = [["Verified skills", 60, C.blue], ["Shared interests", 25, C.violet], ["Verified hackathons", 15, C.teal]];
  const at = f(0.3);
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Callout x={220} y={130} w={1480} kicker="How a match is scored" title="A formula you can check. No black box." />
      <div style={{ position: "absolute", left: 220, right: 220, top: 420 }}>
        {rows.map(([label, pct, color], i) => <Bar key={label} label={label} pct={pct} color={color} delay={at + cue("match", ["60%", "25%", "15%"][i]) - f(0.2)} />)}
        <Note delay={at + cue("match", "and every match")} text={`"Verified backend 90 covers 60% of this role; shared interests: HR-Tech."  Claimed-only skills count for zero.`} />
      </div>
    </AbsoluteFill>
  );
};
const Bar: React.FC<{ label: string; pct: number; color: string; delay: number }> = ({ label, pct, color, delay }) => {
  const e = useEnter(delay, 22);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "380px 1fr 130px", alignItems: "center", gap: 30, marginBottom: 36, opacity: Math.min(1, e * 1.4) }}>
      <span style={{ color: C.white, fontSize: 38, fontWeight: 600 }}>{label}</span>
      <div style={{ height: 24, borderRadius: 12, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}><div style={{ width: `${(pct / 60) * 100 * e}%`, height: "100%", borderRadius: 12, background: color }} /></div>
      <span style={{ color: C.white, fontSize: 48, fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Math.round(pct * e)}%</span>
    </div>
  );
};
const Note: React.FC<{ delay: number; text: string }> = ({ delay, text }) => {
  const e = useEnter(delay);
  return <div style={{ marginTop: 30, color: C.muted, fontSize: 30, lineHeight: 1.4, opacity: e }}>{text}</div>;
};

const MatchScene: React.FC = () => {
  const split = fit([[SM.internships - 0.4, SM.applied + 2.6]], matchPart2)[0];
  const rsplit: Part = { ...split, video: "recruiter", from: RM.internships - 0.4, to: RM.applied + 2.6 };
  return (
    <Series>
      <Series.Sequence durationInFrames={matchPart1}><Fade frames={matchPart1}><Formula /></Fade></Series.Sequence>
      <Series.Sequence durationInFrames={matchPart2}>
        <AbsoluteFill>
          <LiveBadge />
          <Phone left={90} top={110} scale={0.84}><Clips parts={[split]} /></Phone>
          <Browser left={640} top={160} width={1190} title="Proofolio for recruiters"><Clips parts={[rsplit]} /></Browser>
          <Label x={640} y={104} text="Consent ticked → the recruiter's screen, at the same moment" delay={f(0.8)} />
        </AbsoluteFill>
      </Series.Sequence>
    </Series>
  );
};
const Label: React.FC<{ x: number; y: number; text: string; delay?: number }> = ({ x, y, text, delay = 0 }) => {
  const e = useEnter(delay);
  return <div style={{ position: "absolute", left: x, top: y, fontFamily: FONT, color: C.blueSoft, fontSize: 27, fontWeight: 600, opacity: e }}>{text}</div>;
};

const RecruiterScene: React.FC<{ frames: number }> = ({ frames }) => {
  const segs: [number, number][] = [[RM.arrival - 1.2, RM.arrival + 3.0], [RM.candidate - 0.6, RM.cand_answers + 2.0], [RM.csv - 1.6, RM.csv + 1.6]];
  const parts = fit(segs, frames, "recruiter");
  const a = parts[0].frames, b = parts[1].frames;
  return (
    <AbsoluteFill>
      <LiveBadge />
      <Browser left={110} top={100} width={1390} title="Proofolio for recruiters"><Clips parts={parts} /></Browser>
      <Sequence from={0} durationInFrames={a}><Tag x={1545} y={230} text="New applicant, ranked live" /></Sequence>
      <Sequence from={a} durationInFrames={b}><Tag x={1545} y={230} text="Each answer beside its code" /></Sequence>
      <Sequence from={a + b}><Tag x={1545} y={230} text="One-click CSV" /></Sequence>
    </AbsoluteFill>
  );
};
const Tag: React.FC<{ x: number; y: number; text: string }> = ({ x, y, text }) => {
  const e = useEnter(4);
  return <div style={{ position: "absolute", left: x, top: y, width: 320, fontFamily: FONT, color: C.white, fontSize: 38, lineHeight: 1.2, fontWeight: 660, opacity: e, transform: `translateX(${(1 - e) * 20}px)` }}><div style={{ width: 48, height: 4, borderRadius: 2, background: C.blue, marginBottom: 18 }} />{text}</div>;
};

// ---------- How it works ----------

const Box: React.FC<{ x: number; y: number; w: number; h: number; title: string; sub?: string; delay: number; accent?: string; children?: React.ReactNode }> = ({ x, y, w, h, title, sub, delay, accent = C.line, children }) => {
  const e = useEnter(delay);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, padding: "22px 26px", borderRadius: 20, background: "rgba(255,255,255,0.055)", boxShadow: `0 0 0 1.5px ${accent}`, opacity: e, transform: `scale(${0.95 + 0.05 * e})`, fontFamily: FONT, boxSizing: "border-box" }}>
      <div style={{ color: C.white, fontSize: 29, fontWeight: 660 }}>{title}</div>
      {sub ? <div style={{ color: C.muted, fontSize: 22, marginTop: 6, lineHeight: 1.35 }}>{sub}</div> : null}
      {children}
    </div>
  );
};
const Wire: React.FC<{ x1: number; y1: number; x2: number; y2: number; delay: number; color?: string }> = ({ x1, y1, x2, y2, delay, color = C.blueSoft }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [delay, delay + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const len = Math.hypot(x2 - x1, y2 - y1);
  const dot = ((frame - delay) % 45) / 45;
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width="1920" height="1080">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeOpacity={0.55} strokeWidth={2.5} strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
      {p >= 1 ? <circle cx={x1 + (x2 - x1) * dot} cy={y1 + (y2 - y1) * dot} r={5} fill={color} /> : null}
    </svg>
  );
};
const Arch: React.FC = () => {
  const at = f(0.5);
  const tClients = at + f(0.4);
  const tApi = at + cue("arch", "one FastAPI");
  const tGem = at + cue("arch", "Gemini");
  const tGit = at + cue("arch", "GitHub");
  const tDb = at + cue("arch", "Supabase");
  const tKey = at + cue("arch", "No app");
  const modules = ["Repo reading", "Questions", "Voice → text", "Scoring", "Report", "Matching (no AI)", "Apply + shortlist"];
  return (
    <AbsoluteFill>
      <Callout x={130} y={70} w={1600} kicker="How it works" title="One API. Every AI step on the server." />
      <Box x={130} y={330} w={420} h={130} title="Student web app" sub="Installable, phone-first" delay={tClients} />
      <Box x={130} y={490} w={420} h={130} title="Recruiter dashboard" sub="Live shortlist, CSV" delay={tClients + 6} />
      <Box x={130} y={650} w={420} h={130} title="Android app" sub="Kotlin, built in Google AI Studio" delay={tClients + 12} />
      <Box x={700} y={330} w={520} h={450} title="Proofolio API" sub="Python · FastAPI · Google Cloud Run" delay={tApi} accent="rgba(31,94,255,0.7)">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
          {modules.map((m, i) => <Chip key={m} t={m} delay={tApi + 8 + i * 4} hi={m.startsWith("Matching")} />)}
        </div>
      </Box>
      <Box x={1370} y={330} w={420} h={130} title="Gemini on Vertex AI" sub="Questions · transcription · scoring" delay={tGem} accent="rgba(139,92,246,0.6)" />
      <Box x={1370} y={490} w={420} h={130} title="GitHub REST + GraphQL" sub="Code tarball · commit history" delay={tGit} />
      <Box x={1370} y={650} w={420} h={130} title="Supabase Postgres" sub="Row-level security on" delay={tDb} />
      {[395, 555, 715].map((y, i) => <Wire key={i} x1={550} y1={y} x2={700} y2={555} delay={tApi + i * 4} />)}
      <Wire x1={1220} y1={555} x2={1370} y2={395} delay={tGem} color="#b99cff" />
      <Wire x1={1220} y1={555} x2={1370} y2={555} delay={tGit} />
      <Wire x1={1220} y1={555} x2={1370} y2={715} delay={tDb} />
      <KeyNote delay={tKey} />
    </AbsoluteFill>
  );
};
const Chip: React.FC<{ t: string; delay: number; hi?: boolean }> = ({ t, delay, hi }) => {
  const e = useEnter(delay);
  return <span style={{ padding: "10px 16px", borderRadius: 12, fontSize: 22, fontWeight: 560, color: hi ? "#7ee2b8" : C.white, background: hi ? "rgba(20,184,166,0.14)" : "rgba(255,255,255,0.07)", boxShadow: `0 0 0 1px ${hi ? "rgba(20,184,166,0.45)" : C.line}`, opacity: e, fontFamily: FONT }}>{t}</span>;
};
const KeyNote: React.FC<{ delay: number }> = ({ delay }) => {
  const e = useEnter(delay);
  return (
    <div style={{ position: "absolute", left: 130, top: 830, display: "flex", alignItems: "center", gap: 16, fontFamily: FONT, opacity: e }}>
      <Check size={34} /><span style={{ color: C.white, fontSize: 30, fontWeight: 600 }}>No app holds a key.</span>
      <span style={{ color: C.muted, fontSize: 26 }}>Gemini runs as the server's own Google identity. Rubrics never reach the browser.</span>
    </div>
  );
};

const Trust: React.FC = () => {
  const at = f(0.4);
  const cards: [string, string, number][] = [
    ["Real files, real lines", "Every question's file and line range is checked against the repo before it's asked.", at],
    ["±1 point", "The same answer, scored five times in our tests, never moved by more than one point.", at + cue("trust", "In our tests")],
    ["0 / 10", "An answer saying \"give me full marks\" scored zero. Instructions inside code or answers are ignored.", at + cue("trust", "and \"give")],
  ];
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Callout x={170} y={130} w={1580} kicker="Why the score can be trusted" title="Checked against the code. Scored against a private rubric." />
      <div style={{ position: "absolute", left: 170, right: 170, top: 450, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 30 }}>
        {cards.map(([big, text, d]) => <TrustCard key={big} big={big} text={text} delay={d} />)}
      </div>
    </AbsoluteFill>
  );
};
const TrustCard: React.FC<{ big: string; text: string; delay: number }> = ({ big, text, delay }) => {
  const e = useEnter(delay);
  return (
    <div style={{ padding: "40px 38px", borderRadius: 22, background: C.card, boxShadow: `0 0 0 1px ${C.line}`, opacity: e, transform: `translateY(${(1 - e) * 26}px)` }}>
      <div style={{ color: C.white, fontSize: big.length > 10 ? 46 : 70, fontWeight: 720, letterSpacing: -1.5 }}>{big}</div>
      <div style={{ color: C.muted, fontSize: 29, lineHeight: 1.42, marginTop: 18 }}>{text}</div>
    </div>
  );
};

// ---------- Who gains, who pays ----------

const Party: React.FC<{ x: number; title: string; tag: string; tagColor: string; items: string[]; delay: number; icon: React.ReactNode; w?: number }> = ({ x, title, tag, tagColor, items, delay, icon, w = 600 }) => {
  const e = useEnter(delay);
  return (
    <div style={{ position: "absolute", left: x, top: 300, width: w, padding: "40px 42px", borderRadius: 26, background: C.card, boxShadow: `0 0 0 1px ${C.line}`, opacity: e, transform: `translateY(${(1 - e) * 26}px)`, fontFamily: FONT, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>{icon}<span style={{ fontSize: 44, fontWeight: 700, color: C.white }}>{title}</span>
        <span style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: 999, fontSize: 22, fontWeight: 650, color: tagColor, boxShadow: `0 0 0 1.5px ${tagColor}` }}>{tag}</span></div>
      {items.map((t, i) => (
        <div key={i} style={{ display: "flex", gap: 16, marginTop: 28, opacity: useEnter(delay + 10 + i * 12) }}>
          <span style={{ marginTop: 2 }}><Check size={32} /></span><span style={{ color: C.muted, fontSize: 31, lineHeight: 1.38 }}>{t}</span>
        </div>
      ))}
    </div>
  );
};
const Value: React.FC = () => {
  const at = f(0.4);
  const tS = at + cue("value", "Students use");
  const tC = at + cue("value", "Companies get");
  const frame = useCurrentFrame();
  const mid = interpolate(frame, [tC - 6, tC + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Callout x={170} y={110} w={1580} kicker="Who gains" title="Both sides of the hire." />
      <Party x={170} title="Students" tag="Free" tagColor={C.ok} delay={tS} icon={<PersonIcon color={C.blueSoft} />}
        items={["One viva, reused on every application", "Judged on what they can actually do", "Report private until they apply"]} />
      <div style={{ position: "absolute", left: 830, top: 470, width: 260, textAlign: "center", fontFamily: FONT, opacity: mid }}>
        <Mark size={84} /><div style={{ color: C.white, fontSize: 30, fontWeight: 680, marginTop: 10 }}>Proofolio</div>
        <div style={{ color: C.dim, fontSize: 21, marginTop: 6 }}>verified profiles → ranked shortlists</div>
      </div>
      <Party x={1150} title="Companies" tag="Pay" tagColor={C.blueSoft} delay={tC} icon={<BuildingIcon color={C.violet} />}
        items={["A short ranked list, with evidence", "Fewer interviews, better ones", "Every score explains itself"]} />
    </AbsoluteFill>
  );
};

const Money: React.FC = () => {
  const at = f(0.4);
  const t1 = at + cue("money", "Companies pay");
  const t2 = at + cue("money", "Placement cells");
  const t3 = at + cue("money", "HR-tech");
  const t4 = at + cue("money", "A viva costs");
  const rows: [string, string, string, number][] = [
    ["Companies", "₹2,999 per internship role", "Includes the ranked, verified shortlist. One paid Internshala listing costs the same.", t1],
    ["College placement cells", "Per student batch", "Verify a whole batch before placement season.", t2],
    ["HR-tech platforms, like Promtal", "Per candidate, via our API", "The same API already serves our web and Android apps.", t3],
  ];
  const e4 = useEnter(t4);
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Callout x={170} y={90} w={1580} kicker="Who pays, and what we earn" title="Students never pay. Hiring does." />
      <div style={{ position: "absolute", left: 170, top: 330, width: 1000 }}>
        {rows.map(([who, price, note, d]) => <Revenue key={who} who={who} price={price} note={note} delay={d} />)}
      </div>
      <div style={{ position: "absolute", left: 1230, top: 330, width: 520, padding: "38px 40px", borderRadius: 26, background: "rgba(31,94,255,0.10)", boxShadow: "0 0 0 1.5px rgba(31,94,255,0.5)", opacity: e4, transform: `translateY(${(1 - e4) * 24}px)`, boxSizing: "border-box" }}>
        <div style={{ color: C.blueSoft, fontSize: 24, fontWeight: 600 }}>Unit economics</div>
        <div style={{ color: C.white, fontSize: 30, marginTop: 22 }}>AI cost of one viva</div>
        <div style={{ color: C.white, fontSize: 84, fontWeight: 760, letterSpacing: -2.5 }}>&lt; ₹10</div>
        <div style={{ color: C.white, fontSize: 30, marginTop: 18 }}>One paid role covers</div>
        <div style={{ color: C.white, fontSize: 84, fontWeight: 760, letterSpacing: -2.5 }}>300+ vivas</div>
        <div style={{ color: C.dim, fontSize: 19, marginTop: 18, lineHeight: 1.4 }}>Median of 6 live vivas: $0.071 (about ₹6), measured tokens × Gemini 3.8 Flash list price ($1.50 / $7.50 per 1M tokens)</div>
      </div>
      <Source text="Proposed pricing. Internshala's single-listing price (₹2,999) from internshala.com/blog, Sep 2026." y={952} delay={t1} />
    </AbsoluteFill>
  );
};
const Revenue: React.FC<{ who: string; price: string; note: string; delay: number }> = ({ who, price, note, delay }) => {
  const e = useEnter(delay);
  return (
    <div style={{ padding: "26px 32px", marginBottom: 22, borderRadius: 20, background: C.card, boxShadow: `0 0 0 1px ${C.line}`, opacity: e, transform: `translateX(${(1 - e) * -20}px)` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}><span style={{ color: C.white, fontSize: 32, fontWeight: 660 }}>{who}</span><span style={{ marginLeft: "auto", color: "#7ee2b8", fontSize: 32, fontWeight: 700 }}>{price}</span></div>
      <div style={{ color: C.muted, fontSize: 24, marginTop: 8 }}>{note}</div>
    </div>
  );
};

// ---------- Close ----------

const Close: React.FC<{ frames: number }> = ({ frames }) => {
  const at = f(0.4);
  const endAt = at + cue("close", "Proofolio. Show");
  const items: [string, string][] = [
    ["Student profile", "GitHub check, résumé or skill chips, interests, hackathons"],
    ["Internship listings", "Six roles from the track's ventures"],
    ["AI match score", "On AI-verified skills, with the reason shown"],
    ["Apply button", "With an explicit consent tick"],
    ["Admin shortlist", "Ranked, live, with evidence and CSV"],
  ];
  const frame = useCurrentFrame();
  const swap = interpolate(frame, [endAt - 8, endAt + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const landing = fit([[0.5, LD - 0.3]], Math.max(1, endAt + 8), "landing");
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: swap }}>
        <Browser left={110} top={150} width={1010} title="Proofolio"><Clips parts={landing} /></Browser>
        <div style={{ position: "absolute", left: 1190, top: 120, width: 640, fontFamily: FONT }}>
          <div style={{ color: C.blueSoft, fontSize: 26, fontWeight: 600 }}>The brief, live today</div>
          {items.map(([t, d], i) => <Brief key={t} t={t} d={d} delay={at + f(0.2) + i * f(0.85)} />)}
        </div>
      </AbsoluteFill>
      {frame >= endAt - 8 ? <EndCard delay={endAt} /> : null}
    </AbsoluteFill>
  );
};
const Brief: React.FC<{ t: string; d: string; delay: number }> = ({ t, d, delay }) => {
  const e = useEnter(delay);
  return (
    <div style={{ display: "flex", gap: 18, marginTop: 30, opacity: e, transform: `translateX(${(1 - e) * 18}px)` }}>
      <Check size={40} /><div><div style={{ color: C.white, fontSize: 34, fontWeight: 650 }}>{t}</div><div style={{ color: C.muted, fontSize: 23, marginTop: 4 }}>{d}</div></div>
    </div>
  );
};
const EndCard: React.FC<{ delay: number }> = ({ delay }) => {
  const e = useEnter(delay, 14);
  const q = useEnter(delay + f(1.2));
  return (
    <AbsoluteFill style={{ fontFamily: FONT, justifyContent: "center", padding: "0 200px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28, opacity: e, transform: `translateY(${(1 - e) * 20}px)` }}><Mark size={104} /><span style={{ fontSize: 112, fontWeight: 720, letterSpacing: -3.5, color: C.white }}>Proofolio</span></div>
      <div style={{ color: C.muted, fontSize: 52, fontWeight: 560, letterSpacing: -1, marginTop: 26, opacity: e }}>Show what you can really build.</div>
      <div style={{ color: C.dim, fontSize: 25, marginTop: 64, lineHeight: 1.6, maxWidth: 1000, opacity: q }}>
        Tri-City AI-Thon 2026 · Promtal track<br />@samarthputhraya (API, web, AI) · @trulyayush (Android)<br />
        Built in 24 hours with Claude Code and Google AI Studio. Narration, music and the sample answers are AI-generated.
      </div>
      <div style={{ position: "absolute", right: 200, top: 250, width: 420, opacity: q, transform: `scale(${0.9 + 0.1 * q})`, textAlign: "center" }}>
        <div style={{ background: "#fff", borderRadius: 26, padding: 30 }}><Img src={staticFile("qr.svg")} style={{ width: 360, height: 360 }} /></div>
        <div style={{ color: C.white, fontSize: 28, fontWeight: 600, marginTop: 22 }}>Verify your own repo</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Two-minute cut: merged scenes ----------

const Problem: React.FC<{ frames: number }> = ({ frames }) => {
  const at = f(0.5);
  const split = at + cue("problem", "Real builders") - f(0.3);
  const s2 = at + cue("problem", "and 84%");
  const s3 = at + cue("problem", "So every");
  return (
    <Series>
      <Series.Sequence durationInFrames={split}>
        <Fade frames={split}>
          <AbsoluteFill style={{ fontFamily: FONT, padding: "150px 170px 0" }}>
            <div style={{ display: "flex", gap: 36 }}>
              <Stat big="7.4 s" label="a recruiter's first look at a résumé" src="Ladders eye-tracking study, 2018" delay={at} />
              <Stat big="84%" label="of developers use or plan to use AI tools" src="Stack Overflow Developer Survey, 2025" delay={s2} color={C.blueSoft} />
            </div>
            <BigLine delay={s3} a="Every GitHub looks impressive." b="A repo alone no longer shows who can build." />
          </AbsoluteFill>
        </Fade>
      </Series.Sequence>
      <Series.Sequence durationInFrames={frames - split}>
        <AbsoluteFill style={{ fontFamily: FONT, padding: "130px 170px 0" }}>
          <div style={{ color: C.blueSoft, fontSize: 28, fontWeight: 600, marginBottom: 34 }}>Both sides lose</div>
          <div style={{ display: "flex", gap: 36 }}>
            <SideCol who="Students" icon={<PersonIcon color={C.blueSoft} />} delay={0} step={Math.max(f(0.8), cue("problem", "hackathon wins") - cue("problem", "Real builders"))}
              items={[["Real builders filtered out by keywords and CGPA"], ["Hackathon wins taken on trust"]]} />
            <SideCol who="Recruiters" icon={<BuildingIcon color={C.violet} />} delay={Math.max(f(1.2), cue("problem", "and 74%") - cue("problem", "Real builders") - f(0.6))} step={f(0.6)}
              items={[["of Indian recruiters say qualified talent got harder to find", "74%"]]}
              src="LinkedIn research, reported by People Matters, Jan 2026" />
          </div>
        </AbsoluteFill>
      </Series.Sequence>
    </Series>
  );
};
const BigLine: React.FC<{ delay: number; a: string; b: string }> = ({ delay, a, b }) => {
  const e = useEnter(delay, 16);
  return (
    <div style={{ marginTop: 64, fontSize: 60, fontWeight: 690, letterSpacing: -1.6, lineHeight: 1.15, color: C.white, opacity: e, transform: `translateY(${(1 - e) * 24}px)` }}>
      {a}<br /><span style={{ color: C.muted }}>{b}</span>
    </div>
  );
};

const Solution: React.FC<{ frames: number }> = ({ frames }) => {
  const at = f(0.3);
  const split = at + cue("solution", "Proofolio does") - f(0.2);
  const e1 = useEnter(at, 15);
  const steps = [["1", "Pick your own GitHub repo"], ["2", "Answer 5 questions about its code"], ["3", "Get a verified skill profile"]];
  const fitAt = at + cue("solution", "and get matched") - split;
  const pills: [string, string][] = [["Skills", "verified by a viva on real code"], ["Interests", "picked at sign-up"], ["Hackathon performance", "verified by a viva on the project repo"]];
  return (
    <Series>
      <Series.Sequence durationInFrames={split}>
        <Fade frames={split}>
          <AbsoluteFill style={{ fontFamily: FONT, justifyContent: "center", padding: "0 170px" }}>
            <div style={{ fontSize: 40, color: C.muted, fontWeight: 520, opacity: e1 }}>Nobody asks the one question that matters:</div>
            <div style={{ fontSize: 96, color: C.white, fontWeight: 740, letterSpacing: -3, lineHeight: 1.06, marginTop: 36, opacity: e1, transform: `translateY(${(1 - e1) * 30}px)` }}>"Do you understand the code<br />you're showing?"</div>
          </AbsoluteFill>
        </Fade>
      </Series.Sequence>
      <Series.Sequence durationInFrames={frames - split}>
        <SolutionB steps={steps} pills={pills} fitAt={fitAt} stepsAt={Math.max(4, at + cue("solution", "Students answer") - split)} />
      </Series.Sequence>
    </Series>
  );
};
const SolutionB: React.FC<{ steps: string[][]; pills: [string, string][]; fitAt: number; stepsAt: number }> = ({ steps, pills, fitAt, stepsAt }) => {
  const e = useEnter(2, 14);
  return (
    <AbsoluteFill style={{ alignItems: "center", fontFamily: FONT, paddingTop: 150 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 30, transform: `scale(${0.85 + 0.15 * e})`, opacity: e }}>
        <Mark size={112} />
        <span style={{ fontSize: 118, fontWeight: 720, letterSpacing: -4, color: C.white }}>Proofolio</span>
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 56 }}>
        {steps.map(([n, t], i) => <Step key={n} n={n} t={t} delay={stepsAt + i * f(0.7)} />)}
      </div>
      <div style={{ marginTop: 72, width: 1580, opacity: useEnter(fitAt) }}>
        <div style={{ color: C.blueSoft, fontSize: 26, fontWeight: 600, marginBottom: 20, textAlign: "center" }}>The Promtal brief: match students with internships on…</div>
        <div style={{ display: "flex", gap: 22 }}>
          {pills.map(([t, d], i) => <Pill key={t} t={t} d={d} delay={fitAt + f(0.5) + i * f(0.8)} />)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ReadingScene: React.FC<{ frames: number }> = ({ frames }) => {
  const pA = Math.round(frames * 0.6);
  const parts = fit([[SM.reading - 0.5, SM.reading + 2.2], [SM.found - 0.3, SM.found_team + 2.6]], pA);
  return (
    <AbsoluteFill>
      <Phone left={250} zoom={[[pA, 1, 20], [pA + f(1.1), 1.42, 34], [frames - f(0.5), 1.42, 34]]}>
        <Series>
          <Series.Sequence durationInFrames={pA}><Clips parts={parts} /></Series.Sequence>
          <Series.Sequence durationInFrames={frames - pA}><Img src={staticFile("q1.png")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} /></Series.Sequence>
        </Series>
      </Phone>
      <Callout x={860} y={230} kicker="Reading the repo" title="Questions on real lines. On a team repo, only yours." lines={["Skips libraries and generated code", "3 authors here: only files this student changed", "No definitions, no trick questions"]} delay={8} />
    </AbsoluteFill>
  );
};

const MatchScene2: React.FC<{ frames: number }> = ({ frames }) => {
  const p1 = f(0.3) + cue("match", "With consent") - f(0.1);
  const rest = frames - p1;
  const p2 = Math.round(rest * 0.48), p3 = rest - p2;
  const split = fit([[SM.internships - 0.3, SM.applied + 1.6]], p2)[0];
  const rsplit: Part = { ...split, video: "recruiter", from: RM.internships - 0.3, to: RM.applied + 1.6 };
  const rparts = fit([[RM.arrival - 1.0, RM.arrival + 2.6], [RM.candidate - 0.4, RM.cand_answers + 1.4], [RM.csv - 1.2, RM.csv + 1.3]], p3, "recruiter");
  const a = rparts[0].frames, b = rparts[1].frames;
  const bars: [string, number, string][] = [["Verified skills", 60, C.blue], ["Shared interests", 25, C.violet], ["Verified hackathons", 15, C.teal]];
  return (
    <Series>
      <Series.Sequence durationInFrames={p1}><Fade frames={p1}>
        <AbsoluteFill style={{ fontFamily: FONT }}>
          <Callout x={220} y={130} w={1480} kicker="How a match is scored" title="A formula you can check. No black box." />
          <div style={{ position: "absolute", left: 220, right: 220, top: 420 }}>
            {bars.map(([label, pct, color], i) => <Bar key={label} label={label} pct={pct} color={color} delay={f(0.3) + cue("match", ["60%", "25%", "15%"][i]) - f(0.2)} />)}
            <Note delay={f(0.3) + cue("match", "15%") + f(1.0)} text={"Every match says why: “Verified backend 90 covers 60% of this role; verified hackathon: Winner at ARGONYX ’26.” Claimed-only skills count for zero."} />
          </div>
        </AbsoluteFill>
      </Fade></Series.Sequence>
      <Series.Sequence durationInFrames={p2}>
        <AbsoluteFill>
          <LiveBadge />
          <Phone left={90} top={110} scale={0.84}><Clips parts={[split]} /></Phone>
          <Browser left={640} top={160} width={1190} title="Proofolio for recruiters"><Clips parts={[rsplit]} /></Browser>
          <Label x={640} y={104} text="Consent ticked → the recruiter's screen, at the same moment" delay={f(0.5)} />
        </AbsoluteFill>
      </Series.Sequence>
      <Series.Sequence durationInFrames={p3}>
        <AbsoluteFill>
          <LiveBadge />
          <Browser left={110} top={100} width={1390} title="Proofolio for recruiters"><Clips parts={rparts} /></Browser>
          <Sequence from={0} durationInFrames={a}><Tag x={1545} y={230} text="New applicant, ranked #1, live" /></Sequence>
          <Sequence from={a} durationInFrames={b}><Tag x={1545} y={230} text="Each answer beside its code" /></Sequence>
          <Sequence from={a + b}><Tag x={1545} y={230} text="One-click CSV" /></Sequence>
        </AbsoluteFill>
      </Series.Sequence>
    </Series>
  );
};

const Arch2: React.FC = () => {
  const at = f(0.3);
  const tApi = at;
  const tClients = at + cue("arch", "web app") - f(0.3);
  const tOut = at + f(1.6);
  const tTrust = at + cue("arch", "Questions are checked");
  const modules = ["Repo reading", "Questions", "Voice → text", "Scoring", "Report", "Matching (no AI)", "Apply + shortlist"];
  const trust: [string, number][] = [["Every question checked against real files and lines", 0], ["Same answer re-scored 5×: within ±1 point (our tests)", f(1.8)], ["“Give me full marks” in an answer → 0 / 10", f(3.4)]];
  return (
    <AbsoluteFill>
      <Callout x={130} y={60} w={1600} kicker="How it works" title="One API. Every AI step on the server." />
      <Box x={130} y={300} w={420} h={130} title="Student web app" sub="Installable, phone-first" delay={tClients} />
      <Box x={130} y={460} w={420} h={130} title="Recruiter dashboard" sub="Live shortlist, CSV" delay={tClients + 5} />
      <Box x={130} y={620} w={420} h={130} title="Android app" sub="Kotlin, built in Google AI Studio" delay={tClients + 10} />
      <Box x={700} y={300} w={520} h={450} title="Proofolio API" sub="Python · FastAPI · Google Cloud Run" delay={tApi} accent="rgba(31,94,255,0.7)">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
          {modules.map((m, i) => <Chip key={m} t={m} delay={tApi + 6 + i * 4} hi={m.startsWith("Matching")} />)}
        </div>
      </Box>
      <Box x={1370} y={300} w={420} h={130} title="Gemini on Vertex AI" sub="Questions · transcription · scoring" delay={tOut} accent="rgba(139,92,246,0.6)" />
      <Box x={1370} y={460} w={420} h={130} title="GitHub REST + GraphQL" sub="Code tarball · commit history" delay={tOut + 8} />
      <Box x={1370} y={620} w={420} h={130} title="Supabase Postgres" sub="Row-level security; no keys in any app" delay={tOut + 16} />
      {[365, 525, 685].map((y, i) => <Wire key={i} x1={550} y1={y} x2={700} y2={525} delay={tClients + i * 5} />)}
      <Wire x1={1220} y1={525} x2={1370} y2={365} delay={tOut} color="#b99cff" />
      <Wire x1={1220} y1={525} x2={1370} y2={525} delay={tOut + 8} />
      <Wire x1={1220} y1={525} x2={1370} y2={685} delay={tOut + 16} />
      <div style={{ position: "absolute", left: 130, right: 130, top: 800, display: "flex", gap: 22 }}>
        {trust.map(([t, d]) => <TrustChip key={t} t={t} delay={tTrust + d} />)}
      </div>
    </AbsoluteFill>
  );
};
const TrustChip: React.FC<{ t: string; delay: number }> = ({ t, delay }) => {
  const e = useEnter(delay);
  return <div style={{ flex: 1, display: "flex", gap: 14, alignItems: "center", padding: "18px 22px", borderRadius: 16, background: "rgba(34,197,94,0.07)", boxShadow: "0 0 0 1px rgba(34,197,94,0.3)", opacity: e, transform: `translateY(${(1 - e) * 16}px)`, fontFamily: FONT }}><Check size={30} /><span style={{ color: C.white, fontSize: 25, fontWeight: 560, lineHeight: 1.3 }}>{t}</span></div>;
};

const Col: React.FC<{ x: number; title: string; tag: string; tagColor: string; items: string[]; delay: number; icon: React.ReactNode; hi?: boolean }> = ({ x, title, tag, tagColor, items, delay, icon, hi }) => {
  const e = useEnter(delay);
  return (
    <div style={{ position: "absolute", left: x, top: 290, width: 505, height: 560, padding: "36px 36px", borderRadius: 26, background: hi ? "rgba(31,94,255,0.10)" : C.card, boxShadow: `0 0 0 ${hi ? 1.5 : 1}px ${hi ? "rgba(31,94,255,0.5)" : C.line}`, opacity: e, transform: `translateY(${(1 - e) * 26}px)`, fontFamily: FONT, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>{icon}<span style={{ fontSize: 38, fontWeight: 700, color: C.white }}>{title}</span>
        <span style={{ marginLeft: "auto", padding: "7px 15px", borderRadius: 999, fontSize: 21, fontWeight: 650, color: tagColor, boxShadow: `0 0 0 1.5px ${tagColor}` }}>{tag}</span></div>
      {items.map((t, i) => <ColItem key={i} t={t} delay={delay + 8 + i * 9} />)}
    </div>
  );
};
const ColItem: React.FC<{ t: string; delay: number }> = ({ t, delay }) => {
  const e = useEnter(delay);
  return <div style={{ display: "flex", gap: 14, marginTop: 26, opacity: e }}><span style={{ marginTop: 2 }}><Check size={30} /></span><span style={{ color: C.muted, fontSize: 28, lineHeight: 1.36 }}>{t}</span></div>;
};
const CoinIcon = ({ color }: { color: string }) => (
  <svg width="56" height="56" viewBox="0 0 24 24"><rect width="24" height="24" rx="7" fill={color} opacity="0.2" /><text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="700" fill={color} fontFamily="Inter">₹</text></svg>
);
const Business: React.FC = () => {
  const at = f(0.3);
  return (
    <AbsoluteFill>
      <Callout x={170} y={70} w={1580} kicker="Who gains, who pays" title="Students never pay. Hiring does." />
      <Col x={170} title="Students" tag="Free" tagColor={C.ok} icon={<PersonIcon color={C.blueSoft} />} delay={at + cue("business", "Students")}
        items={["One viva, reused on every application", "Judged on what they can actually do", "Report private until they apply"]} />
      <Col x={707} title="Companies" tag="Pay" tagColor={C.blueSoft} icon={<BuildingIcon color={C.violet} />} delay={at + cue("business", "Companies")}
        items={["Fewer, better interviews: a ranked shortlist with evidence", "₹2,999 per internship role, the price of one Internshala listing"]} />
      <Col x={1245} title="We earn" tag="Margin" tagColor="#7ee2b8" icon={<CoinIcon color="#7ee2b8" />} delay={at + cue("business", "Placement cells")} hi
        items={["Companies: per role", "Placement cells: per student batch", "HR-tech platforms like Promtal: per candidate, via our API", "AI cost per viva ≈ ₹6, so one role covers 300+ vivas"]} />
      <Source y={872} text="Proposed pricing. Internshala's ₹2,999 single-listing price: internshala.com/blog, Sep 2026. AI cost: median of 6 live vivas ($0.071), measured tokens × Gemini 3.8 Flash list price." delay={at + cue("business", "Companies")} />
    </AbsoluteFill>
  );
};

// ---------- The film ----------

export const Main: React.FC = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    const faces = [new FontFace("Inter", `url(${staticFile("fonts/inter.woff2")}) format("woff2")`, { weight: "100 900" }),
      new FontFace("JetBrains Mono", `url(${staticFile("fonts/jetbrains-mono.woff2")}) format("woff2")`, { weight: "100 800" })];
    Promise.all(faces.map((x) => x.load())).then((loaded) => { loaded.forEach((x) => (document as any).fonts.add(x)); continueRender(handle); });
  }, [handle]);

  const render = (s: Scene) => {
    const F = s.frames;
    switch (s.key) {
      case "problem": return <Problem frames={F} />;
      case "solution": return <Solution frames={F} />;
      case "signup": return <PhoneScene side="left" parts={fit([[SM.signup + 0.4, SM.github_found + 1.0], [SM.resume_added - 1.8, SM.resume_reading + 1.6], [SM.hack_dialog - 0.6, SM.hack_added + 2.2]], F)}
        callout={{ x: 0, y: 250, kicker: "Live app · sign-up", title: "Claims go in first.", lines: ["Gemini reads claimed skills from a résumé PDF", "Hackathon: ARGONYX '26, Best UI/UX, team of 3", "Counts for nothing until a viva verifies it"], delay: 8 }} />;
      case "reading": return <ReadingScene frames={F} />;
      case "voice": return (
        <Series>
          <Series.Sequence durationInFrames={f(voiceA + 0.5)}>
            <PhoneScene side="right" parts={[{ video: "student", from: SM.q1_recording - 0.5, to: SM.q1_recording + voiceA, frames: f(voiceA + 0.5) }]}
              callout={{ x: 0, y: 320, kicker: "Answering out loud, in Hinglish", title: "Speak or type, in any language.", lines: ["English, Hindi, Telugu or a mix"], delay: 6 }} />
          </Series.Sequence>
          <Series.Sequence durationInFrames={voiceBFrames}>
            <PhoneScene side="right" parts={fit([[SM.q1_recorded - 0.6, SM.q1_heard + 2.0], [SM.q2_followup - 0.4, SM.q2_followup + 3.2]], voiceBFrames)}
              callout={{ x: 0, y: 300, kicker: "Transcribed, then scored", title: "Understanding counts. Accent doesn't.", lines: ["No score shown during the viva", "A vague answer gets one follow-up"], delay: 4 }} />
          </Series.Sequence>
        </Series>
      );
      case "report": return <PhoneScene side="left" parts={fit([[SM.done - 0.3, SM.done + 3.4], [SM.report - 0.3, SM.report_claims + 0.6], [SM.report_hack - 1.0, SM.report_hack + 2.6]], F)}
        callout={{ x: 0, y: 240, kicker: "The report", title: "Every score comes with evidence.", lines: ["Skills with scores and levels", "Claimed vs verified, side by side", "Hackathon verified: Winner, ARGONYX '26", "64% of the team repo's commits are this account's"], delay: 8 }} />;
      case "match": return <MatchScene2 frames={F} />;
      case "arch": return <Arch2 />;
      case "business": return <Business />;
      default: return <Close frames={F} />;
    }
  };

  const total = totalFrames();
  return (
    <AbsoluteFill style={{ backgroundColor: "#080d19" }}>
      <Background />
      {SCENES.map((s, i) => (
        <Sequence key={s.key} from={STARTS[i]} durationInFrames={s.frames} name={s.key}>
          <Fade frames={s.frames}>{render(s)}{s.footage ? <LiveBadge /> : null}</Fade>
        </Sequence>
      ))}
      {SCENES.map((s, i) => (s.narr ? (
        <Sequence key={`vo-${s.key}`} from={STARTS[i] + (s.narrAt || 0)} durationInFrames={f(N[s.narr].seconds) + 2} name={`vo ${s.key}`}>
          <Audio src={staticFile(N[s.narr].file)} volume={1} />
        </Sequence>
      ) : null))}
      {SCENES.map((s, i) => (s.narr ? (
        <Sequence key={`cc-${s.key}`} from={STARTS[i]} durationInFrames={s.frames} name={`cc ${s.key}`}><Captions narrKey={s.narr} at={s.narrAt || 0} /></Sequence>
      ) : null))}
      <Sequence from={STUDENT_SPAN[0]} durationInFrames={STUDENT_SPAN[1] - STUDENT_SPAN[0]} name="student voice">
        <Audio src={staticFile("answer_q1.wav")} volume={(fr) => interpolate(fr, [0, 4, STUDENT_SPAN[1] - STUDENT_SPAN[0] - 8, STUDENT_SPAN[1] - STUDENT_SPAN[0]], [0, 0.95, 0.95, 0], { extrapolateRight: "clamp" })} />
      </Sequence>
      {/* Two music beds: a restrained one under the problem, the bright one from "Proofolio asks it" */}
      <Sequence from={0} durationInFrames={SOLUTION_AT + 45} name="music problem">
        <Audio src={staticFile("music_problem.wav")} loop volume={(fr) => {
          const talking = NARR_SPANS.some(([a, b]) => fr >= a - 6 && fr <= b + 6);
          return (talking ? 0.075 : 0.16) * interpolate(fr, [0, 30, SOLUTION_AT - 15, SOLUTION_AT + 45], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        }} />
      </Sequence>
      <Sequence from={SOLUTION_AT - 15} name="music">
        <Audio src={staticFile("music.wav")} loop volume={(fr) => {
          const g = fr + SOLUTION_AT - 15;
          const talking = NARR_SPANS.some(([a, b]) => g >= a - 6 && g <= b + 6) || (g >= STUDENT_SPAN[0] - 6 && g <= STUDENT_SPAN[1] + 6);
          return (talking ? 0.07 : 0.17) * interpolate(g, [SOLUTION_AT - 15, SOLUTION_AT + 30, total - 75, total], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        }} />
      </Sequence>
    </AbsoluteFill>
  );
};
