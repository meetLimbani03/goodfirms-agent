from __future__ import annotations

from app.db.mongo import MongoManager
from app.db.repositories.software_reviews import SoftwareReviewRepository
from app.domain.context.models import (
    DerivedSignalsContext,
    GroundTruthContext,
    ProvenanceContext,
    RatingsContext,
    RequestContext,
    RequestSummaryContext,
    ReviewContentContext,
    ReviewRecordContext,
    ReviewerProfileContext,
    SoftwareReviewContext,
    SoftwareSubjectContext,
    UsageContext,
)
from app.domain.context.utils import (
    extract_email_domain,
    extract_url_host,
    normalize_integer,
    normalize_loose_string_array,
    normalize_loose_text,
    normalize_multi_value_text,
    normalize_text,
    now_iso,
    nullable_text,
    posting_preference_text,
    read_nullable_raw_number,
    read_nullable_raw_text,
    status_label,
    strings_equal_loose,
    unix_seconds_to_iso,
)


def build_software_review_context(mongo: MongoManager, review_id: str) -> SoftwareReviewContext:
    repository = SoftwareReviewRepository(mongo)
    raw_review = repository.get_review_by_id(review_id)
    if not raw_review:
        raise ValueError(f"Software review not found: {review_id}")

    normalized_review = _normalize_review(raw_review)
    request_token = read_nullable_raw_text(raw_review.get("requesttoken"))

    request_record = repository.get_review_request_context(normalized_review["id"], request_token)
    category_names = repository.get_category_names(normalized_review["categories"])
    software_names_by_id = repository.get_software_names_by_ids(
        normalized_review["integrate_software"] + normalized_review["used_software"]
    )

    trust_signals = _build_trust_signals(normalized_review, request_record)
    risk_hints = _build_risk_hints(normalized_review)
    vendor_conflict_hints = _build_vendor_conflict_hints(normalized_review)

    return SoftwareReviewContext(
        context_version="2026-03-09",
        generated_at=now_iso(),
        review_id=normalized_review["id"],
        review_record=ReviewRecordContext(
            mongo_id=normalized_review["id"],
            status_code=normalized_review["is_active"],
            status_label=status_label(normalized_review["is_active"]),
            step=normalized_review["step"],
            rejection_reason=read_nullable_raw_text(raw_review.get("reason")),
            response=read_nullable_raw_text(raw_review.get("response")),
            request_token=request_token,
            submitted_by=read_nullable_raw_number(raw_review.get("submitted_by")),
            publish_date_unix=read_nullable_raw_number(raw_review.get("publish_date")),
            publish_date_iso=unix_seconds_to_iso(read_nullable_raw_number(raw_review.get("publish_date"))),
            created_at_unix=normalized_review["created_at"],
            created_at_iso=unix_seconds_to_iso(normalized_review["created_at"]),
            updated_at_unix=normalized_review["updated_at"],
            updated_at_iso=unix_seconds_to_iso(normalized_review["updated_at"]),
        ),
        software=SoftwareSubjectContext(
            software_id=normalized_review["software_id"],
            name=normalized_review["software_name"],
            slug=normalized_review["software_slug"],
            categories=category_names or normalized_review["categories"],
        ),
        usage=UsageContext(
            duration_value=normalized_review["use_in_time"],
            duration_unit=nullable_text(normalized_review["use_time_format"]),
            frequency=nullable_text(normalized_review["frequent_use"]),
            pricing=nullable_text(normalized_review["software_pricing"]),
            integrated_other_software=nullable_text(normalized_review["is_integrated"]),
            integrated_software=_replace_ids_with_names(
                normalized_review["integrate_software"],
                software_names_by_id,
            ),
            switched_from_other_software=nullable_text(normalized_review["switched_from"]),
            used_software_before_switch=_replace_ids_with_names(
                normalized_review["used_software"],
                software_names_by_id,
            ),
        ),
        review_content=ReviewContentContext(
            title=normalized_review["title"],
            summary=normalized_review["summary"],
            strength=normalized_review["strength"],
            weakness=normalized_review["weakness"],
            ratings=RatingsContext(
                ease_of_use=normalized_review["ease_of_use"],
                features_functionality=normalized_review["features_functionality"],
                customer_support=normalized_review["customer_support"],
                overall=normalized_review["overall"],
            ),
        ),
        reviewer_profile=ReviewerProfileContext(
            name=normalized_review["client_name"],
            email=normalized_review["client_email"],
            email_domain=extract_email_domain(normalized_review["client_email"]),
            company_name=nullable_text(normalized_review["client_company_name"]),
            position=nullable_text(normalized_review["position"]),
            location=nullable_text(normalized_review["location"]),
            posting_preference_code=nullable_text(normalized_review["hidden_identity"]),
            posting_preference_label=nullable_text(posting_preference_text(normalized_review["hidden_identity"])),
            company_website=nullable_text(normalized_review["client_company_website"]),
            company_website_host=extract_url_host(normalized_review["client_company_website"]),
            profile_link=nullable_text(normalized_review["client_profile_link"]),
            profile_link_host=extract_url_host(normalized_review["client_profile_link"]),
        ),
        request_context=RequestContext(
            found=request_record is not None,
            request=_build_request_summary(request_record) if request_record else None,
        ),
        derived_signals=DerivedSignalsContext(
            trust_signals=trust_signals,
            risk_hints=risk_hints,
            vendor_conflict_hints=vendor_conflict_hints,
        ),
        ground_truth=GroundTruthContext(
            status_label=status_label(normalized_review["is_active"]),
            rejection_reason=read_nullable_raw_text(raw_review.get("reason")),
            is_pending=normalized_review["is_active"] == 0,
            is_published=normalized_review["is_active"] == 1,
            is_rejected=normalized_review["is_active"] == 2,
        ),
        provenance=ProvenanceContext(
            related_mongo_collections=["software-review-request"] if request_record else [],
            notes=[
                "Review content comes from MongoDB goodfirms.software-reviews.",
                "Software category and software-name enrichment come from MongoDB reference collections.",
                "Account enrichment is not loaded yet in the Python backend context gatherer.",
            ],
        ),
    )


def _normalize_review(document: dict) -> dict[str, object]:
    features = document.get("features") if isinstance(document.get("features"), dict) else {}
    category_values = features.get("category") if isinstance(features, dict) else None

    return {
        "id": str(document.get("_id", "")),
        "is_active": normalize_integer(document.get("is_active")),
        "step": normalize_integer(document.get("step")),
        "software_id": normalize_loose_text(document.get("software_id")),
        "software_name": normalize_text(document.get("software_name")),
        "software_slug": normalize_text(document.get("software_slug")),
        "user_id": normalize_text(document.get("user_id")),
        "categories": normalize_loose_string_array(category_values),
        "use_in_time": normalize_integer(document.get("use_in_time")),
        "use_time_format": normalize_loose_text(document.get("use_time_format")).lower(),
        "frequent_use": normalize_loose_text(document.get("frequent_use")).lower(),
        "software_pricing": normalize_loose_text(document.get("software_pricing")).lower(),
        "is_integrated": normalize_loose_text(document.get("is_integrated")).lower(),
        "switched_from": normalize_loose_text(document.get("switched_from")).lower(),
        "integrate_software": normalize_loose_string_array(document.get("integrate_software")),
        "used_software": normalize_loose_string_array(document.get("used_software")),
        "title": normalize_text(document.get("title")),
        "summary": normalize_text(document.get("summary")),
        "strength": normalize_multi_value_text(document.get("strength")),
        "weakness": normalize_multi_value_text(document.get("weakness")),
        "ease_of_use": normalize_integer(document.get("ease_of_use")),
        "features_functionality": normalize_integer(document.get("features_functionality")),
        "customer_support": normalize_integer(document.get("customer_support")),
        "overall": normalize_integer(document.get("overall")),
        "client_name": normalize_text(document.get("client_name")),
        "client_email": normalize_text(document.get("client_email")).lower(),
        "client_company_name": normalize_text(document.get("client_company_name")),
        "position": normalize_text(document.get("position")),
        "location": normalize_text(document.get("location")).lower(),
        "hidden_identity": normalize_loose_text(document.get("hidden_identity")),
        "client_company_website": normalize_text(document.get("client_company_website")),
        "client_profile_link": normalize_text(document.get("client_profile_link")),
        "created_at": normalize_integer(document.get("created")),
        "updated_at": normalize_integer(document.get("updated")),
    }


def _replace_ids_with_names(values: list[str], names_by_id: dict[str, str]) -> list[str]:
    return [names_by_id.get(value, value) for value in values]


def _build_request_summary(request_record: dict) -> RequestSummaryContext:
    request_sent_unix = read_nullable_raw_number(request_record.get("request_sent"))
    created_at_unix = read_nullable_raw_number(request_record.get("created"))
    updated_at_unix = read_nullable_raw_number(request_record.get("updated"))

    return RequestSummaryContext(
        token=read_nullable_raw_text(request_record.get("token")),
        name=read_nullable_raw_text(request_record.get("name")),
        email=read_nullable_raw_text(request_record.get("email")),
        phone=read_nullable_raw_text(request_record.get("phone")),
        admin_request=read_nullable_raw_number(request_record.get("admin_request")),
        event=read_nullable_raw_text(request_record.get("event")),
        error=read_nullable_raw_text(request_record.get("error")),
        request_sent_unix=request_sent_unix,
        request_sent_iso=unix_seconds_to_iso(request_sent_unix),
        created_at_unix=created_at_unix,
        created_at_iso=unix_seconds_to_iso(created_at_unix),
        updated_at_unix=updated_at_unix,
        updated_at_iso=unix_seconds_to_iso(updated_at_unix),
    )


def _build_trust_signals(normalized_review: dict[str, object], request_record: dict | None) -> list[str]:
    signals: list[str] = []
    if request_record and read_nullable_raw_number(request_record.get("admin_request")) == 1:
        signals.append("review linked to admin_request invite")
    if str(normalized_review["client_profile_link"]).strip():
        signals.append("review includes profile link")
    if str(normalized_review["client_company_website"]).strip():
        signals.append("review includes company website")
    return signals


def _build_risk_hints(normalized_review: dict[str, object]) -> list[str]:
    hints: list[str] = []
    if not str(normalized_review["client_profile_link"]).strip():
        hints.append("review missing LinkedIn/profile link")
    if not str(normalized_review["client_company_website"]).strip():
        hints.append("review missing company website")
    if not str(normalized_review["client_company_name"]).strip():
        hints.append("review missing company name")
    return hints


def _build_vendor_conflict_hints(normalized_review: dict[str, object]) -> list[str]:
    hints: list[str] = []
    company_name = str(normalized_review["client_company_name"])
    software_name = str(normalized_review["software_name"])
    software_slug = str(normalized_review["software_slug"]).lower()
    website_host = extract_url_host(str(normalized_review["client_company_website"]) or "")

    if company_name and strings_equal_loose(company_name, software_name):
        hints.append("review client_company_name matches reviewed software name")
    if website_host and software_slug and software_slug in website_host:
        hints.append("review company website host contains software slug")
    return hints
