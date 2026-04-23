from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    name: str | None = Field(default=None, max_length=120)


class SessionResponse(BaseModel):
    id: str
    name: str
    status: str
    selected_language: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SessionSummary(BaseModel):
    session_id: str
    status: str
    supplier_uploaded: bool
    target_uploaded: bool
    merged_columns: list[str]
    preview_headers: list[str]
    preview_rows: list[list[str]]


class SaveSelectionRequest(BaseModel):
    selected_column_name: str
    selected_box: str
    selected_column_alpha: str
    selected_row: int
    target_language: str
    skip_row_one: bool = True
    active_preview_kind: str | None = None
    edited_headers: list[str] = Field(default_factory=list)
    edited_preview_rows: list[list[str]] = Field(default_factory=list)
    edited_cell_count: int = 0


class SaveSelectionResponse(BaseModel):
    message: str
    selection_id: str


class TranslateRequest(BaseModel):
    language: str


class TranslateResponse(BaseModel):
    message: str
    language: str
