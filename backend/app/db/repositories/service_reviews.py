from __future__ import annotations

from app.db.mysql import MySQLManager


class ServiceReviewRepository:
    def __init__(self, mysql: MySQLManager) -> None:
        self._mysql = mysql

    def get_review_by_id(self, review_id: str) -> dict | None:
        if not review_id.isdigit():
            raise ValueError("Invalid service review id")

        sql = """
            SELECT
                r.id,
                r.user_id,
                r.company_profile_id,
                cp.company_name,
                cp.slug,
                r.project_name,
                r.cost,
                r.industry_id,
                i.name AS industry_name,
                r.project_status,
                r.project_summary,
                r.category_id,
                c.name AS primary_category_name,
                r.conclusion,
                r.feedback_summary,
                r.strength,
                r.weakness,
                r.quality,
                r.ability,
                r.reliability,
                r.overall,
                r.client_name,
                r.hidden_identity,
                r.client_company_name,
                r.position,
                r.location,
                r.client_company_website,
                r.client_email,
                r.client_profile_link,
                r.step,
                r.publish_status,
                r.reason,
                r.created,
                r.updated
            FROM reviews r
            LEFT JOIN company_profiles cp ON cp.id = r.company_profile_id
            LEFT JOIN categories c ON c.id = r.category_id
            LEFT JOIN industries i ON i.id = r.industry_id
            WHERE r.id = %s
            LIMIT 1
        """
        with self._mysql.connection.cursor() as cursor:
            cursor.execute(sql, (int(review_id),))
            return cursor.fetchone()

    def get_selected_category_names(self, review_id: str) -> list[str]:
        if not review_id.isdigit():
            return []

        sql = """
            SELECT DISTINCT c.name
            FROM company_review_categories crc
            INNER JOIN categories c ON c.id = crc.category_id
            WHERE crc.review_id = %s
              AND c.name IS NOT NULL
              AND TRIM(c.name) <> ''
            ORDER BY c.name
        """
        with self._mysql.connection.cursor() as cursor:
            cursor.execute(sql, (int(review_id),))
            rows = cursor.fetchall() or []
        return [str(row.get("name") or "").strip() for row in rows if str(row.get("name") or "").strip()]

    def count_reviews_for_user(
        self,
        user_id: int,
        *,
        exclude_review_id: str | None = None,
        statuses: list[int] | None = None,
    ) -> int:
        sql = """
            SELECT COUNT(*) AS review_count
            FROM reviews
            WHERE user_id = %s
        """
        params: list[object] = [user_id]
        if statuses:
            placeholders = ", ".join(["%s"] * len(statuses))
            sql += f" AND publish_status IN ({placeholders})"
            params.extend(statuses)
        if exclude_review_id and exclude_review_id.isdigit():
            sql += " AND id <> %s"
            params.append(int(exclude_review_id))

        with self._mysql.connection.cursor() as cursor:
            cursor.execute(sql, tuple(params))
            row = cursor.fetchone() or {}
        return int(row.get("review_count") or 0)

    def get_compact_reviews_for_user(
        self,
        user_id: int,
        limit: int = 20,
        *,
        exclude_review_id: str | None = None,
    ) -> list[dict]:
        sql = """
            SELECT
                r.id,
                r.user_id,
                r.conclusion,
                r.created,
                r.publish_status,
                cp.company_name
            FROM reviews r
            LEFT JOIN company_profiles cp ON cp.id = r.company_profile_id
            WHERE r.user_id = %s
            ORDER BY r.created DESC, r.id DESC
            LIMIT %s
        """
        params: list[object] = [user_id]
        if exclude_review_id and exclude_review_id.isdigit():
            sql = sql.replace("ORDER BY r.created DESC, r.id DESC", "AND r.id <> %s\n            ORDER BY r.created DESC, r.id DESC")
            params.append(int(exclude_review_id))
        params.append(limit)
        with self._mysql.connection.cursor() as cursor:
            cursor.execute(sql, tuple(params))
            rows = cursor.fetchall() or []

        return [
            {
                "review_type": "service",
                "review_id": str(row.get("id")),
                "review_title": str(row.get("conclusion") or "").strip(),
                "subject_name": str(row.get("company_name") or "").strip(),
                "created_at": str(row.get("created") or "").strip(),
                "status_label": self._status_label(row.get("publish_status")),
            }
            for row in rows
        ]

    def get_detailed_reviews_for_user(
        self,
        user_id: int,
        review_ids: list[str],
        *,
        exclude_review_id: str | None = None,
    ) -> list[dict]:
        numeric_ids = sorted({int(review_id) for review_id in review_ids if review_id.isdigit()})
        if not numeric_ids:
            return []

        placeholders = ", ".join(["%s"] * len(numeric_ids))
        sql = f"""
            SELECT
                r.id,
                r.user_id,
                r.project_name,
                r.conclusion,
                r.feedback_summary,
                r.strength,
                r.weakness,
                r.quality,
                r.ability,
                r.reliability,
                r.overall,
                r.created,
                r.publish_status,
                cp.company_name
            FROM reviews r
            LEFT JOIN company_profiles cp ON cp.id = r.company_profile_id
            WHERE r.user_id = %s
              AND r.id IN ({placeholders})
            ORDER BY r.created DESC, r.id DESC
        """
        params: list[object] = [user_id, *numeric_ids]
        if exclude_review_id and exclude_review_id.isdigit():
            sql = sql.replace("ORDER BY r.created DESC, r.id DESC", "AND r.id <> %s\n            ORDER BY r.created DESC, r.id DESC")
            params.append(int(exclude_review_id))
        with self._mysql.connection.cursor() as cursor:
            cursor.execute(sql, tuple(params))
            rows = cursor.fetchall() or []

        return [
            {
                "review_type": "service",
                "review_id": str(row.get("id")),
                "subject_name": str(row.get("company_name") or "").strip(),
                "project_name": str(row.get("project_name") or "").strip(),
                "review_title": str(row.get("conclusion") or "").strip(),
                "summary": str(row.get("feedback_summary") or "").strip(),
                "strength": str(row.get("strength") or "").strip(),
                "weakness": str(row.get("weakness") or "").strip(),
                "ratings": {
                    "quality_work": row.get("quality"),
                    "scheduling_timing": row.get("ability"),
                    "communication": row.get("reliability"),
                    "overall_experience": row.get("overall"),
                },
                "created_at": str(row.get("created") or "").strip(),
                "status_label": self._status_label(row.get("publish_status")),
            }
            for row in rows
        ]

    def _status_label(self, publish_status: object) -> str:
        try:
            value = int(publish_status)
        except (TypeError, ValueError):
            return "Unknown"

        if value == 0:
            return "Pending"
        if value == 1:
            return "Published"
        if value == 2:
            return "Rejected"
        return "Unknown"
