# Volunteer vivas and the labelled set (tonight)

These are the numbers the pitch needs, gathered from real students. All they need is a link: https://verifiedbuild-api-215071922486.asia-south1.run.app/app/

## What to say to each volunteer (about 30 seconds)

> "We're testing VerifiedBuild. You pick one of your public GitHub repos and answer 5 questions about your own code, out loud or typed, in any language. It takes about 8 minutes. Your report is private to you: nobody sees it unless you press Apply on an internship. We'll only use totals in our pitch, never your name or scores. OK to go ahead?"

Only continue on a clear yes. Don't press Apply for them.

## Steps for each volunteer

1. Open the link on their phone or laptop. Voice needs microphone permission; typing works without it.
2. Sign up with their own GitHub username, then "Pick a repo": a project they built.
3. Read "What we found", then answer the 5 questions.
4. Show them their report. Ask: "Does this match what you'd say about your own skills?" Note anything surprising.

## The labelled set (5 + 5)

The pitch's strongest number is the score gap between people answering about code they built and understand, and code they didn't build.

- **Built (5 vivas):** volunteers answering about a repo they wrote themselves.
- **Not built (5 vivas):** volunteers answering about a repo they own but didn't really build. For example, a project they forked and pushed as their own, a tutorial they copied, or something generated for them that they shipped without reading. It must be under their account, or contain their commits.

Write each repo into `seed/labelled_set.json` (copy `seed/labelled_set.example.json`):

```json
{
  "someone/their-own-project": "built",
  "someone-else/copied-tutorial": "not_built"
}
```

Then run, from the repo root with `.env` filled in:

```
python -m scripts.stats --labels seed/labelled_set.json
```

It prints students verified, vivas finished, the median score, claimed-vs-shown gaps, median viva time, AI cost per viva, analyze and scoring times, and the built vs not-built means with the gap. Put those numbers in `docs/pitch.md` (section 6).

## Rules

- Totals only on stage. No names, no individual scores.
- A volunteer can ask to be removed. Delete their row in the Supabase table `students` (it removes their vivas, answers, hackathons and applications too).
- Never coach an answer during a viva. The labelled set only means something if every answer is the volunteer's own.
