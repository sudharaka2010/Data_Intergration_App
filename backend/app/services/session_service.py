from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.data_session import DataSession
from app.models.enums import UploadKind
from app.models.saved_selection import SavedSelection
from app.schemas.session import (
    SaveSelectionRequest,
    SessionSummary,
    TranslateRequest,
)


def create_session(db: Session, name: str | None = None) -> DataSession:
    session_name = name or _build_default_session_name()
    session_obj = DataSession(name=session_name, status="waiting_uploads")
    db.add(session_obj)
    db.commit()
    db.refresh(session_obj)
    return session_obj


def get_session_or_404(db: Session, session_id: str) -> DataSession:
    statement = (
        select(DataSession)
        .options(selectinload(DataSession.uploads))
        .where(DataSession.id == session_id)
    )
    session_obj = db.scalar(statement)
    if not session_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' was not found.",
        )

    return session_obj


def build_session_summary(session_obj: DataSession) -> SessionSummary:
    supplier_upload = _find_upload(session_obj, UploadKind.supplier)
    target_upload = _find_upload(session_obj, UploadKind.target)
    merged_columns = _merge_columns(
        supplier_upload.columns_json if supplier_upload else [],
        target_upload.columns_json if target_upload else [],
    )
    active_upload = supplier_upload or target_upload

    return SessionSummary(
        session_id=session_obj.id,
        status=session_obj.status,
        supplier_uploaded=supplier_upload is not None,
        target_uploaded=target_upload is not None,
        merged_columns=merged_columns,
        preview_headers=active_upload.columns_json if active_upload else [],
        preview_rows=active_upload.preview_rows_json if active_upload else [],
    )


def sync_session_status(session_obj: DataSession) -> None:
    supplier_upload = _find_upload(session_obj, UploadKind.supplier)
    target_upload = _find_upload(session_obj, UploadKind.target)

    if supplier_upload and target_upload:
        session_obj.status = "ready"
    elif supplier_upload or target_upload:
        session_obj.status = "partially_loaded"
    else:
        session_obj.status = "waiting_uploads"


def save_selection(
    db: Session,
    session_obj: DataSession,
    payload: SaveSelectionRequest,
) -> SavedSelection:
    selection = SavedSelection(
        session_id=session_obj.id,
        selected_column_name=payload.selected_column_name,
        selected_box=payload.selected_box,
        selected_column_alpha=payload.selected_column_alpha,
        selected_row=payload.selected_row,
        target_language=payload.target_language,
        skip_row_one=payload.skip_row_one,
        active_preview_kind=payload.active_preview_kind,
        edited_headers_json=payload.edited_headers,
        edited_preview_rows_json=payload.edited_preview_rows,
        edited_cell_count=payload.edited_cell_count,
    )
    session_obj.status = "selection_saved"
    session_obj.selected_language = payload.target_language

    db.add(selection)
    db.add(session_obj)
    db.commit()
    db.refresh(selection)
    return selection


def register_translation_request(
    db: Session,
    session_obj: DataSession,
    payload: TranslateRequest,
) -> None:
    session_obj.selected_language = payload.language
    if session_obj.status == "waiting_uploads":
        session_obj.status = "waiting_uploads"
    else:
        session_obj.status = "translation_ready"

    db.add(session_obj)
    db.commit()


def _find_upload(session_obj: DataSession, kind: UploadKind):
    return next((upload for upload in session_obj.uploads if upload.kind == kind), None)


def _merge_columns(*column_lists: list[str]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()

    for columns in column_lists:
        for column in columns:
            label = str(column)
            if label in seen:
                continue
            seen.add(label)
            merged.append(label)

    return merged


def _build_default_session_name() -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    return f"DATAC Session {now}"
