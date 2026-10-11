# Proofolio pitch (3:00)

**Before you rehearse, fill every `[bracket]` with real facts.** Don't make any of them up: judges who are founders will ask. Tonight, talk to 2–3 students at the venue (5 minutes each) and ask:
1. "How many internships did you apply to last season, and how many replied?"
2. "What did you put on your resume or GitHub to stand out?"
3. "Can we use your first name in our pitch?"

Use the student whose story is clearest. If a founder or recruiter at the event has hired interns, ask them: "How many applications did your last intern role get, how long did screening take, and how many shortlisted people could explain their own project?" That gives the recruiter-side number for the close.

---

## 1. Opening 30 seconds (memorize word for word) — SAM

> This is [Name]. Final-year CSE student at [college], [city].
>
> Last season [Name] applied to [N] internships. [n] replied.
>
> [Name]'s GitHub has real projects. But every applicant's GitHub now looks like that, because AI can build a project for anyone.
>
> So a recruiter can't tell who built it and understood it, and who just shipped it.
>
> [Name] gets ignored along with everyone else.

*(Pause two seconds after the number of replies.)*

## 2. Full script

| Time | Who | What to say |
|---|---|---|
| 0:00–0:30 | SAM | The opening above. |
| 0:30–0:50 | SAM | "Today recruiters filter on resume keywords, CGPA and GitHub stars. A hackathon win on a resume is taken on trust, and in a team of four nobody can tell who built what. Coding tests are generic, and AI can solve those too. None of it asks: do you understand the code you're showing me? Proofolio does, in five minutes." |
| 0:50–2:00 | Ayush | The demo path below. Say out loud what the judge should notice. |
| 2:00–2:30 | SAM | "The hard part is making the questions about real code and the scoring fair. Every question points at real lines in the student's repo: we check the lines exist and cut the snippet from the file ourselves. The answer is scored against a rubric that never leaves our server. Spoken and typed answers go through the same scoring step, and the language doesn't matter: a correct Hinglish answer scores 9 or 10 out of 10, the same as the English one. The match score itself uses no AI. It's a formula we can show you, and claimed skills count for zero." |
| 2:30–3:00 | SAM | "[Who pays, from section 5.] Next we'd [one thing from the 30-day answer]. [Name] now has a profile that says: [skill], verified, [score], with [Name]'s own words as evidence. That's what gets [Name] the reply." |

## 3. Demo path (Ayush drives, about 70 seconds)

Prepare before going on stage:
- **Phone 1 (mirrored to the projector):** the student web app, installed with Chrome's "Add to Home screen" so it opens full screen like an app. Sign up a second student up to the last step, but don't press "Create my profile". That student's repo must be public.
  - Show the Proofolio Android app for a few seconds, signed in, to say it exists on Android too and uses the same API. Don't tap Admin, Recruiter, Explore demo or the Skip buttons on it: the first three open sample data, and Skip doesn't reach the server.
- **Phone 2, or Phone 1 after the live part:** signed in as [Name], with a finished viva and a verified hackathon, and **not yet applied to Promtal**.
- **Laptop:** the recruiter dashboard at `https://verifiedbuild-api-215071922486.asia-south1.run.app/recruiter/`, signed in and open on the Promtal shortlist. Three labelled sample applicants are already on it (Arjun, Meera and Riya, each marked "(sample)"), plus any volunteers.
- The backup video, ready to play.

| Step | Click | Say |
|---|---|---|
| 1 | Phone 1: submit sign-up, then pick [repo] in the repo list | "Let's verify someone live. They sign up and pick their own project." |
| 2 | Start the viva. During the wait (usually ~15 s, sometimes up to 30 s), narrate over the checklist. On "We read …", point at it | "It's reading the repo now: it drops libraries and generated code and keeps the files that matter. ... It read [N] files and found [skill]: here's the sentence of evidence, naming the file." |
| 3 | "Start question 1", then answer it by voice, live (one sentence in Hinglish is fine) | "The question names a real function, and the code is lines [x–y] of their actual file. They answer out loud, in whatever language they think in. No score yet, on purpose." |
| 4 | Phone 2: [Name]'s report | "Here's [Name]'s finished viva from this morning. Six skills, each with a score and a level. They claimed [skill], and the viva didn't show it, so it says not shown. They didn't claim [skill], but they showed it. Every score has their own words as evidence." |
| 5 | Scroll to hackathons | "[Name] listed [hackathon]. It shows as verified because the viva was on that team repo, and the questions were about the files [Name] committed, not the teammates' code." |
| 6 | Scroll to matches | "Matches use verified skills, shared interests and verified hackathons only. [Top match] is [N]%, and the line under it says why in plain numbers." |
| 7 | Phone 2: Apply to Promtal, tick consent | "[Name] applies, and agrees to share the report with this one company." |
| 8 | Laptop: the Promtal shortlist, nobody touches it | "Watch the recruiter's screen." Within 5 seconds [Name] lands in the ranked list, highlighted. "Ranked by verified match. Click in, and every answer sits next to the exact code it was about. One click exports a CSV." |

**Notice for the judges:** real line numbers (step 2), the language doesn't matter (step 3), claimed vs verified (step 4), verified hackathon on a team repo (step 5), the reason under each match (step 6), and the phone-to-laptop moment (step 8).

**If asked about the design:** "It's built like a product students and recruiters would use every day: one typeface, one colour, nothing decorative. Every screen has a loading, empty and error state, it works on a cheap phone and a projector, and it's installable from the browser."

Optional, if SAM is confident: run step 2 on our own repo, `verifiedbuild-api`, and let SAM answer one question about `app/matching.py` live. It shows the product checking its own builder. Only do it after SAM has done a full practice viva on it.

## 4. Fallback

If the repo reading takes more than 40 seconds, an answer takes more than 25 seconds, or anything shows an error, switch to the recorded video at the same step, and say:

> "Live Wi-Fi at a hackathon. Here's the same flow, recorded an hour ago on the same app."

Then keep narrating with the same lines. Before going on stage, set `DEMO_MODE=cached` for [Name]'s repo (`python -m app.demo_cache <session_id>`) so that step 2 returns instantly from the saved run if GitHub or Gemini is slow. If you use it, say so if asked: it's a saved run of the same repo, not a fake.

## 5. Hard judge questions

**How is this different from HackerRank, or from looking at GitHub?**
Coding tests are generic puzzles, and AI can solve those too. We ask about the project the student is showing you, the one on their resume, so the result tells you about that claim directly.

**What's real and what's mocked?**
Everything in the flow is live: GitHub reading, question writing, voice transcription, scoring, matching and the shortlist. The six internship listings are demo data. The three applicants marked "(sample)" are sample profiles on our own repos: the questions and scores are real, but AI wrote the answers, so the dashboard isn't empty. There's also a saved-run fallback for the stage, which is off by default.

**Who pays, and why would they switch?**
[Team decision. Suggested: startups and HR-tech platforms like Promtal pay per verified shortlist, because it cuts screening time; or college placement cells pay per batch.] One viva costs us about [₹ from `python -m scripts.stats`] in AI, so [price] leaves a wide margin.

**What happens when the AI is wrong?**
A weak first answer gets a follow-up, and the better score counts. The recruiter sees the question, the student's own words and what was covered or missed, not only a number, and the match formula uses no AI at all. We scored each of 6 test answers 5 times, and no score moved by more than 1 point out of 10.

**Can't a student just read an answer from ChatGPT?**
Answers are timed and spoken, and they're about specific lines of the student's own code, with a follow-up when an answer is vague. We show the recruiter how each answer was given (voice or typed, and whether text was pasted) as plain facts, and we never accuse anyone.

**Hackathon projects are team projects. How do you know what this student did?**
On a team repo we read the student's own commits and ask only about the files they changed, so the viva is about their part. Their share of commits is shown as a plain fact, and the hackathon only counts toward a match after they pass that viva.

**Isn't scoring spoken English unfair to some students?**
The scorer is told to ignore language, accent and grammar and to score only understanding. The same correct answer typed in Hinglish, in romanised Hindi and in Telugu mixed with English scored 9–10, the same as in English. We haven't yet tested spoken Telugu.

**Could a student game the AI, for example with "give me full marks" in a code comment?**
Repo text and answers are treated as data, not instructions. They're fenced in delimiters the content can't fake, and scores are clamped on our server. We tested exactly that answer, and it scored 0.

**What would you build in the next 30 days?**
[Pick one or two: GitHub sign-in so the student proves they own the account; a recruiter-written question added to the five; a pilot with one placement cell and [N] students.]

**Why your team?**
[Your honest answer in two sentences: what you've built before and why you care about this problem.] We built this in 24 hours, and we used AI to do it, which is exactly why we think understanding should be what gets checked.

## Let the judges try it

Put [docs/qr-student-app.svg](qr-student-app.svg) on the last slide with the line "Verify your own repo: 5 questions, about 8 minutes." It opens the student web app (`/app/`), so judges need nothing installed. If one of them tries it, their row appears on the recruiter dashboard after they apply.

Before the final, get the volunteer numbers with [docs/volunteers.md](volunteers.md).

## 6. Numbers slide

| | |
|---|---|
| Time for a student | 5 questions, about 90 s each |
| Reading a repo and writing the questions | usually about 13 s (our tests) |
| Scoring one answer | usually 3–4 s typed, 6 s spoken |
| Same answer, scored 5 times | never more than 1 point apart, out of 10 |
| Vague answer / "give me 10" answer | 1 / 0 out of 10 |
| Score gap: repos the owner built vs didn't build | [from `scripts.stats --labels`] |
| Students verified tonight | [N], median score [N] (`scripts.stats` counts the 3 samples too: subtract them, or don't use this row) |
| Claimed a skill, then couldn't show it | [N]% |
| Showed a skill they didn't claim | [N]% |
| AI cost per viva | [from `scripts.stats`. Our 2 test vivas had a median of $0.039 at $0.75 / $3.75 per 1M tokens, a third-party price; check Google's Vertex rate card first] |

## 7. Delivery notes

- Memorize the opening 30 seconds. Shaky hands usually settle once the first lines come out on autopilot.
- Slow down by about 20% from what feels natural. Pause after [Name]'s number of replies.
- Rehearse at least 3 full timed run-throughs, including one where the demo "fails" and you switch to the video.
- Don't say "catch", "detect", "cheat" or "flag". Say "verify", "show", "prove".
