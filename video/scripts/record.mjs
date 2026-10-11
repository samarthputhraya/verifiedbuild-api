// Records the Proofolio demo from the LIVE app: a labelled sample student on a phone, and the recruiter dashboard.
// Frames come from Chrome's screencast (lossless-quality JPEG at device pixels), with wall-clock markers for the edit.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = path.resolve(HERE, "..");
const OUT = path.join(VIDEO, "capture");
const B = "https://verifiedbuild-api-215071922486.asia-south1.run.app";
const PY = path.resolve(VIDEO, "..", "venv", "Scripts", "python.exe");
const ENV = fs.readFileSync("C:/Users/samar/OneDrive/Documents/tricity/.env", "utf8");
const ADMIN_KEY = (ENV.match(/^ADMIN_KEY=(.*)$/m) || [])[1].trim().replace(/^"|"$/g, "");
const REPO = "Guru-Graph";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const markers = [];
const mark = (name) => { markers.push({ name, t: Date.now() / 1000 }); console.log("marker", name); try { saveMarkers(); } catch {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const recorders = new Set();
async function startRec(page, name) {
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  const save = () => fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify({ frames, end: Date.now() / 1000 }));
  cdp.on("Page.screencastFrame", (fr) => {
    const file = path.join(dir, `${String(frames.length).padStart(6, "0")}.jpg`);
    frames.push({ file, t: Date.now() / 1000 });
    fs.writeFileSync(file, Buffer.from(fr.data, "base64"));
    cdp.send("Page.screencastFrameAck", { sessionId: fr.sessionId }).catch(() => {});
    if (frames.length % 150 === 0) save();
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 95, everyNthFrame: 1 });
  let running = true;
  const rec = { stop: async () => { if (!running) return; running = false; await cdp.send("Page.stopScreencast").catch(() => {}); save(); recorders.delete(rec); return frames.length; } };
  recorders.add(rec);
  return rec;
}
const saveMarkers = () => fs.writeFileSync(path.join(OUT, "markers.json"), JSON.stringify(markers, null, 1));
process.on("uncaughtException", async (e) => { console.error("CRASH", e); for (const r of [...recorders]) await r.stop(); saveMarkers(); process.exit(1); });

// A visible touch dot (phone) or pointer (desktop), so viewers can follow each tap and click
const POINTER = (kind) => `(() => {
  const add = () => {
    const d = document.createElement("div");
    const s = d.style;
    s.position = "fixed"; s.zIndex = "2147483647"; s.pointerEvents = "none"; s.left = "-100px"; s.top = "-100px";
    s.transition = "opacity 300ms, transform 160ms";
    if ("${kind}" === "touch") { s.width = "44px"; s.height = "44px"; s.borderRadius = "50%"; s.background = "rgba(31,94,255,0.28)"; s.border = "2px solid rgba(31,94,255,0.75)"; s.opacity = "0"; s.marginLeft = "-22px"; s.marginTop = "-22px"; }
    else { s.width = "20px"; s.height = "20px"; s.borderRadius = "50%"; s.background = "rgba(15,23,42,0.85)"; s.border = "2px solid #fff"; s.boxShadow = "0 2px 8px rgba(0,0,0,0.35)"; s.marginLeft = "-10px"; s.marginTop = "-10px"; }
    document.body.appendChild(d);
    let hide;
    addEventListener("pointermove", (e) => { s.left = e.clientX + "px"; s.top = e.clientY + "px"; }, true);
    addEventListener("pointerdown", (e) => { s.left = e.clientX + "px"; s.top = e.clientY + "px"; s.opacity = "1"; s.transform = "scale(0.8)"; clearTimeout(hide); }, true);
    addEventListener("pointerup", () => { s.transform = "scale(1)"; if ("${kind}" === "touch") hide = setTimeout(() => { s.opacity = "0"; }, 350); }, true);
  };
  if (document.body) add(); else addEventListener("DOMContentLoaded", add);
})();`;

async function tapEl(page, locator, opts = {}) {
  const el = typeof locator === "string" ? page.locator(locator).first() : locator;
  await el.scrollIntoViewIfNeeded();
  // Keep the target clear of the fixed top and bottom bars, and let any re-render settle
  if (opts.center !== false && await el.evaluate((e) => { const r = e.getBoundingClientRect(); const off = r.top < 90 || r.bottom > innerHeight - 110; if (off) e.scrollIntoView({ block: "center", behavior: "smooth" }); return off; })) await sleep(700);
  const box = await el.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: opts.steps || 12 });
  await sleep(opts.pause ?? 180);
  await page.mouse.down(); await sleep(90); await page.mouse.up();
}
async function typeIn(page, sel, text, delay = 55) { await tapEl(page, sel); await page.locator(sel).pressSequentially(text, { delay }); }
async function smoothScroll(page, dy, steps = 30, ms = 1400) { for (let i = 0; i < steps; i++) { const f = 0.5 - 0.5 * Math.cos(Math.PI * (i + 1) / steps) - (0.5 - 0.5 * Math.cos(Math.PI * i / steps)); await page.evaluate((y) => window.scrollBy(0, y), dy * f); await sleep(ms / steps); } }
function makeAnswer(job) {
  const f = path.join(OUT, `job_${job.kind}_${Date.now()}.json`);
  fs.writeFileSync(f, JSON.stringify(job));
  const out = execFileSync(PY, [path.join(VIDEO, "make_answer.py"), f], { encoding: "utf8" });
  return JSON.parse(out.trim().split("\n").pop());
}
async function currentQuestion(page) {
  const a = JSON.parse(await page.evaluate(() => sessionStorage.getItem("vb_last_analysis")));
  const title = await page.locator(".viva-bar .h3").innerText();
  const n = Number((title.match(/Question (\d+)/) || [])[1] || 1);
  return a.questions[n - 1];
}
async function waitAnswerSaved(page, prevKey) {
  // The question text or follow-up changes, or the viva ends
  await page.waitForFunction((k) => location.hash.includes("done") || [...document.querySelectorAll(".question, .followup p")].map((e) => e.innerText).join("|") !== k, prevKey, { timeout: 120000 });
}
const qKey = (page) => page.evaluate(() => [...document.querySelectorAll(".question, .followup p")].map((e) => e.innerText).join("|"));

const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--force-color-profile=srgb", "--font-render-hinting=none"] });

// ---------- Recruiter window (desktop), signed in before recording starts ----------
const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 4 / 3, colorScheme: "light" });
await rctx.addInitScript(POINTER("mouse"));
const rp = await rctx.newPage();
await rp.goto(B + "/recruiter/");
await rp.evaluate((k) => sessionStorage.setItem("vb_admin_key", k), ADMIN_KEY);
await rp.goto(B + "/recruiter/#/listing/l-promtal-backend");
await rp.reload();
await rp.waitForSelector(".split-detail .h1", { timeout: 30000 });
await rp.mouse.move(700, 600);

// ---------- A labelled sample résumé (PDF), so sign-up shows Gemini reading claimed skills ----------
const RESUME = path.join(OUT, "kavya-sample-resume.pdf");
{
  const p = await (await browser.newContext()).newPage();
  await p.setContent(`<html><body style="font-family:Arial;padding:40px;color:#111">
    <div style="color:#b00;font-weight:bold">SAMPLE RESUME, made for the Proofolio demo video</div>
    <h1 style="margin:8px 0 0">Kavya (sample)</h1><div>B.Tech Computer Science, 3rd year · github.com/samarthputhraya</div>
    <h3>Skills</h3><div>TypeScript, React, Next.js, Python, FastAPI, PostgreSQL, Docker, Machine Learning</div>
    <h3>Projects</h3><div>GuruGraph: homework feedback app for teachers and students (ARGONYX 2026, Best UI/UX)</div>
    <h3>Hackathons</h3><div>ARGONYX 2026, RV University: Best UI/UX award (team of 3)</div></body></html>`);
  await p.pdf({ path: RESUME, format: "A4" });
  await p.context().close();
}

// ---------- Landing page (desktop), read-only ----------
{
  const lctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 4 / 3, colorScheme: "light" });
  await lctx.addInitScript(POINTER("mouse"));
  const lp = await lctx.newPage();
  await lp.goto(B + "/");
  await lp.waitForLoadState("networkidle");
  await lp.mouse.move(900, 300);
  await sleep(600);
  const lrec = await startRec(lp, "landing");
  mark("landing");
  await sleep(2500);
  await smoothScroll(lp, 760, 50, 3600); await sleep(1800);
  await smoothScroll(lp, 700, 50, 3400); await sleep(1800);
  await smoothScroll(lp, 760, 50, 3600); await sleep(2200);
  mark("landing_end");
  await lrec.stop();
  await lctx.close();
}

// ---------- Student phone ----------
const sctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: false, colorScheme: "light",
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  permissions: ["microphone"],
});
await sctx.addInitScript(POINTER("touch"));
const sp = await sctx.newPage();
let answerWav = null;
await sp.route("**/__answer.wav", (route) => route.fulfill({ status: 200, contentType: "audio/wav", body: fs.readFileSync(answerWav) }));
await sp.goto(B + "/app/");
await sp.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await sp.reload();
await sp.waitForSelector("#github");
await sleep(800);

const srec = await startRec(sp, "student");
mark("signup");
await sleep(1200);
await typeIn(sp, "#github", "samarthputhraya", 70);
await sp.waitForSelector(".field.ok", { timeout: 20000 });
mark("github_found");
await sleep(1800);
await tapEl(sp, "button:has-text('Continue')");
await sleep(700);
mark("about");
await typeIn(sp, "#name", "Kavya (sample)", 45);
await typeIn(sp, "#email", "kavya.sample@example.com", 25);
await typeIn(sp, "#college", "Sample profile, AI-written answers", 30);
await sleep(500);
await tapEl(sp, "button:has-text('Continue')");
await sleep(700);
mark("interests");
for (const t of ["AI", "EdTech", "SaaS", "HR-Tech"]) { await tapEl(sp, `button.chip:text-is("${t}")`); await sleep(250); }
await sleep(500);
await tapEl(sp, "button:has-text('Continue')");
await sleep(700);
mark("skills");
// Résumé upload through the real file picker, plus picked chips as a fallback
const chooser = sp.waitForEvent("filechooser");
await tapEl(sp, "label.drop");
await (await chooser).setFiles(RESUME);
await sleep(1400);
mark("resume_added");
for (const t of ["TypeScript", "React", "Python"]) { await tapEl(sp, `button.chip:text-is("${t}")`); await sleep(220); }
await sleep(600);
await tapEl(sp, "button:has-text('Create my profile')");
mark("resume_reading");
await Promise.race([
  sp.waitForURL(/#\/home/, { timeout: 90000 }),
  sp.waitForSelector("button:has-text('Continue with my picked skills')", { timeout: 90000 }).then(async () => { mark("resume_failed"); await sleep(1500); await tapEl(sp, "button:has-text('Continue with my picked skills')"); await sp.waitForURL(/#\/home/, { timeout: 60000 }); }),
]);
await sp.waitForSelector("text=Verify your skills", { timeout: 30000 });
mark("home");
await sleep(2500);

// A hackathon claim: our team's real ARGONYX '26 project, a team repo with three authors
await smoothScroll(sp, 380, 30, 1800);
await sleep(800);
await tapEl(sp, "button:has-text('Add')");
await sp.waitForSelector("dialog[open] #h-event");
mark("hack_dialog");
await sleep(700);
await typeIn(sp, "#h-event", "ARGONYX '26", 70);
await sleep(300);
await tapEl(sp, "#h-team"); await sp.fill("#h-team", ""); await sp.locator("#h-team").pressSequentially("3", { delay: 80 });
await sleep(300);
await tapEl(sp, "#h-result"); await sp.selectOption("#h-result", "winner");
await sleep(500);
await tapEl(sp, "#h-repo"); await sp.selectOption("#h-repo", `samarthputhraya/${REPO}`);
await sleep(900);
mark("hack_filled");
await tapEl(sp, "dialog button:has-text('Add hackathon')");
await sp.waitForSelector("button:has-text('Verify now')", { timeout: 30000 });
mark("hack_added");
await sleep(3200);
await tapEl(sp, "button:has-text('Verify now')");
mark("reading");
await sp.waitForURL(/#\/found/, { timeout: 180000 });
mark("found");
await sleep(3000);
await smoothScroll(sp, 300, 30, 2000);
mark("found_team");
await sleep(3000);
await smoothScroll(sp, 600, 40, 2600);
await sleep(1200);
await tapEl(sp, "button:has-text('Start question 1')");
await sp.waitForSelector(".viva-bar");
mark("q1");

// Q1: a spoken answer in Hinglish, through the app's real recorder (the mic is fed this speech)
const q1 = await currentQuestion(sp);
answerWav = path.join(OUT, "answer_q1");
const voice = makeAnswer({ question: q1.question, snippet: q1.snippet, file: q1.file, kind: "voice", out: answerWav });
answerWav += ".wav";
execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", answerWav, "-af", "apad=pad_dur=4", path.join(OUT, "answer_q1_padded.wav")]);
answerWav = path.join(OUT, "answer_q1_padded.wav");
fs.writeFileSync(path.join(OUT, "q1_voice.json"), JSON.stringify(voice));
await sleep(1500);
await sp.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { const a = new Audio("/__answer.wav"); await a.play(); return a.captureStream(); }; });
mark("q1_read");
await tapEl(sp, ".rec-btn");
mark("q1_recording");
await sleep(voice.seconds * 1000 + 700);
await tapEl(sp, ".rec-btn");
await sp.waitForSelector("button:has-text('Send answer')");
mark("q1_recorded");
await sleep(1200);
let k = await qKey(sp);
await tapEl(sp, "button:has-text('Send answer')");
await sp.waitForSelector(".toast", { timeout: 90000 });
mark("q1_heard");
await waitAnswerSaved(sp, k);
await sleep(3500);

async function answerTyped(kind, delay) {
  const q = await currentQuestion(sp);
  if (await sp.locator('button[role=tab][aria-selected="false"]:has-text("Type")').count()) { await tapEl(sp, 'button[role=tab]:has-text("Type")'); await sleep(400); }
  let text = "It makes the code work properly and handles the cases.";
  if (kind === "good") {
    const fu = await sp.locator(".followup p").count() ? await sp.locator(".followup p").innerText() : q.question;
    text = makeAnswer({ question: fu, snippet: q.snippet, file: q.file, kind: "good", out: path.join(OUT, `ans_${Date.now()}`) }).text;
  }
  if (delay) await typeIn(sp, "#answer", text, delay); else { await sp.fill("#answer", text); }
  await sleep(600);
  const before = await qKey(sp);
  await tapEl(sp, "button:has-text('Send answer')");
  await waitAnswerSaved(sp, before);
  await settled();
}
async function settled() {
  await sp.waitForFunction(() => location.hash.includes("done") || document.querySelector(".viva-bar .h3"), null, { timeout: 60000 });
  await sleep(400);
}
const vivaDone = async () => (await sp.evaluate(() => location.hash)).includes("done");
await settled();
while (!(await vivaDone()) && await sp.locator(".followup").count()) await answerTyped("good", 0);

// Q2: a vague typed answer gets a follow-up, then a real answer
mark("q2");
await answerTyped("vague", 45);
if (await sp.locator(".followup").count()) {
  mark("q2_followup");
  await sleep(4500);
  await answerTyped("good", 14);
  mark("q2_answered");
}
await sleep(1500);
mark("q3_off");
while (!(await vivaDone())) await answerTyped("good", 0);
await sp.waitForSelector("text=Viva complete", { timeout: 60000 });
mark("done");
await sleep(5000);
await tapEl(sp, "a:has-text('See my report')");
await sp.waitForSelector(".skill-rows", { timeout: 30000 });
mark("report");
await sleep(3000);
await smoothScroll(sp, 620, 40, 3000); mark("report_skills"); await sleep(2500);
await smoothScroll(sp, 520, 40, 2600); mark("report_claims"); await sleep(2500);
await smoothScroll(sp, 650, 40, 2800); mark("report_matches"); await sleep(3000);
await sp.evaluate(() => { const h = [...document.querySelectorAll("h2, .h2, .h3")].find((e) => e.textContent.trim() === "Hackathons"); if (h) h.scrollIntoView({ behavior: "smooth", block: "start" }); });
await sleep(1400); mark("report_hack"); await sleep(3000);
await smoothScroll(sp, 900, 50, 3600); mark("report_answers"); await sleep(3000);
await sp.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
await sleep(1500); mark("report_build"); await sleep(3500);

// Apply to Promtal while the recruiter window records
const rrec = await startRec(rp, "recruiter");
mark("rec_start");
await rp.mouse.move(560, 520, { steps: 20 });
await sp.evaluate(() => window.scrollTo(0, 0));
await tapEl(sp, "a.tab:has-text('Internships')");
await sp.waitForSelector(".match", { timeout: 30000 });
mark("internships");
await sleep(2500);
const promtal = sp.locator(".match", { hasText: "HR-Tech Backend Intern" });
await tapEl(sp, promtal.locator("button:has-text('Apply')"));
await sp.waitForSelector("dialog[open]");
mark("apply_dialog");
await sleep(2200);
await tapEl(sp, "#dlg-consent");
await sleep(900);
await tapEl(sp, "dialog button:has-text('Apply')");
await sp.waitForSelector("text=Applied to Promtal", { timeout: 30000 });
mark("applied");
await sleep(3000);
await srec.stop();

await rp.waitForSelector("text=New applicant", { timeout: 30000 });
mark("arrival");
await sleep(3500);
const kavya = rp.locator("a.cand", { hasText: "Kavya (sample)" });
await tapEl(rp, kavya, { steps: 25, pause: 300 });
await rp.waitForSelector(".split-detail .h1:has-text('Kavya')", { timeout: 30000 });
mark("candidate");
await sleep(3000);
await rp.mouse.move(900, 600, { steps: 15 });
await smoothScroll(rp, 900, 40, 2800); await sleep(2000);
await smoothScroll(rp, 1100, 45, 3200); mark("cand_answers"); await sleep(4000);
await smoothScroll(rp, 1600, 50, 3600); mark("cand_hack"); await sleep(3500);
await rp.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
await sleep(1500);
await tapEl(rp, "button:has-text('Download CSV')", { steps: 25, pause: 300 });
await rp.waitForSelector("text=CSV downloaded", { timeout: 20000 });
mark("csv");
await sleep(2500);
await rrec.stop();

saveMarkers();
await browser.close();
console.log("done");
