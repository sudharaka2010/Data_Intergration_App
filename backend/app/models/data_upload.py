from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import UploadKind


class DataUpload(Base):
    __tablename__ = "data_uploads"
    __table_args__ = (UniqueConstraint("session_id", "kind", name="uq_session_kind"),)

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    session_id: Mapped[str] = mapped_column(ForeignKey("data_sessions.id"), index=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.id"))
    kind: Mapped[UploadKind] = mapped_column(Enum(UploadKind, name="upload_kind"))
    original_filename: Mapped[str] = mapped_column(String(255))
    stored_filename: Mapped[str] = mapped_column(String(255), unique=True)
    file_type: Mapped[str] = mapped_column(String(20))
    total_rows: Mapped[int] = mapped_column(Integer)
    total_columns: Mapped[int] = mapped_column(Integer)
    columns_json: Mapped[list[str]] = mapped_column(JSON)
    preview_rows_json: Mapped[list[list[str]]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    session = relationship("DataSession", back_populates="uploads")
    market = relationship("Market", back_populates="uploads")
