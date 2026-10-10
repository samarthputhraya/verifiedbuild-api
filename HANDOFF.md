# Handoff - 2026-10-10 06:30 IST, written by Claude session

## Goal (one line)
Backend for VerifiedBuild: 5-question viva on a student's own repo → verified skill profile → internship match → recruiter shortlist.

## Demo path (the exact clicks a judge will see)
Sign up → pick repo → analyze (~13 s) → answer by voice → report (claimed vs verified, evidence, matches) → apply with consent → recruiter shortlist → CSV. Full script with lines to say: `docs/pitch.md`.

## Works now (verified, with how it was verified)
- Every endpoint in API_CONTRACT.md is real, not mocked. `python -m pytest`: 12 tests pass, including the full flow checked against `examples/*.json` shapes.
- Live run on real repos (Modelpin, Guru-Graph) with real GitHub and Gemini, locally: questions point at real lines; vague answer 1, injection answer 0, Hinglish 10; follow-ups trigger; report, apply, shortlist and CSV are correct.
- Voice: a webm recording was transcribed and scored 9/10, about 6 s per answer over 3 runs. Resume PDF: 10 skills extracted, and a planted instruction in the PDF was ignored.
- File selection ran on all 10 public repos of samarthputhraya without errors.
- **Live, end to end (06:30):** https://verifiedbuild-api-215071922486.asia-south1.run.app with Supabase and Vertex AI. One scripted run covered sign-up → analyze (13.8 s, 5 questions on samarthputhraya/kavach) → 5 answers (a weak one got a follow-up, one was spoken) → report → apply (consent and duplicate checks) → shortlist → CSV. Every call passed, CORS headers included. Typed answers took 3–4 s, the spoken one 6.7 s. The test data was deleted afterwards; listings stay.

## Broken / in progress
- Nothing known to be broken.
- `scripts/stats.py` is unverified: it needs real vivas in Supabase.

## Next 3 steps (concrete, in order)
1. Ayush points the app at the live URL and ADMIN_KEY (in `.env`) and clicks through all 6 screens. Fix anything that doesn't match `API_CONTRACT.md`.
2. Volunteers and the labelled set (5 built, 5 not built) → `python -m scripts.stats --labels seed/labelled_set.json` → fill the brackets in `docs/pitch.md`.
3. Do the persona's full viva on the demo repo, then `python -m app.demo_cache <session_id>`, commit the file, and redeploy with `DEMO_MODE=cached` before going on stage.

## Decisions made (and why, one line each)
- Gemini runs on Vertex AI as the Cloud Run identity: the Developer API key returned 402 (prepaid credits empty).
- `gemini-3.8-flash` at thinking LOW: questions take ~10 s instead of 25–50 s, with the same scores on test answers.
- Voice is transcribed by `gemini-3.5-flash` and then scored like text: 3.8-flash hung on audio again and again.
- One tarball download plus one GraphQL query per repo, instead of 30+ REST calls.
- Supabase over plain REST with httpx (the supabase package was dropped). Listings upserted from `seed/listings.json` on every start.
- Snippets are cut from the real file by the server, never copied from the model's output.

## Gotchas
- `GITHUB_TOKEN` is currently SAM's `gh auth token`, which has repo scope. Swap it for a fine-grained token with read-only access to public repos. Private repos are refused in code.
- Supabase uses a new `sb_secret_` key, sent in the `apikey` header only (it is rejected as a Bearer token).
- Running locally needs `gcloud auth application-default login` once (Vertex), and ffmpeg on PATH for voice.
- The folder is still named `tricity`. Close VS Code, then `Rename-Item "$HOME\OneDrive\Documents\tricity" verifiedbuild-api`.

## How to run
`pip install -r requirements-dev.txt` → `copy .env.example .env` (fill in) → `uvicorn app.main:app --reload --env-file .env` → http://127.0.0.1:8000/docs. Tests: `python -m pytest`. Deploy: `powershell -File scripts\deploy.ps1`.
