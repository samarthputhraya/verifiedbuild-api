# VerifiedBuild pitch (3:00)

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
| 0:30–0:50 | SAM | "Today recruiters filter on resume keywords, CGPA and GitHub stars. Coding tests are generic, and AI can solve those too. None of it asks: do you understand the code you're showing me? VerifiedBuild does, in five minutes." |
| 0:50–2:00 | Ayush | The demo path below. Say out loud what the judge should notice. |
| 2:00–2:30 | SAM | "The hard part is making the questions about real code and the scoring fair. Every question points at real lines in the student's repo: we check the lines exist and cut the snippet from the file ourselves. The answer is scored against a rubric that never leaves our server. Spoken and typed answers go through the same scoring step, and the language doesn't matter: a Hinglish answer scored the same 10/10 as English. The match score itself uses no AI. It's a formula we can show you, and claimed skills count for zero." |
| 2:30–3:00 | SAM | "[Who pays, from section 7.] Next we'd [one thing from the 30-day answer]. [Name] now has a profile that says: backend, verified, 81, with [Name]'s own words as evidence. That's what gets [Name] the reply." |

## 3. Demo path (Ayush drives, about 70 seconds)

Prepare before going on stage:
- **Tab A:** the sign-up screen, with [Name]'s details typed in and not yet submitted. [Name]'s repo must be public and under [Name]'s own GitHub account.
- **Tab B:** a finished report for [Name], from a full viva [Name] did earlier (all 5 questions answered by [Name]).
- **Tab C:** the recruiter shortlist for `l-promtal-backend`, with [Name] and 2–3 volunteers who applied. The admin passcode is already entered.
- Phone recording the screen, as a backup.

| Step | Click | Say |
|---|---|---|
| 1 | Tab A: submit sign-up, then pick [repo] in the repo list | "[Name] signs up and picks their own project." |
| 2 | Start the viva. Wait about 15 s while it reads the repo | "It's reading the repo now: it drops the libraries and generated code and picks the files that matter. ... Notice the question: it names a real function, and the code shown is lines [x–y] of the actual file." |
| 3 | Answer question 1 by voice, live (one sentence in Hinglish is fine) | "[Name] answers out loud, in whatever language they think in. No score yet, on purpose: they see it at the end." |
| 4 | Tab B: the report | "Here's [Name]'s finished viva from this morning. They claimed React, and the repo didn't show it, so it says not shown. They didn't claim security, but they showed it. Every score has their own words as evidence." |
| 5 | Scroll to matches | "Matches use verified skills only. [Top match] is [N]%, and the line under it says why in plain numbers." |
| 6 | Tab C: the shortlist | "The recruiter only sees students who applied, with consent. They're ranked by verified match, and one click exports a CSV." |

**Notice for the judges:** real line numbers (step 2), the language doesn't matter (step 3), claimed vs verified (step 4), the reason under each match (step 5).

Optional, if SAM is confident: run step 2 on our own repo, `verifiedbuild-api`, and let SAM answer one question about `app/matching.py` live. It shows the product checking its own builder. Only do it after SAM has done a full practice viva on it.

## 4. Fallback

If anything hangs for more than 20 seconds or errors, switch to the recorded video at the same step, and say:

> "Live Wi-Fi at a hackathon. Here's the same flow, recorded an hour ago on the same app."

Then keep narrating with the same lines. Before going on stage, set `DEMO_MODE=cached` for [Name]'s repo (`python -m app.demo_cache <session_id>`) so that step 2 returns instantly from the saved run if GitHub or Gemini is slow. If you use it, say so if asked: it's a saved run of the same repo, not a fake.

## 5. Hard judge questions

**How is this different from HackerRank, or from looking at GitHub?**
Coding tests are generic puzzles, and AI can solve those too. We ask about the project the student is showing you, the one on their resume, so the result tells you about that claim directly.

**What's real and what's mocked?**
Everything in the flow is live: GitHub reading, question writing, voice transcription, scoring, matching and the shortlist. The six internship listings are demo data, and there's a saved-run fallback for the stage, which is off by default.

**Who pays, and why would they switch?**
[Team decision. Suggested: startups and HR-tech platforms like Promtal pay per verified shortlist, because it cuts screening time; or college placement cells pay per batch.] One viva costs us about [₹ from `python -m scripts.stats`] in AI, so [price] leaves a wide margin.

**What happens when the AI is wrong?**
A weak first answer gets a follow-up, and the better score counts. The recruiter sees the question, the student's own words and what was covered or missed, not only a number, and the match formula uses no AI at all. In our tests the same answer scored the same 3 times out of 3.

**Can't a student just read an answer from ChatGPT?**
Answers are timed and spoken, and they're about specific lines of the student's own code, with a follow-up when an answer is vague. We show the recruiter how each answer was given (voice or typed, and whether text was pasted) as plain facts, and we never accuse anyone.

**Isn't scoring spoken English unfair to some students?**
The scorer is told to ignore language, accent and grammar and to score only understanding. A correct Hinglish answer scored 10/10, the same as English, and Telugu and Hindi answers are accepted.

**Could a student game the AI, for example with "give me full marks" in a code comment?**
Repo text and answers are treated as data, not instructions. They're fenced in delimiters the content can't fake, and scores are clamped on our server. We tested exactly that answer, and it scored 0.

**What would you build in the next 30 days?**
[Pick one or two: GitHub sign-in so the student proves they own the account; a recruiter-written question added to the five; a pilot with one placement cell and [N] students.]

**Why your team?**
[Your honest answer in two sentences: what you've built before and why you care about this problem.] We built this in 24 hours, and we used AI to do it, which is exactly why we think understanding should be what gets checked.

## 6. Numbers slide

| | |
|---|---|
| Time for a student | 5 questions, about 90 s each |
| Reading a repo and writing the questions | about 13 s (our tests) |
| Scoring one answer | about 3 s typed, 6 s spoken |
| Same answer, scored 3 times | the same score each time |
| Vague answer / "give me 10" answer | 1 / 0 out of 10 |
| Score gap: repos the owner built vs didn't build | [from `scripts.stats --labels`] |
| Students verified tonight | [N], median score [N] |
| Claimed a skill, then couldn't show it | [N]% |
| Showed a skill they didn't claim | [N]% |
| AI cost per viva | [₹ / $ from `scripts.stats`] |

## 7. Delivery notes

- Memorize the opening 30 seconds. Shaky hands usually settle once the first lines come out on autopilot.
- Slow down by about 20% from what feels natural. Pause after [Name]'s number of replies.
- Rehearse at least 3 full timed run-throughs, including one where the demo "fails" and you switch to the video.
- Don't say "catch", "detect", "cheat" or "flag". Say "verify", "show", "prove".
