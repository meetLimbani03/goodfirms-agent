from __future__ import annotations

import pymysql
from pymysql.connections import Connection
from pymysql.cursors import DictCursor
from pymysql.err import MySQLError

from app.core.config import Settings
from app.core.logging import logger


class MySQLManager:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._connection: Connection | None = None

    @property
    def connection(self) -> Connection:
        if self._connection is None:
            logger.info("Creating MySQL connection")
            self._connection = pymysql.connect(
                host=self._settings.mysql.host,
                port=self._settings.mysql.port,
                user=self._settings.mysql.user,
                password=self._settings.mysql.password,
                database=self._settings.mysql.database,
                charset="utf8mb4",
                cursorclass=DictCursor,
                autocommit=True,
                connect_timeout=5,
                read_timeout=5,
                write_timeout=5,
            )

        return self._connection

    def ping(self) -> bool:
        logger.info("Attempting MySQL ping")
        try:
            self.connection.ping(reconnect=True)
            with self.connection.cursor() as cursor:
                cursor.execute("SELECT 1 AS ok")
                cursor.fetchone()
        except MySQLError as exc:
            logger.error("MySQL ping failed: {error}", error=str(exc))
            return False

        logger.info("MySQL ping succeeded")
        return True

    def close(self) -> None:
        if self._connection is not None:
            logger.info("Closing MySQL connection")
            self._connection.close()
            self._connection = None
