from pathlib import Path, PurePosixPath

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles


BACKEND_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]


class SPAStaticFiles(StaticFiles):
    """Serve built files and fall back to index.html for client-side routes."""

    async def get_response(self, path: str, scope: dict) -> Response:
        # StaticFiles already confines file resolution to its configured directory.
        # Avoid turning an explicit traversal attempt into a successful SPA response.
        if ".." in PurePosixPath(path).parts:
            return Response(status_code=404)

        try:
            return await super().get_response(path, scope)
        except HTTPException as error:
            if error.status_code != 404:
                raise
        return await super().get_response("index.html", scope)


def install_production_frontend(app: FastAPI, dist_dir: Path) -> None:
    """Install backend namespace guards and the final catch-all SPA mount."""

    index_path = dist_dir / "index.html"
    if not index_path.is_file():
        raise RuntimeError(
            "Production frontend build is missing: expected "
            f"{index_path}. Run the Vite build before starting FastAPI."
        )

    def backend_not_found() -> JSONResponse:
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    # These guards must be registered after real backend routes and before the SPA
    # mount so an unknown backend URL can never become an HTML response.
    app.add_api_route(
        "/api",
        backend_not_found,
        methods=BACKEND_METHODS,
        include_in_schema=False,
    )
    app.add_api_route(
        "/api/{path:path}",
        backend_not_found,
        methods=BACKEND_METHODS,
        include_in_schema=False,
    )
    app.add_api_route(
        "/health/{path:path}",
        backend_not_found,
        methods=BACKEND_METHODS,
        include_in_schema=False,
    )
    app.mount(
        "/",
        SPAStaticFiles(directory=dist_dir, html=False, check_dir=True),
        name="production-frontend",
    )
