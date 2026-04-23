from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.session import (
    SaveSelectionRequest,
    SaveSelectionResponse,
    SessionCreate,
    SessionResponse,
    SessionSummary,
    TranslateRequest,
    TranslateResponse,
)
from app.services.session_service import (
    build_session_summary,
    create_session,
    get_session_or_404,
    register_translation_request,
    save_selection,
)


router = APIRouter()


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_data_session(
    payload: SessionCreate | None = None,
    db: Session = Depends(get_db),
) -> SessionResponse:
    session_obj = create_session(db, name=payload.name if payload else None)
    return SessionResponse.model_validate(session_obj)


@router.get("/{session_id}/summary", response_model=SessionSummary)
def get_data_session_summary(session_id: str, db: Session = Depends(get_db)) -> SessionSummary:
    session_obj = get_session_or_404(db, session_id)
    return build_session_summary(session_obj)


@router.post(
    "/{session_id}/selections",
    response_model=SaveSelectionResponse,
    status_code=status.HTTP_201_CREATED,
)
def save_data_selection(
    session_id: str,
    payload: SaveSelectionRequest,
    db: Session = Depends(get_db),
) -> SaveSelectionResponse:
    session_obj = get_session_or_404(db, session_id)
    selection = save_selection(db, session_obj, payload)
    return SaveSelectionResponse(
        message="Selection saved successfully.",
        selection_id=selection.id,
    )


@router.post("/{session_id}/translate-preview", response_model=TranslateResponse)
def request_translation_preview(
    session_id: str,
    payload: TranslateRequest,
    db: Session = Depends(get_db),
) -> TranslateResponse:
    session_obj = get_session_or_404(db, session_id)
    register_translation_request(db, session_obj, payload)
    return TranslateResponse(
        message=f"Translation preview prepared for {payload.language}.",
        language=payload.language,
    )
