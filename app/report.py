"""The student's report, computed on read from their latest viva (there is no profile table).

    question score = max(first answer, follow-up answer), 0-10
    overall        = round(mean question score x 10)
    skills[tag]    = round(mean score of that tag's questions x 10), only for tags that were asked
    level          = strong >=70, partial 40-69, not_verified <40, not_shown if never asked
"""

from app import db, matching
from app.errors import ApiError
from app.matching import round_half_up

STRONG, PARTIAL = 70, 40
EXCERPT_CHARS = 200


def level(score: int | None) -> str:
    if score is None:
        return "not_shown"
    return "strong" if score >= STRONG else "partial" if score >= PARTIAL else "not_verified"


def excerpt(text: str | None, limit: int = EXCERPT_CHARS) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + "..."


def summary(student_id: str) -> dict:
    """Scores from the latest viva. Used by the report, apply and the shortlist."""
    sessions = db.select("viva_sessions", student_id=student_id, desc=True, limit=1)
    session = sessions[0] if sessions else None
    results = []
    if session:
        answers = db.select("viva_answers", session_id=session["id"])
        for q in session["questions"]:
            first = next((a for a in answers if a["question_id"] == q["id"] and not a["is_follow_up"]), None)
            if not first:
                continue
            follow = next((a for a in answers if a["question_id"] == q["id"] and a["is_follow_up"]), None)
            best = follow if follow and follow["score"] > first["score"] else first
            results.append({"question": q, "first": first, "follow": follow, "best": best, "score": best["score"]})

    by_tag: dict[str, list[int]] = {}
    for r in results:
        by_tag.setdefault(r["question"]["skill"], []).append(r["score"])
    skills = {tag: round_half_up(sum(s) / len(s) * 10) for tag, s in by_tag.items()}
    skills = dict(sorted(skills.items(), key=lambda kv: -kv[1]))
    overall = round_half_up(sum(r["score"] for r in results) / len(results) * 10) if results else 0
    return {
        "session": session,
        "results": results,
        "skills": skills,
        "overall": overall,
        "status": session["status"] if session else "in_progress",
    }


def evidence_row(r: dict) -> dict:
    q, first, follow, best = r["question"], r["first"], r["follow"], r["best"]
    durations = [a["duration_s"] for a in (first, follow) if a and a.get("duration_s") is not None]
    return {
        "question_id": q["id"], "file": q["file"], "lines": q["lines"],
        "question": q["question"],
        "answer_excerpt": excerpt(best["transcript"]),
        "evidence_quote": best.get("evidence_quote") or "",
        "covered": best.get("covered") or [],
        "missed": best.get("missed") or [],
        "score": r["score"], "skill": q["skill"], "mode": first["mode"],
        "pasted": any(a["pasted"] for a in (first, follow) if a),
        "duration_s": sum(durations) if durations else None,
        "had_follow_up": bool(first.get("follow_up")),
    }


def build(student_id: str) -> dict:
    student = db.get("students", student_id)
    if not student:
        raise ApiError("STUDENT_NOT_FOUND", "We couldn't find that student.", 404)
    s = summary(student_id)
    analysis = db.get("repo_analyses", s["session"]["analysis_id"]) if s["session"] else None

    claimed_rows, claimed_tags = [], set()
    for c in student["claimed_skills"]:
        claimed_rows.append({"name": c["name"], "tag": c["tag"], "claimed": True, "level": level(s["skills"].get(c["tag"]))})
        claimed_tags.add(c["tag"])
    unclaimed = [
        {"name": tag, "tag": tag, "claimed": False, "level": level(score)}
        for tag, score in s["skills"].items() if score >= PARTIAL and tag not in claimed_tags
    ]

    listings = db.select("listings", order="position")
    applied = {a["listing_id"] for a in db.select("applications", student_id=student_id)}
    return {
        "student": {
            "student_id": student["id"], "name": student["name"],
            "college": student["college"], "github_username": student["github_username"],
        },
        "repo": {"full_name": analysis["repo_full_name"]} if analysis else None,
        "status": s["status"],
        "overall": s["overall"],
        "skills": s["skills"],
        "claimed_vs_verified": claimed_rows + unclaimed,
        "evidence": [evidence_row(r) for r in s["results"]],
        "build_history": analysis["build_history"] if analysis else None,
        "matches": matching.match_all(s["skills"], student["interests"], listings, applied),
    }
