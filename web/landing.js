"use strict";
// Landing page: the shapes beside the headline and the three steps. Static content only.

(() => {
  const { h, icon, shape } = VB;
  VB.watchScroll(document.getElementById("appbar"));

  // Four skill stamps, as they appear on a student's report
  const stamp = (kind, size, tint, iconName, cls) => {
    const el = shape(kind, size, tint, icon(iconName, "lg"));
    el.classList.add(cls);
    return el;
  };
  document.getElementById("art").append(
    stamp("cookie9", 168, "primary", "dns", "art-1"),
    stamp("clover", 120, "tertiary", "web", "art-2"),
    stamp("burst", 120, "strong", "neurology", "art-3"),
    stamp("cookie12", 72, "partial", "shield", "art-4"));

  const step = (n, kind, tint, iconName, title, text) => h("div", { class: "card" },
    shape(kind, 56, tint, icon(iconName)),
    h("h2", { class: "title-l" }, `${n}. ${title}`),
    h("p", { class: "body-m var" }, text));
  document.getElementById("how").append(
    step(1, "cookie9", "primary", "code", "Pick a repo", "A project from your own GitHub, or a team repo you committed to. We read the code that matters and skip libraries and generated files."),
    step(2, "clover", "tertiary", "mic", "Answer 5 questions", "Each question points at real lines of your code. Speak or type, in English, Hindi, Telugu or a mix. About 8 minutes."),
    step(3, "burst", "strong", "work", "Get matched", "Your answers become a skill report with evidence. Internships rank you on what you showed, and recruiters see it only when you apply."));
})();
