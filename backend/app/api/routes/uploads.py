from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.enums import UploadKind
from app.schemas.upload import UploadResponse
from app.services.upload_service import store_upload


router = APIRouter()


@router.post(
    "/{session_id}/uploads/{kind}",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_session_file(
    session_id: str,
    kind: UploadKind,
    market_code: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> UploadResponse:
    return await store_upload(
        db=db,
        session_id=session_id,
        kind=kind,
        market_code=market_code,
        file=file,
    )
