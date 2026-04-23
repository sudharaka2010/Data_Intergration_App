from fastapi import APIRouter

from app.api.routes import auth, health, markets, sessions, uploads


api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(markets.router, prefix="/markets", tags=["Markets"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["Sessions"])
api_router.include_router(uploads.router, prefix="/sessions", tags=["Uploads"])
