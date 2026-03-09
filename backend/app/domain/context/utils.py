from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urlparse


def now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")


def collapse_whitespace(value: str) -> str:
    return " ".join(value.split()).strip()


def normalize_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return collapse_whitespace(value)


def normalize_loose_text(value: object) -> str:
    if value is None:
        return ""
    return collapse_whitespace(str(value))


def normalize_integer(value: object) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


def normalize_loose_string_array(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    normalized: list[str] = []
    for entry in value:
        item = normalize_loose_text(entry)
        if item:
            normalized.append(item)
    return normalized


def normalize_multi_value_text(value: object) -> str:
    if isinstance(value, str):
        return normalize_text(value)
    if isinstance(value, list):
        return ", ".join(item for item in (normalize_text(entry) for entry in value) if item)
    if isinstance(value, dict):
        return ", ".join(item for item in (normalize_text(entry) for entry in value.values()) if item)
    return ""


def nullable_text(value: str) -> str | None:
    normalized = value.strip()
    return normalized or None


def extract_email_domain(email: str) -> str | None:
    normalized = normalize_text(email).lower()
    if "@" not in normalized:
        return None
    _, domain = normalized.rsplit("@", 1)
    return domain or None


def extract_url_host(value: str) -> str | None:
    normalized = normalize_text(value)
    if not normalized:
        return None
    candidate = normalized if "://" in normalized else f"https://{normalized}"
    try:
        parsed = urlparse(candidate)
    except ValueError:
        return None
    return parsed.hostname.lower() if parsed.hostname else None


def posting_preference_text(hidden_identity: str) -> str:
    return {
        "1": "Display both my name and the company's name with the review",
        "2": "Only display my name with the review",
        "3": "Only display the company's name with the review",
        "4": "Don't display my name and the company's name with the review",
    }.get(hidden_identity, "")


def unix_seconds_to_iso(value: int | None) -> str | None:
    if value is None:
        return None
    return datetime.fromtimestamp(value, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def status_label(status_code: int | None) -> str:
    return {
        0: "Pending",
        1: "Published",
        2: "Rejected",
    }.get(status_code, "Unknown")


def strings_equal_loose(left: str, right: str) -> bool:
    def normalize(value: str) -> str:
        return "".join(char for char in value.lower() if char.isalnum())

    left_normalized = normalize(left)
    right_normalized = normalize(right)
    return bool(left_normalized) and left_normalized == right_normalized


def read_nullable_raw_text(value: object) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def read_nullable_raw_number(value: object) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
