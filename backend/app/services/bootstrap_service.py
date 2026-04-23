from __future__ import annotations

from sqlalchemy import inspect, select, text

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.market import Market
from app.models.user import User


DEFAULT_MARKETS = [
    {"code": "AU", "name": "Australia", "default_language": "English", "region": "Oceania"},
    {"code": "DK", "name": "Denmark", "default_language": "Danish", "region": "Europe"},
    {"code": "FI", "name": "Finland", "default_language": "Finnish", "region": "Europe"},
    {"code": "FR", "name": "France", "default_language": "French", "region": "Europe"},
    {"code": "DE", "name": "Germany", "default_language": "German", "region": "Europe"},
    {
        "code": "GB",
        "name": "United Kingdom",
        "default_language": "English",
        "region": "Europe",
    },
    {
        "code": "US",
        "name": "United States",
        "default_language": "English",
        "region": "North America",
    },
]


def initialize_application_data() -> None:
    settings.storage_directory.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _apply_lightweight_schema_updates()

    with SessionLocal() as db:
        _seed_markets(db)
        _seed_admin_user(db)


def _seed_markets(db) -> None:
    existing_codes = set(db.scalars(select(Market.code)).all())

    for market_data in DEFAULT_MARKETS:
        if market_data["code"] in existing_codes:
            continue

        db.add(Market(**market_data))

    db.commit()


def _seed_admin_user(db) -> None:
    existing_admin = db.scalar(
        select(User).where(
            (User.username == settings.seed_admin_username)
            | (User.email == settings.seed_admin_email)
        )
    )
    if existing_admin:
        return

    admin_user = User(
        username=settings.seed_admin_username,
        email=settings.seed_admin_email,
        password_hash=hash_password(settings.seed_admin_password),
        full_name=settings.seed_admin_full_name,
        is_active=True,
    )
    db.add(admin_user)
    db.commit()


def _apply_lightweight_schema_updates() -> None:
    inspector = inspect(engine)
    if "saved_selections" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("saved_selections")}
    column_sql = {
        "active_preview_kind": "ALTER TABLE saved_selections ADD COLUMN active_preview_kind VARCHAR(50)",
        "edited_headers_json": "ALTER TABLE saved_selections ADD COLUMN edited_headers_json JSON",
        "edited_preview_rows_json": "ALTER TABLE saved_selections ADD COLUMN edited_preview_rows_json JSON",
        "edited_cell_count": "ALTER TABLE saved_selections ADD COLUMN edited_cell_count INTEGER DEFAULT 0",
    }

    with engine.begin() as connection:
        for column_name, sql in column_sql.items():
            if column_name not in existing_columns:
                connection.execute(text(sql))
