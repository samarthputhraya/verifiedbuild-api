"""Answer audio: base64 from the browser -> bytes Gemini accepts.

Gemini takes wav, mp3, aiff, aac, ogg and flac directly. Anything else (Chrome records webm,
Safari records mp4/m4a) is converted with ffmpeg to 16 kHz mono wav.
"""

import base64
import binascii
import logging
import os
import subprocess
import tempfile

from app.errors import ApiError

log = logging.getLogger("verifiedbuild")

NATIVE = {
    "audio/wav": "audio/wav", "audio/x-wav": "audio/wav", "audio/wave": "audio/wav",
    "audio/mp3": "audio/mp3", "audio/mpeg": "audio/mp3",
    "audio/aiff": "audio/aiff", "audio/x-aiff": "audio/aiff",
    "audio/aac": "audio/aac",
    "audio/ogg": "audio/ogg", "audio/opus": "audio/ogg",
    "audio/flac": "audio/flac", "audio/x-flac": "audio/flac",
}
MAX_SECONDS = 125  # 2 minutes plus a little slack


def _unreadable() -> ApiError:
    return ApiError("AUDIO_UNREADABLE", "We couldn't play that recording. Please record again, or type your answer.", 422)


def prepare(audio_base64: str, audio_mime: str | None) -> tuple[bytes, str]:
    """Returns (audio bytes, mime type) ready to send to Gemini."""
    try:
        data = base64.b64decode(audio_base64.split(",", 1)[-1], validate=False)
    except (binascii.Error, ValueError):
        raise _unreadable()
    if len(data) < 1000:  # a few hundred bytes is a header with no sound
        raise _unreadable()
    mime = (audio_mime or "").split(";")[0].strip().lower()
    if mime in NATIVE:
        return data, NATIVE[mime]
    return _to_wav(data), "audio/wav"


def _to_wav(data: bytes) -> bytes:
    # A temp file, not a pipe: mp4/m4a keep their index at the end of the file, which a pipe can't seek to.
    with tempfile.NamedTemporaryFile(delete=False) as f:
        f.write(data)
        src = f.name
    try:
        result = subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", src, "-t", str(MAX_SECONDS),
             "-ac", "1", "-ar", "16000", "-f", "wav", "pipe:1"],
            capture_output=True, timeout=60,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        log.error("ffmpeg failed to run: %s", exc)
        raise _unreadable()
    finally:
        os.unlink(src)
    if result.returncode != 0 or len(result.stdout) < 1000:
        log.warning("ffmpeg could not convert audio: %s", result.stderr.decode(errors="replace")[:300])
        raise _unreadable()
    return result.stdout
