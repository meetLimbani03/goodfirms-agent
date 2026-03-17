from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import httpx

from app.core.config import HunterSettings
from app.core.logging import logger


@dataclass(frozen=True)
class HunterIdentityResult:
    lookup_ran: bool
    status: str
    candidate_email: str | None = None
    candidate_domain: str | None = None
    verification_status: str | None = None
    score: int | None = None
    claimed_company_domain_matches: bool | None = None
    lookup_method: str | None = None
    reason: str | None = None


class HunterIdentityService:
    def __init__(self, settings: HunterSettings | None) -> None:
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
    ) -> HunterIdentityResult:
        logger.info(
            "hunter_lookup_started full_name={full_name} company_name={company_name}",
            full_name=" ".join(full_name.strip().split()) or "not_provided",
            company_name=" ".join(company_name.strip().split()) or "not_provided",
        )
        if not self._settings:
            logger.warning("hunter_lookup_skipped_not_configured")
            return HunterIdentityResult(lookup_ran=False, status="not_configured", reason="Hunter is not configured")

        linkedin_handle = self._extract_linkedin_handle(linkedin_url)
        company_domain = self._extract_host(company_website)
        normalized_name = " ".join(full_name.strip().split())

        params: dict[str, Any] = {"api_key": self._settings.api_key}
        lookup_method = None
        if linkedin_handle:
            params["linkedin_handle"] = linkedin_handle
            lookup_method = "linkedin_handle"
        elif normalized_name and company_domain:
            params["full_name"] = normalized_name
            params["domain"] = company_domain
            lookup_method = "full_name_domain"
        elif normalized_name and company_name:
            params["full_name"] = normalized_name
            params["company"] = company_name
            lookup_method = "full_name_company"
        else:
            logger.warning("hunter_lookup_skipped_not_enough_inputs")
            return HunterIdentityResult(
                lookup_ran=False,
                status="not_enough_inputs",
                reason="LinkedIn handle or name+company context is required for Hunter lookup",
            )

        if company_domain and "domain" not in params:
            params["domain"] = company_domain
        if normalized_name and "full_name" not in params:
            params["full_name"] = normalized_name
        if self._settings.max_duration is not None:
            params["max_duration"] = self._settings.max_duration
        logger.info(
            "hunter_lookup_request_prepared lookup_method={lookup_method} linkedin_handle={linkedin_handle} company_domain={company_domain}",
            lookup_method=lookup_method,
            linkedin_handle=linkedin_handle or "not_available",
            company_domain=company_domain or "not_available",
        )

        try:
            response = httpx.get(
                self._settings.base_url,
                params=params,
                headers={"User-Agent": "goodfirms-backend/hunter-identity"},
                timeout=20.0,
            )
            logger.info(
                "hunter_lookup_http_response lookup_method={lookup_method} status_code={status_code}",
                lookup_method=lookup_method,
                status_code=response.status_code,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            result = self._map_http_status_error(
                exc,
                lookup_method=lookup_method,
                company_domain=company_domain,
            )
            logger.warning(
                "hunter_lookup_http_status_mapped lookup_method={lookup_method} status={status} reason={reason}",
                lookup_method=lookup_method,
                status=result.status,
                reason=result.reason or "not_available",
            )
            return result
        except httpx.HTTPError as exc:
            logger.warning(
                "hunter_lookup_transport_error lookup_method={lookup_method} error={error}",
                lookup_method=lookup_method,
                error=str(exc),
            )
            return HunterIdentityResult(
                lookup_ran=True,
                status="lookup_error",
                lookup_method=lookup_method,
                reason=str(exc),
            )

        data = response.json().get("data") or {}
        candidate_email = self._text(data.get("email")) or None
        candidate_domain = self._text(data.get("domain")) or None
        verification_status = self._text((data.get("verification") or {}).get("status")) or None
        score = self._parse_int(data.get("score"))
        claimed_company_domain_matches = None
        if company_domain and candidate_domain:
            claimed_company_domain_matches = company_domain == candidate_domain

        if not candidate_email:
            logger.info(
                "hunter_lookup_completed_no_email lookup_method={lookup_method} candidate_domain={candidate_domain}",
                lookup_method=lookup_method,
                candidate_domain=candidate_domain or "not_available",
            )
            return HunterIdentityResult(
                lookup_ran=True,
                status="no_email_found",
                candidate_domain=candidate_domain,
                verification_status=verification_status,
                score=score,
                claimed_company_domain_matches=claimed_company_domain_matches,
                lookup_method=lookup_method,
                reason="Hunter did not return a candidate email for this identity",
            )

        email_match = self._normalize_email(signup_email) == self._normalize_email(candidate_email)
        logger.info(
            "hunter_lookup_completed lookup_method={lookup_method} status={status} candidate_email={candidate_email} candidate_domain={candidate_domain}",
            lookup_method=lookup_method,
            status="email_match" if email_match else "email_mismatch",
            candidate_email=candidate_email,
            candidate_domain=candidate_domain or "not_available",
        )
        return HunterIdentityResult(
            lookup_ran=True,
            status="email_match" if email_match else "email_mismatch",
            candidate_email=candidate_email,
            candidate_domain=candidate_domain,
            verification_status=verification_status,
            score=score,
            claimed_company_domain_matches=claimed_company_domain_matches,
            lookup_method=lookup_method,
            reason=(
                "Hunter candidate email matches the GoodFirms signup email"
                if email_match
                else "Hunter candidate email does not match the GoodFirms signup email"
            ),
        )

    def _extract_linkedin_handle(self, value: str) -> str:
        if not value:
            return ""
        candidate = value.strip()
        if "://" not in candidate:
            candidate = f"https://{candidate}"
        try:
            parsed = urlparse(candidate)
        except ValueError:
            return ""
        segments = [segment for segment in parsed.path.split("/") if segment]
        if not segments:
            return ""
        if segments[0] in {"in", "pub"} and len(segments) >= 2:
            return segments[1].strip()
        return segments[-1].strip()

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

    def _text(self, value: Any) -> str:
        if value is None:
            return ""
        return " ".join(str(value).strip().split())

    def _parse_int(self, value: Any) -> int | None:
        text_value = self._text(value)
        if not text_value:
            return None
        try:
            return int(float(text_value))
        except ValueError:
            return None

    def _map_http_status_error(
        self,
        exc: httpx.HTTPStatusError,
        *,
        lookup_method: str | None,
        company_domain: str,
    ) -> HunterIdentityResult:
        response = exc.response
        status_code = response.status_code
        error_details = self._read_error_details(response)

        if status_code == 404:
            return HunterIdentityResult(
                lookup_ran=True,
                status="no_email_found",
                candidate_domain=company_domain or None,
                lookup_method=lookup_method,
                reason=error_details or "Hunter could not find a matching LinkedIn/profile identity in its database",
            )

        if status_code == 400:
            return HunterIdentityResult(
                lookup_ran=True,
                status="invalid_lookup_input",
                lookup_method=lookup_method,
                reason=error_details or "Hunter rejected the lookup input",
            )

        if status_code == 401:
            return HunterIdentityResult(
                lookup_ran=True,
                status="lookup_unauthorized",
                lookup_method=lookup_method,
                reason=error_details or "Hunter credentials were rejected",
            )

        if status_code == 403:
            return HunterIdentityResult(
                lookup_ran=True,
                status="lookup_rate_limited",
                lookup_method=lookup_method,
                reason=error_details or "Hunter temporarily refused the request because of rate limits",
            )

        if status_code == 429:
            return HunterIdentityResult(
                lookup_ran=True,
                status="lookup_rate_limited",
                lookup_method=lookup_method,
                reason=error_details or "Hunter API rate limit reached",
            )

        if status_code == 422:
            return HunterIdentityResult(
                lookup_ran=True,
                status="invalid_lookup_input",
                lookup_method=lookup_method,
                reason=error_details or "Hunter rejected the lookup input",
            )

        if status_code == 451:
            return HunterIdentityResult(
                lookup_ran=True,
                status="lookup_restricted_profile",
                lookup_method=lookup_method,
                reason=error_details or "Hunter indicates this profile/email should not be processed",
            )

        if 500 <= status_code <= 599:
            return HunterIdentityResult(
                lookup_ran=True,
                status="lookup_provider_error",
                lookup_method=lookup_method,
                reason=error_details or "Hunter provider error",
            )

        return HunterIdentityResult(
            lookup_ran=True,
            status="lookup_error",
            lookup_method=lookup_method,
            reason=error_details or str(exc),
        )

    def _read_error_details(self, response: httpx.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            return response.text.strip()

        errors = payload.get("errors")
        if isinstance(errors, list) and errors:
            details = errors[0].get("details")
            if details:
                return self._text(details)
        return self._text(payload.get("message")) or response.text.strip()
