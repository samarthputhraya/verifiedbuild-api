# Handoff - 2026-10-11 07:20 IST, written by Claude session

## Goal (one line)
Proofolio (Tri-City AI-Thon 2026, Promtal track): a 5-question viva on a student's own repo → verified skill profile → internship match → recruiter shortlist.

## Demo path (the exact clicks a judge will see)
Phone 1 (installed web app `/app/`): sign up → pick repo → analyze (~15 s) → answer question 1 by voice. Phone 2: a finished report → apply to Promtal with the consent tick. Laptop: `/recruiter/` Promtal shortlist, where the student lands within 5 s. Show Ayush's Android app for a few seconds only (never tap Admin, Recruiter, Explore demo or Skip). Lines: `docs/pitch.md`.

## Works now (verified, with how it was verified)
- Live: https://verifiedbuild-api-215071922486.asia-south1.run.app, Cloud Run revision 00018, `/api/health` → v1.1. Live files matched the repo byte for byte after the 07:00 deploy. `python -m pytest`: 22 pass.
- Web (student app, recruiter dashboard, landing) rebuilt 03:40 as a plain product UI on Preact + htm (no build step). Full flow incl. voice, follow-up, apply, live shortlist arrival and CSV verified locally with real GitHub/Gemini, and recorded from the live site at 06:45 for the video.
- Renamed VerifiedBuild → Proofolio (05:40) in all UI, docs, API title, schema and contract. Service name and URL stay `verifiedbuild-api`.
- Android app (`trulyayush/KITSW`, Ayush): uses only our API since his 00:22 commit; its API layer is identical to `clients/android/`, which passed 79/79 live checks (04:45). His PR #1 (recruiter link, "We heard" note) merged 05:27.
- Live database (06:50): 6 listings and 4 labelled samples (Riya, Arjun, Meera, Kavya, each "(sample)", college "Sample profile…"), all applied to Promtal. No other data. Pitch and README say they're samples with AI-written answers.
- Demo video: `C:\Users\samar\OneDrive\Documents\Proofolio-demo.mp4`, 2:33, 1080p30, -16 LUFS, narration/soundtrack checked by transcription. Source in `video/`; assets to re-render in `C:\Users\samar\OneDrive\Documents\proofolio-work\` (see its README).

## Broken / in progress
- Android footage missing from the video (no SDK here). Needs a 10–15 s screen recording from Ayush; then add `android.mp4` + `"android": true` and re-render (proofolio-work README).
- Ayush must repeat PR #1's two edits in AI Studio, or his next push may drop them (unverified how AI Studio sync handles remote commits).
- Ayush's 04:43 commit added a demo mode with invented sample people and Skip buttons that never reach the server (skip leaves the viva unfinished). SAM chose to keep them; don't use them on camera.
- Not checked: whether Ayush's Compose screens compile (no Gradle wrapper, no SDK).
- `docs/pitch.md` has 24 `[bracket]` blanks (persona, numbers, who pays, 30-day plan, why us). Voice pronunciation of "Proofolio" in the video is unconfirmed by ear.

## Next 3 steps (concrete, in order)
1. Write the PPT from `docs/pitch.md` and the measured numbers (README "What we measured"). Don't quote `scripts.stats` as volunteers: it counts the 4 samples.
2. If Ayush sends the Android clip, add the scene and re-render the video.
3. Merge both repos into the organiser's repo with history (`git subtree add --prefix=backend <api-repo> main`, `--prefix=frontend https://github.com/trulyayush/KITSW main`) and submit; both repos are private now, make public only if required.

## Decisions made (and why, one line each)
- No new features after 05:00 (SAM): only bugs, data, video, PPT, submission.
- Design: plain professional UI; SAM rejected every themed concept (memory file `ui-taste-professional`).
- Samples instead of strangers' repos: the API only verifies a student's own repos, and fake profiles in real people's names were refused.
- Match = 60% verified skills + 25% interests + 15% best verified hackathon; no AI in the formula.
- Gemini on Vertex (3.8-flash for questions/scoring at thinking LOW, 3.5-flash for transcription); hedged retries after 6/8/25 s.

## Gotchas
- `ADMIN_KEY` lives in `.env`; scripts read it from there. Never print it or put it in a tool call; the local server uses "local-test".
- `GITHUB_TOKEN` is SAM's classic `gh` token with repo scope; swap for a fine-grained public-read token.
- `scripts/deploy.ps1` deploys the last commit. Tests need pytest (not in the global Python 3.12).
- Bugs fixed today: retry after a failed repo read, recruiter live tag, landing top bar on phones, Stop hanging when the mic stream ends early.

## How to run
`pip install -r requirements-dev.txt` → `copy .env.example .env` (fill it) → `gcloud auth application-default login` → `uvicorn app.main:app --reload --env-file .env` → http://127.0.0.1:8000/app/. Tests: `python -m pytest`. Deploy: `powershell -File scripts\deploy.ps1`.
