"""Applying to a listing, and the recruiter's shortlist (JSON and CSV).

Applying is the consent step: it shares the student's report with that one recruiter.
The shortlist only ever shows students who applied to that listing.
"""

import csv
import io
from datetime import datetime, timezone

from app import db, matching, report
from app.errors import ApiError
from app.models import TAGS


def _listing(listing_id: str) -> dict:
    listing = db.get("listings", listing_id)
    if not listing:
        raise ApiError("LISTING_NOT_FOUND", "We couldn't find that internship.", 404)
    return listing


def _iso_z(value: str) -> str:
    return datetime.fromisoformat(value).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def apply(student_id: str, listing_id: str, share_consent: bool) -> dict:
    if not share_consent:
        raise ApiError("CONSENT_REQUIRED", "Please tick the box to share your report with this company.", 400)
    student = db.get("students", student_id)
    if not student:
        raise ApiError("STUDENT_NOT_FOUND", "We couldn't find your profile. Please sign up again.", 404)
    listing = _listing(listing_id)
    s = report.summary(student_id)
    if s["status"] != "done":
        raise ApiError("VIVA_NOT_DONE", "Finish your viva before you apply.", 409)
    match = matching.score(s["skills"], student["interests"], listing)["match"]
    try:
        row = db.insert("applications", {
            "student_id": student_id, "listing_id": listing_id, "match": match, "share_consent": True, "status": "applied",
        })
    except db.Duplicate:
        raise ApiError("ALREADY_APPLIED", "You've already applied to this internship.", 409)
    return {"application_id": row["id"], "status": "applied", "match": match}


def _candidate(application: dict) -> dict | None:
    student = db.get("students", application["student_id"])
    if not student:
        return None
    s = report.summary(student["id"])
    analysis = db.get("repo_analyses", s["session"]["analysis_id"]) if s["session"] else None
    results = s["results"]
    top = max(results, key=lambda r: r["score"]) if results else None
    return {
        "student_id": student["id"], "name": student["name"], "college": student["college"],
        "github_username": student["github_username"],
        "repo_full_name": analysis["repo_full_name"] if analysis else None,
        "match": application["match"], "overall": s["overall"], "skills": s["skills"],
        "answer_modes": {
            "voice": sum(1 for r in results if r["first"]["mode"] == "voice"),
            "text": sum(1 for r in results if r["first"]["mode"] == "text"),
            "pasted": sum(1 for r in results if any(a["pasted"] for a in (r["first"], r["follow"]) if a)),
        },
        "top_evidence": {
            "question": top["question"]["question"],
            "answer_excerpt": report.excerpt(top["best"]["transcript"]),
            "score": top["score"],
        } if top else None,
        "applied_at": _iso_z(application["created_at"]),
    }


def shortlist(listing_id: str) -> dict:
    listing = _listing(listing_id)
    candidates = [c for c in map(_candidate, db.select("applications", listing_id=listing_id)) if c]
    candidates.sort(key=lambda c: (-c["match"], -c["overall"]))
    return {
        "listing": {"id": listing["id"], "title": listing["title"], "venture": listing["venture"]},
        "candidates": [{"rank": i, **c} for i, c in enumerate(candidates, 1)],
    }


CSV_COLUMNS = ["rank", "name", "college", "github_username", "repo", "match", "overall", *TAGS,
               "voice_answers", "text_answers", "pasted_answers", "applied_at"]


def shortlist_csv(listing_id: str) -> str:
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(CSV_COLUMNS)
    for c in shortlist(listing_id)["candidates"]:
        writer.writerow([
            c["rank"], c["name"], c["college"], c["github_username"], c["repo_full_name"], c["match"], c["overall"],
            *[c["skills"].get(tag, "") for tag in TAGS],
            c["answer_modes"]["voice"], c["answer_modes"]["text"], c["answer_modes"]["pasted"], c["applied_at"],
        ])
    return out.getvalue()
