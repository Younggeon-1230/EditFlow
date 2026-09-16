import logging
import time
from uuid import uuid4

from fastapi import Request
from fastapi.responses import JSONResponse, Response


logger = logging.getLogger("editflow.http")
REQUEST_ID_HEADER = "X-Request-ID"


async def request_context_middleware(request: Request, call_next) -> Response:
    request_id = str(uuid4())
    request.state.request_id = request_id
    started_at = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as error:
        logger.error(
            "http_request_failed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": 500,
                "duration_ms": round(
                    (time.perf_counter() - started_at) * 1000,
                    2,
                ),
                "exception_type": type(error).__name__,
            },
        )
        raise

    response.headers[REQUEST_ID_HEADER] = request_id
    logger.info(
        "http_request",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
        },
    )
    return response


async def unexpected_exception_handler(
    request: Request,
    _error: Exception,
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid4()))
    return JSONResponse(
        status_code=500,
        headers={REQUEST_ID_HEADER: request_id},
        content={
            "detail": {
                "code": "internal_server_error",
                "message": "An unexpected error occurred.",
                "request_id": request_id,
            }
        },
    )
