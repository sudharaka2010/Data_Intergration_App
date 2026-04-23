from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.market import Market
from app.schemas.market import MarketOut


router = APIRouter()


@router.get("", response_model=list[MarketOut])
def list_markets(db: Session = Depends(get_db)) -> list[MarketOut]:
    markets = db.scalars(select(Market).order_by(Market.name.asc())).all()
    return [MarketOut.model_validate(market) for market in markets]
