"use strict";
// Landing page: a sample run beside the headline, and the three steps. Static content only.

(() => {
  const { h, icon } = VB;
  VB.watchScroll(document.getElementById("appbar"));

  // A sample run that plays on a loop. The badges at the end are made-up example scores.
  const STAGES = [
    ["Read the repo", "Skip libraries and generated files"],
    ["Find the skills it shows", "Rank files by how often they're imported"],
    ["Ask 5 questions", "Each about real lines of the code"],
    ["Score the answers", "Against a rubric and the code itself"],
    ["Match internships", "On verified skills, interests and hackathons"],
  ];
  const SAMPLE = { backend: 84, data: 73, devops: 66, ai_ml: 47 };
  const status = h("span", { class: "status run" });
  const host = h("div", {});
  const out = h("div", {});
  const card = h("div", { class: "run-card", "aria-label": "A sample run" },
    h("div", { class: "run-head" }, VB.brandMark(), h("span", { class: "mono" }, "verify your-name/your-repo"), status), host, out);
  let shown = -1;
  const draw = (step) => {
    if (step === shown) return; // hold the finished run without replaying the badges
    shown = step;
    const finished = step >= STAGES.length;
    host.replaceChildren(VB.pipeline(STAGES.map(([label, sub], i) => ({ label, sub, state: i < step ? "pass" : i === step ? "run" : "queued" }))));
    status.className = `status ${finished ? "pass" : "run"}`;
    status.replaceChildren(h("span", { class: "dot" }), finished ? "Finished" : "Running");
    out.replaceChildren(finished ? VB.skillBadges(SAMPLE, { cascade: true, delay: 0, only: (x) => x.score !== undefined }) : "");
  };
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still) draw(STAGES.length);
  else {
    let step = 0;
    draw(0);
    setInterval(() => { step = step > STAGES.length + 2 ? 0 : step + 1; draw(Math.min(step, STAGES.length)); }, 1100);
  }
  document.getElementById("art").append(card, h("p", { class: "caption" }, "A sample run. Yours reads your own repo, and the badges come from your answers."));

  const step = (n, iconName, title, text) => h("div", { class: "card" },
    h("div", { class: "section-head" }, h("span", { class: "steps-num" }, String(n)), icon(iconName)),
    h("h2", { class: "title-l" }, title),
    h("p", { class: "body-m var" }, text));
  document.getElementById("how").append(
    step(1, "code", "Pick a repo", "A project from your own GitHub, or a team repo you committed to. We read the code that matters and skip libraries and generated files."),
    step(2, "mic", "Answer 5 questions", "Each question points at real lines of your code. Speak or type, in English, Hindi, Telugu or a mix. About 8 minutes."),
    step(3, "work", "Get matched", "Your answers become verified skill badges with evidence. Internships rank you on what you showed, and recruiters see it only when you apply."));
})();
