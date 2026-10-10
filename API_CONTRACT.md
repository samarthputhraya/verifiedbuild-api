# VerifiedBuild API contract (v1.1)

**v1.1 (2026-10-10), additive: no v1 field was removed or renamed.**
- Hackathon entries: new endpoints in 8b. A viva on a hackathon's repo verifies it.
- Analyze accepts repos the student has commits in, such as a teammate's hackathon repo, and returns `contribution`.
- The report combines all finished vivas and adds `hackathons`, `viva_in_progress`, and `repo_full_name` / `snippet` / `snippet_start_line` on each evidence item.
- Match score: 60% skills, 25% interests, 15% verified hackathon (was 70/30).
- The shortlist adds `hackathons`, and the CSV adds a `verified_hackathons` column.

Single source of truth for both sides. The backend (SAM, FastAPI) implements it; the AI Studio app (Ayush) calls it. **Change a shape only after you both agree, and bump the version line above.**

- **Base URL:** `API_BASE` = the Cloud Run URL SAM shares (e.g. `https://verifiedbuild-api-xxxx.a.run.app`).
- **Format:** JSON in, JSON out. Files (resume PDF, answer audio) are sent as base64 strings inside JSON. No multipart, no cookies.
- **CORS:** every origin allowed, no credentials.
- **Admin:** endpoints under `/api/admin/*` need the header `X-Admin-Key: <passcode>`.
- **Errors:** non-2xx status with
  ```json
  {"error": {"code": "GITHUB_USER_NOT_FOUND", "message": "We couldn't find that GitHub username."}}
  ```
  The frontend shows `message` as-is.
- **Slow call:** `POST /api/analyze` takes 20–60 s. Answer evaluation takes 3–10 s. Show a loader for both.

## Fixed vocabularies

**Skill tags (always one of these 6):** `backend`, `frontend`, `data`, `ai_ml`, `devops`, `security`

**Skill chips** (used when the student has no resume):
- Python, JavaScript, TypeScript, Java, C++
- React, Next.js, HTML/CSS, Flutter, Android
- Node.js, FastAPI, Django, Flask, Spring
- SQL, MongoDB, Pandas
- Machine Learning, Deep Learning, LLMs/GenAI
- Docker, Cloud (AWS/GCP/Azure), CI/CD
- Security

**Interest chips:** `ai`, `data`, `web`, `mobile`, `saas`, `fintech`, `edtech`, `hrtech`, `security`, `devtools`, `growth`, `healthcare`

**Hackathon results:** `winner`, `finalist`, `participant`

**Verified levels:**
- `strong`: ≥70
- `partial`: 40–69
- `not_verified`: asked about but scored below 40
- `not_shown`: the repo had no question on that skill

---

## Student flow

### 1. `POST /api/students` — sign up
Request:
```json
{
  "name": "Asha Rao",
  "email": "asha@example.com",
  "college": "KITS Warangal",
  "github_username": "asharao",
  "interests": ["saas", "data"],
  "skills": ["React", "Python"],
  "resume_base64": "JVBERi0xLjQK...",
  "resume_mime": "application/pdf"
}
```
- `skills` is optional and only used when there's no resume.
- `resume_base64` and `resume_mime` are optional. Max 5 MB, PDF only.

Response `201`:
```json
{
  "student_id": "6f1c2a9e-0b7e-4c1a-9d1e-2f9b0c7a1d11",
  "github_username": "asharao",
  "claimed_skills": [
    {"name": "React", "tag": "frontend"},
    {"name": "FastAPI", "tag": "backend"},
    {"name": "Machine Learning", "tag": "ai_ml"}
  ],
  "claimed_from": "resume"
}
```
- `claimed_from` is `resume` or `chips`.
- Errors: `GITHUB_USER_NOT_FOUND` (404), `RESUME_UNREADABLE` (422), `VALIDATION` (422).

### 2. `GET /api/github/{username}/repos` — repo picker
Public, non-fork, non-archived repos, newest push first, max 30.
```json
{
  "repos": [
    {"full_name": "asharao/expense-split", "description": "Split bills with friends", "language": "TypeScript", "stars": 3, "pushed_at": "2026-09-28T10:12:00Z"},
    {"full_name": "asharao/loan-risk-ml", "description": null, "language": "Python", "stars": 0, "pushed_at": "2026-08-02T17:40:00Z"}
  ]
}
```

### 3. `POST /api/analyze` — read the repo and create the viva
Request:
```json
{"student_id": "6f1c2a9e-...", "repo_full_name": "asharao/expense-split"}
```
Response `201` (about 10–20 s):
```json
{
  "session_id": "b2d7...",
  "repo": {
    "full_name": "asharao/expense-split",
    "languages": {
      "TypeScript": 81.2,
      "CSS": 18.8
    },
    "files_read": 12
  },
  "repo_skills": [
    {
      "tag": "backend",
      "evidence": "Express routes and settlement logic in server/routes.ts"
    },
    {
      "tag": "frontend",
      "evidence": "React state and forms in src/App.tsx"
    }
  ],
  "contribution": {
    "team_repo": true,
    "your_commits": 28,
    "focus_files": [
      "server/settle.ts",
      "server/routes.ts",
      "src/App.tsx"
    ]
  },
  "questions": [
    {
      "id": "q1",
      "file": "server/settle.ts",
      "lines": "40-62",
      "snippet": "export function settle(balances: Balance[]) {\n  ...\n}",
      "snippet_start_line": 40,
      "question": "Why do you sort debtors and creditors before matching them here, and what breaks if you don't?",
      "skill": "backend",
      "difficulty": "medium"
    }
  ],
  "time_limit_s": 90
}
```
- `questions` always has exactly 5 items. The grading rubric is **never** sent to the client.
- The repo must be public, and either owned by the student or contain commits by them (for example a teammate's hackathon repo).
- `contribution.team_repo` is `true` when someone else owns the repo or more than one person committed. Questions then focus on `focus_files`, the selected files the student changed.
- Errors: `REPO_NOT_OWNED` (400, the student neither owns the repo nor has commits in it), `REPO_NOT_FOUND` (404), `REPO_EMPTY` (422), `NO_SOURCE_FILES` (422), `GITHUB_RATE_LIMIT` (503), `AI_FAILED` (502).

### 4. `GET /api/viva/{session_id}` — resume a viva after a refresh
```json
{
  "session_id": "b2d7...",
  "student_id": "6f1c2a9e-...",
  "status": "in_progress",
  "questions": ["...same items as in analyze..."],
  "answered": ["q1", "q2"],
  "current_question_id": "q3",
  "pending_follow_up": null
}
```
- `status` is `in_progress` or `done`.
- `pending_follow_up` is either `null` or `{"question_id": "q2", "follow_up": "..."}`.

### 5. `POST /api/viva/{session_id}/answer` — submit one answer
Request (send either `answer_text` or the audio fields):
```json
{
  "question_id": "q1",
  "is_follow_up": false,
  "mode": "voice",
  "answer_text": null,
  "audio_base64": "GkXfo59ChoEBQveBAULygQRC...",
  "audio_mime": "audio/webm",
  "duration_s": 74,
  "pasted": false
}
```
- `mode` is `voice` or `text`.
- `pasted`: the frontend sets this to `true` if a paste event happened in the answer box. It is shown to recruiters as a plain fact and does not change the score.
- Audio may be webm, ogg, wav, mp3 or m4a, max 2 minutes. Answers in English, Hindi, Telugu or a mix are all accepted.

Response `200`:
```json
{
  "question_id": "q1",
  "transcript": "Sorting lets me greedily match the biggest debtor with the biggest creditor...",
  "recorded": true,
  "follow_up": "What happens to the number of transactions if two people owe exactly the same amount?",
  "next_question_id": null,
  "done": false
}
```
- `follow_up` is non-null at most once per question, and only when the first answer was weak. The client then shows it and posts again with the same `question_id` and `is_follow_up: true`.
- When `follow_up` is null, go to `next_question_id`. On the last question, `done` is `true` and `next_question_id` is `null`.
- Scores are **not** returned during the viva. The student sees them on the report.
- Errors: `ALREADY_ANSWERED` (409), `EMPTY_ANSWER` (422), `AUDIO_UNREADABLE` (422), `AI_FAILED` (502, the client may retry once).

### 6. `GET /api/report/{student_id}` — the student's report and matches
```json
{
  "student": {
    "student_id": "6f1c...",
    "name": "Asha Rao",
    "college": "KITS Warangal",
    "github_username": "asharao"
  },
  "repo": {
    "full_name": "asharao/expense-split"
  },
  "status": "done",
  "overall": 72,
  "skills": {
    "backend": 81,
    "frontend": 60,
    "data": 55
  },
  "claimed_vs_verified": [
    {
      "name": "React",
      "tag": "frontend",
      "claimed": true,
      "level": "partial"
    },
    {
      "name": "FastAPI",
      "tag": "backend",
      "claimed": true,
      "level": "strong"
    },
    {
      "name": "Machine Learning",
      "tag": "ai_ml",
      "claimed": true,
      "level": "not_shown"
    },
    {
      "name": "data",
      "tag": "data",
      "claimed": false,
      "level": "partial"
    }
  ],
  "evidence": [
    {
      "question_id": "q1",
      "repo_full_name": "asharao/expense-split",
      "file": "server/settle.ts",
      "lines": "40-62",
      "snippet": "export function settle(balances: Balance[]) {\n  ...\n}",
      "snippet_start_line": 40,
      "question": "Why do you sort debtors...",
      "answer_excerpt": "Sorting lets me greedily match...",
      "evidence_quote": "greedily match the biggest debtor with the biggest creditor",
      "covered": [
        "greedy matching",
        "fewer transactions"
      ],
      "missed": [
        "ties between equal balances"
      ],
      "score": 8,
      "skill": "backend",
      "mode": "voice",
      "pasted": false,
      "duration_s": 74,
      "had_follow_up": false
    }
  ],
  "build_history": {
    "commits": 46,
    "active_days": 19,
    "span_days": 33,
    "authors": 3,
    "your_commit_share": 0.61,
    "median_lines_per_commit": 38
  },
  "hackathons": [
    {
      "hackathon_id": "h7c2...",
      "event": "HackX",
      "year": 2026,
      "result": "finalist",
      "team_size": 3,
      "repo_full_name": "asharao/expense-split",
      "verified": true,
      "viva_score": 72,
      "your_commit_share": 0.61
    }
  ],
  "viva_in_progress": null,
  "matches": [
    {
      "listing_id": "l-promtal-backend",
      "title": "HR-Tech Backend Intern",
      "venture": "Promtal",
      "match": 53,
      "why": "Verified backend 81 covers 60% of this role; shared interests: saas; verified hackathon: Finalist at HackX 2026 (viva 72).",
      "applied": false
    }
  ]
}
```
- `status` is `in_progress` or `done`. If it's `in_progress`, show "Finish your viva" instead of the scores.
- `claimed: false` rows are skills verified from the repo that the student didn't claim.
- The report combines every finished viva: the latest finished viva on each repo counts, and redoing a repo replaces its old viva. `repo` and `build_history` come from the most recent finished viva, and each evidence item names its `repo_full_name`.
- `snippet` and `snippet_start_line` on each evidence item are the code the question was about, so the answer can be shown next to the code.
- `viva_in_progress` is `null`, or `{"session_id", "repo_full_name", "answered", "total"}` for an unfinished viva, so the app can offer "Continue".
- `hackathons`: a hackathon entry is `verified` once the student finishes a viva on its repo. `viva_score` is that viva's overall score and `your_commit_share` comes from its build history; both are `null` until verified.
- Match score: `round(100 × (0.6 × skill_fit + 0.25 × interest_overlap + 0.15 × hackathon))`, where `hackathon` is the best verified entry's `viva_score / 100 × result weight` (winner 1.0, finalist 0.8, participant 0.6). Unverified entries count 0.
- `matches` covers all listings, sorted by `match` descending.

### 7. `GET /api/listings`
```json
{
  "listings": [
    {
      "id": "l-promtal-backend", "title": "HR-Tech Backend Intern", "venture": "Promtal",
      "description": "Build APIs for candidate matching.",
      "required_skills": {"backend": 0.6, "data": 0.2, "security": 0.2},
      "tags": ["hrtech", "saas"]
    }
  ]
}
```

### 8. `POST /api/apply`
Request:
```json
{"student_id": "6f1c...", "listing_id": "l-promtal-backend", "share_consent": true}
```
Response `201`:
```json
{"application_id": "a91f...", "status": "applied", "match": 53}
```
- Errors: `CONSENT_REQUIRED` (400), `VIVA_NOT_DONE` (409), `ALREADY_APPLIED` (409).

### 8b. Hackathon entries (v1.1)
`POST /api/students/{student_id}/hackathons`: add one. The repo must be public and owned by the student or contain their commits.
```json
{"event": "HackX", "year": 2026, "result": "finalist", "team_size": 3, "repo_full_name": "asharao/expense-split"}
```
Response `201`: the entry as it appears in the report.
```json
{
  "hackathon_id": "h7c2...",
  "event": "HackX",
  "year": 2026,
  "result": "finalist",
  "team_size": 3,
  "repo_full_name": "asharao/expense-split",
  "verified": true,
  "viva_score": 72,
  "your_commit_share": 0.61
}
```
To verify an entry, start a viva on its repo with `POST /api/analyze` using `repo_full_name`.

`DELETE /api/students/{student_id}/hackathons/{hackathon_id}`: remove one. Returns `{"ok": true}`.
- Errors: `REPO_NOT_OWNED` (400), `REPO_NOT_FOUND` (404), `HACKATHON_NOT_FOUND` (404), `STUDENT_NOT_FOUND` (404), `VALIDATION` (422).

---

## Recruiter flow (header `X-Admin-Key` required)

### 9. `GET /api/admin/verify`
Returns `{"ok": true}`, or `401 {"error":{"code":"BAD_ADMIN_KEY",...}}`.

### 10. `GET /api/admin/shortlist/{listing_id}`
Only students who applied to this listing, ranked by `match` (ties broken by `overall`).
```json
{
  "listing": {
    "id": "l-promtal-backend",
    "title": "HR-Tech Backend Intern",
    "venture": "Promtal"
  },
  "candidates": [
    {
      "rank": 1,
      "student_id": "6f1c...",
      "name": "Asha Rao",
      "college": "KITS Warangal",
      "github_username": "asharao",
      "repo_full_name": "asharao/expense-split",
      "match": 53,
      "overall": 72,
      "skills": {
        "backend": 81,
        "frontend": 60,
        "data": 55
      },
      "answer_modes": {
        "voice": 4,
        "text": 1,
        "pasted": 0
      },
      "top_evidence": {
        "question": "Why do you sort debtors...",
        "answer_excerpt": "Sorting lets me greedily...",
        "score": 8
      },
      "hackathons": [
        {
          "event": "HackX",
          "year": 2026,
          "result": "finalist",
          "viva_score": 72
        }
      ],
      "applied_at": "2026-10-10T13:05:00Z"
    }
  ]
}
```
The full evidence for one candidate comes from `GET /api/report/{student_id}`, which works with or without the admin key.

### 11. `GET /api/admin/shortlist/{listing_id}/csv`
Returns `text/csv` with these columns: rank, name, college, github_username, repo, match, overall, backend, frontend, data, ai_ml, devops, security, voice_answers, text_answers, pasted_answers, applied_at, verified_hackathons.

`verified_hackathons` reads like `Finalist HackX 2026 (viva 72)`, with entries separated by `; `.

The download needs the header, so the frontend fetches it with `X-Admin-Key`, turns the response into a Blob and downloads it.

---

## Utility
- `GET /api/health` returns `{"ok": true, "demo_mode": false, "version": "v1.1"}`.

---

## Notes from the live API

- **Timing measured on real repos:** `POST /api/analyze` about 10–20 s; answer scoring about 3 s typed and 6 s spoken.
- **Fields that can be `null`:** `build_history` (when GitHub has no history for the repo), `report.repo` (no viva started yet), `top_evidence` (no answers yet), `duration_s` (if the client didn't send it), `viva_in_progress`, and a hackathon's `viva_score` and `your_commit_share` (until verified).
- **Report before a viva:** `status` is `in_progress`, `overall` is 0, and `skills` and `evidence` are empty. `matches` is still filled in, from interests only.
- **`audio_mime`** is accepted but not needed: every recording is converted to wav on the server.
- **More error codes.** Show `message` as-is; the codes are for logic only.

| Code | Status | When |
|---|---|---|
| `STUDENT_NOT_FOUND` | 404 | unknown `student_id` |
| `SESSION_NOT_FOUND` | 404 | unknown `session_id` |
| `QUESTION_NOT_FOUND` | 404 | `question_id` isn't in this viva |
| `LISTING_NOT_FOUND` | 404 | unknown `listing_id` |
| `REPO_NOT_FOUND` | 404 | repo doesn't exist or isn't public |
| `NO_FOLLOW_UP` | 409 | `is_follow_up: true` but no follow-up is waiting |
| `HACKATHON_NOT_FOUND` | 404 | the hackathon isn't on this student's profile |
| `GITHUB_ERROR` | 502 | GitHub didn't answer; retry |
| `TOO_LARGE` | 413 | request body over 10 MB |
| `TOO_MANY_REQUESTS` | 429 | too many tries from one network in an hour |
| `NOT_FOUND` / `METHOD_NOT_ALLOWED` | 404 / 405 | wrong path or method |
| `DB_UNAVAILABLE` / `DB_ERROR` / `INTERNAL` | 503 / 500 / 500 | our side; retry |
