from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel, Field

from app.core.logging import logger
from app.db.repositories.service_reviews import ServiceReviewRepository
from app.db.repositories.software_reviews import SoftwareReviewRepository


class ReviewerHistoryToolInput(BaseModel):
    reviewer_id: str = Field(description="GoodFirms reviewer or user id")
    review_ids_csv: str | None = Field(
        default=None,
        description="Optional comma-separated review ids. When provided, return full context for those reviews owned by the reviewer.",
    )


@dataclass
class ReviewerReviewStats:
    previous_reviews: int
    previously_approved_reviews: int
    previously_rejected_reviews: int


@dataclass
class ReviewerHistoryLookupService:
    software_reviews: SoftwareReviewRepository
    service_reviews: ServiceReviewRepository

    def get_review_stats(self, reviewer_id: int, current_review_id: str) -> ReviewerReviewStats:
        logger.info(
            "reviewer_history_stats_started reviewer_id={reviewer_id} exclude_review_id={exclude_review_id}",
            reviewer_id=reviewer_id,
            exclude_review_id=current_review_id,
        )
        previous_software_reviews = self.software_reviews.count_reviews_for_user(
            reviewer_id,
            exclude_review_id=current_review_id,
        )
        previous_service_reviews = self.service_reviews.count_reviews_for_user(
            reviewer_id,
            exclude_review_id=current_review_id,
        )
        approved_software_reviews = self.software_reviews.count_reviews_for_user(
            reviewer_id,
            exclude_review_id=current_review_id,
            statuses=[1],
        )
        approved_service_reviews = self.service_reviews.count_reviews_for_user(
            reviewer_id,
            exclude_review_id=current_review_id,
            statuses=[1],
        )
        rejected_software_reviews = self.software_reviews.count_reviews_for_user(
            reviewer_id,
            exclude_review_id=current_review_id,
            statuses=[2],
        )
        rejected_service_reviews = self.service_reviews.count_reviews_for_user(
            reviewer_id,
            exclude_review_id=current_review_id,
            statuses=[2],
        )
        stats = ReviewerReviewStats(
            previous_reviews=previous_software_reviews + previous_service_reviews,
            previously_approved_reviews=approved_software_reviews + approved_service_reviews,
            previously_rejected_reviews=rejected_software_reviews + rejected_service_reviews,
        )
        logger.info(
            "reviewer_history_stats_completed reviewer_id={reviewer_id} previous_reviews={previous_reviews} previously_approved_reviews={previously_approved_reviews} previously_rejected_reviews={previously_rejected_reviews}",
            reviewer_id=reviewer_id,
            previous_reviews=stats.previous_reviews,
            previously_approved_reviews=stats.previously_approved_reviews,
            previously_rejected_reviews=stats.previously_rejected_reviews,
        )
        return stats

    def lookup(
        self,
        reviewer_id: str,
        review_ids_csv: str | None = None,
        *,
        exclude_review_id: str | None = None,
    ) -> str:
        numeric_reviewer_id = self._parse_reviewer_id(reviewer_id)
        review_ids = self._parse_review_ids(review_ids_csv)
        logger.info(
            "reviewer_history_lookup_started reviewer_id={reviewer_id} review_ids_count={review_ids_count} exclude_review_id={exclude_review_id}",
            reviewer_id=numeric_reviewer_id,
            review_ids_count=len(review_ids),
            exclude_review_id=exclude_review_id or "not_set",
        )

        if review_ids:
            records = (
                self.software_reviews.get_detailed_reviews_for_user(
                    numeric_reviewer_id,
                    review_ids,
                    exclude_review_id=exclude_review_id,
                )
                + self.service_reviews.get_detailed_reviews_for_user(
                    numeric_reviewer_id,
                    review_ids,
                    exclude_review_id=exclude_review_id,
                )
            )
            if not records:
                logger.info(
                    "reviewer_history_lookup_completed reviewer_id={reviewer_id} mode=detailed record_count=0",
                    reviewer_id=numeric_reviewer_id,
                )
                return "No matching reviews were found for the reviewer and requested review ids."
            logger.info(
                "reviewer_history_lookup_completed reviewer_id={reviewer_id} mode=detailed record_count={record_count}",
                reviewer_id=numeric_reviewer_id,
                record_count=len(records),
            )
            return self._render_detailed(records)

        compact_records = (
            self.software_reviews.get_compact_reviews_for_user(
                numeric_reviewer_id,
                exclude_review_id=exclude_review_id,
            )
            + self.service_reviews.get_compact_reviews_for_user(
                numeric_reviewer_id,
                exclude_review_id=exclude_review_id,
            )
        )
        compact_records.sort(key=lambda record: record.get("created_at") or "", reverse=True)
        if not compact_records:
            logger.info(
                "reviewer_history_lookup_completed reviewer_id={reviewer_id} mode=compact record_count=0",
                reviewer_id=numeric_reviewer_id,
            )
            return "No reviews were found for this reviewer."
        logger.info(
            "reviewer_history_lookup_completed reviewer_id={reviewer_id} mode=compact record_count={record_count}",
            reviewer_id=numeric_reviewer_id,
            record_count=min(len(compact_records), 20),
        )
        return self._render_compact(compact_records[:20])

    def _parse_reviewer_id(self, reviewer_id: str) -> int:
        try:
            value = int(reviewer_id.strip())
        except (AttributeError, ValueError) as exc:
            raise ValueError("reviewer_id must be a valid integer-like string") from exc
        if value <= 0:
            raise ValueError("reviewer_id must be a positive integer-like string")
        return value

    def _parse_review_ids(self, review_ids_csv: str | None) -> list[str]:
        if not review_ids_csv:
            return []
        return [value.strip() for value in review_ids_csv.split(",") if value.strip()]

    def _render_compact(self, records: list[dict]) -> str:
        lines = ["# Reviewer History", ""]
        for index, record in enumerate(records, start=1):
            lines.extend(
                [
                    f"## Review {index}",
                    f"- Review Type: {record['review_type']}",
                    f"- Review ID: {record['review_id']}",
                    f"- Review Title: {record['review_title'] or 'Not available'}",
                    f"- Subject Name: {record['subject_name'] or 'Not available'}",
                    f"- Created At: {record['created_at'] or 'Not available'}",
                    f"- Status: {record['status_label'] or 'Not available'}",
                    "",
                ]
            )
        return "\n".join(lines).rstrip()

    def _render_detailed(self, records: list[dict]) -> str:
        lines = ["# Reviewer History Detailed Context", ""]
        for index, record in enumerate(records, start=1):
            lines.extend(
                [
                    f"## Review {index}",
                    f"- Review Type: {record['review_type']}",
                    f"- Review ID: {record['review_id']}",
                    f"- Subject Name: {record['subject_name'] or 'Not available'}",
                    f"- Review Title: {record.get('review_title') or 'Not available'}",
                ]
            )
            if record["review_type"] == "service":
                lines.append(f"- Project Name: {record.get('project_name') or 'Not available'}")
            lines.extend(
                [
                    f"- Summary: {record.get('summary') or 'Not available'}",
                    f"- Strength: {record.get('strength') or 'Not available'}",
                    f"- Weakness: {record.get('weakness') or 'Not available'}",
                    f"- Ratings: {self._format_ratings(record.get('ratings') or {})}",
                    f"- Created At: {record['created_at'] or 'Not available'}",
                    f"- Status: {record['status_label'] or 'Not available'}",
                    "",
                ]
            )
        return "\n".join(lines).rstrip()

    def _format_ratings(self, ratings: dict) -> str:
        parts = [f"{key}: {value}" for key, value in ratings.items() if value not in (None, "", 0)]
        return ", ".join(parts) if parts else "Not available"
