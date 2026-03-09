from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

from app.core.config import get_settings
from app.core.logging import logger, setup_logging
from app.db.mongo import MongoManager


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    setup_logging(settings)
    logger.info("Starting backend application")
    app.state.mongo = MongoManager(settings)
    mongo_ok = app.state.mongo.ping()
    logger.info("MongoDB connection status: {status}", status="up" if mongo_ok else "down")
    yield
    logger.info("Shutting down backend application")
    app.state.mongo.close()


app = FastAPI(title="GoodFirms Backend", lifespan=lifespan)


@app.get("/")
def root() -> str:
    logger.debug("Root endpoint called")
    return "pong"


@app.get("/health")
def health(request: Request) -> dict[str, object]:
    mongo_manager: MongoManager = request.app.state.mongo
    mongo_ok = mongo_manager.ping()
    logger.info("Health check completed: mongodb={status}", status="up" if mongo_ok else "down")

    return {
        "status": "ok" if mongo_ok else "degraded",
        "services": {
            "mongodb": {
                "status": "up" if mongo_ok else "down",
            }
        },
    }
