from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

from app.db.repositories.service_reviews import ServiceReviewRepository
from app.db.repositories.software_reviews import SoftwareReviewRepository
from app.db.repositories.users import UserRepository
from app.services.reviewer_history import ReviewerHistoryLookupService, ReviewerReviewStats


POSTING_PREFERENCE_LABELS = {
    "1": "Display both my name and the company's name with the review",
    "2": "Only display my name with the review",
    "3": "Only display the company's name with the review",
    "4": "Don't display my name and the company's name with the review",
}

PROJECT_STATUS_LABELS = {
    "0": "In Progress",
    "1": "Completed",
}

GENERIC_EMAIL_DOMAINS = {
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "aol.com",
    "proton.me",
    "protonmail.com",
}


@dataclass
class ServiceAgentContext:
    prompt_markdown: str
    context_markdown: str
    payload: dict[str, Any]
    metadata: dict[str, Any]


class ServiceReviewContextBuilder:
    def __init__(
        self,
        review_repository: ServiceReviewRepository,
        user_repository: UserRepository,
        software_review_repository: SoftwareReviewRepository,
    ) -> None:
        self._reviews = review_repository
        self._users = user_repository
        self._software_reviews = software_review_repository

    def build(self, review_id: str, test_mode: bool = False) -> ServiceAgentContext:
        review = self._reviews.get_review_by_id(review_id)
        if not review:
            raise LookupError(f"Service review not found: {review_id}")

        self._validate_review(review, test_mode=test_mode)

        user_id = self._parse_int(review.get("user_id"))
        user = self._users.get_user_by_id(user_id) if user_id is not None else None
        reviewer_history = ReviewerHistoryLookupService(self._software_reviews, self._reviews)
        review_stats = (
            reviewer_history.get_review_stats(user_id, review_id)
            if user_id is not None
            else ReviewerReviewStats(
                previous_reviews=0,
                previously_approved_reviews=0,
                previously_rejected_reviews=0,
            )
        )

        selected_services = self._reviews.get_selected_category_names(review_id)
        primary_service = self._text(review.get("primary_category_name"))
        if primary_service and primary_service not in selected_services:
            selected_services = [primary_service, *selected_services]

        reviewer = self._build_reviewer_context(review, user, review_stats=review_stats)
        project = self._build_project_context(review, selected_services)
        signals = self._build_signals(review, user, reviewer)
        prechecks = self._build_prechecks(
            review,
            reviewer=reviewer,
            project=project,
            signals=signals,
            test_mode=test_mode,
        )

        payload = {
            "subject": {
                "company_name": self._text(review.get("company_name")),
                "company_slug": self._text(review.get("slug")),
            },
            "project": project,
            "reviewer": reviewer,
            "review_content": {
                "headline": self._text(review.get("conclusion")),
                "body": self._text(review.get("feedback_summary")),
                "strength": self._text(review.get("strength")),
                "weakness": self._text(review.get("weakness")),
                "ratings": {
                    "quality_work": self._parse_int(review.get("quality")),
                    "scheduling_timing": self._parse_int(review.get("ability")),
                    "communication": self._parse_int(review.get("reliability")),
                    "overall_experience": self._parse_int(review.get("overall")),
                },
            },
            "signals": signals,
            "prechecks": prechecks,
        }
        metadata = {
            "review_id": str(review.get("id", review_id)),
            "status_code": self._parse_int(review.get("publish_status")),
            "status_label": self._status_label(review.get("publish_status")),
            "step": self._parse_int(review.get("step")),
            "rejection_reason": self._text(review.get("reason")) or None,
            "created_at": self._text(review.get("created")) or None,
            "updated_at": self._text(review.get("updated")) or None,
        }

        return ServiceAgentContext(
            prompt_markdown=self._prompt_markdown(),
            context_markdown=self._render_markdown(payload),
            payload=payload,
            metadata=metadata,
        )

    def _validate_review(self, review: dict[str, Any], test_mode: bool) -> None:
        publish_status = self._parse_int(review.get("publish_status"))
        if not test_mode and publish_status != 0:
            raise ValueError("Service review is not eligible: publish_status must be 0")

        if self._is_draft_like(review):
            raise ValueError("Service review is not eligible: review is draft-like")

        required_text_fields = (
            "project_name",
            "cost",
            "conclusion",
            "feedback_summary",
            "strength",
            "weakness",
            "client_name",
            "client_email",
            "client_company_name",
            "position",
            "location",
        )
        for field_name in required_text_fields:
            if not self._text(review.get(field_name)):
                raise ValueError(f"Service review is not eligible: {field_name} is required")

        if self._parse_int(review.get("industry_id")) is None or self._parse_int(review.get("industry_id")) <= 0:
            raise ValueError("Service review is not eligible: industry_id is required")

        if self._parse_int(review.get("category_id")) is None or self._parse_int(review.get("category_id")) <= 0:
            raise ValueError("Service review is not eligible: category_id is required")

        posting_preference = self._text(review.get("hidden_identity"))
        if posting_preference not in POSTING_PREFERENCE_LABELS:
            raise ValueError("Service review is not eligible: hidden_identity must be in 1..4")

        for rating_name in ("quality", "ability", "reliability", "overall"):
            rating_value = self._parse_int(review.get(rating_name))
            if rating_value is None or rating_value < 1 or rating_value > 5:
                raise ValueError(f"Service review is not eligible: {rating_name} must be between 1 and 5")

    def _is_draft_like(self, review: dict[str, Any]) -> bool:
        text_fields_empty = all(
            not self._text(review.get(field_name))
            for field_name in ("conclusion", "feedback_summary", "strength", "weakness")
        )
        ratings_empty = all((self._parse_int(review.get(field_name)) or 0) == 0 for field_name in ("quality", "ability", "reliability", "overall"))
        return text_fields_empty and ratings_empty

    def _build_reviewer_context(
        self,
        review: dict[str, Any],
        user: dict[str, Any] | None,
        *,
        review_stats: ReviewerReviewStats,
    ) -> dict[str, Any]:
        review_submitted = {
            "name": self._text(review.get("client_name")),
            "email": self._text(review.get("client_email")),
            "company_name": self._text(review.get("client_company_name")),
            "position": self._text(review.get("position")),
            "location": self._text(review.get("location")),
            "company_website": self._text(review.get("client_company_website")),
            "profile_link": self._text(review.get("client_profile_link")),
        }
        profile_fetched = {
            "name": self._text(user.get("name")) if user else "",
            "email": self._text(user.get("email")) if user else "",
            "company_name": self._text(user.get("company_name")) if user else "",
            "position": self._text(user.get("position")) if user else "",
            "location": self._text(user.get("location")) if user else "",
            "company_website": self._text(user.get("company_website")) if user else "",
            "profile_link": self._text(user.get("public_url")) if user else "",
        }

        resolved: dict[str, str] = {}
        resolution: dict[str, str] = {}
        for field_name in review_submitted:
            review_value = review_submitted[field_name]
            profile_value = profile_fetched[field_name]
            status, resolved_value = self._resolve_field(review_value, profile_value, field_name)
            resolution[field_name] = status
            resolved[field_name] = resolved_value

        posting_preference_code = self._text(review.get("hidden_identity"))
        resolved["posting_preference_label"] = POSTING_PREFERENCE_LABELS.get(posting_preference_code, "")
        resolved["email_domain"] = self._extract_email_domain(resolved.get("email"))
        resolved["company_website_host"] = self._extract_host(resolved.get("company_website"))
        resolved["profile_link_host"] = self._extract_host(resolved.get("profile_link"))
        resolved["reviewer_id"] = self._text(review.get("user_id")) or (self._text(user.get("id")) if user else "")
        resolved["account_created_at"] = self._text(user.get("created")) if user else ""
        resolved["account_updated_at"] = self._text(user.get("updated")) if user else ""
        resolved["previous_reviews"] = str(review_stats.previous_reviews)
        resolved["previously_approved_reviews"] = str(review_stats.previously_approved_reviews)
        resolved["previously_rejected_reviews"] = str(review_stats.previously_rejected_reviews)

        return {
            "resolved": resolved,
            "review_submitted": review_submitted,
            "profile_fetched": profile_fetched,
            "resolution": resolution,
        }

    def _build_project_context(self, review: dict[str, Any], selected_services: list[str]) -> dict[str, Any]:
        return {
            "title": self._text(review.get("project_name")),
            "budget": self._text(review.get("cost")),
            "industry": self._text(review.get("industry_name")),
            "status_label": PROJECT_STATUS_LABELS.get(self._text(review.get("project_status")), "Unknown"),
            "summary": self._text(review.get("project_summary")),
            "primary_service": self._text(review.get("primary_category_name")),
            "selected_services": selected_services,
        }

    def _build_signals(
        self,
        review: dict[str, Any],
        user: dict[str, Any] | None,
        reviewer: dict[str, Any],
    ) -> dict[str, Any]:
        review_submitted = reviewer["review_submitted"]
        profile_fetched = reviewer["profile_fetched"]
        resolved = reviewer["resolved"]
        risk_flags: list[str] = []
        trust_flags: list[str] = []

        if user:
            trust_flags.append("account_found")
        else:
            risk_flags.append("account_not_found")

        is_goodfirms_registered = bool(user and user.get("is_goodfirms_registered"))
        if is_goodfirms_registered:
            trust_flags.append("is_goodfirms_registered")

        if resolved.get("email_domain") in GENERIC_EMAIL_DOMAINS:
            risk_flags.append("reviewer_email_uses_generic_domain")

        identity_match = {
            "review_email_matches_account_email": self._matches(review_submitted["email"], profile_fetched["email"], "email"),
            "review_name_matches_account_name": self._matches(review_submitted["name"], profile_fetched["name"], "name"),
            "review_company_matches_account_company": self._matches(
                review_submitted["company_name"], profile_fetched["company_name"], "company_name"
            ),
        }

        for flag_name, matches in identity_match.items():
            if matches is True:
                trust_flags.append(flag_name)
            elif matches is False:
                risk_flags.append(flag_name.replace("matches", "mismatch"))

        login_method = "unknown"
        if user:
            has_google = bool(self._text(user.get("google_id")))
            has_social = bool(self._text(user.get("social_id")))
            if has_google:
                login_method = "google"
            elif has_social:
                login_method = "linkedin"
            elif self._text(user.get("email")):
                login_method = "email_legacy"

        return {
            "account_found": user is not None,
            "inferred_login_method": login_method,
            "review_email_matches_account_email": identity_match["review_email_matches_account_email"],
            "review_name_matches_account_name": identity_match["review_name_matches_account_name"],
            "review_company_matches_account_company": identity_match["review_company_matches_account_company"],
            "is_goodfirms_registered": is_goodfirms_registered,
            "risk_flags": sorted(set(risk_flags)),
            "trust_flags": sorted(set(trust_flags)),
        }

    def _build_prechecks(
        self,
        review: dict[str, Any],
        *,
        reviewer: dict[str, Any],
        project: dict[str, Any],
        signals: dict[str, Any],
        test_mode: bool,
    ) -> list[dict[str, str]]:
        reviewer_resolved = reviewer["resolved"]
        previous_reviews = self._parse_int(reviewer_resolved.get("previous_reviews")) or 0
        previously_approved = self._parse_int(reviewer_resolved.get("previously_approved_reviews")) or 0
        previously_rejected = self._parse_int(reviewer_resolved.get("previously_rejected_reviews")) or 0
        has_profile_inputs = bool(reviewer_resolved.get("profile_link") or reviewer_resolved.get("company_website"))
        mismatch_flags = [
            flag
            for flag in (
                "review_email_mismatch_account_email",
                "review_name_mismatch_account_name",
                "review_company_mismatch_account_company",
            )
            if flag in signals["risk_flags"]
        ]

        prechecks: list[dict[str, str]] = [
            {
                "name": "Eligibility Gate",
                "status": "pass",
                "reason": f"draft-like check passed and status_gate={'test override used' if test_mode else 'pending only'}",
            },
            {
                "name": "Required Review Fields",
                "status": "pass",
                "reason": (
                    "project details, review text, reviewer identity fields, service category, "
                    "and all four ratings are present"
                ),
            },
            {
                "name": "Project Context Completeness",
                "status": "pass" if project["summary"] and project["selected_services"] else "warning",
                "reason": (
                    "project summary and selected services are available"
                    if project["summary"] and project["selected_services"]
                    else "project summary or selected services are sparse"
                ),
            },
        ]

        if self._narrative_sections_look_duplicate(
            self._text(review.get("strength")),
            self._text(review.get("weakness")),
        ):
            prechecks.append(
                {
                    "name": "Most Liked vs Least Liked Separation",
                    "status": "fail",
                    "reason": "most-liked and least-liked sections are too similar or overlapping",
                }
            )
        else:
            prechecks.append(
                {
                    "name": "Most Liked vs Least Liked Separation",
                    "status": "pass",
                    "reason": "most-liked and least-liked sections are materially different",
                }
            )

        if not signals["account_found"]:
            identity_status = "fail"
            identity_reason = "no matching GoodFirms account was found for this reviewer"
        elif mismatch_flags:
            identity_status = "fail"
            identity_reason = f"account comparison produced mismatches: {', '.join(mismatch_flags)}"
        elif any(
            value is True
            for value in (
                signals["review_email_matches_account_email"],
                signals["review_name_matches_account_name"],
                signals["review_company_matches_account_company"],
            )
        ):
            identity_status = "pass"
            identity_reason = "account match checks found at least one strong match and no hard mismatches"
        else:
            identity_status = "warning"
            identity_reason = "account exists, but overlap between review-submitted identity and account fields is limited"
        prechecks.append(
            {
                "name": "Reviewer Identity Alignment",
                "status": identity_status,
                "reason": identity_reason,
            }
        )

        history_status = "pass"
        if previously_rejected > 0:
            history_status = "warning"
        prechecks.append(
            {
                "name": "Reviewer History",
                "status": history_status,
                "reason": (
                    f"previous_reviews={previous_reviews}, "
                    f"previously_approved_reviews={previously_approved}, "
                    f"previously_rejected_reviews={previously_rejected}"
                ),
            }
        )
        prechecks.append(
            {
                "name": "Public Profile Inputs",
                "status": "pass" if has_profile_inputs else "warning",
                "reason": (
                    "at least one public profile input is available (company website or profile link)"
                    if has_profile_inputs
                    else "no company website or profile link is available from the review/profile data"
                ),
            }
        )
        return prechecks

    def _render_markdown(self, payload: dict[str, Any]) -> str:
        subject = payload["subject"]
        project = payload["project"]
        reviewer = payload["reviewer"]["resolved"]
        review_content = payload["review_content"]
        signals = payload["signals"]
        prechecks = payload["prechecks"]

        lines = [
            "# Service Review Context",
            "",
            "## Company",
            f"- Name: {self._fallback(subject['company_name'])}",
            f"- Slug: {self._fallback(subject['company_slug'])}",
            "",
            "## Backend Prechecks",
        ]
        lines.extend(
            f"- {item['name']}: {item['status']} — {item['reason']}"
            for item in prechecks
        )
        lines.extend(
            [
                "",
            "## Project",
            f"- Title: {self._fallback(project['title'])}",
            f"- Budget: {self._fallback(project['budget'])}",
            f"- Industry: {self._fallback(project['industry'])}",
            f"- Status: {self._fallback(project['status_label'])}",
            f"- Summary: {self._fallback(project['summary'])}",
            f"- Primary Service: {self._fallback(project['primary_service'])}",
            f"- Selected Services: {', '.join(project['selected_services']) if project['selected_services'] else 'not available'}",
            "",
            "## Reviewer",
            f"- Reviewer ID: {self._fallback(reviewer.get('reviewer_id'))}",
            f"- Name: {self._fallback(reviewer.get('name'))}",
            f"- Email: {self._fallback(reviewer.get('email'))}",
            f"- Company Name: {self._fallback(reviewer.get('company_name'))}",
            f"- Position: {self._fallback(reviewer.get('position'))}",
            f"- Location: {self._fallback(reviewer.get('location'))}",
            f"- Posting Preference: {self._fallback(reviewer.get('posting_preference_label'))}",
            f"- Company Website Host: {self._fallback(reviewer.get('company_website_host'))}",
            f"- Profile Link: {self._fallback(reviewer.get('profile_link'))}",
            f"- Account Created At: {self._fallback(reviewer.get('account_created_at'))}",
            f"- Account Updated At: {self._fallback(reviewer.get('account_updated_at'))}",
            f"- Previous Reviews: {self._fallback(reviewer.get('previous_reviews'))}",
            f"- Previously Approved Reviews: {self._fallback(reviewer.get('previously_approved_reviews'))}",
            f"- Previously Rejected Reviews: {self._fallback(reviewer.get('previously_rejected_reviews'))}",
            "",
            "## Review",
            f"- One-line Summary: {self._fallback(review_content['headline'])}",
            f"- Detailed Experience: {self._fallback(review_content['body'])}",
            f"- Most Liked: {self._fallback(review_content['strength'])}",
            f"- Least Liked: {self._fallback(review_content['weakness'])}",
            "- Ratings:",
            f"  - Quality Work: {self._fallback(review_content['ratings']['quality_work'])}",
            f"  - Scheduling and Timing: {self._fallback(review_content['ratings']['scheduling_timing'])}",
            f"  - Communication: {self._fallback(review_content['ratings']['communication'])}",
            f"  - Overall Experience: {self._fallback(review_content['ratings']['overall_experience'])}",
            "",
            "## Signals",
            f"- Account Found: {'yes' if signals['account_found'] else 'no'}",
            f"- Inferred Login Method: {signals['inferred_login_method']}",
            f"- Is GoodFirms Registered: {self._bool_text(signals['is_goodfirms_registered'])}",
            f"- Review Email Matches Account Email: {self._bool_text(signals['review_email_matches_account_email'])}",
            f"- Review Name Matches Account Name: {self._bool_text(signals['review_name_matches_account_name'])}",
            f"- Review Company Matches Account Company: {self._bool_text(signals['review_company_matches_account_company'])}",
            f"- Risk Flags: {', '.join(signals['risk_flags']) if signals['risk_flags'] else 'no risk flags detected'}",
            f"- Trust Flags: {', '.join(signals['trust_flags']) if signals['trust_flags'] else 'no additional trust flags'}",
            ]
        )
        return "\n".join(lines)

    def _prompt_markdown(self) -> str:
        return """# Service Review Agent

You are reviewing a client review submitted for a service project on the GoodFirms review platform.

## Tasks

- verify authenticity and internal consistency of the review
- improve writing quality while preserving factual meaning and sentiment
- avoid inventing any facts
- keep edits very minimal and focused, for example grammar, spelling, punctuation, and spacing

## Important Rules

- preserve factual meaning
- preserve sentiment direction
- treat the `Backend Prechecks` section as deterministic system facts and do not contradict it
- the one-line summary must align with the detailed experience
- ratings must align with the narrative tone
- most-liked and least-liked sections must be meaningfully different
- treat trust and risk signals as supporting context, not proof by themselves
- `is_goodfirms_registered = yes` means the user account was registered by the GoodFirms admin team and should be treated as a strong trust signal
- use the reviewer history tool for ambiguity, repetition, and authenticity checks, not for basic grammar or rewrite work
- use the public web search tool only for external public corroboration, for example LinkedIn profile discovery, indexed LinkedIn posts/activity, company-site corroboration, or resolving old-company/current-company ambiguity
- when using the public web search tool, put the main advanced Google operators directly in `q`, use `as_sitesearch` for a domain restriction, `as_qdr` for recent activity windows, and `gl` for country bias when relevant
- you may call the public web search tool multiple times in parallel with different focused queries
- treat search results as evidence, not proof; if something is missing from search results, treat it as not observed rather than automatically false
- if identity or consistency signals are weak or conflicting, prefer a manual-review outcome over overconfident acceptance
- use the model for ambiguity, authenticity judgment, and minimal rewrite work; do not spend effort re-deriving simple mechanical checks already covered by Backend Prechecks
- `confidence` must reflect how strong and internally consistent the available evidence is: use `high`, `medium`, or `low`
- `decision_summary` must be concise but specific: state the key findings, how you interpreted them, and why those findings support the final decision; mention tool results when they materially influenced the outcome
- return only the structured output fields and do not add any extra prose outside the schema

## Final Decision Values

- `verified_pass` for a review that can be accepted without rewrite changes
- `verified_with_minor_fixes` for a review that can be accepted with small text improvements
- `needs_manual_review` for a review that should be flagged for human review
- `reject_recommended` for a review that should be rejected

## Allowed Reject Reasons

- Unable to verify the reviewer
- Reviews are accepted only from clients of the company
- Reviews are not accepted from former employees
- Review has already been published before
"""

    def _status_label(self, status_code: Any) -> str:
        status_value = self._parse_int(status_code)
        if status_value == 0:
            return "Pending"
        if status_value == 1:
            return "Published"
        if status_value == 2:
            return "Rejected"
        return "Unknown"

    def _resolve_field(self, review_value: str, profile_value: str, field_name: str) -> tuple[str, str]:
        if review_value and not profile_value:
            return "review_only", review_value
        if not review_value and profile_value:
            return "profile_backfill", profile_value
        if review_value and profile_value:
            if self._normalized_compare_value(review_value, field_name) == self._normalized_compare_value(
                profile_value, field_name
            ):
                return "matched", review_value
            return "mismatch", review_value
        return "missing", ""

    def _normalized_compare_value(self, value: str, field_name: str) -> str:
        normalized = " ".join(value.strip().lower().split())
        if field_name in {"company_website", "profile_link"}:
            return self._extract_host(normalized)
        return normalized

    def _matches(self, review_value: str, profile_value: str, field_name: str) -> bool | None:
        if not review_value or not profile_value:
            return None
        return self._normalized_compare_value(review_value, field_name) == self._normalized_compare_value(
            profile_value, field_name
        )

    def _extract_email_domain(self, email: str | None) -> str:
        if not email or "@" not in email:
            return ""
        return email.split("@", 1)[1].strip().lower()

    def _extract_host(self, value: str | None) -> str:
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

    def _bool_text(self, value: bool | None) -> str:
        if value is True:
            return "yes"
        if value is False:
            return "no"
        return "not available"

    def _narrative_sections_look_duplicate(self, left: str, right: str) -> bool:
        left_normalized = self._normalize_free_text(left)
        right_normalized = self._normalize_free_text(right)
        if not left_normalized or not right_normalized:
            return False
        if left_normalized == right_normalized:
            return True
        left_tokens = set(left_normalized.split())
        right_tokens = set(right_normalized.split())
        if not left_tokens or not right_tokens:
            return False
        overlap_ratio = len(left_tokens & right_tokens) / min(len(left_tokens), len(right_tokens))
        return overlap_ratio >= 0.8

    def _normalize_free_text(self, value: str) -> str:
        return " ".join(value.strip().lower().split())

    def _fallback(self, value: Any) -> str:
        if value is None:
            return "not available"
        if isinstance(value, str):
            stripped = value.strip()
            return stripped if stripped else "not provided"
        return str(value)

    def _parse_int(self, raw_value: Any) -> int | None:
        if raw_value in (None, "", "null"):
            return None
        try:
            return int(float(str(raw_value)))
        except (TypeError, ValueError):
            return None

    def _text(self, raw_value: Any) -> str:
        if raw_value is None:
            return ""
        return str(raw_value).strip()
