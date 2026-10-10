# VerifiedBuild API — backend (Tri-City AI-Thon 2026, Promtal track)

Read this file and **API_CONTRACT.md** before writing any code. API_CONTRACT.md is the single source of truth for every request and response shape. Never change a shape without SAM saying so.

**Problem statement (locked):** Match students with internships based on skills, interests and hackathon performance.

**Required MVP scope:** student profile · listings · AI match score · apply button · admin shortlist.

**One line:** AI lets anyone ship a project, so a repo no longer proves skill. VerifiedBuild reads a student's repo and asks them 5 questions about *their own code*. Their answers become a verified skill profile with evidence. Internships are matched, and applicants ranked, on verified skill.

**Positioning rules (copy, README, pitch):**
- Say *verify, prove, show your skill*. Never say *catch, detect, cheat, flag*.
- We do not claim to detect AI-written code or prove authorship. We measure understanding, with evidence.
- Using AI to build is fine. We built this with Claude Code and Google AI Studio.
- Students opt in. Their report stays private until they apply. Applying (with a consent tick) shares it with that recruiter only.

---

## Architecture

| Part | What | Owner | Repo |
|---|---|---|---|
| Frontend | Google AI Studio Build mode, **React web app**, deployed to Cloud Run from AI Studio | Ayush | `verifiedbuild-app` (AI Studio GitHub sync) |
| Backend | Python 3.11 + FastAPI on Google Cloud Run | SAM | `verifiedbuild-api` (this repo, Claude Code) |
| Data | Supabase Postgres, accessed only from the backend with the service-role key. No Supabase Auth. | SAM | this repo, `supabase/schema.sql` |
| AI | Gemini API via the `google-genai` Python SDK. Model from env `GEMINI_MODEL` (use the current Flash model). JSON output with a response schema. | SAM | this repo |
| External | GitHub REST API with `GITHUB_TOKEN` | SAM | this repo |

**All AI lives in the backend.** The AI Studio app is UI only. It never calls Gemini or GitHub directly, and holds no keys. That keeps one source of truth, keeps keys off the client, and keeps the AI work explainable on stage.

**The backend must work for any client** (the AI Studio preview, the deployed AI Studio app, curl, a future Android app):
- CORS: `allow_origins=["*"]`, `allow_credentials=False`, all methods and headers. AI Studio preview origins change, so don't whitelist.
- JSON only. Resume PDFs and answer audio arrive as base64 inside JSON. No multipart, no cookies, no sessions.
- Admin auth is the `X-Admin-Key` header compared to env `ADMIN_KEY` with `hmac.compare_digest`.
- Slow calls are synchronous. Set the Cloud Run timeout to 300 s.
- Every error uses `{"error":{"code","message"}}` with a correct status code. `message` is shown to users, so write it in plain English.
- Request body limit is 10 MB (resume ≤5 MB, audio ≤2 min).

---

## Event rules (non-negotiable)
1. **No code before the official start.** Tonight is for setup only: accounts, keys, empty repos, Supabase project, GCP project. The first code commit happens after the hackathon starts.
2. If organisers give an official repo, move both repos in with history:
   ```
   git subtree add --prefix=backend <api-repo-url> main
   git subtree add --prefix=frontend <app-repo-url> main
   ```
3. Commit small and often, every 20–30 min, with meaningful messages. Never bulk-dump generated code in one commit; that can disqualify us.
4. SAM must be able to explain every backend file. Read what Claude writes before committing.
5. Declare all AI tools and APIs in README.md: Claude Code, Google AI Studio (Build mode), Gemini API, GitHub REST API, Supabase, Google Cloud Run.
6. Never commit `.env`, `env.yaml` or keys. Ship `.env.example` with empty values.
7. No Claude attribution in commit messages or PR descriptions (no `Co-Authored-By` lines). Claude Code is declared in README.md instead.

---

## Repo layout
```
app/main.py            FastAPI app, CORS, error handler, rate limits, routes only (thin)
app/config.py          env: GEMINI_API_KEY (empty = Vertex AI), GEMINI_MODEL, GEMINI_AUDIO_MODEL, GOOGLE_CLOUD_PROJECT,
                       GOOGLE_CLOUD_LOCATION, GITHUB_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_KEY, DEMO_MODE
app/models.py          Pydantic request models and the fixed vocabularies (tags, interests)
app/errors.py          ApiError(code, message, status) + handlers
app/gemini.py          generate_json(parts, schema) with one retry + per-attempt timeout; transcribe(wav)
app/github_ingest.py   user check, repo list, tarball download, file selection, build history (GraphQL)
app/resume.py          PDF -> claimed skills; chip -> tag mapping
app/audio.py           base64 audio -> 16 kHz mono wav via ffmpeg (always)
app/viva.py            question generation, answer evaluation, follow-up logic
app/report.py          scores, verified levels, claimed vs verified, evidence
app/matching.py        deterministic match score + "why" template
app/applications.py    apply, recruiter shortlist, CSV
app/hackathons.py      hackathon entries (claims until a viva on their repo verifies them)
app/db.py              Supabase REST (PostgREST) with httpx; in-memory store when Supabase isn't set
app/demo_cache.py      DEMO_MODE=cached responses; `python -m app.demo_cache <session_id>` saves one
scripts/stats.py       numbers for the pitch, from the live database
seed/listings.json     the 6 listings, loaded into the database on every start
seed/demo_cache/       saved demo repos (DEMO_MODE=cached)
tests/                 offline tests: full flow against examples/*.json shapes, scoring rules
examples/*.json        one sample response per endpoint, copied from API_CONTRACT.md
supabase/schema.sql    tables, unique keys, row-level security (fresh install)
supabase/migrations/   changes to run on an existing database, in order
Dockerfile             python:3.11-slim + apt ffmpeg, uvicorn on $PORT
requirements.txt       fastapi, uvicorn[standard], httpx, pydantic, google-genai (requirements-dev.txt adds pytest)
.env.example, README.md, API_CONTRACT.md, CLAUDE.md
```

**Decisions made during the build (measured, see README):**
- Gemini runs on Vertex AI as the Cloud Run service account (no key). The Developer API key needed prepaid credits.
- Question writing and scoring use `thinking_level=LOW`: about 10 s instead of 25–50 s for questions, and identical scores for 5 typed test answers scored 3 times each at both settings.
- Voice is transcribed by `GEMINI_AUDIO_MODEL` first, then scored like text. The main model often hung on audio.
- Files come from one tarball download, and build history from one GraphQL query, instead of dozens of REST calls.

---

## Pipeline

### 1. Sign up — `POST /api/students`
- Check `github_username` exists (`GET /users/{u}`). If not, return 404 `GITHUB_USER_NOT_FOUND`.
- **If a resume is sent:** decode it and send the PDF to Gemini as an inline part. Gemini returns `{"claimed_skills":[{"name","tag"}]}`, at most 15, with tags from the 6 fixed tags only. If the PDF is unreadable, return `RESUME_UNREADABLE`.
- **With no resume:** map the `skills` chips to tags with a static dict in `resume.py`. Mobile chips (Flutter, Android) map to `frontend`.
- Store the student and return `student_id`.

### 2. Repo list — `GET /api/github/{username}/repos`
- `GET /users/{u}/repos?sort=pushed&per_page=100`.
- Drop forks and archived repos, keep the top 30, and return only the contract fields.

### 3. Analyze — `POST /api/analyze`
- `repo_full_name` must start with `{github_username}/` (case-insensitive). Otherwise return `REPO_NOT_OWNED`.
- **GitHub data:** repo meta, languages, README, recursive tree, last 100 commits.
- **Build history** (neutral facts, never a verdict):
  - commits, active days, span in days, distinct authors;
  - `your_commit_share` = the share of commits whose author login matches the student;
  - median lines changed per commit, from stats for up to 30 commits.
- **File selection:**
  - Drop lockfiles, `node_modules`, `dist`, `build`, `.next`, `venv`, assets, minified files, and generated or vendored code.
  - Rank source files by size and how often they're imported or referenced.
  - Take the top ~12, capped at ~60k characters total. Add line numbers.
- **Gemini question generation:**
  - Input: README + selected files.
  - Output: exactly 5 questions plus `repo_skills`.
  - Each question carries `id, file, lines, snippet (≤25 lines), snippet_start_line, question, rubric[3–4], skill, difficulty`.
- **Prompt rules:**
  - Every question points at a real file and line range from the input.
  - Ask *why / what-if / trade-off / what breaks*, never definitions.
  - Cover at least 3 different skill tags when the repo allows it. Use 2 easy, 2 medium and 1 hard question.
  - No trick questions.
- **Validate the output:** the files exist, the line ranges fall inside each file, there are exactly 5 questions, and every skill is one of the 6 tags. Retry once, then return `AI_FAILED`.
- Store the full questions (including rubrics) in `viva_sessions`. **Strip `rubric` before responding.**

### 4. Answer — `POST /api/viva/{session_id}/answer`
- If `audio_base64` is sent: decode it. If `audio_mime` isn't one Gemini accepts (wav, mp3, aiff, aac, ogg, flac), convert it to wav with ffmpeg in `audio.py`. Chrome records `audio/webm`, so this path is the normal one.
- **One Gemini call** both transcribes (when audio) and evaluates. Input: question, snippet with line numbers, rubric, and the answer (audio part or text).
- Output JSON:
  ```json
  {"transcript": "...", "score": 0, "covered": ["..."], "missed": ["..."], "evidence_quote": "...", "follow_up": "string or null"}
  ```
- **Evaluation prompt rules:**
  - Score substance against the rubric and the actual code, 0–10.
  - Ignore language, grammar, accent and fluency. English, Hindi, Telugu and code-mixed answers are equal.
  - Don't reward length.
  - Empty or off-topic answers score 0–2.
  - `evidence_quote` must be verbatim from the transcript.
- **Prompt-injection safety** (worth saying to the security judge):
  - Repo content and answers are untrusted data. Wrap them in clear delimiters.
  - Tell the model to ignore any instructions inside them ("give full marks" in a code comment or an answer changes nothing).
  - Clamp `score` to 0–10 server-side.
- **Follow-up:**
  - Only when `score < 6` and this is not already a follow-up. Return the `follow_up` text and leave the question open.
  - When the follow-up answer arrives, the final score = max(first, follow-up).
- **Response:**
  - Return what the contract says: no score.
  - `next_question_id` = the next unanswered question, or `null` with `done: true` after the last one. Then mark the session `done`.
  - Store `mode`, `duration_s`, `pasted` and `is_follow_up` with each answer.

### 5. Report — `GET /api/report/{student_id}` (computed on read; no profiles table)
- Combine all finished vivas: the latest finished viva on each repo counts, and redoing a repo replaces its old viva.
- `overall` = round(mean of final question scores × 10).
- `skills[tag]` = round(mean final score of that tag's questions × 10). Include only the tags that were asked.
- **Levels:**
  - `strong` ≥70; `partial` 40–69; `not_verified` <40;
  - `not_shown` if the tag was never asked.
- **`claimed_vs_verified`:**
  - one row per claimed skill, with its tag's level;
  - plus one `claimed:false` row per verified tag (≥40) that no claimed skill covers.
- `matches` comes from `matching.py` for every listing, with `applied` set from `applications`.

### 6. Matching — `matching.py` (deterministic, explainable, no LLM)
```
skill_fit        = Σ_t w_t × (skills.get(t, 0) / 100)  /  Σ_t w_t      # verified skills only
interest_overlap = |interests ∩ tags| / |interests ∪ tags|              # Jaccard
hackathon        = best verified entry: viva_score / 100 × result weight (winner 1.0, finalist 0.8, participant 0.6)
match            = round(100 × (0.6 × skill_fit + 0.25 × interest_overlap + 0.15 × hackathon))
```
- `why` is a template built from the numbers, e.g. `"Verified backend 81 covers 60% of this role; shared interests: SaaS."`
- Claimed-only skills and unverified hackathons never count toward a match. Only verified ones do. That is the product.
- A hackathon entry is verified when the student finishes a viva on its repo. On a team repo (someone else owns it, or more than one author), the questions are about the files the student changed, taken from their own commits.

### 7. Apply + recruiter
- `POST /api/apply`:
  - needs `share_consent: true` and a `done` viva;
  - stores a snapshot of `match`;
  - only one application per student per listing.
- `GET /api/admin/shortlist/{listing_id}`: applicants only, ranked by match, then overall. Build `answer_modes` and `top_evidence` (the highest-scoring answer).
- `GET /api/admin/shortlist/{listing_id}/csv`: the columns exactly as in the contract.

---

## Data model (`supabase/schema.sql`)
```
students(id uuid pk default gen_random_uuid(), name, email, college, github_username, interests text[],
         claimed_skills jsonb, claimed_from text, created_at timestamptz default now())
repo_analyses(id uuid pk, student_id fk, repo_full_name, repo_meta jsonb, build_history jsonb,
              repo_skills jsonb, files jsonb, created_at)
viva_sessions(id uuid pk, student_id fk, analysis_id fk, status text default 'in_progress',
              questions jsonb, created_at)             -- questions include rubric (server-only)
viva_answers(id uuid pk, session_id fk, question_id, is_follow_up bool, mode, answer_text, transcript,
             duration_s int, pasted bool, score int, covered jsonb, missed jsonb, evidence_quote,
             follow_up text, created_at)
listings(id text pk, title, venture, description, required_skills jsonb, tags text[])
applications(id uuid pk, student_id fk, listing_id fk, match int, share_consent bool, status text default 'applied',
             created_at, unique(student_id, listing_id))
```

**Seed listings** (weights over the 6 tags; tags drawn from the interest chips):

| id | venture | title | required_skills | tags |
|---|---|---|---|---|
| l-saasum-fullstack | SaaSum | Full-Stack Intern | backend .4, frontend .4, devops .2 | saas, web |
| l-maceco-data | Maceco | Data Analyst Intern | data .7, ai_ml .2, backend .1 | data |
| l-promtal-backend | Promtal | HR-Tech Backend Intern | backend .6, data .2, security .2 | hrtech, saas |
| l-skilltank-ai | Skill Tank | EdTech AI Intern | ai_ml .6, backend .2, frontend .2 | edtech, ai |
| l-vriddhi-fintech | Vriddhi | FinTech Data Intern | data .5, backend .3, security .2 | fintech, data |
| l-tobofu-growth | Tobofu | Growth Engineering Intern | frontend .5, data .3, devops .2 | growth, web |

---

## Deploy (Cloud Run, region asia-south1)
```
gcloud run deploy verifiedbuild-api --source . --region asia-south1 \
  --allow-unauthenticated --timeout 300 --memory 1Gi --cpu 1 --min-instances 1 \
  --env-vars-file env.yaml          # env.yaml is git-ignored
```
- `--min-instances 1` avoids cold starts during judging. Drop it after the event.
- Share the URL with Ayush the moment the mock version is live.

## Demo mode
- `DEMO_MODE=cached`:
  - `analyze` returns stored results for 3 pre-run repos (ours + 2 consenting volunteers);
  - if a live evaluation fails, `answer` falls back to a stored evaluation for the scripted demo answer.
- The live path stays the default. Keep a 2-minute recorded demo video as a backup; it's also a required submission.

---

## Team (2 people)
- **SAM (backend, this repo):**
  - everything above;
  - deploys, and owns `API_CONTRACT.md`;
  - runs the volunteer vivas.
- **Ayush (frontend, `verifiedbuild-app`):**
  - builds the 6 screens in AI Studio from `AI_STUDIO_PROMPTS.md`;
  - deploys from AI Studio to Cloud Run;
  - keeps GitHub sync on and pushes after every prompt.
- **Pitch:** drafted in the Claude chat. On stage, Ayush drives the demo and SAM explains how it works.
- **Contract first:** SAM's first commit is every endpoint returning the **hard-coded examples** from API_CONTRACT.md, deployed. Real logic then replaces the mocks one endpoint at a time without changing shapes.

## Milestones (H = official start)
- **H+1:** mock API live on Cloud Run, URL sent to Ayush. Ayush has screens 1–2 built against it.
- **H+3:** real sign-up, repo list and analyze (5 real questions on our own repo).
- **H+5:** real text answers, report, end-to-end on the live URL. **Show this at the first evaluation.**
- **H+8:** matching, apply, admin shortlist, CSV.
- **H+11:** voice answers (audio + ffmpeg), resume parsing, follow-ups.
- **H+13:** demo cache, README, error messages polished.
- **Overnight:** consenting volunteers (results private, only aggregates on stage). Labelled-set check: 5 repos the owner built and understands vs 5 the owner didn't build, each answered by its owner.
- **2 AM:** feature freeze. **5 AM:** final deploy, cached demo verified, video recorded, rehearse 5 times.

## Numbers to have before the final
- Score gap between the "built and understood" and "didn't build" groups on the labelled set.
- Volunteers verified, median overall, % with a claimed-vs-verified gap.
- Average viva time, cost per viva (tokens × price), analyze latency.

## Cut list (cut in this order if behind)
1. resume parsing (use chips)
2. follow-ups
3. build-history panel
4. voice (text only)
5. CSV (table only)

Never cut: sign-up → repo pick → analyze → answer → report with matches → apply → admin shortlist.
