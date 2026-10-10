# Handoff - 2026-10-11 03:45 IST, written by Claude session

## Goal (one line)
VerifiedBuild: 5-question viva on a student's own repo → verified skill profile → internship match → recruiter shortlist.

## Demo path (the exact clicks a judge will see)
Phone 1: sign up → pick repo → analyze (~15 s) → answer question 1 by voice. Phone 2: a finished report (claimed vs verified, evidence, verified hackathon, matches) → apply with consent. Laptop: the Promtal shortlist on `/recruiter/`, where the student appears within 5 s. Script and lines: `docs/pitch.md`.

## Works now (verified, with how it was verified)
- Live on Cloud Run, revision 00014 (Supabase + Vertex AI). `/api/health` returns `v1.1`. Earlier looks, if ever needed: 00011 (Material 3), 00013 (build run).
- **Web rebuilt as a plain product UI on React-style components (11 Oct, 03:40):** Preact + htm as ES modules (no build step), Inter, one blue, borders not shadows, skeleton/empty/error states, light and dark. SAM asked for a professional, Fortune-500-style product look and nothing decorative, after rejecting the Material 3, seal and build-run designs.
  - Verified locally with real GitHub and Gemini: 4-step sign-up with the live GitHub check, home, repo list, analyzing checklist, what we found, the viva with a typed answer, a follow-up, 9 answers to done, the report, apply with the consent box, a spoken answer through the real recorder (bars moved, transcript came back), the recruiter listings, shortlist with the detail pane, candidate page, phone and desktop widths with no sideways scroll, dark mode. Zero console errors throughout.
- **Earlier Material 3 version (18:00), the same flows:**
  - Verified locally in a browser: the full student flow (4-step sign-up, live GitHub check, the letter PDF gives the right message, analyze, typed answers, follow-up, a spoken answer through the real recorder, done, report, apply with consent).
  - Also checked locally: phone and desktop layouts, dark mode, and recruiter list-detail with a second applicant arriving live.
  - Live: every page, font, icon and the manifest return 200, the GitHub avatar loads under the CSP, and there are no console errors.
  - Pages: `/` (landing), `/app/` (student web app), `/recruiter/` (dashboard, needs ADMIN_KEY), `/docs`.
  - All return 200 (curl), and API 404s are JSON.
- `python -m pytest`: 22 pass. They cover the full flow, hackathons, team repos, multi-viva reports, voice, errors, web pages, cache headers and hedged Gemini calls.
- **Prod, through the student web app (16:14 IST):**
  - Sign-up → kavach analyzed (6 files, 4 skills found) → 5 typed answers.
  - A vague answer got a follow-up. A Hinglish answer scored 10/10.
  - The report, matches (EdTech AI 60%, Promtal 45%) and build history were all correct. No console errors.
  - Then, by script against prod (`X-Admin-Key` read from `.env`): apply without consent → refused; with consent → 201.
  - The student appeared on the Promtal shortlist and in the CSV, and a wrong admin key got 401.
- **Prod, full spoken viva by script (16:46 IST, revision 00009):** analyze took 14.0 s, then 10 voice answers (5 questions plus 5 follow-ups).
  - Median 5.2 s per answer, slowest 9.4 s. The report finished, and the test data was deleted afterwards.
- **Prod, Android:** the Kotlin harness (`clients/android/harness`) passed against v1.1.
- **Local, student web app:**
  - Full flow including a spoken answer: MediaRecorder with a fake mic fed TTS audio, transcribed correctly.
  - Also checked: a pasted-text fact, resume after reload, apply with the consent gate.
  - The student then appeared on the recruiter shortlist.
- **Local, recruiter dashboard:**
  - Sign-in and wrong passcode, listings, live arrival highlight, candidate report with code beside each answer.
  - CSV with `verified_hackathons`, mobile and dark mode.
- SAM's own runs on prod in the new design (18:06): resume sign-up, analyze, 10 answers including voice, done; both reports read back with 200 at 23:45.
- Supabase holds no test data: SAM's 2 test profiles were deleted at 23:50, and every table is at 0 rows except the 6 listings (row counts checked).
- Not yet clicked through on prod in the new design: apply on a phone → the student appears on `/recruiter/`. Verified locally, and the API part on prod at 16:14.

## Broken / in progress
- Nothing known broken.
- Gemini's speed varies. On prod we saw analyze take 12 s and 30 s for the same repo, and one scoring took 19 s locally. Hence the 40 s / 25 s fallback rule in `docs/pitch.md`.
- Unverified: `scripts/stats.py` numbers on real volunteers. Only 2 test vivas so far, at a median of $0.039 per viva, priced with third-party token rates.
- Android app (Ayush, `trulyayush/KITSW`): still at the 12:39 push at 23:45, so the 23:00 cut-off passed and it is out of the demo.
  - It never calls our API. It calls Gemini (key built into the app) and GitHub itself.
  - Without Gemini it falls back to template questions and a score from answer length, with fixed praise text.
  - Its sample data includes a recruiter named "Google Cloud", and one commit added 10,843 lines.
  - The web app is the product.

## Next 3 steps (concrete, in order)
1. Pick the persona and fill every `[bracket]` in `docs/pitch.md` with real facts.
   - Give the persona a finished viva plus a verified hackathon.
   - Run `python -m app.demo_cache <session_id>` for their repo.
   - Record the backup video.
2. Volunteers tonight, following `docs/volunteers.md` (5 built + 5 not built).
   - Put their repos in `seed/labelled_set.json`, then run `python -m scripts.stats --labels seed/labelled_set.json`.
   - Copy the numbers into pitch section 6.
3. 2–3 volunteers apply to Promtal so the dashboard isn't empty. Then 3 timed rehearsals, including one fallback to the video.

## Decisions made (and why, one line each)
- Gemini on Vertex as the Cloud Run identity: the Developer API key returned 402 (no prepaid credits).
- `gemini-3.8-flash` at thinking LOW for questions and scoring. `gemini-3.5-flash` transcribes voice, because 3.8-flash hung on audio.
- Web pages are plain HTML/JS with no build step, served by the API: one deploy, same origin, CSP `'self'`.
- The student web app exists so judges can try it from a QR code (`docs/qr-student-app.svg`), and as a fallback if the Android build isn't ready.
- Hackathons count only after a viva on their repo. On team repos, questions cover the files the student changed.
- Match = 60% verified skills + 25% interests + 15% best verified hackathon. No AI in the formula.
- Design (11 Oct, 03:40): a plain, professional product UI, like a Fortune-500 product page, with no theme or decoration (SAM's call after three themed designs). React-style components on Preact + htm with no build step, so one deploy ships API and pages and nothing can break at 4 AM.
- Web files are sent with `Cache-Control: no-cache`, so phones never mix old and new JS after a deploy.
- Slow Gemini calls are hedged: the same request is sent again after 6 s (transcription), 8 s (scoring) or 25 s (questions), and the first answer wins.
- Pitch claims use today's measurements: each of 6 test answers was scored 5 times and never moved by more than 1 point.
  - Typed Hinglish, romanised Hindi and Telugu-English answers scored 9–10. Spoken non-English answers are untested.

## Gotchas
- `ADMIN_KEY` is in `.env`. Share it with Ayush privately, never in the repo or chat logs.
- `GITHUB_TOKEN` is SAM's `gh` token, which has repo scope. Swap it for a fine-grained public-read token. Private repos are refused in code anyway.
- `scripts/deploy.ps1` deploys the last commit, not uncommitted edits.
- Running locally needs `gcloud auth application-default login` (Vertex) and ffmpeg on PATH.
- Supabase `sb_secret_` keys go in the `apikey` header only.
- The folder is still named `tricity`. Close VS Code, then `Rename-Item "$HOME\OneDrive\Documents\tricity" verifiedbuild-api`.

## How to run
`pip install -r requirements-dev.txt` → `copy .env.example .env` (fill it in) → `uvicorn app.main:app --reload --env-file .env` → http://127.0.0.1:8000/app/. Tests: `python -m pytest`. Deploy: `powershell -File scripts\deploy.ps1`.
