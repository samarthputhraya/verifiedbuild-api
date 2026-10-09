"""One error shape for every failure: {"error": {"code": ..., "message": ...}}.

`message` is shown to users as-is, so it must be plain English.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("verifiedbuild")


class ApiError(Exception):
    """Raise this anywhere in the app to return a contract-shaped error."""

    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def error_response(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status)


async def _api_error(request: Request, exc: ApiError) -> JSONResponse:
    return error_response(exc.code, exc.message, exc.status)


def _validation_message(exc: RequestValidationError) -> str:
    errors = exc.errors()
    if not errors:
        return "Some of the request fields are wrong."
    first = errors[0]
    if first.get("type") == "json_invalid":
        return "The request body isn't valid JSON."
    field = ".".join(str(p) for p in first.get("loc", ()) if p != "body")
    if not field:
        return "The request needs a JSON body."
    return f"Please check '{field}': {first.get('msg', 'invalid value')}."


async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    return error_response("VALIDATION", _validation_message(exc), 422)


_HTTP_ERRORS = {
    404: ("NOT_FOUND", "We couldn't find that."),
    405: ("METHOD_NOT_ALLOWED", "That action isn't supported here."),
}


async def _http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code, message = _HTTP_ERRORS.get(exc.status_code, ("HTTP_ERROR", str(exc.detail)))
    return error_response(code, message, exc.status_code)


async def _catch_unhandled(request: Request, call_next):
    # Runs inside CORSMiddleware, so even a crash returns a response the browser can read.
    try:
        return await call_next(request)
    except Exception:
        log.exception("Unhandled error on %s %s", request.method, request.url.path)
        return error_response("INTERNAL", "Something went wrong on our side. Please try again.", 500)


def register(app: FastAPI) -> None:
    """Call before adding CORSMiddleware, so CORS wraps the catch-all."""
    app.add_exception_handler(ApiError, _api_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.middleware("http")(_catch_unhandled)
