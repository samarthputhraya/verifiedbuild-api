"""The only place we call Gemini.

generate_json(parts, schema): Gemini must answer with JSON that fits `schema`. If the JSON is
broken, or `validate` rejects it, we ask once more. A second failure becomes AI_FAILED.

transcribe(wav): speech to text for voice answers. It uses its own model (GEMINI_AUDIO_MODEL):
in our tests the main model often hung on audio, while this one answered every time in ~2.5 s.
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

_client: genai.Client | None = None


def client() -> genai.Client:
    global _client
    if _client is None:
        http = types.HttpOptions(retry_options=types.HttpRetryOptions(attempts=2))  # one retry on 429/5xx
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


def _ai_failed() -> ApiError:
    return ApiError("AI_FAILED", "Our AI step didn't work this time. Please try again.", 502)


def _new_usage(model: str) -> dict:
    return {"model": model, "calls": 0, "tokens_in": 0, "tokens_out": 0, "latency_ms": 0}


def merge_usage(a: dict, b: dict) -> dict:
    return {"model": f"{a['model']}+{b['model']}", **{k: a[k] + b[k] for k in ("calls", "tokens_in", "tokens_out", "latency_ms")}}


def _call(model: str, contents: list, config: types.GenerateContentConfig, usage: dict):
    started = time.monotonic()
    try:
        response = client().models.generate_content(model=model, contents=contents, config=config)
    finally:
        usage["calls"] += 1
        usage["latency_ms"] += int((time.monotonic() - started) * 1000)
    meta = response.usage_metadata
    if meta:
        usage["tokens_in"] += meta.prompt_token_count or 0
        usage["tokens_out"] += (meta.candidates_token_count or 0) + (meta.thoughts_token_count or 0)
    return response


def generate_json(
    parts: list[Any],
    schema: dict,
    *,
    system: str,
    validate: Callable[[dict], Any] | None = None,
    thinking: str | None = None,
    timeout_s: int = 45,
) -> tuple[Any, dict]:
    """Returns (result, usage). `validate` may clean the result, or raise ValueError to retry.

    `timeout_s` is per attempt: a call that hangs is cut off and tried once more.
    """
    config = types.GenerateContentConfig(
        http_options=types.HttpOptions(timeout=timeout_s * 1000),
        system_instruction=system,
        response_mime_type="application/json",
        response_json_schema=schema,
        thinking_config=types.ThinkingConfig(thinking_level=thinking) if thinking else None,
    )
    usage = _new_usage(settings.gemini_model)
    for attempt in (1, 2):
        try:
            response = _call(settings.gemini_model, parts, config, usage)
        except Exception as exc:  # network, quota, timeout
            log.warning("Gemini call failed (attempt %d): %s", attempt, exc)
            continue
        try:
            data = json.loads(response.text or "")
            return (validate(data) if validate else data), usage
        except (ValueError, TypeError, KeyError) as exc:  # json.JSONDecodeError is a ValueError
            log.warning("Gemini output rejected (attempt %d): %s", attempt, exc)
    raise _ai_failed()


TRANSCRIBE_PROMPT = (
    "Transcribe this spoken answer exactly as said, in the language(s) spoken. Keep technical words and code names "
    "as spoken. Do not translate, correct or summarise. If there is no speech, return nothing."
)


def transcribe(wav: bytes) -> tuple[str, dict]:
    """Returns (transcript, usage). An empty transcript means no speech was heard."""
    config = types.GenerateContentConfig(
        http_options=types.HttpOptions(timeout=30_000),
        thinking_config=types.ThinkingConfig(thinking_level="LOW"),
    )
    usage = _new_usage(settings.gemini_audio_model)
    for attempt in (1, 2):
        try:
            response = _call(settings.gemini_audio_model,
                             [TRANSCRIBE_PROMPT, types.Part.from_bytes(data=wav, mime_type="audio/wav")], config, usage)
            return (response.text or "").strip(), usage
        except Exception as exc:
            log.warning("Transcription failed (attempt %d): %s", attempt, exc)
    raise _ai_failed()
