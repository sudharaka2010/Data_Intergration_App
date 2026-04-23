from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.services.bootstrap_service import initialize_application_data


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_application_data()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)
app.mount("/assets", StaticFiles(directory=str(settings.frontend_directory / "assets")), name="assets")
app.mount("/downloads", StaticFiles(directory=str(settings.storage_directory)), name="downloads")


@app.get("/", include_in_schema=False)
async def serve_frontend() -> FileResponse:
    return FileResponse(settings.frontend_index_file)
