from __future__ import annotations

from app.domain.context.models import ReviewContextProjection, SoftwareReviewContext


def project_software_review_context(
    context: SoftwareReviewContext,
    projection: ReviewContextProjection,
) -> dict[str, object]:
    base_projection: dict[str, object] = {
        "context_version": context.context_version,
        "review_type": context.review_type,
        "review_id": context.review_id,
        "software": context.software.model_dump(),
        "usage": context.usage.model_dump(),
        "review": context.review_content.model_dump(),
        "reviewer": context.reviewer_profile.model_dump(),
        "request_context": {
            "found": context.request_context.found,
            "request": (
                {
                    "admin_request": context.request_context.request.admin_request,
                    "event": context.request_context.request.event,
                    "email": context.request_context.request.email,
                    "name": context.request_context.request.name,
                }
                if context.request_context.request
                else None
            ),
        },
        "derived_signals": context.derived_signals.model_dump(),
    }

    if projection == "agent":
        return base_projection

    return {
        **base_projection,
        "review_record": context.review_record.model_dump(),
        "ground_truth": context.ground_truth.model_dump(),
        "provenance": context.provenance.model_dump(),
        "request_context": context.request_context.model_dump(),
    }
