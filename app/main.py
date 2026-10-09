"""VerifiedBuild API: app setup and routes only. Logic lives in the other modules.

Step 1 (contract first): every route returns its example from examples/.
Real logic replaces them one endpoint at a time, without changing the shapes.
"""

import hmac
import json
import re
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app import errors
from app.config import settings
from app.errors import ApiError
from app.models import AnalyzeRequest, AnswerRequest, ApplyRequest, StudentCreate

EXAMPLES = Path(__file__).resolve().parent.parent / "examples"

app = FastAPI(title="VerifiedBuild API", version="v1")
errors.register(app)
# Added last, so it is the outermost layer and error responses carry CORS headers too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


def example(name: str) -> dict:
    return json.loads((EXAMPLES / f"{name}.json").read_text(encoding="utf-8"))


def require_admin(x_admin_key: str | None = Header(default=None)) -> None:
    expected = settings.admin_key
    if not expected or not x_admin_key or not hmac.compare_digest(x_admin_key.encode(), expected.encode()):
        raise ApiError("BAD_ADMIN_KEY", "That admin passcode isn't right.", 401)


# --- Utility ---

@app.get("/api/health")
def health():
    return {"ok": True, "demo_mode": settings.demo_mode == "cached", "version": "v1"}


# --- Student flow ---

@app.post("/api/students", status_code=201)
def create_student(body: StudentCreate):
    return example("post_students")


@app.get("/api/github/{username}/repos")
def list_repos(username: str):
    return example("get_github_repos")


@app.post("/api/analyze", status_code=201)
def analyze(body: AnalyzeRequest):
    return example("post_analyze")


@app.get("/api/viva/{session_id}")
def get_viva(session_id: str):
    return example("get_viva")


@app.post("/api/viva/{session_id}/answer")
def submit_answer(session_id: str, body: AnswerRequest):
    return example("post_viva_answer")


@app.get("/api/report/{student_id}")
def get_report(student_id: str):
    return example("get_report")


@app.get("/api/listings")
def list_listings():
    return example("get_listings")


@app.post("/api/apply", status_code=201)
def apply(body: ApplyRequest):
    return example("post_apply")


# --- Recruiter flow: every route on this router needs X-Admin-Key ---

admin = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])


@admin.get("/verify")
def admin_verify():
    return example("get_admin_verify")


@admin.get("/shortlist/{listing_id}")
def shortlist(listing_id: str):
    return example("get_admin_shortlist")


@admin.get("/shortlist/{listing_id}/csv")
def shortlist_csv(listing_id: str):
    csv_text = (EXAMPLES / "get_admin_shortlist.csv").read_text(encoding="utf-8")
    safe_id = re.sub(r"[^A-Za-z0-9_-]", "", listing_id)
    return Response(
        csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="shortlist-{safe_id}.csv"'},
    )


app.include_router(admin)
