from __future__ import annotations

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import PyMongoError

from app.core.config import Settings
from app.core.logging import logger


class MongoManager:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: MongoClient | None = None

    @property
    def client(self) -> MongoClient:
        if self._client is None:
            logger.info("Creating MongoDB client")
            self._client = MongoClient(self._settings.mongodb_uri)

        return self._client

    def database(self, name: str) -> Database:
        return self.client[name]

    def ping(self) -> bool:
        logger.info("Attempting MongoDB ping")
        try:
            self.client.admin.command("ping")
        except PyMongoError as exc:
            logger.error("MongoDB ping failed: {error}", error=str(exc))
            return False

        logger.info("MongoDB ping succeeded")
        return True

    def close(self) -> None:
        if self._client is not None:
            logger.info("Closing MongoDB client")
            self._client.close()
            self._client = None
