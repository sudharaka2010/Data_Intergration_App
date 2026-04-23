from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SavedSelection(Base):
    __tablename__ = "saved_selections"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    session_id: Mapped[str] = mapped_column(ForeignKey("data_sessions.id"), index=True)
    selected_column_name: Mapped[str] = mapped_column(String(255))
    selected_box: Mapped[str] = mapped_column(String(20))
    selected_column_alpha: Mapped[str] = mapped_column(String(20))
    selected_row: Mapped[int] = mapped_column(Integer)
    target_language: Mapped[str] = mapped_column(String(50))
    skip_row_one: Mapped[bool] = mapped_column(Boolean, default=True)
    active_preview_kind: Mapped[str | None] = mapped_column(String(50), nullable=True)
    edited_headers_json: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    edited_preview_rows_json: Mapped[list[list[str]] | None] = mapped_column(JSON, nullable=True)
    edited_cell_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    session = relationship("DataSession", back_populates="saved_selections")
