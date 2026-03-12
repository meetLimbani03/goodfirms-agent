from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings
from app.core.logging import logger


class PostgresManager:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._engine: Engine | None = None
        self._session_factory: sessionmaker[Session] | None = None

    @property
    def configured(self) -> bool:
        return bool(self._settings.postgres_dsn)

    @property
    def engine(self) -> Engine:
        if not self._settings.postgres_dsn:
            raise RuntimeError("PostgreSQL is not configured. Set POSTGRES_DSN in backend/.env")

        if self._engine is None:
            logger.info("Creating PostgreSQL engine")
            self._engine = create_engine(
                self._settings.postgres_dsn,
                pool_pre_ping=True,
                future=True,
            )

        return self._engine

    @property
    def session_factory(self) -> sessionmaker[Session]:
        if self._session_factory is None:
            self._session_factory = sessionmaker(
                bind=self.engine,
                autoflush=False,
                autocommit=False,
                expire_on_commit=False,
                future=True,
            )

        return self._session_factory

    @contextmanager
    def session(self) -> Iterator[Session]:
        session = self.session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def ping(self) -> bool:
        if not self.configured:
            logger.warning("PostgreSQL ping skipped: POSTGRES_DSN not configured")
            return False

        logger.info("Attempting PostgreSQL ping")
        try:
            with self.engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except SQLAlchemyError as exc:
            logger.error("PostgreSQL ping failed: {error}", error=str(exc))
            return False

        logger.info("PostgreSQL ping succeeded")
        return True

    def close(self) -> None:
        if self._engine is not None:
            logger.info("Disposing PostgreSQL engine")
            self._engine.dispose()
            self._engine = None
            self._session_factory = None
