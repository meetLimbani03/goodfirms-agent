from __future__ import annotations

from bson import ObjectId

from app.db.mongo import MongoManager


class SoftwareReviewRepository:
    def __init__(self, mongo: MongoManager) -> None:
        self._db = mongo.database("goodfirms")

    def get_review_by_id(self, review_id: str) -> dict | None:
        if not ObjectId.is_valid(review_id):
            raise ValueError(f"Invalid Mongo ObjectId: {review_id}")

        return self._db["software-reviews"].find_one({"_id": ObjectId(review_id)})

    def get_review_request_context(
        self,
        review_id: str,
        request_token: str | None,
    ) -> dict | None:
        if not ObjectId.is_valid(review_id):
            raise ValueError(f"Invalid Mongo ObjectId: {review_id}")

        filters: list[dict] = [
            {"software_review_id": ObjectId(review_id)},
            {"software_review_id": review_id},
        ]
        if request_token:
            filters.append({"token": request_token})

        return self._db["software-review-request"].find_one({"$or": filters})

    def get_category_names(self, category_ids: list[str]) -> list[str]:
        normalized_ids = sorted({value.strip() for value in category_ids if value.strip()})
        if not normalized_ids:
            return []

        filters: list[dict] = [{"_id": {"$in": normalized_ids}}]
        object_ids = [ObjectId(value) for value in normalized_ids if ObjectId.is_valid(value)]
        if object_ids:
            filters.insert(0, {"_id": {"$in": object_ids}})

        documents = self._db["software-category"].find({"$or": filters})
        return [
            str(document.get("name", "")).strip()
            for document in documents
            if str(document.get("name", "")).strip()
        ]

    def get_software_names_by_ids(self, software_ids: list[str]) -> dict[str, str]:
        normalized_ids = sorted({value.strip() for value in software_ids if value.strip()})
        if not normalized_ids:
            return {}

        filters: list[dict] = [{"_id": {"$in": normalized_ids}}]
        object_ids = [ObjectId(value) for value in normalized_ids if ObjectId.is_valid(value)]
        if object_ids:
            filters.insert(0, {"_id": {"$in": object_ids}})

        documents = self._db["softwares"].find({"$or": filters})
        names_by_id: dict[str, str] = {}
        for document in documents:
            identifier = str(document.get("_id", "")).strip()
            name = str(document.get("name", "")).strip()
            if identifier and name:
                names_by_id[identifier] = name
        return names_by_id

    def count_reviews_for_user(
        self,
        user_id: int,
        *,
        exclude_review_id: str | None = None,
        statuses: list[int] | None = None,
    ) -> int:
        filters = {
            "$and": [
                {"$or": [{"user_id": user_id}, {"user_id": str(user_id)}]},
            ]
        }
        if statuses:
            filters["$and"].append({"is_active": {"$in": statuses}})
        if exclude_review_id and ObjectId.is_valid(exclude_review_id):
            filters["$and"].append({"_id": {"$ne": ObjectId(exclude_review_id)}})
        elif exclude_review_id:
            filters["$and"].append({"_id": {"$ne": exclude_review_id}})

        return int(self._db["software-reviews"].count_documents(filters))

    def get_compact_reviews_for_user(
        self,
        user_id: int,
        limit: int = 20,
        *,
        exclude_review_id: str | None = None,
    ) -> list[dict]:
        filters: dict = {"$and": [{"$or": [{"user_id": user_id}, {"user_id": str(user_id)}]}]}
        if exclude_review_id and ObjectId.is_valid(exclude_review_id):
            filters["$and"].append({"_id": {"$ne": ObjectId(exclude_review_id)}})
        elif exclude_review_id:
            filters["$and"].append({"_id": {"$ne": exclude_review_id}})
        cursor = (
            self._db["software-reviews"]
            .find(filters, {"title": 1, "software_name": 1, "created": 1, "is_active": 1})
            .sort("created", -1)
            .limit(limit)
        )
        return [
            {
                "review_type": "software",
                "review_id": str(document.get("_id")),
                "review_title": str(document.get("title") or "").strip(),
                "subject_name": str(document.get("software_name") or "").strip(),
                "created_at": self._iso_from_unix(document.get("created")),
                "status_label": self._status_label(document.get("is_active")),
            }
            for document in cursor
        ]

    def get_detailed_reviews_for_user(
        self,
        user_id: int,
        review_ids: list[str],
        *,
        exclude_review_id: str | None = None,
    ) -> list[dict]:
        if not review_ids:
            return []

        normalized_ids = [review_id.strip() for review_id in review_ids if review_id.strip()]
        filters: list[dict] = [{"_id": {"$in": normalized_ids}}]
        object_ids = [ObjectId(review_id) for review_id in normalized_ids if ObjectId.is_valid(review_id)]
        if object_ids:
            filters.insert(0, {"_id": {"$in": object_ids}})

        query_filters: dict[str, list[dict]] = {
            "$and": [
                {"$or": [{"user_id": user_id}, {"user_id": str(user_id)}]},
                {"$or": filters},
            ]
        }
        if exclude_review_id and ObjectId.is_valid(exclude_review_id):
            query_filters["$and"].append({"_id": {"$ne": ObjectId(exclude_review_id)}})
        elif exclude_review_id:
            query_filters["$and"].append({"_id": {"$ne": exclude_review_id}})

        cursor = self._db["software-reviews"].find(
            query_filters,
            {
                "title": 1,
                "software_name": 1,
                "summary": 1,
                "strength": 1,
                "weakness": 1,
                "overall": 1,
                "ease_of_use": 1,
                "features_functionality": 1,
                "customer_support": 1,
                "created": 1,
                "is_active": 1,
            },
        ).sort("created", -1)

        return [
            {
                "review_type": "software",
                "review_id": str(document.get("_id")),
                "subject_name": str(document.get("software_name") or "").strip(),
                "review_title": str(document.get("title") or "").strip(),
                "summary": str(document.get("summary") or "").strip(),
                "strength": str(document.get("strength") or "").strip(),
                "weakness": str(document.get("weakness") or "").strip(),
                "ratings": {
                    "ease_of_use": document.get("ease_of_use"),
                    "features_functionality": document.get("features_functionality"),
                    "customer_support": document.get("customer_support"),
                    "overall": document.get("overall"),
                },
                "created_at": self._iso_from_unix(document.get("created")),
                "status_label": self._status_label(document.get("is_active")),
            }
            for document in cursor
        ]

    def _status_label(self, status_code: object) -> str:
        try:
            value = int(status_code)
        except (TypeError, ValueError):
            return "Unknown"
        if value == 0:
            return "Pending"
        if value == 1:
            return "Approved"
        if value == 2:
            return "Rejected"
        return "Unknown"

    def _iso_from_unix(self, value: object) -> str:
        try:
            timestamp = int(float(str(value)))
        except (TypeError, ValueError):
            return ""
        from datetime import UTC, datetime

        return datetime.fromtimestamp(timestamp, UTC).isoformat().replace("+00:00", "Z")
