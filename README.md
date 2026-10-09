# VerifiedBuild API

Backend for VerifiedBuild (Tri-City AI-Thon 2026, Promtal track).

AI lets anyone ship a project, so a repo alone no longer shows skill. VerifiedBuild reads a student's repo and asks them 5 questions about their own code. Their answers become a verified skill profile with evidence, and internships are matched, and applicants ranked, on verified skill.

The request and response shapes are in [API_CONTRACT.md](API_CONTRACT.md). One sample response per endpoint is in [examples/](examples/).

**Status:** step 1. Every endpoint returns its example from `examples/`. Real logic replaces them one endpoint at a time.

## Run locally

```
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env            # macOS/Linux: cp .env.example .env, then fill in ADMIN_KEY
uvicorn app.main:app --reload --env-file .env
```

Then open http://127.0.0.1:8000/api/health, or http://127.0.0.1:8000/docs for every endpoint.

## Deploy

Google Cloud Run, region asia-south1. Keys go in `env.yaml`, which is git-ignored.

```
gcloud run deploy verifiedbuild-api --source . --region asia-south1 --allow-unauthenticated --timeout 300 --memory 1Gi --cpu 1 --min-instances 1 --env-vars-file env.yaml
```

## AI tools and APIs used

- Claude Code: helped write this backend
- Google AI Studio (Build mode): the frontend app
- Gemini API: question generation, answer transcription and scoring, resume parsing
- GitHub REST API: reading the student's repo
- Supabase: Postgres database
- Google Cloud Run: hosting
