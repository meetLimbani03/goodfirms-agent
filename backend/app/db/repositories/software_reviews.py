from __future__ import annotations

from bson import ObjectId

from app.db.mongo import MongoManager


class SoftwareReviewRepository:
    def __init__(self, mongo: MongoManager) -> None:
        self._db = mongo.client["goodfirms"]

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
