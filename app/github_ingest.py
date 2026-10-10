"""Everything we read from GitHub.

- Sign-up and the repo picker: the user check and the repo list (REST).
- Analyze: repo info and languages (REST), all files in one tarball download, and the
  build history from one GraphQL query. Then we choose the ~12 files worth asking about.
- Team repos: the student's own commits and the files they changed (REST), so a viva on a
  hackathon repo asks about the student's part of the code.
"""

import io
import json
import logging
import math
import re
import statistics
import tarfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import PurePosixPath

import httpx

from app.config import settings
from app.errors import ApiError

log = logging.getLogger("verifiedbuild")

USERNAME_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")
REPO_RE = re.compile(r"^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$")


def _headers() -> dict:
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "verifiedbuild-api"}
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"
    return headers


_http = httpx.Client(base_url="https://api.github.com", headers=_headers(), timeout=30, follow_redirects=True)


def _raise_for(r: httpx.Response) -> None:
    if r.status_code == 429 or (r.status_code == 403 and ("rate limit" in r.text.lower() or r.headers.get("x-ratelimit-remaining") == "0")):
        raise ApiError("GITHUB_RATE_LIMIT", "GitHub is limiting our requests right now. Please try again in a few minutes.", 503)
    if r.status_code >= 400:
        log.error("GitHub %s %s -> %s %s", r.request.method, r.request.url.path, r.status_code, r.text[:200])
        raise ApiError("GITHUB_ERROR", "We couldn't read from GitHub just now. Please try again.", 502)


def _get(path: str, **params):
    """GET a GitHub API path. Returns None on 404."""
    try:
        r = _http.get(path, params=params or None)
    except httpx.HTTPError as exc:
        log.error("GitHub unreachable: %s", exc)
        raise ApiError("GITHUB_ERROR", "We couldn't reach GitHub just now. Please try again.", 502)
    if r.status_code == 404:
        return None
    _raise_for(r)
    return r.json()


# --- Sign-up and repo picker ---

def get_user(username: str) -> dict | None:
    if not USERNAME_RE.match(username):
        return None
    return _get(f"/users/{username}")


def list_repos(username: str) -> list[dict]:
    """Public, non-fork, non-archived, non-empty repos, newest push first, max 30."""
    repos = _get(f"/users/{username}/repos", sort="pushed", per_page=100, type="owner") if USERNAME_RE.match(username) else None
    if repos is None:
        raise ApiError("GITHUB_USER_NOT_FOUND", "We couldn't find that GitHub username.", 404)
    keep = [r for r in repos if not r["fork"] and not r["archived"] and not r.get("private") and r.get("size", 0) > 0]
    keep.sort(key=lambda r: r.get("pushed_at") or "", reverse=True)
    return [
        {"full_name": r["full_name"], "description": r["description"], "language": r["language"],
         "stars": r["stargazers_count"], "pushed_at": r["pushed_at"]}
        for r in keep[:30]
    ]


# --- Analyze: repo info ---

def get_repo(full_name: str) -> dict:
    meta = _get(f"/repos/{full_name}") if REPO_RE.match(full_name) else None
    if meta is None or meta.get("private"):
        raise ApiError("REPO_NOT_FOUND", "We couldn't find that public repo on GitHub.", 404)
    if meta.get("size", 0) == 0:
        raise ApiError("REPO_EMPTY", "This repo is empty. Pick a repo with code in it.", 422)
    return meta


def get_languages(full_name: str) -> dict[str, float]:
    langs = _get(f"/repos/{full_name}/languages") or {}
    total = sum(langs.values())
    return {name: round(n * 100 / total, 1) for name, n in sorted(langs.items(), key=lambda kv: -kv[1])} if total else {}


def commits_by(full_name: str, login: str) -> list[str]:
    """SHAs of up to 100 recent commits by this GitHub user (GitHub links them by the commit email)."""
    commits = _get(f"/repos/{full_name}/commits", author=login, per_page=100) or []
    return [c["sha"] for c in commits if isinstance(c, dict) and c.get("sha")]


def files_changed(full_name: str, shas: list[str], limit: int = 30) -> dict[str, int]:
    """Lines changed per file across the most recent `limit` of these commits."""
    def one(sha: str) -> list[tuple[str, int]]:
        try:
            data = _get(f"/repos/{full_name}/commits/{sha}") or {}
        except ApiError:
            return []  # one unreadable commit shouldn't stop the viva
        return [(f["filename"], f.get("changes", 0)) for f in data.get("files", []) if f.get("filename")]

    totals: dict[str, int] = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for files in pool.map(one, shas[:limit]):
            for name, changes in files:
                totals[name] = totals.get(name, 0) + changes
    return totals


# --- Analyze: files ---

MAX_DOWNLOAD_BYTES = 150 * 1024 * 1024
MAX_FILE_BYTES = 300_000

SKIP_DIRS = {
    "node_modules", "dist", "build", "out", ".next", ".nuxt", ".svelte-kit", ".expo", "venv", ".venv", "env",
    "__pycache__", ".git", "vendor", "vendors", "third_party", "external", "coverage", ".idea", ".vscode",
    "target", "bin", "obj", ".gradle", "pods", ".dart_tool", "site-packages", "migrations", "generated",
    "__generated__", "android", "ios", "macos", "linux", "windows", "web-build", "storybook-static", ".cache",
}
LOCKFILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "pipfile.lock", "cargo.lock",
    "composer.lock", "gemfile.lock", "go.sum", "bun.lockb", "uv.lock",
}
SOURCE_EXTS = {
    ".py", ".ipynb", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte", ".java", ".kt", ".kts",
    ".go", ".rs", ".rb", ".php", ".cs", ".c", ".h", ".cpp", ".cc", ".hpp", ".swift", ".dart", ".scala", ".r",
    ".sql", ".sh", ".tf", ".html", ".css", ".scss", ".yml", ".yaml",
}
LOW_VALUE_EXTS = {".html", ".css", ".scss", ".yml", ".yaml", ".sh", ".sql", ".tf"}
BOILERPLATE_STEMS = {"setuptests", "reportwebvitals", "serviceworker", "manage", "wsgi", "asgi", "vite-env.d", "next-env.d"}
ENTRY_STEMS = {"main", "app", "server", "index", "api", "routes"}
# Imported everywhere, but mostly declarations: poor material for "why" questions
DECLARATION_STEMS = {"types", "type", "interfaces", "constants", "consts", "theme", "config", "settings", "styles"}
SKIP_NAME_RE = re.compile(
    r"(\.min\.|\.bundle\.|\.d\.ts$|_pb2\.py$|\.pb\.go$|\.g\.dart$|\.freezed\.dart$|\.generated\.|"
    r"\.config\.(js|ts|mjs|cjs)$|^(jquery|bootstrap|chart|d3|three|lodash|popper|moment)[.-])"
)
GENERATED_RE = re.compile(r"auto-?generated|do not edit|@generated|generated by", re.I)
IMPORT_LINE_RE = re.compile(r"^\s*(import\b|from\s+\S+\s+import\b|export\s.*\bfrom\b|#include\b|use\s|using\s|require\b)|require\(|import\(")
TEST_RE = re.compile(r"(^|/)(tests?|__tests__|spec)(/|$)|(\.|_)(test|spec)\.|^test_", re.I)

MAX_FILES = 12
MAX_TOTAL_CHARS = 60_000
MAX_FILE_CHARS = 12_000
README_CHARS = 5_000


def _is_readme(path: str) -> bool:
    return "/" not in path and path.lower().startswith("readme")


def _is_candidate(path: str) -> bool:
    """Cheap path check before we read a file out of the tarball."""
    if _is_readme(path):
        return True
    p = PurePosixPath(path)
    if any(part.lower() in SKIP_DIRS for part in p.parts[:-1]):
        return False
    name = p.name.lower()
    if name in LOCKFILES or SKIP_NAME_RE.search(name):
        return False
    if name == "dockerfile":
        return True
    ext = p.suffix.lower()
    if ext in (".yml", ".yaml"):  # only CI and deploy config shows skill; other YAML is noise
        return "workflows" in path or name.startswith(("docker-compose", "compose")) or "k8s" in path
    return ext in SOURCE_EXTS


class _TooBig(Exception):
    pass


class _ChunkReader(io.RawIOBase):
    """Lets tarfile read the download while it is still arriving."""

    def __init__(self, chunks):
        self.chunks, self.buf, self.total = chunks, b"", 0

    def readable(self):
        return True

    def readinto(self, b):
        while not self.buf:
            try:
                self.buf = next(self.chunks)
            except StopIteration:
                return 0
            self.total += len(self.buf)
            if self.total > MAX_DOWNLOAD_BYTES:
                raise _TooBig()
        n = min(len(b), len(self.buf))
        b[:n], self.buf = self.buf[:n], self.buf[n:]
        return n


def _notebook_to_code(raw: str) -> str | None:
    try:
        cells = json.loads(raw).get("cells", [])
    except (ValueError, AttributeError):
        return None
    code = ["".join(c.get("source", [])) for c in cells if c.get("cell_type") == "code"]
    return "\n\n# %% next cell\n".join(code) if code else None


def download_files(full_name: str, ref: str) -> dict[str, str]:
    """Every candidate text file in the repo, path -> text, from one tarball download."""
    files: dict[str, str] = {}
    try:
        with _http.stream("GET", f"/repos/{full_name}/tarball/{ref}") as r:
            if r.status_code == 404:
                raise ApiError("REPO_EMPTY", "This repo is empty. Pick a repo with code in it.", 422)
            if r.status_code >= 400:
                r.read()
                _raise_for(r)
            reader = io.BufferedReader(_ChunkReader(r.iter_bytes()), buffer_size=1 << 16)
            with tarfile.open(fileobj=reader, mode="r|gz") as tar:
                for member in tar:
                    if not member.isfile() or member.size > MAX_FILE_BYTES:
                        continue
                    path = member.name.split("/", 1)[1] if "/" in member.name else member.name
                    if not _is_candidate(path):
                        continue
                    data = tar.extractfile(member).read()
                    if b"\0" in data[:8000]:
                        continue
                    text = data.decode("utf-8", errors="replace")
                    if path.lower().endswith(".ipynb"):
                        text = _notebook_to_code(text)
                        if text is None:
                            continue
                    files[path] = text
    except _TooBig:
        log.warning("%s is over %d MB; using the %d files read so far", full_name, MAX_DOWNLOAD_BYTES >> 20, len(files))
    except (tarfile.TarError, httpx.HTTPError, EOFError) as exc:
        log.error("Tarball read failed for %s: %s", full_name, exc)
        if not files:
            raise ApiError("GITHUB_ERROR", "We couldn't download this repo from GitHub. Please try again.", 502)
    return files


def _looks_generated_or_minified(text: str) -> bool:
    lines = text.split("\n")
    if GENERATED_RE.search("\n".join(lines[:5])):
        return True
    longest = max((len(line) for line in lines), default=0)
    return longest > 1000 and len(text) / max(len(lines), 1) > 200


def _ref_keys(path: str) -> set[str]:
    """Names other files would use to import this one."""
    p = PurePosixPath(path)
    stem = p.name.split(".")[0]
    keys = {stem} if stem.lower() not in {"index", "__init__", "mod", "main"} else set()
    if p.parent.name and stem.lower() in {"index", "__init__", "mod"}:
        keys.add(p.parent.name)
    return {k for k in keys if len(k) >= 2}


def select_files(files: dict[str, str], focus: dict[str, int] | None = None) -> tuple[str, dict[str, str]]:
    """Returns (readme, chosen) where chosen maps path -> text for up to 12 files, ~60k chars total.

    Ranking: files that other files import score higher, bigger files score higher (up to a point),
    entry points get a boost, tests and config get less. We spread picks across folders.
    `focus` (team repos) maps path -> lines the student changed: their files rank far above the rest.
    """
    readme = next((t for p, t in sorted(files.items()) if _is_readme(p)), "")[:README_CHARS]
    candidates = {}
    for path, text in files.items():
        if _is_readme(path):
            continue
        stem = PurePosixPath(path).name.split(".")[0].lower()
        if stem in BOILERPLATE_STEMS or _looks_generated_or_minified(text):
            continue
        if sum(1 for line in text.split("\n") if line.strip()) < 8:
            continue
        candidates[path] = text

    import_text = {
        path: "\n".join(line for line in text.split("\n") if IMPORT_LINE_RE.search(line))
        for path, text in candidates.items()
    }
    most_mine = max((focus.get(p, 0) for p in candidates), default=0) if focus else 0
    scores = {}
    for path, text in candidates.items():
        keys = _ref_keys(path)
        pattern = re.compile(r"\b(" + "|".join(re.escape(k) for k in keys) + r")\b") if keys else None
        refs = sum(1 for other, imports in import_text.items() if other != path and pattern and pattern.search(imports))
        lines = text.count("\n") + 1
        weight = 1.0
        ext = PurePosixPath(path).suffix.lower()
        stem = PurePosixPath(path).name.split(".")[0].lower()
        if TEST_RE.search(path):
            weight *= 0.4
        if ext in LOW_VALUE_EXTS:
            weight *= 0.5
        if stem in ENTRY_STEMS:
            weight *= 1.5
        if stem in DECLARATION_STEMS:
            weight *= 0.3
        code_lines = [line for line in text.split("\n") if line.strip()]
        if sum(1 for line in code_lines if IMPORT_LINE_RE.search(line)) > 0.5 * len(code_lines):
            weight *= 0.2  # a file that mostly re-exports other files
        if most_mine:
            mine = focus.get(path, 0)
            weight *= (2 + 3 * mine / most_mine) if mine else 0.25
        scores[path] = (1 + refs) * math.log2(1 + min(lines, 600)) * weight

    chosen: dict[str, str] = {}
    per_folder: dict[str, int] = {}
    total = 0
    remaining = dict(scores)
    while remaining and len(chosen) < MAX_FILES and MAX_TOTAL_CHARS - total >= 1500:
        best = max(remaining, key=lambda p: remaining[p] * 0.7 ** per_folder.get(str(PurePosixPath(p).parent), 0))
        del remaining[best]
        text = _cap(candidates[best], min(MAX_FILE_CHARS, MAX_TOTAL_CHARS - total))
        if not text:
            continue
        chosen[best] = text
        total += len(text)
        folder = str(PurePosixPath(best).parent)
        per_folder[folder] = per_folder.get(folder, 0) + 1
    return readme, chosen


def _cap(text: str, limit: int) -> str:
    """Cut at a line boundary so line numbers stay true."""
    if len(text) <= limit:
        return text
    cut = text.rfind("\n", 0, limit)
    return text[:cut] if cut > 0 else ""


def numbered(text: str, start: int = 1) -> str:
    lines = text.split("\n")
    width = len(str(start + len(lines) - 1))
    return "\n".join(f"{i:>{width}} | {line}" for i, line in enumerate(lines, start))


# --- Analyze: build history ---

HISTORY_QUERY = """
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef { target { ... on Commit {
      history(first: 100) {
        totalCount
        nodes { authoredDate additions deletions author { email name user { login } } }
      }
    } } }
  }
}"""


def build_history(full_name: str, student_login: str) -> dict | None:
    """Neutral facts about how the repo was built. Never a verdict."""
    if not settings.github_token:
        return None
    owner, name = full_name.split("/", 1)
    try:
        r = _http.post("/graphql", json={"query": HISTORY_QUERY, "variables": {"owner": owner, "name": name}})
        r.raise_for_status()
        history = r.json()["data"]["repository"]["defaultBranchRef"]["target"]["history"]
    except (httpx.HTTPError, KeyError, TypeError) as exc:
        log.warning("Build history unavailable for %s: %s", full_name, exc)
        return None
    nodes = history["nodes"]
    if not nodes:
        return None

    def author_key(n):
        a = n.get("author") or {}
        return ((a.get("user") or {}).get("login") or a.get("email") or a.get("name") or "").lower()

    dates = [datetime.fromisoformat(n["authoredDate"]) for n in nodes]
    mine = sum(1 for n in nodes if author_key(n) == student_login.lower())
    return {
        "commits": history["totalCount"],
        "active_days": len({d.date() for d in dates}),
        "span_days": (max(dates) - min(dates)).days + 1,
        "authors": len({author_key(n) for n in nodes}),
        "your_commit_share": round(mine / len(nodes), 2),
        "median_lines_per_commit": int(statistics.median(n["additions"] + n["deletions"] for n in nodes)),
    }
