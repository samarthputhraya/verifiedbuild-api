"""Hackathon entries: the third input of the problem statement.

An entry (event, year, result, team size, repo) is only a claim. It becomes verified when the
student finishes a viva on that repo. On a team repo the viva asks about the files they changed.
Only verified entries count in the match score.
"""

from app import db, github_ingest, report
from app.errors import ApiError
from app.models import HackathonCreate
from app.viva import commits_in_others_repo


def add(student_id: str, body: HackathonCreate) -> dict:
    student = db.get("students", student_id)
    if not student:
        raise ApiError("STUDENT_NOT_FOUND", "We couldn't find your profile. Please sign up again.", 404)
    login = student["github_username"]
    meta = github_ingest.get_repo(body.repo_full_name.strip().strip("/"))  # exists and is public
    full_name = meta["full_name"]
    if full_name.split("/")[0].lower() != login.lower():
        commits_in_others_repo(full_name, login)  # refuses unless the student has commits in it
    row = db.insert("hackathons", {
        "student_id": student_id, "event": body.event, "year": body.year, "result": body.result,
        "team_size": body.team_size, "repo_full_name": full_name,
    })
    items = report.hackathon_items(student_id, report.summary(student_id)["per_repo"])
    return next(h for h in items if h["hackathon_id"] == row["id"])


def remove(student_id: str, hackathon_id: str) -> dict:
    row = db.get("hackathons", hackathon_id)
    if not row or row["student_id"] != student_id:
        raise ApiError("HACKATHON_NOT_FOUND", "We couldn't find that hackathon on your profile.", 404)
    db.delete("hackathons", hackathon_id)
    return {"ok": True}
