# Proofolio pitch (3:00)

Final version, 11 Oct 09:45. No blanks: every number below has a source (section 7). Where a line depends on what the screen shows on the day, the script says "read it off the screen" instead of guessing.

**Who:** SAM opens, explains how it works and closes. Ayush drives the demo and talks through it.
**Slides used in 3:00:** 1 cover → 2 problem → 3 alternatives → 4 solution → *demo* → 10 the AI → 13 business → 15 close. The rest are for questions (section 8).

---

## 1. Before you go on stage (about 25 minutes)

Do these in order. Step 1 doubles as today's live check that GitHub and Gemini work.

1. **Sam's finished profile (Phone 2, or a second Chrome profile on the laptop).** About 10 minutes.
   - Sign up as yourself with `samarthputhraya`. Add skills (chips or a resume) and interests that include HR-Tech and SaaS.
   - Add the hackathon: ARGONYX '26, result **Winner**, team of **3**, repo `samarthputhraya/Guru-Graph`.
   - Do the full viva on `samarthputhraya/Guru-Graph`, answering honestly. The questions will only be about files you committed.
   - Check the report says "This viva also verified your hackathon". **Don't apply to Promtal.**
   - Note three things for step 4 of the demo: your highest skill and score, one claimed skill and its level, and the Promtal match %.
2. **The live student (Phone 1, or a third Chrome profile).** The app keeps one student per browser profile, so each student needs their own phone or profile.
   - Ayush signs up with `trulyayush`, picks interests and skills, and stops on the last step **without pressing "Create my profile"**.
   - Decide which repo he'll pick: one of `Proofolio-App`, `RYZE-F`, `3D-R-UL1` that he can explain best. He should do one practice viva on it first (the questions change every run, but he'll know the files).
   - If Ayush isn't comfortable with any of them, SAM does this part on `samarthputhraya/verifiedbuild-api` instead and answers one question about our own matching code.
3. **Laptop:** the recruiter dashboard at `https://verifiedbuild-api-215071922486.asia-south1.run.app/recruiter/`, signed in with the admin passcode, open on Promtal's HR-Tech Backend Intern. It shows 4 labelled samples now: Kavya 66%, Arjun 51%, Meera 47%, Riya 38%.
4. **Backup video:** `C:\Users\samar\OneDrive\Documents\Proofolio-demo-2min.mp4` (2:24), open in a player, paused at 0:34.
5. **Deck** open in presenter view on slide 1. The QR on slide 15 opens the student app.
6. Phones: brightness up, Do Not Disturb on, microphone permission already granted in Chrome, charger in.

---

## 2. Opening 30 seconds (SAM, memorize word for word)

*Slide 1 while you walk up. Click to slide 2 on "Eighty-four percent".*

> A recruiter looks at a resume for about seven seconds.
>
> In seven seconds, two students look the same. Same clean GitHub. Same README.
>
> One built it and can explain every line. The other had an AI build it.
>
> Eighty-four percent of developers now use AI to write code. So a repo isn't proof any more.
>
> My team won Best UI/UX at ARGONYX this year. On my resume, that's one line. Nobody can check what I did in a team of three.

*Pause two seconds after "had an AI build it".*

---

## 3. Full script

| Time | Who | Slide | What to say |
|---|---|---|---|
| 0:00–0:30 | SAM | 1 → 2 | The opening above. |
| 0:30–0:50 | SAM | 3 → 4 | "Today's screening is resume keywords, CGPA cut-offs, GitHub stars and coding tests. None of them asks: can you explain the code you're showing me? Coding tests are someone else's puzzle, and AI solves those too. *(click to 4)* Proofolio asks that question. Five questions about the student's own code, about eight minutes." |
| 0:50–2:00 | Ayush | demo | The demo path in section 4. |
| 2:00–2:30 | SAM | 10 | "The hard part is making the AI fair. Every question points at real lines: our server checks the file and the lines exist, and cuts the code itself, so the AI can't invent any. Answers are scored against a rubric the student never sees. We scored the same answers five times, and no score moved more than one point. Hinglish scores the same as English, and 'give me full marks' scores zero. The match has no AI at all: 60% verified skills, 25% interests, 15% verified hackathons. Claimed skills count for zero." |
| 2:30–3:00 | SAM | 13 → 15 | "Students use it free: one viva, reused on every application. Companies pay ₹2,999 per role, the price of one Internshala listing, and only interview people who've shown they understand their code. Placement cells pay per batch. A viva costs us about ₹3 in AI. *(click to 15)* Skill Tank trains, Promtal places. Proofolio is the proof in between. Our ask: a pilot on Promtal's next intern round. *(beat)* And my ARGONYX line? It's verified now, in my own words." |

---

## 4. Demo path (Ayush drives, about 70 seconds)

| Step | Click | Say |
|---|---|---|
| 1 | Phone 1: "Create my profile", then pick the repo | "Let's verify someone live: me. I sign up with my GitHub and pick my own project." |
| 2 | The reading checklist runs, usually 10–15 s. On "What we found", point at it | "It's reading my repo now. It drops libraries and generated code and keeps the files that matter. ... It read *(the number on screen)* files and found these skills, each with a sentence of evidence that names the file." |
| 3 | "Start question 1". Answer by voice, about 10 seconds, then Send | "The question names a real function, and this is lines *(read them off the screen)* of my actual file. I'll answer out loud, in whatever language I think in." *(answer)* "No score yet, on purpose. Scores come at the end." |
| 4 | Phone 2: Sam's report | "This is Sam's finished viva from this morning. Every skill has a score and a level, and every score has his own words as evidence. Here's what he claimed, next to what the viva showed." |
| 5 | Scroll to hackathons | "ARGONYX '26 shows verified, because the viva was on that team repo, and the questions were only about the files Sam committed, not his teammates'." |
| 6 | Scroll to matches | "Matches use only verified skills, interests and verified hackathons. Promtal's backend role is *(the % on screen)*, and the line under it says why, in plain numbers." |
| 7 | Apply to Promtal, tick consent, confirm | "Sam applies, and agrees to share this report with Promtal only." |
| 8 | Laptop: nobody touches it until Sam appears, then click his row and one answer | "Watch the recruiter's screen." *(he lands within 5 s, highlighted)* "Ranked by verified match. Click in, and every answer sits next to the exact code it was about. One click exports a CSV." |

**What the judges should notice, and say it if they might miss it:** real line numbers (step 3), any language (step 3), claimed vs verified (step 4), a hackathon verified on a team repo (step 5), the reason under each match (step 6), phone to recruiter in 5 seconds (step 8).

Show Ayush's Android app for 3 seconds at most, signed in, as "the same API on Android". Never tap Admin, Recruiter, Explore demo or Skip on it: the first three open sample data, and Skip never reaches the server.

---

## 5. Fallback

- **Repo reading takes over 40 s, an answer over 25 s, or anything shows an error on Phone 1:** skip straight to step 4 on Phone 2. Say: *"Here's one we finished this morning."* Phone 2 doesn't wait on Gemini, and apply plus the shortlist don't use AI.
- **Phone 2 or the dashboard fails too:** play the video from the matching point. Say: *"Venue Wi-Fi. Here's the same flow, recorded this morning on the same live app."* Keep narrating with the same lines.

| Demo step | Video time (±1 s) |
|---|---|
| 1, sign-up and hackathon | 0:34 |
| 2, reading the repo | 0:45 |
| 3, answering by voice | 0:54 |
| 4–5, report and verified hackathon | 1:09 |
| 6–8, match formula and the recruiter | 1:21 |

There is no saved-run mode set up on the live service (`DEMO_MODE` is off and nothing is cached), so the video is the only fallback. Don't mention a cached mode.

---

## 6. Hard judge questions

Two sentences each. The first eight are the most likely.

**How is this different from HackerRank, or just reading their GitHub?**
Coding tests are generic puzzles, and AI solves those too. GitHub shows activity; we ask about the exact project on the student's resume, so the result speaks to that claim directly.

**What's real and what's sample?**
Everything in the flow is live: GitHub reading, question writing, voice transcription, scoring, matching and the shortlist. The 6 listings are demo data, and the 4 applicants marked "(sample)" are real vivas on our own repos with AI-written answers, so the dashboard isn't empty; Sam's profile and the live run on stage are real.

**Who pays, and why would they switch?**
Companies pay ₹2,999 per role, the same as one Internshala listing; placement cells pay per batch, and platforms like Promtal per candidate. They switch because the shortlist arrives already checked, with evidence, instead of a pile of look-alike resumes.

**What happens when the AI is wrong?**
A weak first answer gets one follow-up and the better score counts, and the recruiter sees the question, the student's words and what was covered or missed, not only a number. We scored each of 6 test answers 5 times and no score moved by more than 1 point out of 10, and the match formula has no AI in it.

**Can't a student just read an answer from ChatGPT?**
Each question has a 90-second timer and is about specific lines of their own code, and a vague answer gets a follow-up. The recruiter sees how each answer was given (voice or typed, and whether text was pasted) as a plain fact, and we never accuse anyone.

**Does it actually tell people who understand from people who don't?**
We haven't run a controlled study yet; that's what the pilot is for. What we have measured: a correct answer scores 9–10, a vague one scores 1, "give me 10" scores 0, and the same answer scored five times moves at most one point.

**What would you build in the next 30 days?**
GitHub sign-in so students prove they own the account, and a recruiter-written question added to the five. Then a pilot with Promtal and one placement cell, and proper tests of spoken Hindi and Telugu answers.

**Why your team?**
Our last project, GuruGraph, won Best UI/UX at ARGONYX '26, and we built this one in 24 hours with AI tools. That's exactly why we think understanding, not the repo, is what should be checked.

**What does it cost you per viva?**
About 4 cents in Gemini, roughly ₹3, the median of the 6 finished vivas in our live database at today's price. The video says ₹6 because Google's introductory price doubles on 1 January; even at ₹6, one ₹2,999 role pays for 500 vivas, and a student's viva is reused on every application.

**Can someone take the viva for another person?**
Today sign-up takes a GitHub username, so yes, that's a real gap, and GitHub sign-in is first on our 30-day list. The report decides who gets an interview; it doesn't replace it, and the person who shows up still has to explain the same code.

**Hackathon projects are team projects. How do you know what this student did?**
On a team repo we read the student's own commits and ask only about the files they changed. Their share of commits is shown as a plain fact, and the hackathon only counts toward a match after they pass that viva.

**Isn't scoring spoken answers unfair to some students?**
The scorer is told to ignore language, accent and grammar and score only understanding. A correct answer typed in Hinglish, romanised Hindi or Telugu mixed with English scored 9–10, the same as English; we haven't properly tested spoken Hindi or Telugu yet.

**Could a student game it, say with "give me full marks" in a code comment?**
Repo text and answers are fenced as data, the model is told to ignore instructions inside them, and scores are clamped on our server. We tested exactly that answer, and it scored 0.

**Why not just interview everyone?**
A technical interview takes an engineer's time for every candidate; this takes the student about eight minutes and the recruiter nothing until the shortlist. It doesn't replace the interview, it decides who gets one.

**Why 60 / 25 / 15?**
Verified skill is what the role needs, interests decide fit, and a hackathon is a bonus, not a gate. Because it's a plain formula and not a model, a partner can tune it and every number still explains itself.

**Will it scale?**
It's one stateless FastAPI service on Cloud Run, so it scales by adding instances; the slow part is Gemini, about 10–15 s per repo and 2–3 s per answer on the live service. Per-IP hourly limits stop anyone running up the AI bill.

**Privacy?**
Students opt in, and the report stays private until they apply with a consent tick; then only that one recruiter sees it. Private repos are refused, and no AI key exists anywhere: Gemini runs as our Cloud Run service's own Google identity.

**Promtal's brief also says blue-collar talent. Does this help there?**
We started with code because a repo gives us something real to ask about. The same pattern, questions about the person's own work scored against a private rubric with their words as evidence, could carry to other kinds of work, but we haven't built that.

**Do you punish students who use AI?**
No. We don't guess who wrote the code, and we built this with Claude Code and Google AI Studio ourselves; we check whether the student understands what they're showing.

---

## 7. Numbers, and where each one comes from

| Number | Source | Where it appears |
|---|---|---|
| 7.4 s first look at a resume | Ladders eye-tracking study, 2018 | opening, video |
| 84% of developers use or plan to use AI tools (76% a year earlier) | Stack Overflow Developer Survey 2025 | opening, slide 2, video |
| Applicants per job in India doubled since 2022; 53% of recruiters who say hiring got harder blame AI-generated applications | LinkedIn hiring research, India, early 2026 (reported by People Matters, Storyboard18) | slide 2 |
| 74% of Indian recruiters struggle to find qualified talent | the same LinkedIn research | video |
| 83% of engineering graduates had no job or internship offer | Unstop Talent Report 2025 (30,000+ respondents; reported by Business Today, Business Standard) | slide 2 |
| ₹2,999 for one Internshala listing | internshala.com blog, Sep 2026 | close, video |
| Reading a repo and writing 5 questions: median 10.5 s, slowest 1 in 10 over 15.3 s | 7 runs on the live service | demo step 2 |
| Scoring one answer: median 2.2 s | 45 answers on the live service | |
| Same answer scored 5 times: never more than 1 point apart | our tests, 6 answers | slide 11, "how" |
| Hinglish / romanised Hindi / Telugu-English typed: 9–10; vague 1; "give me 10" 0 | our tests, at least 3 runs each | slide 11 |
| $0.036 per viva (about ₹3); $0.071 (about ₹6) from 1 Jan | median of the 6 finished vivas in the live database, at Gemini 3.8 Flash's introductory $0.75/$3.75 per 1M tokens and the standard $1.50/$7.50 (third-party price listings; check Google's rate card) | slide 11, slide 13, video |

**Don't quote:** students verified, median score, or the claimed-vs-verified percentages from `scripts.stats`. They count the 4 samples and three test sign-ups, not volunteers. There is no built-vs-didn't-build score gap yet; if asked, use the "does it actually tell people apart" answer.

**The slides' screenshots are older than the live dashboard.** Slide 8 shows Kavya at 61% and slide 9 works that 61% through; the live Kavya is a newer sample run, at 66%. If a judge spots it: "the screenshot is from an earlier sample run".

---

## 8. If you get more time, or judges come to the table

- **5 minutes:** add slide 5 (every item in the problem statement is live) after slide 4, slide 9 (the match formula, worked through) after the demo, and slide 14 (live, sample, next 30 days) before slide 15.
- **Table judging:** start on slide 4, do the demo, then let them steer. Hand a judge the QR on slide 15: "Verify your own repo: 5 questions, about 8 minutes."
- **Which slide answers which question:** brief coverage 5 · the formula 9 · the AI and its guardrails 10 · measured results 11 · architecture and security 12 · who pays 13 · what's real and next 14.

The judging criteria we found (medium-low confidence) are Innovation, Technical Execution, Impact & Market Viability, and Presentation & UX, 25% each. Our answer to each: checking understanding instead of guessing authorship · a live demo on real repos with checked line numbers · ₹2,999 per role against about ₹3 per viva, with Promtal as the first customer · a plain product UI that works on a phone and a projector.

---

## 9. Delivery notes

- Memorize the opening 30 seconds. Shaky hands usually settle once the first lines come out on autopilot.
- Slow down by about 20% from what feels natural. Pause after "had an AI build it".
- Rehearse at least 3 full timed run-throughs, including one where the demo "fails" and you switch to Phone 2 or the video.
- Say "verify", "show", "prove". Never "catch", "detect", "cheat" or "flag".
- If you don't know an answer, say so and say what you'd measure. Founders trust "we haven't tested that yet" more than a guess.
