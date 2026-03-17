from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from pydantic import BaseModel, Field

from app.core.config import SerpApiSettings
from app.core.logging import logger


class PublicWebSearchToolInput(BaseModel):
    q: str = Field(
        min_length=3,
        max_length=500,
        description=(
            "Advanced Google query string. Use quotes, site:, OR, and other Google operators directly in q when helpful."
        ),
    )
    gl: str | None = Field(
        default=None,
        description="Optional Google country bias, for example us, gb, de, in, sg, or ae.",
    )
    hl: str | None = Field(
        default="en",
        description="Optional Google interface language, for example en.",
    )
    as_qdr: str | None = Field(
        default=None,
        description="Optional Google recency filter such as d1, w1, m1, m3, m6, or y1.",
    )
    as_sitesearch: str | None = Field(
        default=None,
        description="Optional site/domain restriction, for example linkedin.com or piogroup.net.",
    )
    num: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Number of organic results to return. Keep this small and targeted.",
    )
    start: int = Field(
        default=0,
        ge=0,
        le=30,
        description="Pagination offset in Google results, usually 0, 10, or 20.",
    )
    filter: int = Field(
        default=1,
        ge=0,
        le=1,
        description="Set to 0 to include near-duplicate results. Set to 1 for normal Google deduplication.",
    )


@dataclass
class PublicWebSearchService:
    settings: SerpApiSettings | None

    @property
    def enabled(self) -> bool:
        return self.settings is not None

    def search(
        self,
        q: str,
        gl: str | None = None,
        hl: str | None = "en",
        as_qdr: str | None = None,
        as_sitesearch: str | None = None,
        num: int = 5,
        start: int = 0,
        filter: int = 1,
    ) -> str:
        if not self.settings:
            raise RuntimeError("SerpApi public web search is not configured")

        params: dict[str, Any] = {
            "engine": "google",
            "q": q,
            "num": num,
            "start": start,
            "filter": filter,
            "safe": "active",
            "no_cache": "true",
            "json_restrictor": "organic_results,search_information,search_metadata,serpapi_pagination",
        }
        if gl:
            params["gl"] = gl.strip().lower()
        if hl:
            params["hl"] = hl.strip().lower()
        if as_qdr:
            params["as_qdr"] = as_qdr.strip()
        if as_sitesearch:
            params["as_sitesearch"] = self._normalize_sitesearch(as_sitesearch)

        logger.info(
            "public_web_search_started q={q} gl={gl} hl={hl} as_qdr={as_qdr} as_sitesearch={as_sitesearch} num={num} start={start} filter={filter}",
            q=q,
            gl=params.get("gl") or "not_set",
            hl=params.get("hl") or "not_set",
            as_qdr=params.get("as_qdr") or "not_set",
            as_sitesearch=params.get("as_sitesearch") or "not_set",
            num=params["num"],
            start=params["start"],
            filter=params["filter"],
        )
        payload = self._perform_search(params)
        organic_results = payload.get("organic_results") or []
        logger.info(
            "public_web_search_completed q={q} organic_result_count={organic_result_count}",
            q=q,
            organic_result_count=len(organic_results),
        )
        return self._render_markdown(params, payload)

    def _perform_search(self, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.settings.base_url}?{urlencode({'api_key': self.settings.api_key, **params})}"
        request = Request(
            url,
            headers={"User-Agent": "goodfirms-backend/serpapi-public-web-search"},
        )
        logger.info("public_web_search_request_sent url={url}", url=url)
        with urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8")
        payload = json.loads(body)
        if payload.get("error"):
            logger.warning("public_web_search_provider_error error={error}", error=payload["error"])
            raise RuntimeError(f"SerpApi search failed: {payload['error']}")
        organic_results = payload.get("organic_results") or []
        logger.info(
            "public_web_search_response_received organic_result_count={organic_result_count}",
            organic_result_count=len(organic_results),
        )
        return payload

    def _render_markdown(self, params: dict[str, Any], payload: dict[str, Any]) -> str:
        organic_results = payload.get("organic_results") or []
        total_results = (payload.get("search_information") or {}).get("total_results")

        lines = [
            "# Public Web Search Results",
            "",
            f"- Query: {params.get('q')}",
            f"- Country Bias: {params.get('gl') or 'not set'}",
            f"- Language: {params.get('hl') or 'not set'}",
            f"- Site Restriction: {params.get('as_sitesearch') or 'not set'}",
            f"- Recency Filter: {params.get('as_qdr') or 'not set'}",
            f"- Requested Result Count: {params.get('num')}",
            f"- Result Offset: {params.get('start')}",
            f"- Total Results Reported: {total_results if total_results is not None else 'not available'}",
            "",
        ]

        if not organic_results:
            lines.append("No organic results found.")
            return "\n".join(lines)

        for index, result in enumerate(organic_results, start=1):
            title = self._text(result.get("title")) or "Not available"
            link = self._text(result.get("link")) or "Not available"
            displayed_link = self._text(result.get("displayed_link"))
            snippet = self._text(result.get("snippet")) or "Not available"
            date = self._text(result.get("date")) or "Not observed"
            lines.extend(
                [
                    f"## Result {index}",
                    f"- Title: {title}",
                    f"- Link: {link}",
                    f"- Displayed Link: {displayed_link or 'Not available'}",
                    f"- Date: {date}",
                    f"- Snippet: {snippet}",
                    "",
                ]
            )
        return "\n".join(lines).rstrip()

    def _normalize_sitesearch(self, value: str) -> str:
        stripped = value.strip()
        if "://" in stripped:
            parsed = urlparse(stripped)
            return parsed.netloc.lower().removeprefix("www.")
        return stripped.lower().removeprefix("www.")

    def _text(self, value: Any) -> str:
        if value is None:
            return ""
        return " ".join(str(value).strip().split())
