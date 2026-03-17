from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / ".env"
PROJECT_ROOT = BASE_DIR.parent
EXPERIMENTS_ENV_PATH = PROJECT_ROOT / "experiments/.env"
DEFAULT_APP_ENV = "local"


@dataclass(frozen=True)
class MySQLSettings:
    host: str
    port: int
    user: str
    password: str
    database: str


@dataclass(frozen=True)
class OpenRouterSettings:
    api_key: str
    model: str
    base_url: str
    site_url: str | None
    app_name: str | None


@dataclass(frozen=True)
class SerpApiSettings:
    api_key: str
    base_url: str


@dataclass(frozen=True)
class HunterSettings:
    api_key: str
    base_url: str
    max_duration: int | None


@dataclass(frozen=True)
class ContactOutSettings:
    api_key: str
    base_url: str


@dataclass(frozen=True)
class ApolloSettings:
    api_key: str
    base_url: str


@dataclass(frozen=True)
class Settings:
    app_env: str
    mongodb_uri: str
    mysql: MySQLSettings
    postgres_dsn: str | None
    openrouter: OpenRouterSettings
    serpapi: SerpApiSettings | None
    hunter: HunterSettings | None
    contactout: ContactOutSettings | None
    apollo: ApolloSettings | None
    log_level: str
    cors_allowed_origins: tuple[str, ...]


def _load_environment() -> None:
    load_dotenv(ENV_PATH, override=False)
    load_dotenv(EXPERIMENTS_ENV_PATH, override=False)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    _load_environment()

    app_env = _resolve_app_env()
    mongodb_uri = os.getenv("MONGODB_URI", "").strip()
    if not mongodb_uri:
        raise RuntimeError("Missing MONGODB_URI in backend/.env")

    log_level = os.getenv("LOG_LEVEL", "INFO").strip().upper() or "INFO"

    return Settings(
        app_env=app_env,
        mongodb_uri=mongodb_uri,
        mysql=_resolve_mysql_settings(app_env),
        postgres_dsn=_resolve_postgres_dsn(),
        openrouter=_resolve_openrouter_settings(),
        serpapi=_resolve_serpapi_settings(),
        hunter=_resolve_hunter_settings(),
        contactout=_resolve_contactout_settings(),
        apollo=_resolve_apollo_settings(),
        log_level=log_level,
        cors_allowed_origins=_resolve_cors_allowed_origins(),
    )


def _resolve_app_env() -> str:
    raw_value = (
        os.getenv("APP_ENV")
        or os.getenv("ENVIRONMENT")
        or os.getenv("ENV")
        or DEFAULT_APP_ENV
    )
    return raw_value.strip().lower() or DEFAULT_APP_ENV


def _resolve_mysql_settings(app_env: str) -> MySQLSettings:
    env_prefix = "PROD" if app_env in {"prod", "production"} else "LOCAL"

    return (
        _read_mysql_settings_from_env(prefix=env_prefix)
        or _read_mysql_settings_from_env(prefix=None)
        or _read_local_mysql_settings_from_project_files(app_env)
        or _raise_missing_mysql_config(app_env)
    )


def _read_mysql_settings_from_env(prefix: str | None) -> MySQLSettings | None:
    prefix_text = f"MYSQL_{prefix}_" if prefix else "MYSQL_"
    host = _read_optional_env(f"{prefix_text}HOST")
    port = _read_optional_env(f"{prefix_text}PORT")
    user = _read_optional_env(f"{prefix_text}USER")
    password = _read_optional_env(f"{prefix_text}PASS")
    database = _read_optional_env(f"{prefix_text}DB")

    if not all((host, port, user, password, database)):
        return None

    return MySQLSettings(
        host=host,
        port=int(port),
        user=user,
        password=password,
        database=database,
    )


def _read_local_mysql_settings_from_project_files(app_env: str) -> MySQLSettings | None:
    if app_env in {"prod", "production"}:
        return None

    return _read_mysql_settings_from_mcp_json() or _read_mysql_settings_from_codex_toml()


def _read_mysql_settings_from_mcp_json() -> MySQLSettings | None:
    mcp_config_path = PROJECT_ROOT / ".mcp.json"
    if not mcp_config_path.exists():
        return None

    try:
        document = json.loads(mcp_config_path.read_text())
    except (OSError, json.JSONDecodeError):
        return None

    servers = document.get("mcpServers")
    if not isinstance(servers, dict):
        return None

    server = servers.get("Prod-goodfirms-mysql")
    if not isinstance(server, dict):
        return None

    env = server.get("env")
    if not isinstance(env, dict):
        return None

    return _read_mysql_settings_from_mapping(env)


def _read_mysql_settings_from_codex_toml() -> MySQLSettings | None:
    config_path = Path(os.getenv("MYSQL_CONFIG_TOML_PATH", Path.home() / ".codex/config.toml"))
    if not config_path.exists():
        return None

    try:
        lines = config_path.read_text().splitlines()
    except OSError:
        return None

    section_names = {
        "[mcp_servers.dumped-goodfirms-mysql.env]",
        "[mcp_servers.Prod-goodfirms-mysql.env]",
    }
    start_index = next((index for index, line in enumerate(lines) if line.strip() in section_names), -1)
    if start_index < 0:
        return None

    entries: dict[str, str] = {}
    for raw_line in lines[start_index + 1 :]:
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("["):
            break

        key, separator, raw_value = line.partition("=")
        if not separator:
            continue

        value = raw_value.strip().strip('"').strip("'")
        entries[key.strip()] = value

    return _read_mysql_settings_from_mapping(entries)


def _read_mysql_settings_from_mapping(values: dict[str, object]) -> MySQLSettings | None:
    host = _normalized_mapping_value(values, "MYSQL_HOST")
    port = _normalized_mapping_value(values, "MYSQL_PORT")
    user = _normalized_mapping_value(values, "MYSQL_USER")
    password = _normalized_mapping_value(values, "MYSQL_PASS")
    database = _normalized_mapping_value(values, "MYSQL_DB")

    if not all((host, port, user, password, database)):
        return None

    return MySQLSettings(
        host=host,
        port=int(port),
        user=user,
        password=password,
        database=database,
    )


def _normalized_mapping_value(values: dict[str, object], key: str) -> str | None:
    raw_value = values.get(key)
    if raw_value is None:
        return None

    normalized = str(raw_value).strip()
    return normalized or None


def _read_optional_env(name: str) -> str | None:
    value = os.getenv(name, "").strip()
    return value or None


def _resolve_openrouter_settings() -> OpenRouterSettings:
    api_key = _read_optional_env("OPENROUTER_API_KEY")
    model = _read_optional_env("OPENROUTER_MODEL")

    if not api_key:
        raise RuntimeError("Missing OPENROUTER_API_KEY in backend/.env")
    if not model:
        raise RuntimeError("Missing OPENROUTER_MODEL in backend/.env")

    return OpenRouterSettings(
        api_key=api_key,
        model=model,
        base_url=_read_optional_env("OPENROUTER_BASE_URL") or "https://openrouter.ai/api/v1",
        site_url=_read_optional_env("OPENROUTER_SITE_URL"),
        app_name=_read_optional_env("OPENROUTER_APP_NAME"),
    )


def _resolve_serpapi_settings() -> SerpApiSettings | None:
    api_key = _read_optional_env("SERP_API_KEY") or _read_optional_env("SERP_API")
    if not api_key:
        return None

    return SerpApiSettings(
        api_key=api_key,
        base_url=_read_optional_env("SERP_API_BASE_URL") or "https://serpapi.com/search.json",
    )


def _resolve_hunter_settings() -> HunterSettings | None:
    api_key = _read_optional_env("HUNTER_API_KEY") or _read_optional_env("HUNTER_API")
    if not api_key:
        return None

    max_duration_text = _read_optional_env("HUNTER_MAX_DURATION")
    max_duration = int(max_duration_text) if max_duration_text else None
    return HunterSettings(
        api_key=api_key,
        base_url=_read_optional_env("HUNTER_API_BASE_URL") or "https://api.hunter.io/v2/email-finder",
        max_duration=max_duration,
    )


def _resolve_contactout_settings() -> ContactOutSettings | None:
    api_key = _read_optional_env("CONTACTOUT_API_KEY")
    if not api_key:
        return None

    return ContactOutSettings(
        api_key=api_key,
        base_url=_read_optional_env("CONTACTOUT_API_BASE_URL")
        or "https://api.contactout.com/v1/linkedin/enrich",
    )


def _resolve_apollo_settings() -> ApolloSettings | None:
    api_key = _read_optional_env("APOLLO_API_KEY")
    if not api_key:
        return None

    return ApolloSettings(
        api_key=api_key,
        base_url=_read_optional_env("APOLLO_API_BASE_URL")
        or "https://api.apollo.io/api/v1/people/match",
    )


def _raise_missing_mysql_config(app_env: str) -> MySQLSettings:
    raise RuntimeError(
        "Missing MySQL config for backend. "
        f"Resolved APP_ENV='{app_env}'. "
        "Set MYSQL_LOCAL_* for local/dev, MYSQL_PROD_* for production, or MYSQL_* as a shared fallback."
    )


def _resolve_postgres_dsn() -> str | None:
    return _read_optional_env("POSTGRES_DSN") or _read_optional_env("DATABASE_URL")


def _resolve_cors_allowed_origins() -> tuple[str, ...]:
    raw_value = _read_optional_env("CORS_ALLOWED_ORIGINS")
    if not raw_value:
        return ()

    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "Invalid CORS_ALLOWED_ORIGINS in backend/.env. "
            'Expected a JSON array of strings, for example ["http://localhost:5173"].'
        ) from exc

    if not isinstance(parsed, list) or not all(isinstance(origin, str) for origin in parsed):
        raise RuntimeError(
            "Invalid CORS_ALLOWED_ORIGINS in backend/.env. "
            'Expected a JSON array of strings, for example ["http://localhost:5173"].'
        )

    return tuple(origin.strip() for origin in parsed if origin.strip())
