"""The one place we call Gemini: generate_json(parts, schema).

Gemini must answer with JSON that fits `schema`. If the JSON is broken, or `validate`
rejects it, we ask once more. A second failure becomes AI_FAILED.
"""

import json
import logging
import time
from typing import Any, Callable

from google import genai
from google.genai import types

from app.config import settings
from app.errors import ApiError

log = logging.getLogger("verifiedbuild")

TIMEOUT_MS = 120_000
_client: genai.Client | None = None


def client() -> genai.Client:
    global _client
    if _client is None:
        http = types.HttpOptions(timeout=TIMEOUT_MS, retry_options=types.HttpRetryOptions(attempts=2))
        if settings.gemini_api_key:
            _client = genai.Client(api_key=settings.gemini_api_key, http_options=http)
        else:
            _client = genai.Client(
                vertexai=True,
                project=settings.google_cloud_project,
                location=settings.google_cloud_location,
                http_options=http,
            )
    return _client


def generate_json(
    parts: list[Any],
    schema: dict,
    *,
    system: str,
    validate: Callable[[dict], Any] | None = None,
    thinking: str | None = None,
) -> tuple[Any, dict]:
    """Returns (result, usage). `validate` may clean the result, or raise ValueError to retry."""
    config = types.GenerateContentConfig(
        system_instruction=system,
        response_mime_type="application/json",
        response_json_schema=schema,
        thinking_config=types.ThinkingConfig(thinking_level=thinking) if thinking else None,
    )
    usage = {"model": settings.gemini_model, "calls": 0, "tokens_in": 0, "tokens_out": 0, "latency_ms": 0}
    last_problem = ""
    for attempt in (1, 2):
        started = time.monotonic()
        try:
            response = client().models.generate_content(model=settings.gemini_model, contents=parts, config=config)
        except Exception as exc:  # network, quota, timeout
            log.warning("Gemini call failed (attempt %d): %s", attempt, exc)
            last_problem = str(exc)
            continue
        finally:
            usage["calls"] += 1
            usage["latency_ms"] += int((time.monotonic() - started) * 1000)
        meta = response.usage_metadata
        if meta:
            usage["tokens_in"] += meta.prompt_token_count or 0
            usage["tokens_out"] += (meta.candidates_token_count or 0) + (meta.thoughts_token_count or 0)
        try:
            data = json.loads(response.text or "")
            result = validate(data) if validate else data
            return result, usage
        except (ValueError, TypeError) as exc:  # json.JSONDecodeError is a ValueError
            log.warning("Gemini output rejected (attempt %d): %s", attempt, exc)
            last_problem = str(exc)
    log.error("Gemini gave up after 2 attempts: %s", last_problem)
    raise ApiError("AI_FAILED", "Our AI step didn't work this time. Please try again.", 502)
