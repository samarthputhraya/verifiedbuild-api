"""Tests run offline: in-memory store, and fakes for GitHub and Gemini."""

import os
import sys
from pathlib import Path

os.environ.update({"SUPABASE_URL": "", "SUPABASE_SERVICE_KEY": "", "ADMIN_KEY": "test-admin", "DEMO_MODE": "", "GITHUB_TOKEN": ""})
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

from app import gemini, github_ingest, viva  # noqa: E402

CODE = "\n".join(f"line {i} of the settle function" for i in range(1, 81))
FILES = {"server/settle.ts": CODE, "src/App.tsx": CODE, "api/auth.py": CODE}


def fake_generate_json(parts, schema, *, system, validate=None, **options):
    usage = {"model": "fake", "calls": 1, "tokens_in": 100, "tokens_out": 50, "latency_ms": 5}
    if schema is viva.QUESTIONS_SCHEMA:
        data = {
            "repo_skills": [{"tag": "backend", "evidence": "Settlement logic in server/settle.ts"},
                            {"tag": "frontend", "evidence": "React state in src/App.tsx"}],
            "questions": [
                {"file": f, "start_line": 40, "end_line": 62, "skill": s, "difficulty": d,
                 "question": f"Why does {f} work this way?", "rubric": ["point one", "point two", "point three"]}
                for f, s, d in [("server/settle.ts", "backend", "hard"), ("src/App.tsx", "frontend", "easy"),
                                ("api/auth.py", "security", "medium"), ("server/settle.ts", "backend", "easy"),
                                ("src/App.tsx", "frontend", "medium")]
            ],
        }
    else:  # answer evaluation: "good" answers score 8, anything else 3 (which earns a follow-up)
        text = parts[0]
        score = 8 if "good" in text.rsplit("<<<ANSWER>>>", 1)[-1] else 3
        data = {"transcript": "ignored for typed answers", "covered": ["point one"], "missed": ["point three"],
                "score": score, "evidence_quote": "good", "follow_up": "What about point three?"}
    return (validate(data) if validate else data), usage


@pytest.fixture(autouse=True)
def fakes(monkeypatch):
    monkeypatch.setattr(gemini, "generate_json", fake_generate_json)
    monkeypatch.setattr(github_ingest, "get_user", lambda u: {"login": u} if u != "nobody" else None)
    monkeypatch.setattr(github_ingest, "list_repos", lambda u: [
        {"full_name": f"{u}/expense-split", "description": "Split bills with friends", "language": "TypeScript",
         "stars": 3, "pushed_at": "2026-09-28T10:12:00Z"}])
    monkeypatch.setattr(github_ingest, "get_repo", lambda n: {"full_name": n, "default_branch": "main", "description": None})
    monkeypatch.setattr(github_ingest, "download_files", lambda n, ref: dict(FILES, **{"README.md": "# Expense split"}))
    monkeypatch.setattr(github_ingest, "get_languages", lambda n: {"TypeScript": 81.2, "CSS": 18.8})
    monkeypatch.setattr(github_ingest, "build_history", lambda n, login: {
        "commits": 46, "active_days": 19, "span_days": 33, "authors": 1, "your_commit_share": 1.0, "median_lines_per_commit": 38})
