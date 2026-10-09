# Handoff - 2026-10-10 03:55 IST, written by Claude session

## Goal (one line)
Backend for VerifiedBuild: 5-question viva on a student's own repo → verified skill profile → internship match → recruiter shortlist.

## Demo path (the exact clicks a judge will see)
Sign up → pick repo → analyze (~13 s) → answer by voice → report (claimed vs verified, evidence, matches) → apply with consent → recruiter shortlist → CSV. Full script with lines to say: `docs/pitch.md`.

## Works now (verified, with how it was verified)
- Every endpoint in API_CONTRACT.md is real, not mocked. `python -m pytest`: 12 tests pass, including the full flow checked against `examples/*.json` shapes.
- Live run on real repos (Modelpin, Guru-Graph) with real GitHub and Gemini, locally: questions point at real lines; vague answer 1, injection answer 0, Hinglish 10; follow-ups trigger; report, apply, shortlist and CSV are correct.
- Voice: a webm recording was transcribed and scored 9/10, about 6 s per answer over 3 runs. Resume PDF: 10 skills extracted, and a planted instruction in the PDF was ignored.
- File selection ran on all 10 public repos of samarthputhraya without errors.
- Deployed: https://verifiedbuild-api-215071922486.asia-south1.run.app. Health, listings, sign-up and the repo list respond (curl).

## Broken / in progress
- **Live analyze and answer return AI_FAILED.** Cloud Run log: `403 PERMISSION_DENIED ... aiplatform.endpoints.predict`. Fix (SAM runs it once; no redeploy needed):
  `gcloud projects add-iam-policy-binding project-b3549f11-8db5-4ca2-9e4 --member=serviceAccount:215071922486-compute@developer.gserviceaccount.com --role=roles/aiplatform.user`
- **No Supabase yet**, so the deployed app uses the in-memory store and every redeploy wipes its data. Create the project (Mumbai), run `supabase/schema.sql` in the SQL editor, put SUPABASE_URL and SUPABASE_SERVICE_KEY in `.env`, then `powershell -File scripts\deploy.ps1`.
- `scripts/stats.py` is unverified: it needs Supabase data.

## Next 3 steps (concrete, in order)
1. Run the IAM command above, then a full viva on the live URL (sign-up → analyze → 5 answers → report).
2. Set up Supabase as above and redeploy. Send Ayush the URL and the ADMIN_KEY (it's in `.env`).
3. Volunteers and the labelled set (5 built, 5 not built): `python -m scripts.stats --labels seed/labelled_set.json`. Fill the brackets in `docs/pitch.md`. Save the demo repo with `python -m app.demo_cache <session_id>`.

## Decisions made (and why, one line each)
- Gemini runs on Vertex AI as the Cloud Run identity: the Developer API key returned 402 (prepaid credits empty).
- `gemini-3.8-flash` at thinking LOW: questions take ~10 s instead of 25–50 s, with the same scores on test answers.
- Voice is transcribed by `gemini-3.5-flash` and then scored like text: 3.8-flash hung on audio again and again.
- One tarball download plus one GraphQL query per repo, instead of 30+ REST calls.
- Supabase over plain REST with httpx (the supabase package was dropped). Listings upserted from `seed/listings.json` on every start.
- Snippets are cut from the real file by the server, never copied from the model's output.

## Gotchas
- `GITHUB_TOKEN` is currently SAM's `gh auth token`, which has repo scope. Swap it for a fine-grained token with read-only access to public repos. Private repos are refused in code.
- The memory store needs `--max-instances 1`; `deploy.ps1` sets this automatically when SUPABASE_URL is empty.
- Running locally needs `gcloud auth application-default login` once (Vertex), and ffmpeg on PATH for voice.
- The folder is still named `tricity`. Close VS Code, then `Rename-Item "$HOME\OneDrive\Documents\tricity" verifiedbuild-api`.

## How to run
`pip install -r requirements-dev.txt` → `copy .env.example .env` (fill in) → `uvicorn app.main:app --reload --env-file .env` → http://127.0.0.1:8000/docs. Tests: `python -m pytest`. Deploy: `powershell -File scripts\deploy.ps1`.
