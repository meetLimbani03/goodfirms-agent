from __future__ import annotations

from pathlib import Path

from app.domain.context.models import ReviewContextProjection, SoftwareReviewContext
from app.domain.context.projections import project_software_review_context


def render_software_review_context_markdown(
    context: SoftwareReviewContext,
    projection: ReviewContextProjection,
) -> str:
    projected = project_software_review_context(context, projection)
    lines = [
        "# Software Review Context",
        "",
        "## Internal Only Metadata",
        f"- Projection: `{projection}`",
        f"- Review ID: `{context.review_id}`",
        f"- Generated At: `{context.generated_at}`",
        f"- Status: {context.review_record.status_label} ({context.review_record.status_code or 'unknown'})",
        f"- Step: {context.review_record.step or 'unknown'}",
        f"- Rejection Reason: {context.review_record.rejection_reason or 'none'}",
        f"- Request Token: {context.review_record.request_token or 'none'}",
        f"- Created: {context.review_record.created_at_iso or 'unknown'}",
        f"- Updated: {context.review_record.updated_at_iso or 'unknown'}",
        "",
        "## Agent-Visible Summary",
        "",
        "### Software",
        f"- Name: {context.software.name}",
        f"- Slug: {context.software.slug}",
        f"- Categories: {', '.join(context.software.categories) or 'none'}",
        "",
        "### Usage",
        f"- Duration: {_format_duration(context.usage.duration_value, context.usage.duration_unit)}",
        f"- Frequency: {context.usage.frequency or 'unknown'}",
        f"- Pricing: {context.usage.pricing or 'unknown'}",
        f"- Integrated Other Software: {context.usage.integrated_other_software or 'unknown'}",
        f"- Integrated Software: {', '.join(context.usage.integrated_software) or 'none'}",
        f"- Switched From Other Software: {context.usage.switched_from_other_software or 'unknown'}",
        f"- Used Software Before Switch: {', '.join(context.usage.used_software_before_switch) or 'none'}",
        "",
        "### Review Content",
        f"- Title: {context.review_content.title or 'empty'}",
        f"- Summary: {context.review_content.summary or 'empty'}",
        f"- Strength: {context.review_content.strength or 'empty'}",
        f"- Weakness: {context.review_content.weakness or 'empty'}",
        (
            "- Ratings: "
            f"ease_of_use={context.review_content.ratings.ease_of_use or 'unknown'}, "
            f"features_functionality={context.review_content.ratings.features_functionality or 'unknown'}, "
            f"customer_support={context.review_content.ratings.customer_support or 'unknown'}, "
            f"overall={context.review_content.ratings.overall or 'unknown'}"
        ),
        "",
        "### Reviewer Profile",
        f"- Name: {context.reviewer_profile.name or 'empty'}",
        f"- Email: {context.reviewer_profile.email or 'empty'}",
        f"- Email Domain: {context.reviewer_profile.email_domain or 'unknown'}",
        f"- Company: {context.reviewer_profile.company_name or 'empty'}",
        f"- Position: {context.reviewer_profile.position or 'empty'}",
        f"- Location: {context.reviewer_profile.location or 'empty'}",
        f"- Posting Preference: {context.reviewer_profile.posting_preference_label or 'empty'}",
        f"- Company Website: {context.reviewer_profile.company_website or 'none'}",
        f"- LinkedIn/Profile Link: {context.reviewer_profile.profile_link or 'none'}",
        "",
        "### Signals",
        f"- Trust Signals: {'; '.join(context.derived_signals.trust_signals) or 'none'}",
        f"- Risk Hints: {'; '.join(context.derived_signals.risk_hints) or 'none'}",
        f"- Vendor Conflict Hints: {'; '.join(context.derived_signals.vendor_conflict_hints) or 'none'}",
        "",
        "## Projected Payload",
        "```json",
        __import__("json").dumps(projected, indent=2),
        "```",
    ]

    if projection != "agent":
        lines.extend(
            [
                "",
                "## Ground Truth",
                f"- Status: {context.ground_truth.status_label}",
                f"- Rejection Reason: {context.ground_truth.rejection_reason or 'none'}",
            ]
        )

    return "\n".join(lines)


def write_software_review_context_markdown(
    context: SoftwareReviewContext,
    projection: ReviewContextProjection,
    output_dir: str | Path,
) -> Path:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    file_path = output_path / f"{context.review_id}.{projection}.md"
    file_path.write_text(
        render_software_review_context_markdown(context, projection),
        encoding="utf-8",
    )
    return file_path


def _format_duration(value: int | None, unit: str | None) -> str:
    if value is None and not unit:
        return "unknown"
    if value is None:
        return unit or "unknown"
    return f"{value} {unit or ''}".strip()
