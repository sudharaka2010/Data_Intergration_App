from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.data_session import DataSession
from app.models.data_upload import DataUpload
from app.models.enums import UploadKind
from app.models.market import Market
from app.schemas.upload import UploadResponse
from app.services.session_service import build_session_summary, get_session_or_404, sync_session_status
from app.utils.file_parser import parse_tabular_file


async def store_upload(
    db: Session,
    session_id: str,
    kind: UploadKind,
    market_code: str,
    file: UploadFile,
) -> UploadResponse:
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A file is required for upload.",
        )

    session_obj = get_session_or_404(db, session_id)
    session_obj = db.scalar(
        select(DataSession)
        .options(selectinload(DataSession.uploads))
        .where(DataSession.id == session_obj.id)
    )
    market = db.scalar(select(Market).where(Market.code == market_code.upper()))
    if not market:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Market code '{market_code}' is not valid.",
        )

    raw_bytes = await file.read()
    try:
        parsed_file = parse_tabular_file(filename=file.filename, raw_bytes=raw_bytes)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    stored_filename = _build_stored_filename(file.filename, kind)
    stored_path = settings.storage_directory / stored_filename
    stored_path.write_bytes(raw_bytes)

    existing_upload = db.scalar(
        select(DataUpload).where(DataUpload.session_id == session_obj.id, DataUpload.kind == kind)
    )
    if existing_upload:
        _delete_existing_file(existing_upload.stored_filename)
        db.delete(existing_upload)
        db.flush()

    upload_record = DataUpload(
        session_id=session_obj.id,
        market_id=market.id,
        kind=kind,
        original_filename=file.filename,
        stored_filename=stored_filename,
        file_type=parsed_file.file_type,
        total_rows=parsed_file.total_rows,
        total_columns=parsed_file.total_columns,
        columns_json=parsed_file.columns,
        preview_rows_json=parsed_file.preview_rows,
    )
    db.add(upload_record)
    db.flush()
    db.refresh(session_obj)
    session_obj = db.scalar(
        select(DataSession)
        .options(selectinload(DataSession.uploads))
        .where(DataSession.id == session_obj.id)
    )
    sync_session_status(session_obj)
    db.add(session_obj)
    db.commit()
    db.refresh(upload_record)
    db.refresh(session_obj)
    session_obj = db.scalar(
        select(DataSession)
        .options(selectinload(DataSession.uploads))
        .where(DataSession.id == session_obj.id)
    )

    return UploadResponse(
        upload_id=upload_record.id,
        session_id=session_obj.id,
        kind=upload_record.kind,
        market_code=market.code,
        market_name=market.name,
        filename=upload_record.original_filename,
        file_type=upload_record.file_type,
        total_rows=upload_record.total_rows,
        total_columns=upload_record.total_columns,
        columns=upload_record.columns_json,
        preview_headers=upload_record.columns_json,
        preview_rows=upload_record.preview_rows_json,
        download_path=f"/downloads/{upload_record.stored_filename}",
        created_at=upload_record.created_at,
        session_summary=build_session_summary(session_obj),
    )


def _build_stored_filename(original_filename: str, kind: UploadKind) -> str:
    suffix = Path(original_filename).suffix.lower()
    return f"{kind.value}_{uuid4().hex}{suffix}"


def _delete_existing_file(stored_filename: str) -> None:
    file_path = settings.storage_directory / stored_filename
    if file_path.exists():
        file_path.unlink()
