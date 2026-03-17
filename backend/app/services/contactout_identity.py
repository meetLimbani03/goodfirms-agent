from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import ContactOutSettings
from app.core.logging import logger


@dataclass(frozen=True)
class ContactOutIdentityResult:
    status: str
    reason: str
    primary_email: str | None = None
    work_emails: list[str] | None = None
    personal_emails: list[str] | None = None
    linkedin_url: str | None = None
    full_name: str | None = None
    title: str | None = None
    company: str | None = None


class ContactOutIdentityService:
    def __init__(self, settings: ContactOutSettings | None) -> None:
        self._settings = settings

    @property
    def enabled(self) -> bool:
        return self._settings is not None

    def lookup(
        self,
        *,
        full_name: str,
        signup_email: str,
        linkedin_url: str,
        company_name: str,
        company_website: str,
    ) -> ContactOutIdentityResult:
        logger.info(
            "contactout_lookup_started full_name={full_name} company_name={company_name}",
            full_name=" ".join(full_name.strip().split()) or "not_provided",
            company_name=" ".join(company_name.strip().split()) or "not_provided",
        )
        if not self._settings:
            logger.warning("contactout_lookup_skipped_not_configured")
            return ContactOutIdentityResult(
                status="not_configured",
                reason="ContactOut verification is not configured in the backend.",
            )

        normalized_linkedin_url = " ".join(linkedin_url.strip().split())
        if not normalized_linkedin_url:
            logger.warning("contactout_lookup_skipped_not_enough_inputs")
            return ContactOutIdentityResult(
                status="not_enough_inputs",
                reason="A LinkedIn profile URL is required for ContactOut verification.",
            )

        try:
            response = httpx.get(
                self._settings.base_url,
                params={"profile": normalized_linkedin_url},
                headers={
                    "token": self._settings.api_key,
                    "User-Agent": "goodfirms-backend/contactout-identity",
                    "Accept": "application/json",
                },
                timeout=20.0,
            )
            logger.info(
                "contactout_lookup_http_response status_code={status_code}",
                status_code=response.status_code,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            result = self._map_http_status_error(exc)
            logger.warning(
                "contactout_lookup_http_status_mapped status={status} reason={reason}",
                status=result.status,
                reason=result.reason,
            )
            return result
        except httpx.HTTPError as exc:
            logger.warning("contactout_lookup_transport_error error={error}", error=str(exc))
            return ContactOutIdentityResult(
                status="lookup_error",
                reason=str(exc),
            )

        payload = response.json()
        profile_payload = payload.get("profile") if isinstance(payload, dict) else None
        if not isinstance(profile_payload, dict):
            logger.warning("contactout_lookup_unexpected_payload_shape")
            return ContactOutIdentityResult(
                status="lookup_error",
                reason="ContactOut returned an unexpected response format.",
            )

        work_emails = self._read_email_values(profile_payload, "work_email")
        personal_emails = self._read_email_values(profile_payload, "personal_email")
        primary_email = self._first_non_empty(*work_emails, *personal_emails)
        linkedin_profile_url = self._read_linkedin_url(profile_payload, normalized_linkedin_url)

        if self._looks_like_sample_response(
            linkedin_url=linkedin_profile_url,
            work_emails=work_emails,
            personal_emails=personal_emails,
        ):
            logger.warning("contactout_lookup_sample_response_detected")
            return ContactOutIdentityResult(
                status="sample_response_detected",
                reason=(
                    "ContactOut returned what appears to be a sample/demo payload rather than real enrichment data. "
                    "Treat this as an external verification limitation."
                ),
                primary_email=primary_email,
                work_emails=work_emails,
                personal_emails=personal_emails,
                linkedin_url=linkedin_profile_url,
                full_name=self._text(profile_payload.get("name")) or normalized_name(full_name),
                title=self._text(profile_payload.get("title")),
                company=self._text(profile_payload.get("company")),
            )

        if not primary_email:
            logger.info("contactout_lookup_completed_no_email")
            return ContactOutIdentityResult(
                status="no_email_found",
                reason="ContactOut did not return a work or personal email for this LinkedIn profile.",
                linkedin_url=linkedin_profile_url,
                full_name=self._text(profile_payload.get("name")) or normalized_name(full_name),
                title=self._text(profile_payload.get("title")),
                company=self._text(profile_payload.get("company")),
            )

        signup_email_normalized = self._normalize_email(signup_email)
        all_emails_normalized = {self._normalize_email(value) for value in [*work_emails, *personal_emails] if value}
        email_match = bool(signup_email_normalized and signup_email_normalized in all_emails_normalized)
        logger.info(
            "contactout_lookup_completed status={status} primary_email={primary_email} work_email_count={work_count} personal_email_count={personal_count}",
            status="email_match" if email_match else "email_mismatch",
            primary_email=primary_email,
            work_count=len(work_emails),
            personal_count=len(personal_emails),
        )
        return ContactOutIdentityResult(
            status="email_match" if email_match else "email_mismatch",
            reason=(
                "ContactOut returned an email that matches the GoodFirms signup email."
                if email_match
                else "ContactOut returned work/personal email data that does not match the GoodFirms signup email."
            ),
            primary_email=primary_email,
            work_emails=work_emails,
            personal_emails=personal_emails,
            linkedin_url=linkedin_profile_url,
            full_name=self._text(profile_payload.get("name")) or normalized_name(full_name),
            title=self._text(profile_payload.get("title")),
            company=self._text(profile_payload.get("company")),
        )

    def _map_http_status_error(self, exc: httpx.HTTPStatusError) -> ContactOutIdentityResult:
        response = exc.response
        status_code = response.status_code
        reason = self._read_error_details(response)

        if status_code == 400:
            return ContactOutIdentityResult(status="invalid_lookup_input", reason=reason or "ContactOut rejected the request input.")
        if status_code == 401:
            return ContactOutIdentityResult(status="lookup_unauthorized", reason=reason or "ContactOut credentials were rejected.")
        if status_code == 402:
            return ContactOutIdentityResult(status="lookup_quota_exceeded", reason=reason or "ContactOut credits are exhausted.")
        if status_code == 404:
            return ContactOutIdentityResult(status="no_email_found", reason=reason or "ContactOut found no data for this LinkedIn profile.")
        if status_code == 429:
            return ContactOutIdentityResult(status="lookup_rate_limited", reason=reason or "ContactOut rate limit reached.")
        if 500 <= status_code <= 599:
            return ContactOutIdentityResult(status="lookup_provider_error", reason=reason or "ContactOut provider error.")
        return ContactOutIdentityResult(status="lookup_error", reason=reason or str(exc))

    def _read_email_values(self, payload: dict[str, Any], key: str) -> list[str]:
        value = payload.get(key)
        if isinstance(value, list):
            return [self._text(item) for item in value if self._text(item)]
        text = self._text(value)
        return [text] if text else []

    def _read_linkedin_url(self, payload: dict[str, Any], fallback_url: str) -> str:
        url_value = payload.get("url")
        if isinstance(url_value, str):
            text = self._text(url_value)
            if text:
                return text
        return fallback_url

    def _looks_like_sample_response(
        self,
        *,
        linkedin_url: str,
        work_emails: list[str],
        personal_emails: list[str],
    ) -> bool:
        lowered_url = linkedin_url.lower()
        all_emails = [*work_emails, *personal_emails]
        if "example-person" in lowered_url:
            return True
        return any(email.lower().endswith("@example.com") for email in all_emails)

    def _read_error_details(self, response: httpx.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            return response.text.strip()

        if isinstance(payload, dict):
            for key in ("message", "error", "detail"):
                text = self._text(payload.get(key))
                if text:
                    return text
        return response.text.strip()

    def _normalize_email(self, value: str | None) -> str:
        if not value:
            return ""
        return value.strip().lower()

    def _first_non_empty(self, *values: str) -> str | None:
        for value in values:
            text = self._text(value)
            if text:
                return text
        return None

    def _text(self, value: Any) -> str:
        if value is None:
            return ""
        return " ".join(str(value).strip().split())


def normalized_name(value: str) -> str:
    return " ".join(value.strip().split())
