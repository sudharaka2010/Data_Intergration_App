from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.models.enums import UploadKind
from app.schemas.session import SessionSummary


class UploadResponse(BaseModel):
    upload_id: str
    session_id: str
    kind: UploadKind
    market_code: str
    market_name: str
    filename: str
    file_type: str
    total_rows: int
    total_columns: int
    columns: list[str]
    preview_headers: list[str]
    preview_rows: list[list[str]]
    download_path: str
    created_at: datetime
    session_summary: SessionSummary
