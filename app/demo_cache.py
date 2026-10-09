"""DEMO_MODE=cached: a safety net for the live demo. The live path stays the default.

- analyze: a repo saved in seed/demo_cache/ skips GitHub and Gemini and reuses its saved questions.
- answer: if a live evaluation fails on a saved repo, we use the saved evaluation of the scripted answer.

Save a repo after a good live run (needs Supabase in .env, since that's where the run is stored):
    python -m app.demo_cache <session_id>
"""

import json
import sys
from pathlib import Path

from app import db
from app.config import settings

CACHE_DIR = Path(__file__).resolve().parent.parent / "seed" / "demo_cache"


def enabled() -> bool:
    return settings.demo_mode == "cached"


def _path(full_name: str) -> Path:
    return CACHE_DIR / (full_name.strip().lower().replace("/", "__") + ".json")


def _load(full_name: str) -> dict | None:
    path = _path(full_name)
    return json.loads(path.read_text(encoding="utf-8")) if full_name and path.exists() else None


def analysis(full_name: str) -> dict | None:
    saved = _load(full_name)
    return saved["analysis"] if saved else None


def evaluation(full_name: str, question_id: str, is_follow_up: bool) -> dict | None:
    if not enabled():
        return None
    saved = _load(full_name)
    return (saved or {}).get("evaluations", {}).get(f"{question_id}:{'follow' if is_follow_up else 'first'}")


def save(session_id: str) -> Path:
    session = db.get("viva_sessions", session_id)
    if not session:
        raise SystemExit(f"No viva session {session_id}")
    row = db.get("repo_analyses", session["analysis_id"])
    keys = ("repo_full_name", "repo_meta", "build_history", "repo_skills", "files", "ai_usage")
    evaluations = {
        f"{a['question_id']}:{'follow' if a['is_follow_up'] else 'first'}": {
            k: a[k] for k in ("transcript", "score", "covered", "missed", "evidence_quote", "follow_up")
        }
        for a in db.select("viva_answers", session_id=session_id)
    }
    payload = {"analysis": {**{k: row[k] for k in keys}, "questions": session["questions"]}, "evaluations": evaluations}
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = _path(row["repo_full_name"])
    path.write_text(json.dumps(payload, indent=1, ensure_ascii=False), encoding="utf-8")
    return path


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: python -m app.demo_cache <session_id>")
    print("Saved", save(sys.argv[1]))
