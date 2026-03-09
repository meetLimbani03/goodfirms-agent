from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / ".env"


@dataclass(frozen=True)
class Settings:
    mongodb_uri: str
    log_level: str


def _load_environment() -> None:
    load_dotenv(ENV_PATH, override=False)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    _load_environment()

    mongodb_uri = os.getenv("MONGODB_URI", "").strip()
    if not mongodb_uri:
        raise RuntimeError("Missing MONGODB_URI in backend/.env")

    log_level = os.getenv("LOG_LEVEL", "INFO").strip().upper() or "INFO"

    return Settings(
        mongodb_uri=mongodb_uri,
        log_level=log_level,
    )
