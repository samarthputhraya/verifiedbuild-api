"""Database access: Supabase Postgres through its REST API, with the service-role key (backend only).

With no SUPABASE_URL / SUPABASE_SERVICE_KEY set, an in-memory store stands in, so local runs and
tests work with no setup. In-memory data is lost on restart, so the deployed app must use Supabase.

The rest of the app only uses the functions at the bottom: insert, get, select, update, upsert.
"""

import copy
import json
import logging
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx

from app.config import settings
from app.errors import ApiError

log = logging.getLogger("verifiedbuild")

SEED_LISTINGS = Path(__file__).resolve().parent.parent / "seed" / "listings.json"

# Unique keys. Postgres enforces them in Supabase (see supabase/schema.sql); the memory store checks by hand.
UNIQUE = {
    "applications": ("student_id", "listing_id"),
    "viva_answers": ("session_id", "question_id", "is_follow_up"),
}


class Duplicate(Exception):
    """A unique key stopped an insert, e.g. applying to the same listing twice."""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class _Memory:
    def __init__(self):
        self.tables: dict[str, list[dict]] = {}
        self.lock = threading.Lock()

    def insert(self, table, row):
        with self.lock:
            rows = self.tables.setdefault(table, [])
            keys = UNIQUE.get(table)
            if keys and any(all(r.get(k) == row.get(k) for k in keys) for r in rows):
                raise Duplicate(table)
            new = {"id": str(uuid.uuid4()), "created_at": _now(), **copy.deepcopy(row)}
            rows.append(new)
            return copy.deepcopy(new)

    def select(self, table, filters, order, desc, limit):
        with self.lock:
            rows = [copy.deepcopy(r) for r in self.tables.get(table, [])
                    if all(r.get(k) == v for k, v in filters.items())]
        rows.sort(key=lambda r: r[order], reverse=desc)
        return rows[:limit] if limit else rows

    def update(self, table, id, fields):
        with self.lock:
            for r in self.tables.get(table, []):
                if r["id"] == id:
                    r.update(copy.deepcopy(fields))

    def upsert(self, table, rows):
        with self.lock:
            existing = {r["id"]: r for r in self.tables.setdefault(table, [])}
            for row in rows:
                if row["id"] in existing:
                    existing[row["id"]].update(copy.deepcopy(row))
                else:
                    self.tables[table].append({"created_at": _now(), **copy.deepcopy(row)})


class _Supabase:
    def __init__(self, url: str, key: str):
        headers = {"apikey": key}
        if key.startswith("eyJ"):  # legacy service_role JWT; new sb_secret_ keys are rejected as Bearer tokens
            headers["Authorization"] = f"Bearer {key}"
        self.http = httpx.Client(base_url=f"{url}/rest/v1", headers=headers, timeout=15)

    def _send(self, method, table, *, params=None, body=None, prefer=None):
        try:
            r = self.http.request(method, f"/{table}", params=params, json=body,
                                  headers={"Prefer": prefer} if prefer else None)
        except httpx.HTTPError as exc:
            log.error("Supabase %s %s unreachable: %s", method, table, exc)
            raise ApiError("DB_UNAVAILABLE", "We couldn't reach our database. Please try again.", 503)
        if r.status_code >= 400:
            code = r.json().get("code") if r.headers.get("content-type", "").startswith("application/json") else None
            if code == "23505":
                raise Duplicate(table)
            if code == "22P02":  # not a valid uuid, so no row can match
                return []
            log.error("Supabase %s %s failed: %s %s", method, table, r.status_code, r.text[:300])
            raise ApiError("DB_ERROR", "Something went wrong with our database. Please try again.", 500)
        return r.json() if r.content else None

    def insert(self, table, row):
        return self._send("POST", table, body=row, prefer="return=representation")[0]

    def select(self, table, filters, order, desc, limit):
        params = {k: f"eq.{str(v).lower() if isinstance(v, bool) else v}" for k, v in filters.items()}
        params["order"] = f"{order}.{'desc' if desc else 'asc'}"
        if limit:
            params["limit"] = limit
        return self._send("GET", table, params=params)

    def update(self, table, id, fields):
        self._send("PATCH", table, params={"id": f"eq.{id}"}, body=fields, prefer="return=minimal")

    def upsert(self, table, rows):
        self._send("POST", table, body=rows, prefer="resolution=merge-duplicates,return=minimal")


_store = (_Supabase(settings.supabase_url, settings.supabase_service_key)
          if settings.supabase_url and settings.supabase_service_key else _Memory())


def using_memory() -> bool:
    return isinstance(_store, _Memory)


def insert(table: str, row: dict) -> dict:
    """Insert one row and return it with its id and created_at. Raises Duplicate on a unique key."""
    return _store.insert(table, row)


def select(table: str, *, order: str = "created_at", desc: bool = False, limit: int | None = None, **filters) -> list[dict]:
    """Rows where every filter column equals its value."""
    return _store.select(table, filters, order, desc, limit)


def get(table: str, id: str) -> dict | None:
    rows = select(table, id=id, limit=1)
    return rows[0] if rows else None


def update(table: str, id: str, **fields) -> None:
    _store.update(table, id, fields)


def upsert(table: str, rows: list[dict]) -> None:
    """Insert rows, or update the ones whose id already exists."""
    _store.upsert(table, rows)


def seed_listings() -> None:
    """Make the listings table match seed/listings.json. Safe to run on every start."""
    rows = json.loads(SEED_LISTINGS.read_text(encoding="utf-8"))
    upsert("listings", [{**row, "position": i} for i, row in enumerate(rows)])
