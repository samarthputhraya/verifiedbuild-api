"""The student's report, computed on read from their finished vivas (there is no profile table).

    question score = max(first answer, follow-up answer), 0-10
    a student's questions = every question of their latest finished viva on each repo
    overall        = round(mean question score x 10)
    skills[tag]    = round(mean score of that tag's questions x 10), only for tags that were asked
    level          = strong >=70, partial 40-69, not_verified <40, not_shown if never asked
    hackathon      = verified when the student has a finished viva on its repo
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


def _results(session: dict, repo_full_name: str) -> list[dict]:
    """One row per answered question of one viva, with its final score."""
    answers = db.select("viva_answers", session_id=session["id"])
    rows = []
    for q in session["questions"]:
        first = next((a for a in answers if a["question_id"] == q["id"] and not a["is_follow_up"]), None)
        if not first:
            continue
        follow = next((a for a in answers if a["question_id"] == q["id"] and a["is_follow_up"]), None)
        best = follow if follow and follow["score"] > first["score"] else first
        rows.append({"question": q, "first": first, "follow": follow, "best": best, "score": best["score"],
                     "repo_full_name": repo_full_name, "session": session})
    return rows


def _overall(rows: list[dict]) -> int:
    return round_half_up(sum(r["score"] for r in rows) / len(rows) * 10) if rows else 0


def summary(student_id: str) -> dict:
    """Scores from the student's vivas. Used by the report, apply and the shortlist."""
    from app.viva import closed_questions  # viva imports nothing from here, so this is safe

    sessions = db.select("viva_sessions", student_id=student_id, desc=True)
    analyses: dict[str, dict] = {}

    def analysis_of(s: dict) -> dict:
        if s["analysis_id"] not in analyses:
            analyses[s["analysis_id"]] = db.get("repo_analyses", s["analysis_id"]) or {}
        return analyses[s["analysis_id"]]

    # Latest finished viva per repo. An older viva on the same repo is replaced, never added twice.
    done, seen = [], set()
    for s in sessions:
        if s["status"] == "done":
            repo = analysis_of(s).get("repo_full_name", "")
            if repo.lower() not in seen:
                seen.add(repo.lower())
                done.append((s, analysis_of(s)))
    latest = sessions[0] if sessions else None
    in_progress = latest if latest and latest["status"] == "in_progress" else None

    if done:
        groups = [(s, a, _results(s, a.get("repo_full_name", ""))) for s, a in done]
    elif in_progress:  # nothing finished yet: show the answers so far
        a = analysis_of(in_progress)
        groups = [(in_progress, a, _results(in_progress, a.get("repo_full_name", "")))]
    else:
        groups = []
    results = [r for _, _, rows in groups for r in rows]

    by_tag: dict[str, list[int]] = {}
    for r in results:
        by_tag.setdefault(r["question"]["skill"], []).append(r["score"])
    skills = {tag: round_half_up(sum(s) / len(s) * 10) for tag, s in by_tag.items()}
    skills = dict(sorted(skills.items(), key=lambda kv: -kv[1]))

    per_repo = {
        a["repo_full_name"].lower(): {
            "overall": _overall(rows),
            "your_commit_share": (a.get("build_history") or {}).get("your_commit_share"),
        }
        for s, a, rows in groups if s["status"] == "done" and a.get("repo_full_name")
    }
    viva_in_progress = None
    if in_progress:
        answers = db.select("viva_answers", session_id=in_progress["id"])
        viva_in_progress = {
            "session_id": in_progress["id"],
            "repo_full_name": analysis_of(in_progress).get("repo_full_name"),
            "answered": len(closed_questions(in_progress["questions"], answers)),
            "total": len(in_progress["questions"]),
        }
    primary = groups[0] if groups else None
    return {
        "session": primary[0] if primary else None,
        "analysis": primary[1] if primary else None,
        "results": results,
        "skills": skills,
        "overall": _overall(results),
        "status": "done" if done else "in_progress",
        "per_repo": per_repo,
        "viva_in_progress": viva_in_progress,
    }


def hackathon_items(student_id: str, per_repo: dict) -> list[dict]:
    items = []
    for h in db.select("hackathons", student_id=student_id):
        v = per_repo.get(h["repo_full_name"].lower())
        items.append({
            "hackathon_id": h["id"], "event": h["event"], "year": h["year"], "result": h["result"],
            "team_size": h["team_size"], "repo_full_name": h["repo_full_name"],
            "verified": v is not None,
            "viva_score": v["overall"] if v else None,
            "your_commit_share": v["your_commit_share"] if v else None,
        })
    return items


def evidence_row(r: dict) -> dict:
    q, first, follow, best = r["question"], r["first"], r["follow"], r["best"]
    durations = [a["duration_s"] for a in (first, follow) if a and a.get("duration_s") is not None]
    return {
        "question_id": q["id"], "repo_full_name": r["repo_full_name"], "file": q["file"], "lines": q["lines"],
        "snippet": q["snippet"], "snippet_start_line": q["snippet_start_line"],
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
    analysis = s["analysis"]

    claimed_rows, claimed_tags = [], set()
    for c in student["claimed_skills"]:
        claimed_rows.append({"name": c["name"], "tag": c["tag"], "claimed": True, "level": level(s["skills"].get(c["tag"]))})
        claimed_tags.add(c["tag"])
    unclaimed = [
        {"name": tag, "tag": tag, "claimed": False, "level": level(score)}
        for tag, score in s["skills"].items() if score >= PARTIAL and tag not in claimed_tags
    ]

    hackathons = hackathon_items(student_id, s["per_repo"])
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
        "build_history": analysis.get("build_history") if analysis else None,
        "hackathons": hackathons,
        "viva_in_progress": s["viva_in_progress"],
        "matches": matching.match_all(s["skills"], student["interests"], listings, applied,
                                      matching.hackathon_signal(hackathons)),
    }
