"""The only place we call Gemini.

generate_json(parts, schema): Gemini must answer with JSON that fits `schema`. If the JSON is
broken, or `validate` rejects it, we ask once more. A second failure becomes AI_FAILED.

transcribe(wav): speech to text for voice answers. It uses its own model (GEMINI_AUDIO_MODEL):
in our tests the main model often hung on audio, while this one answered every time in ~2.5 s.

Hedging: Gemini's latency has a long tail. In 10 runs of the same recording, transcription took
2.0-2.6 s eight times, then 5.7 s and 15.9 s. So when a call is slower than `hedge_after_s`, we send
the same request again and use whichever answer comes back first. It costs a few extra tokens on slow calls only,
and rescues a single stalled request. It can't help when Gemini is slow for everyone (both requests are then slow).
"""

import json
import logging
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from typing import Any, Callable

from google import genai
from google.genai import types

from app.config import settings
from app.errors import ApiError

log = logging.getLogger("verifiedbuild")

_client: genai.Client | None = None
_pool = ThreadPoolExecutor(max_workers=32, thread_name_prefix="gemini")  # a slow loser holds a worker until its timeout

# Seconds before a duplicate request is sent (medians in our tests: transcription 2.2 s, scoring 3 s, questions 10 s;
# a resume took 5 to 20 s)
HEDGE_TRANSCRIBE_S = 6
HEDGE_SCORE_S = 8
HEDGE_QUESTIONS_S = 25
HEDGE_RESUME_S = 12


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


def _hedged_call(model: str, contents: list, config: types.GenerateContentConfig, usage: dict,
                 hedge_after_s: float | None):
    """Like _call, but sends a second identical request if the first is slower than hedge_after_s,
    and returns whichever succeeds first. The slower one finishes in the background and is ignored."""
    if not hedge_after_s:
        return _call(model, contents, config, usage)
    first = _pool.submit(_call, model, contents, config, usage)
    done, _ = wait([first], timeout=hedge_after_s)
    if done:
        return first.result()
    log.info("Gemini %s slower than %s s: sending the same request again", model, hedge_after_s)
    pending = {first, _pool.submit(_call, model, contents, config, usage)}
    error: Exception | None = None
    while pending:
        done, pending = wait(pending, return_when=FIRST_COMPLETED)
        for future in done:
            if future.exception() is None:
                return future.result()
            error = future.exception()
    raise error


def generate_json(
    parts: list[Any],
    schema: dict,
    *,
    system: str,
    validate: Callable[[dict], Any] | None = None,
    thinking: str | None = None,
    timeout_s: int = 45,
    hedge_after_s: float | None = None,
) -> tuple[Any, dict]:
    """Returns (result, usage). `validate` may clean the result, or raise ValueError to retry.

    `timeout_s` is per attempt: a call that hangs is cut off and tried once more.
    `hedge_after_s`: see Hedging above. None sends one request per attempt.
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
            response = _hedged_call(settings.gemini_model, parts, config, usage, hedge_after_s)
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
            response = _hedged_call(settings.gemini_audio_model,
                                    [TRANSCRIBE_PROMPT, types.Part.from_bytes(data=wav, mime_type="audio/wav")], config, usage,
                                    HEDGE_TRANSCRIBE_S)
            return (response.text or "").strip(), usage
        except Exception as exc:
            log.warning("Transcription failed (attempt %d): %s", attempt, exc)
    raise _ai_failed()
