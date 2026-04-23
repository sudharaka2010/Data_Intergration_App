from __future__ import annotations

from pydantic import BaseModel


class MarketOut(BaseModel):
    id: int
    code: str
    name: str
    default_language: str
    region: str

    model_config = {"from_attributes": True}
