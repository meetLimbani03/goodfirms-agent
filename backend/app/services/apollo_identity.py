from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import httpx

from app.core.config import ApolloSettings
from app.core.logging import logger


@dataclass(frozen=True)
class ApolloIdentityResult:
    status: str
    reason: str
    primary_email: str | None = None
    work_email: str | None = None
    personal_emails: list[str] | None = None
    linkedin_url: str | None = None
    full_name: str | None = None
    title: str | None = None
    company: str | None = None


class ApolloIdentityService:
    def __init__(self, settings: ApolloSettings | None) -> None:
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
    ) -> ApolloIdentityResult:
        logger.info(
            "apollo_lookup_started full_name={full_name} company_name={company_name}",
            full_name=" ".join(full_name.strip().split()) or "not_provided",
            company_name=" ".join(company_name.strip().split()) or "not_provided",
        )
        if not self._settings:
            logger.warning("apollo_lookup_skipped_not_configured")
            return ApolloIdentityResult(
                status="not_configured",
                reason="Apollo verification is not configured in the backend.",
            )

        normalized_name = " ".join(full_name.strip().split())
        normalized_linkedin_url = " ".join(linkedin_url.strip().split())
        organization_domain = self._extract_host(company_website)
        first_name, last_name = self._split_name(normalized_name)

        params: dict[str, Any] = {"reveal_personal_emails": "true"}
        if normalized_linkedin_url:
            params["linkedin_url"] = normalized_linkedin_url
        if normalized_name:
            params["name"] = normalized_name
        if first_name:
            params["first_name"] = first_name
        if last_name:
            params["last_name"] = last_name
        if organization_domain:
            params["organization_domain"] = organization_domain
        elif company_name.strip():
            params["organization_name"] = " ".join(company_name.strip().split())

        if "linkedin_url" not in params and not (first_name and last_name and ("organization_domain" in params or "organization_name" in params)):
            logger.warning("apollo_lookup_skipped_not_enough_inputs")
            return ApolloIdentityResult(
                status="not_enough_inputs",
                reason="Apollo needs a LinkedIn URL or a full name with organization information.",
            )

        try:
            response = httpx.post(
                self._settings.base_url,
                params=params,
                headers={
                    "X-Api-Key": self._settings.api_key,
                    "User-Agent": "goodfirms-backend/apollo-identity",
                    "Accept": "application/json",
                },
                timeout=20.0,
            )
            logger.info("apollo_lookup_http_response status_code={status_code}", status_code=response.status_code)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            result = self._map_http_status_error(exc)
            logger.warning(
                "apollo_lookup_http_status_mapped status={status} reason={reason}",
                status=result.status,
                reason=result.reason,
            )
            return result
        except httpx.HTTPError as exc:
            logger.warning("apollo_lookup_transport_error error={error}", error=str(exc))
            return ApolloIdentityResult(status="lookup_error", reason=str(exc))

        payload = response.json()
        person_payload = payload.get("person") if isinstance(payload, dict) else None
        if not isinstance(person_payload, dict):
            logger.warning("apollo_lookup_unexpected_payload_shape")
            return ApolloIdentityResult(
                status="lookup_error",
                reason="Apollo returned an unexpected response format.",
            )

        work_email = self._text(person_payload.get("email")) or None
        personal_emails = self._read_email_values(person_payload.get("personal_emails"))
        primary_email = work_email or self._first_non_empty(*personal_emails)

        if not primary_email:
            logger.info("apollo_lookup_completed_no_email")
            return ApolloIdentityResult(
                status="no_email_found",
                reason="Apollo did not return a work or personal email for this person.",
                linkedin_url=self._text(person_payload.get("linkedin_url")) or normalized_linkedin_url,
                full_name=self._text(person_payload.get("name")) or normalized_name,
                title=self._text(person_payload.get("title")),
                company=self._read_company_name(person_payload.get("organization")),
            )

        signup_email_normalized = self._normalize_email(signup_email)
        comparable_emails = {self._normalize_email(value) for value in [work_email or "", *personal_emails] if value}
        email_match = bool(signup_email_normalized and signup_email_normalized in comparable_emails)

        logger.info(
            "apollo_lookup_completed status={status} primary_email={primary_email} personal_email_count={personal_count}",
            status="email_match" if email_match else "email_mismatch",
            primary_email=primary_email,
            personal_count=len(personal_emails),
        )
        return ApolloIdentityResult(
            status="email_match" if email_match else "email_mismatch",
            reason=(
                "Apollo returned an email that matches the GoodFirms signup email."
                if email_match
                else "Apollo returned work/personal email data that does not match the GoodFirms signup email."
            ),
            primary_email=primary_email,
            work_email=work_email,
            personal_emails=personal_emails,
            linkedin_url=self._text(person_payload.get("linkedin_url")) or normalized_linkedin_url,
            full_name=self._text(person_payload.get("name")) or normalized_name,
            title=self._text(person_payload.get("title")),
            company=self._read_company_name(person_payload.get("organization")),
        )

    def _map_http_status_error(self, exc: httpx.HTTPStatusError) -> ApolloIdentityResult:
        response = exc.response
        status_code = response.status_code
        reason = self._read_error_details(response)
        if status_code == 400:
            return ApolloIdentityResult(status="invalid_lookup_input", reason=reason or "Apollo rejected the request input.")
        if status_code == 401:
            return ApolloIdentityResult(status="lookup_unauthorized", reason=reason or "Apollo credentials were rejected.")
        if status_code == 402:
            return ApolloIdentityResult(status="lookup_quota_exceeded", reason=reason or "Apollo credits are exhausted.")
        if status_code == 404:
            return ApolloIdentityResult(status="no_email_found", reason=reason or "Apollo found no data for this person.")
        if status_code == 422:
            return ApolloIdentityResult(status="invalid_lookup_input", reason=reason or "Apollo rejected the enrichment inputs.")
        if status_code == 429:
            return ApolloIdentityResult(status="lookup_rate_limited", reason=reason or "Apollo rate limit reached.")
        if 500 <= status_code <= 599:
            return ApolloIdentityResult(status="lookup_provider_error", reason=reason or "Apollo provider error.")
        return ApolloIdentityResult(status="lookup_error", reason=reason or str(exc))

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

    def _read_email_values(self, value: Any) -> list[str]:
        if isinstance(value, list):
            return [self._text(item) for item in value if self._text(item)]
        text = self._text(value)
        return [text] if text else []

    def _read_company_name(self, value: Any) -> str | None:
        if isinstance(value, dict):
            text = self._text(value.get("name"))
            return text or None
        text = self._text(value)
        return text or None

    def _split_name(self, value: str) -> tuple[str, str]:
        parts = [part for part in value.split() if part]
        if not parts:
            return "", ""
        if len(parts) == 1:
            return parts[0], ""
        return parts[0], parts[-1]

    def _extract_host(self, value: str) -> str:
        if not value:
            return ""
        candidate = value.strip()
        if "://" not in candidate:
            candidate = f"https://{candidate}"
        try:
            parsed = urlparse(candidate)
        except ValueError:
            return ""
        return parsed.netloc.lower().removeprefix("www.")

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
