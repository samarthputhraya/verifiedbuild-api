// Proofolio demo video. Footage is recorded from the live app (capture/), narration is Gemini 2.5 Pro TTS,
// music is Lyria 2. Scene lengths follow the narration; footage is trimmed and re-timed to fit each scene.
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
const ANDROID: boolean = !!(timeline as any).android;
const ANSWER_S: number = (timeline as any).answer_q1_seconds;

const C = { blue: "#1f5eff", blueSoft: "#8fb0ff", white: "#f5f7fb", muted: "#a8b3c7", dim: "#6f7c93", violet: "#8b5cf6", teal: "#14b8a6", ok: "#22c55e", card: "rgba(255,255,255,0.06)", line: "rgba(255,255,255,0.12)" };
const FONT = "Inter, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

// ---------- Scene plan: durations come from the narration and the recorded footage ----------

type Part = { video: "student" | "recruiter"; from: number; to: number; frames: number };
const clipLen = (from: number, to: number) => to - from;
const stretch = (from: number, to: number, frames: number, video: Part["video"] = "student"): Part => ({ video, from, to, frames });

const voiceA = 6.4; // seconds of the spoken answer heard on its own
const voiceBFrames = f(Math.max(N.voice.seconds + 0.9, clipLen(SM.q1_recorded - 0.8, SM.q1_heard + 2.8) / 2.2));
const recA = clipLen(RM.arrival - 1.2, RM.arrival + 3.4);
const recC = clipLen(RM.csv - 1.6, RM.csv + 1.8);
const recTotal = Math.max(f(N.recruiter.seconds + 1.2), f(recA + recC + 4.5));
const matchSplit = clipLen(SM.internships - 0.4, SM.applied + 2.6);
const matchPart1 = f(12.1); // the formula stays up until "fifteen percent verified hackathons" has been said
const matchPart2 = Math.max(f(N.match.seconds + 1.0) - matchPart1, f(matchSplit / 1.5));

type Scene = { key: string; frames: number; narr?: string; narrAt?: number };
const SCENES: Scene[] = [
  { key: "hook", frames: f(N.hook.seconds + 1.4), narr: "hook", narrAt: f(0.5) },
  { key: "intro", frames: f(N.intro.seconds + 1.2), narr: "intro", narrAt: f(0.3) },
  { key: "signup", frames: f(N.signup.seconds + 1.0), narr: "signup", narrAt: f(0.3) },
  { key: "reading", frames: f(N.reading.seconds + 1.2), narr: "reading", narrAt: f(0.3) },
  { key: "question", frames: f(N.question.seconds + 1.3), narr: "question", narrAt: f(0.4) },
  { key: "voice", frames: f(voiceA + 0.6) + voiceBFrames, narr: "voice", narrAt: f(voiceA + 0.7) },
  { key: "followup", frames: f(N.followup.seconds + 1.6), narr: "followup", narrAt: f(0.4) },
  { key: "report", frames: f(N.report.seconds + 1.2), narr: "report", narrAt: f(0.3) },
  { key: "match", frames: matchPart1 + matchPart2, narr: "match", narrAt: f(0.3) },
  { key: "recruiter", frames: recTotal, narr: "recruiter", narrAt: f(0.4) },
  { key: "trust", frames: f(N.trust.seconds + 1.5), narr: "trust", narrAt: f(0.4) },
  ...(ANDROID ? [{ key: "android", frames: f(N.android.seconds + 2.0), narr: "android", narrAt: f(0.4) }] : []),
  { key: "close", frames: f(N.close.seconds + 3.4), narr: "close", narrAt: f(0.5) },
];
const STARTS: number[] = [];
SCENES.reduce((acc, s) => { STARTS.push(acc); return acc + s.frames; }, 0);
export const totalFrames = () => SCENES.reduce((a, s) => a + s.frames, 0);
const NARR_SPANS = SCENES.map((s, i) => (s.narr ? [STARTS[i] + (s.narrAt || 0), STARTS[i] + (s.narrAt || 0) + f(N[s.narr].seconds)] : null)).filter(Boolean) as number[][];
const VOICE_IDX = SCENES.findIndex((s) => s.key === "voice");
const STUDENT_SPAN = [STARTS[VOICE_IDX] + f(0.6), STARTS[VOICE_IDX] + f(voiceA + 0.6)];

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
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1100px 760px at ${x}% ${y}%, rgba(31,94,255,0.20), transparent 62%), radial-gradient(900px 600px at ${100 - x}% ${100 - y}%, rgba(139,92,246,0.10), transparent 60%), linear-gradient(180deg, #080d19 0%, #0b1324 100%)` }} />
  );
};

const Mark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="6" fill={C.blue} /><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
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

// A phone with the student app inside; zoom moves the camera into the screen
const Phone: React.FC<{ left: number; top?: number; scale?: number; zoom?: [number, number, number][]; children: React.ReactNode }> = ({ left, top = 70, scale = 0.9, zoom, children }) => {
  const frame = useCurrentFrame();
  const enter = useEnter(0, 20);
  let z = 1, ox = 50, oy = 50;
  if (zoom && zoom.length) {
    ox = 0; // zoom from the left edge, where the question and the line numbers start
    const fs = zoom.map((k) => k[0]);
    z = interpolate(frame, fs, zoom.map((k) => k[1]), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
    oy = interpolate(frame, fs, zoom.map((k) => k[2]), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  }
  const W = 430, H = 931;
  return (
    <div style={{ position: "absolute", left, top: top + (1 - enter) * 40, width: W, height: H, transform: `scale(${scale})`, transformOrigin: "50% 0%", opacity: enter }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 66, background: "linear-gradient(145deg, #2a2f3a, #0d0f14)", boxShadow: "0 60px 120px -30px rgba(0,0,0,0.75), 0 0 0 1.5px rgba(255,255,255,0.10) inset" }} />
      <div style={{ position: "absolute", left: 11, top: 11, right: 11, bottom: 11, borderRadius: 56, overflow: "hidden", background: "#fff" }}>
        <div style={{ width: "100%", height: "100%", transform: `scale(${z})`, transformOrigin: `${ox}% ${oy}%` }}>{children}</div>
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

const Callout: React.FC<{ x: number; y: number; w?: number; delay?: number; kicker?: string; title: string; lines?: string[] }> = ({ x, y, w = 640, delay = 0, kicker, title, lines = [] }) => {
  const e = useEnter(delay);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, transform: `translateY(${(1 - e) * 24}px)`, opacity: e, fontFamily: FONT }}>
      {kicker ? <div style={{ color: C.blueSoft, fontSize: 24, fontWeight: 600, marginBottom: 14 }}>{kicker}</div> : null}
      <div style={{ color: C.white, fontSize: 52, lineHeight: 1.12, fontWeight: 680, letterSpacing: -1.2 }}>{title}</div>
      {lines.map((l, i) => <Line key={i} text={l} delay={delay + 10 + i * 9} />)}
    </div>
  );
};
const Line: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
  const e = useEnter(delay);
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginTop: 22, opacity: e, transform: `translateX(${(1 - e) * -16}px)` }}>
      <svg width="30" height="30" viewBox="0 0 24 24" style={{ flex: "none", marginTop: 3 }}><circle cx="12" cy="12" r="11" fill="rgba(34,197,94,0.16)" /><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke={C.ok} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span style={{ color: C.muted, fontSize: 30, lineHeight: 1.35, fontWeight: 450 }}>{text}</span>
    </div>
  );
};

// Captions: the narration, one sentence at a time, timed by its share of the clip
const Captions: React.FC<{ narrKey: string; at: number }> = ({ narrKey, at }) => {
  const frame = useCurrentFrame();
  const n = N[narrKey];
  const parts = n.text.split(/(?<=[.?!])\s+/).flatMap((s) => (s.length > 125 ? s.split(/(?<=,)\s+/) : [s]));
  const lead = 0.28, total = n.seconds - lead - 0.2;
  const chars = parts.reduce((a, p) => a + p.length, 0);
  let acc = at + f(lead);
  const spans = parts.map((p) => { const st = acc; acc += (p.length / chars) * total * FPS; return [st, acc, p] as [number, number, string]; });
  const cur = spans.find(([s, e]) => frame >= s && frame < e + 6);
  if (!cur) return null;
  const o = interpolate(frame, [cur[0], cur[0] + 5], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 38, display: "flex", justifyContent: "center", opacity: o }}>
      <div style={{ maxWidth: 1480, padding: "13px 28px", borderRadius: 14, background: "rgba(6,10,20,0.78)", color: "#fff", fontFamily: FONT, fontSize: 33, lineHeight: 1.3, fontWeight: 520, textAlign: "center", boxShadow: "0 0 0 1px rgba(255,255,255,0.06)" }}>{cur[2]}</div>
    </div>
  );
};

// ---------- Scenes ----------

const Hook: React.FC = () => {
  const words1 = "Anyone can ship a project with AI now.".split(" ");
  const words2 = "So a GitHub repo no longer shows whether a student can really build.".split(" ");
  const W = ({ w, i, base, color }: { w: string; i: number; base: number; color: string }) => {
    const e = useEnter(base + i * 3, 16);
    return <span style={{ display: "inline-block", marginRight: color === C.white ? 22 : 15, opacity: e, transform: `translateY(${(1 - e) * 28}px)`, color }}>{w}</span>;
  };
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 180px", fontFamily: FONT }}>
      <div style={{ fontSize: 86, fontWeight: 700, letterSpacing: -2.6, lineHeight: 1.08, color: C.white }}>{words1.map((w, i) => <W key={i} w={w} i={i} base={14} color={C.white} />)}</div>
      <div style={{ fontSize: 58, fontWeight: 560, letterSpacing: -1.4, lineHeight: 1.18, marginTop: 34, maxWidth: 1450 }}>{words2.map((w, i) => <W key={i} w={w} i={i} base={f(3.4)} color={C.muted} />)}</div>
    </AbsoluteFill>
  );
};

const Intro: React.FC = () => {
  const e = useEnter(4, 14);
  const steps = [["1", "Pick one of your own GitHub repos"], ["2", "Answer 5 questions about its code"], ["3", "Get matched on what you show"]];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", gap: 34, transform: `scale(${0.85 + 0.15 * e})`, opacity: e }}>
        <Mark size={128} />
        <span style={{ fontSize: 132, fontWeight: 720, letterSpacing: -4, color: C.white }}>Proofolio</span>
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 70 }}>
        {steps.map(([n, t], i) => <Step key={n} n={n} t={t} delay={f(1.6) + i * f(1.1)} />)}
      </div>
    </AbsoluteFill>
  );
};
const Step: React.FC<{ n: string; t: string; delay: number }> = ({ n, t, delay }) => {
  const e = useEnter(delay);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 24px", borderRadius: 18, background: C.card, boxShadow: `0 0 0 1px ${C.line}`, opacity: e, transform: `translateY(${(1 - e) * 22}px)` }}>
      <span style={{ width: 44, height: 44, borderRadius: 22, background: "rgba(31,94,255,0.22)", color: C.blueSoft, display: "grid", placeItems: "center", fontSize: 22, fontWeight: 700 }}>{n}</span>
      <span style={{ color: C.white, fontSize: 27, fontWeight: 560 }}>{t}</span>
    </div>
  );
};

const PhoneScene: React.FC<{ parts: Part[]; side: "left" | "right"; callout: React.ComponentProps<typeof Callout>; zoom?: [number, number, number][]; still?: string }> = ({ parts, side, callout, zoom, still }) => (
  <AbsoluteFill>
    <Phone left={side === "left" ? 230 : 1270} zoom={zoom}>{still ? <Img src={staticFile(still)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} /> : <Clips parts={parts} />}</Phone>
    <Callout {...callout} x={side === "left" ? 860 : 170} />
  </AbsoluteFill>
);

const Formula: React.FC = () => {
  const rows: [string, number, string][] = [["Verified skills", 60, C.blue], ["Shared interests", 25, C.violet], ["Verified hackathons", 15, C.teal]];
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 260px", fontFamily: FONT }}>
      <Callout x={260} y={170} w={1400} kicker="How a match is scored" title="A plain formula. No AI in this number." />
      <div style={{ position: "absolute", left: 260, right: 260, top: 470 }}>
        {rows.map(([label, pct, color], i) => <Bar key={label} label={label} pct={pct} color={color} delay={[f(6.2), f(8.1), f(9.8)][i]} />)}
        <Note delay={f(10.8)} text="Skills a student only claims count for zero." />
      </div>
    </AbsoluteFill>
  );
};
const Bar: React.FC<{ label: string; pct: number; color: string; delay: number }> = ({ label, pct, color, delay }) => {
  const e = useEnter(delay, 22);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr 120px", alignItems: "center", gap: 30, marginBottom: 34, opacity: Math.min(1, e * 1.4) }}>
      <span style={{ color: C.white, fontSize: 36, fontWeight: 600 }}>{label}</span>
      <div style={{ height: 22, borderRadius: 11, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}><div style={{ width: `${(pct / 60) * 100 * e}%`, height: "100%", borderRadius: 11, background: color }} /></div>
      <span style={{ color: C.white, fontSize: 44, fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Math.round(pct * e)}%</span>
    </div>
  );
};
const Note: React.FC<{ delay: number; text: string }> = ({ delay, text }) => {
  const e = useEnter(delay);
  return <div style={{ marginTop: 26, color: C.muted, fontSize: 32, opacity: e }}>{text}</div>;
};

const MatchScene: React.FC = () => {
  const split: Part = stretch(SM.internships - 0.4, SM.applied + 2.6, matchPart2);
  const rsplit: Part = { ...split, video: "recruiter", from: RM.internships - 0.4, to: RM.applied + 2.6 };
  return (
    <Series>
      <Series.Sequence durationInFrames={matchPart1}><Fade frames={matchPart1}><Formula /></Fade></Series.Sequence>
      <Series.Sequence durationInFrames={matchPart2}>
        <AbsoluteFill>
          <Phone left={90} top={95} scale={0.84}><Clips parts={[split]} /></Phone>
          <Browser left={640} top={150} width={1190} title="Proofolio for recruiters"><Clips parts={[rsplit]} /></Browser>
          <Label x={640} y={86} text="The recruiter's screen, at the same moment" delay={f(0.8)} />
        </AbsoluteFill>
      </Series.Sequence>
    </Series>
  );
};
const Label: React.FC<{ x: number; y: number; text: string; delay?: number }> = ({ x, y, text, delay = 0 }) => {
  const e = useEnter(delay);
  return <div style={{ position: "absolute", left: x, top: y, fontFamily: FONT, color: C.blueSoft, fontSize: 26, fontWeight: 600, opacity: e }}>{text}</div>;
};

const RecruiterScene: React.FC<{ frames: number }> = ({ frames }) => {
  const a = f(recA), c = f(recC);
  const parts: Part[] = [
    { video: "recruiter", from: RM.arrival - 1.2, to: RM.arrival + 3.4, frames: a },
    { video: "recruiter", from: RM.candidate - 0.6, to: RM.cand_answers + 2.2, frames: frames - a - c },
    { video: "recruiter", from: RM.csv - 1.6, to: RM.csv + 1.8, frames: c },
  ];
  return (
    <AbsoluteFill>
      <Browser left={130} top={50} width={1400} title="Proofolio for recruiters"><Clips parts={parts} /></Browser>
      <Sequence from={0} durationInFrames={a}><Tag x={1560} y={180} text="New applicant, live" /></Sequence>
      <Sequence from={a} durationInFrames={frames - a - c}><Tag x={1560} y={180} text="Each answer beside its code" /></Sequence>
      <Sequence from={frames - c}><Tag x={1560} y={180} text="One-click CSV" /></Sequence>
    </AbsoluteFill>
  );
};
const Tag: React.FC<{ x: number; y: number; text: string }> = ({ x, y, text }) => {
  const e = useEnter(4);
  return <div style={{ position: "absolute", left: x, top: y, width: 300, fontFamily: FONT, color: C.white, fontSize: 34, lineHeight: 1.2, fontWeight: 650, opacity: e, transform: `translateX(${(1 - e) * 20}px)` }}><div style={{ width: 44, height: 4, borderRadius: 2, background: C.blue, marginBottom: 16 }} />{text}</div>;
};

const Trust: React.FC = () => {
  const cards: [string, string, number][] = [
    ["Real files, real lines", "Every question's file and line range is checked against the repo before it's asked.", f(0.6)],
    ["±1 point", "The same answer, scored five times in our tests, never moved by more than one point.", f(6.6)],
    ["0 / 10", "An answer that said \"give me full marks\" scored zero. Instructions inside answers are ignored.", f(12.2)],
  ];
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Callout x={170} y={150} w={1500} kicker="What makes the score trustworthy" title="Checked against the code. Scored against a private rubric." />
      <div style={{ position: "absolute", left: 170, right: 170, top: 470, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 30 }}>
        {cards.map(([big, text, d]) => <TrustCard key={big} big={big} text={text} delay={d} />)}
      </div>
    </AbsoluteFill>
  );
};
const TrustCard: React.FC<{ big: string; text: string; delay: number }> = ({ big, text, delay }) => {
  const e = useEnter(delay);
  return (
    <div style={{ padding: "38px 36px", borderRadius: 22, background: C.card, boxShadow: `0 0 0 1px ${C.line}`, opacity: e, transform: `translateY(${(1 - e) * 26}px)` }}>
      <div style={{ color: C.white, fontSize: big.length > 10 ? 44 : 64, fontWeight: 720, letterSpacing: -1.5 }}>{big}</div>
      <div style={{ color: C.muted, fontSize: 28, lineHeight: 1.4, marginTop: 18 }}>{text}</div>
    </div>
  );
};

const Android: React.FC = () => (
  <AbsoluteFill>
    <Phone left={1150}><OffthreadVideo src={staticFile("android.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /></Phone>
    <Callout x={200} y={360} kicker="Also on Android" title="Proofolio for Android, on the same backend." />
  </AbsoluteFill>
);

const Close: React.FC = () => {
  const e = useEnter(6, 14);
  const q = useEnter(f(1.4));
  return (
    <AbsoluteFill style={{ fontFamily: FONT, justifyContent: "center", padding: "0 200px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28, opacity: e, transform: `translateY(${(1 - e) * 20}px)` }}><Mark size={104} /><span style={{ fontSize: 112, fontWeight: 720, letterSpacing: -3.5, color: C.white }}>Proofolio</span></div>
      <div style={{ color: C.muted, fontSize: 52, fontWeight: 560, letterSpacing: -1, marginTop: 26, opacity: e }}>Show what you can really build.</div>
      <div style={{ color: C.dim, fontSize: 26, marginTop: 70, opacity: q }}>Built at Tri-City AI-Thon 2026 for the Promtal track, with Claude Code and Google AI Studio.</div>
      <div style={{ position: "absolute", right: 200, top: 300, width: 420, opacity: q, transform: `scale(${0.9 + 0.1 * q})`, textAlign: "center" }}>
        <div style={{ background: "#fff", borderRadius: 26, padding: 30 }}><Img src={staticFile("qr.svg")} style={{ width: 360, height: 360 }} /></div>
        <div style={{ color: C.white, fontSize: 28, fontWeight: 600, marginTop: 22 }}>Verify your own repo</div>
      </div>
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
    switch (s.key) {
      case "hook": return <Hook />;
      case "intro": return <Intro />;
      case "signup": return <PhoneScene side="left" parts={[stretch(SM.signup + 0.4, SM.home + 1.6, s.frames)]}
        callout={{ x: 0, y: 300, kicker: "A sample student, on one of our own repos", title: "Sign up in about two minutes.", lines: ["GitHub checked as you type", "Skills from a resume or a quick pick list"], delay: 8 }} />;
      case "reading": return <PhoneScene side="right" parts={[stretch(SM.repos - 0.3, SM.found + 1.4, s.frames)]}
        callout={{ x: 0, y: 250, kicker: "Reading the repo", title: "Five questions about real lines of code.", lines: ["Downloads the repo from GitHub", "Skips libraries and generated files", "Ranks the files that matter"], delay: 8 }} />;
      case "question": return <PhoneScene side="left" still="q1.png" parts={[]}
        zoom={[[f(1.4), 1, 30], [f(3.6), 1.4, 46], [s.frames - f(1.6), 1.4, 46], [s.frames, 1, 30]]}
        callout={{ x: 0, y: 300, kicker: "Question 1 of 5", title: "Why did you build it this way?", lines: ["Points at a real file and line range", "No trick questions, no definitions"], delay: 10 }} />;
      case "voice": return (
        <Series>
          <Series.Sequence durationInFrames={f(voiceA + 0.6)}>
            <PhoneScene side="right" parts={[{ video: "student", from: SM.q1_recording - 0.6, to: SM.q1_recording + voiceA, frames: f(voiceA + 0.6) }]}
              callout={{ x: 0, y: 330, kicker: "Answering out loud, in Hinglish", title: "Speak or type, in any language.", lines: ["English, Hindi, Telugu or a mix"], delay: 6 }} />
          </Series.Sequence>
          <Series.Sequence durationInFrames={voiceBFrames}>
            <PhoneScene side="right" parts={[stretch(SM.q1_recorded - 0.8, SM.q1_heard + 2.8, voiceBFrames)]}
              callout={{ x: 0, y: 330, kicker: "Transcribed, then scored", title: "Understanding counts. Accent doesn't.", lines: ["No score shown during the viva"], delay: 4 }} />
          </Series.Sequence>
        </Series>
      );
      case "followup": return <PhoneScene side="left" parts={[stretch(SM.q2 - 0.2, SM.q2_followup + 3.6, s.frames)]}
        callout={{ x: 0, y: 320, kicker: "A vague answer", title: "One follow-up. The better score counts.", delay: 8 }} />;
      case "report": return <PhoneScene side="right" parts={[stretch(SM.report - 0.3, SM.report_answers + 2.2, s.frames)]}
        callout={{ x: 0, y: 260, kicker: "The report", title: "Every score comes with evidence.", lines: ["Skills with scores and levels", "Claimed vs verified, side by side", "The student's words, next to the code"], delay: 8 }} />;
      case "match": return <MatchScene />;
      case "recruiter": return <RecruiterScene frames={s.frames} />;
      case "trust": return <Trust />;
      case "android": return <Android />;
      default: return <Close />;
    }
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#080d19" }}>
      <Background />
      {SCENES.map((s, i) => (
        <Sequence key={s.key} from={STARTS[i]} durationInFrames={s.frames} name={s.key}>
          <Fade frames={s.frames}>{render(s)}</Fade>
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
      <Audio src={staticFile("music.wav")} loop volume={(fr) => {
        const total = totalFrames();
        const talking = NARR_SPANS.some(([a, b]) => fr >= a - 6 && fr <= b + 6) || (fr >= STUDENT_SPAN[0] - 6 && fr <= STUDENT_SPAN[1] + 6);
        const base = talking ? 0.07 : 0.17;
        return base * interpolate(fr, [0, 30, total - 75, total], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      }} />
    </AbsoluteFill>
  );
};
