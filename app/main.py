"""VerifiedBuild API: app setup and routes only. The logic lives in the other modules."""

import hmac
import logging
import re
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app import applications, db, errors, github_ingest, hackathons, report, resume, viva
from app.config import settings
from app.errors import ApiError
from app.models import AnalyzeRequest, AnswerRequest, ApplyRequest, HackathonCreate, StudentCreate

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("verifiedbuild")
for noisy in ("httpx", "google_genai"):
    logging.getLogger(noisy).setLevel(logging.WARNING)

MAX_BODY_BYTES = 10 * 1024 * 1024
LISTING_FIELDS = ("id", "title", "venture", "description", "required_skills", "tags")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if db.using_memory():
        log.warning("No Supabase settings: using the in-memory store. Data is lost on restart.")
    try:
        db.seed_listings()
    except Exception:
        log.exception("Couldn't load seed/listings.json into the listings table")
    yield


app = FastAPI(title="VerifiedBuild API", version="v1", lifespan=lifespan)
errors.register(app)


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    if int(request.headers.get("content-length") or 0) > MAX_BODY_BYTES:
        return errors.error_response(
            "TOO_LARGE", "That upload is too big. Resumes must be under 5 MB and answers under 2 minutes.", 413)
    return await call_next(request)


# Added last, so it is the outermost layer and error responses carry CORS headers too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


_hits: dict[tuple[str, str], deque] = defaultdict(deque)


def per_hour(name: str, limit: int):
    """Caps calls per client IP per hour, so nobody can run up our Gemini bill.

    Limits are generous because everyone at a venue may share one Wi-Fi IP.
    """
    def check(request: Request) -> None:
        # Cloud Run appends the real client IP last, so earlier entries can't be used to dodge the limit.
        forwarded = request.headers.get("x-forwarded-for", "")
        ip = forwarded.split(",")[-1].strip() or (request.client.host if request.client else "?")
        now, hits = time.monotonic(), _hits[(name, ip)]
        while hits and now - hits[0] > 3600:
            hits.popleft()
        if len(hits) >= limit:
            raise ApiError("TOO_MANY_REQUESTS", "Too many tries from your network. Please wait a few minutes and try again.", 429)
        hits.append(now)
    return Depends(check)


def require_admin(x_admin_key: str | None = Header(default=None)) -> None:
    expected = settings.admin_key
    if not expected or not x_admin_key or not hmac.compare_digest(x_admin_key.encode(), expected.encode()):
        raise ApiError("BAD_ADMIN_KEY", "That admin passcode isn't right.", 401)


# --- Utility ---

@app.get("/api/health")
def health():
    return {"ok": True, "demo_mode": settings.demo_mode == "cached", "version": "v1.1"}


# --- Student flow ---

@app.post("/api/students", status_code=201, dependencies=[per_hour("signup", 120)])
def create_student(body: StudentCreate):
    user = github_ingest.get_user(body.github_username)
    if user is None:
        raise ApiError("GITHUB_USER_NOT_FOUND", "We couldn't find that GitHub username.", 404)
    claimed, source = [], "chips"
    if body.resume_base64:
        claimed, source = resume.from_pdf(body.resume_base64, body.resume_mime), "resume"
    if not claimed and body.skills:
        claimed, source = resume.from_chips(body.skills), "chips"
    student = db.insert("students", {
        "name": body.name, "email": body.email, "college": body.college,
        "github_username": user["login"],  # GitHub's spelling, e.g. AshaRao not asharao
        "interests": body.interests, "claimed_skills": claimed, "claimed_from": source,
    })
    return {"student_id": student["id"], "github_username": student["github_username"],
            "claimed_skills": claimed, "claimed_from": source}


@app.post("/api/students/{student_id}/hackathons", status_code=201, dependencies=[per_hour("hackathon", 120)])
def add_hackathon(student_id: str, body: HackathonCreate):
    return hackathons.add(student_id, body)


@app.delete("/api/students/{student_id}/hackathons/{hackathon_id}")
def delete_hackathon(student_id: str, hackathon_id: str):
    return hackathons.remove(student_id, hackathon_id)


@app.get("/api/github/{username}/repos")
def list_repos(username: str):
    return {"repos": github_ingest.list_repos(username)}


@app.post("/api/analyze", status_code=201, dependencies=[per_hour("analyze", 60)])
def analyze(body: AnalyzeRequest):
    return viva.start(body.student_id, body.repo_full_name)


@app.get("/api/viva/{session_id}")
def get_viva(session_id: str):
    return viva.state(session_id)


@app.post("/api/viva/{session_id}/answer", dependencies=[per_hour("answer", 600)])
def submit_answer(session_id: str, body: AnswerRequest):
    return viva.answer(session_id, body)


@app.get("/api/report/{student_id}")
def get_report(student_id: str):
    return report.build(student_id)


@app.get("/api/listings")
def list_listings():
    return {"listings": [{k: row[k] for k in LISTING_FIELDS} for row in db.select("listings", order="position")]}


@app.post("/api/apply", status_code=201)
def apply(body: ApplyRequest):
    return applications.apply(body.student_id, body.listing_id, body.share_consent)


# --- Recruiter flow: every route on this router needs X-Admin-Key ---

admin = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])


@admin.get("/verify")
def admin_verify():
    return {"ok": True}


@admin.get("/shortlist/{listing_id}")
def shortlist(listing_id: str):
    return applications.shortlist(listing_id)


@admin.get("/shortlist/{listing_id}/csv")
def shortlist_csv(listing_id: str):
    csv_text = applications.shortlist_csv(listing_id)
    safe_id = re.sub(r"[^A-Za-z0-9_-]", "", listing_id)
    return Response(
        csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="shortlist-{safe_id}.csv"'},
    )


app.include_router(admin)
