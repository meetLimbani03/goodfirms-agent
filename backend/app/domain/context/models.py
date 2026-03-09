from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


ReviewContextProjection = Literal["agent", "audit"]


class ReviewRecordContext(BaseModel):
    mongo_id: str
    status_code: int | None
    status_label: str
    step: int | None
    rejection_reason: str | None
    response: str | None
    request_token: str | None
    submitted_by: int | None
    publish_date_unix: int | None
    publish_date_iso: str | None
    created_at_unix: int | None
    created_at_iso: str | None
    updated_at_unix: int | None
    updated_at_iso: str | None


class SoftwareSubjectContext(BaseModel):
    software_id: str
    name: str
    slug: str
    categories: list[str] = Field(default_factory=list)


class UsageContext(BaseModel):
    duration_value: int | None
    duration_unit: str | None
    frequency: str | None
    pricing: str | None
    integrated_other_software: str | None
    integrated_software: list[str] = Field(default_factory=list)
    switched_from_other_software: str | None
    used_software_before_switch: list[str] = Field(default_factory=list)


class RatingsContext(BaseModel):
    ease_of_use: int | None
    features_functionality: int | None
    customer_support: int | None
    overall: int | None


class ReviewContentContext(BaseModel):
    title: str
    summary: str
    strength: str
    weakness: str
    ratings: RatingsContext


class ReviewerProfileContext(BaseModel):
    name: str
    email: str
    email_domain: str | None
    company_name: str | None
    position: str | None
    location: str | None
    posting_preference_code: str | None
    posting_preference_label: str | None
    company_website: str | None
    company_website_host: str | None
    profile_link: str | None
    profile_link_host: str | None


class RequestSummaryContext(BaseModel):
    token: str | None
    name: str | None
    email: str | None
    phone: str | None
    admin_request: int | None
    event: str | None
    error: str | None
    request_sent_unix: int | None
    request_sent_iso: str | None
    created_at_unix: int | None
    created_at_iso: str | None
    updated_at_unix: int | None
    updated_at_iso: str | None


class RequestContext(BaseModel):
    found: bool
    request: RequestSummaryContext | None


class DerivedSignalsContext(BaseModel):
    inferred_login_method: Literal["unknown"] = "unknown"
    auth_evidence: list[str] = Field(default_factory=lambda: ["Mongo-only context; account enrichment not loaded"])
    review_email_matches_account_email: bool | None = None
    review_name_matches_account_name: bool | None = None
    review_company_matches_account_company: bool | None = None
    vendor_conflict_hints: list[str] = Field(default_factory=list)
    trust_signals: list[str] = Field(default_factory=list)
    risk_hints: list[str] = Field(default_factory=list)


class GroundTruthContext(BaseModel):
    status_label: str
    rejection_reason: str | None
    is_pending: bool
    is_published: bool
    is_rejected: bool


class ProvenanceContext(BaseModel):
    mongo_collection: Literal["software-reviews"] = "software-reviews"
    related_mongo_collections: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class SoftwareReviewContext(BaseModel):
    context_version: str
    generated_at: str
    review_type: Literal["software"] = "software"
    review_id: str
    review_record: ReviewRecordContext
    software: SoftwareSubjectContext
    usage: UsageContext
    review_content: ReviewContentContext
    reviewer_profile: ReviewerProfileContext
    request_context: RequestContext
    derived_signals: DerivedSignalsContext
    ground_truth: GroundTruthContext
    provenance: ProvenanceContext


AgentSoftwareReviewProjection = dict[str, Any]
AuditSoftwareReviewProjection = dict[str, Any]
