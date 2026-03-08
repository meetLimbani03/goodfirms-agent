import { MongoClient, ObjectId } from "mongodb";

import type { SoftwareReviewDocument, SoftwareReviewRequestDocument } from "./types.js";

let cachedClient: MongoClient | null = null;

export async function getMongoClient(mongoUri: string): Promise<MongoClient> {
  if (!cachedClient) {
    cachedClient = new MongoClient(mongoUri);
    await cachedClient.connect();
  }

  return cachedClient;
}

export async function loadSoftwareReviewById(
  mongoUri: string,
  reviewId: string,
): Promise<SoftwareReviewDocument | null> {
  if (!ObjectId.isValid(reviewId)) {
    throw new Error(`Invalid Mongo ObjectId: ${reviewId}`);
  }

  const client = await getMongoClient(mongoUri);
  const collection = client.db("goodfirms").collection<SoftwareReviewDocument>("software-reviews");

  return collection.findOne({ _id: new ObjectId(reviewId) } as never);
}

export async function listOtherSoftwareReviewsByUser(
  mongoUri: string,
  userId: string,
  currentReviewId: string,
  limit: number,
): Promise<SoftwareReviewDocument[]> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    return [];
  }

  const client = await getMongoClient(mongoUri);
  const collection = client.db("goodfirms").collection<SoftwareReviewDocument>("software-reviews");
  const query: Record<string, unknown> = {
    $or: buildUserIdFilters(normalizedUserId),
  };

  if (ObjectId.isValid(currentReviewId)) {
    query._id = {
      $ne: new ObjectId(currentReviewId),
    };
  }

  return collection
    .find(query as never, {
      sort: {
        created: -1,
        _id: -1,
      },
      limit: clampToolLimit(limit),
    })
    .toArray();
}

export async function loadOtherSoftwareReviewByUserAndId(
  mongoUri: string,
  userId: string,
  currentReviewId: string,
  reviewId: string,
): Promise<SoftwareReviewDocument | null> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    return null;
  }
  if (!ObjectId.isValid(reviewId) || reviewId === currentReviewId) {
    return null;
  }

  const client = await getMongoClient(mongoUri);
  const collection = client.db("goodfirms").collection<SoftwareReviewDocument>("software-reviews");

  return collection.findOne({
    _id: new ObjectId(reviewId),
    $or: buildUserIdFilters(normalizedUserId),
  } as never);
}

export async function listSoftwareReviewIdsByCreatedRange(
  mongoUri: string,
  createdFromInclusive: number,
  createdToExclusive: number,
): Promise<string[]> {
  const client = await getMongoClient(mongoUri);
  const collection = client.db("goodfirms").collection<SoftwareReviewDocument>("software-reviews");

  const documents = await collection
    .find(
      {
        created: {
          $gte: createdFromInclusive,
          $lt: createdToExclusive,
        },
      } as never,
      {
        projection: {
          _id: 1,
        },
        sort: {
          created: 1,
          _id: 1,
        },
      },
    )
    .toArray();

  return documents.map((document) => String(document._id ?? "").trim()).filter(Boolean);
}

export async function loadSoftwareReviewRequestContext(
  mongoUri: string,
  reviewId: string,
  requestToken?: string | null,
): Promise<SoftwareReviewRequestDocument | null> {
  if (!ObjectId.isValid(reviewId)) {
    throw new Error(`Invalid Mongo ObjectId: ${reviewId}`);
  }

  const client = await getMongoClient(mongoUri);
  const collection = client
    .db("goodfirms")
    .collection<SoftwareReviewRequestDocument>("software-review-request");

  const reviewObjectId = new ObjectId(reviewId);
  const orFilters: Record<string, unknown>[] = [
    { software_review_id: reviewObjectId },
    { software_review_id: reviewId },
  ];

  if (requestToken?.trim()) {
    orFilters.push({ token: requestToken.trim() });
  }

  return collection.findOne({ $or: orFilters } as never);
}

export async function loadSoftwareCategoryNames(
  mongoUri: string,
  categoryIds: string[],
): Promise<string[]> {
  const normalizedIds = Array.from(new Set(categoryIds.map((value) => value.trim()).filter(Boolean)));
  if (normalizedIds.length === 0) {
    return [];
  }

  const client = await getMongoClient(mongoUri);
  const collection = client
    .db("goodfirms")
    .collection<{ _id: unknown; name?: unknown }>("software-category");

  const filters: Record<string, unknown>[] = [];
  const objectIds = normalizedIds.filter((value) => ObjectId.isValid(value)).map((value) => new ObjectId(value));
  if (objectIds.length > 0) {
    filters.push({ _id: { $in: objectIds } });
  }
  filters.push({ _id: { $in: normalizedIds } });

  const documents = await collection.find({ $or: filters } as never).toArray();
  return documents
    .map((document) => (typeof document.name === "string" ? document.name.trim() : ""))
    .filter(Boolean);
}

export async function loadSoftwareNamesByIds(
  mongoUri: string,
  softwareIds: string[],
): Promise<Record<string, string>> {
  const normalizedIds = Array.from(new Set(softwareIds.map((value) => value.trim()).filter(Boolean)));
  if (normalizedIds.length === 0) {
    return {};
  }

  const client = await getMongoClient(mongoUri);
  const collection = client
    .db("goodfirms")
    .collection<{ _id: unknown; name?: unknown }>("softwares");

  const filters: Record<string, unknown>[] = [];
  const objectIds = normalizedIds.filter((value) => ObjectId.isValid(value)).map((value) => new ObjectId(value));
  if (objectIds.length > 0) {
    filters.push({ _id: { $in: objectIds } });
  }
  filters.push({ _id: { $in: normalizedIds } });

  const documents = await collection.find({ $or: filters } as never).toArray();
  const namesById: Record<string, string> = {};
  for (const document of documents) {
    const id = String(document._id ?? "").trim();
    const name = typeof document.name === "string" ? document.name.trim() : "";
    if (id && name) {
      namesById[id] = name;
    }
  }

  return namesById;
}

export async function closeMongoClient(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
  }
}

function buildUserIdFilters(userId: string): Record<string, unknown>[] {
  const filters: Record<string, unknown>[] = [{ user_id: userId }];
  const numericUserId = Number.parseInt(userId, 10);
  if (Number.isInteger(numericUserId)) {
    filters.push({ user_id: numericUserId });
  }

  return filters;
}

function clampToolLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return 10;
  }

  return Math.max(1, Math.min(20, Math.trunc(limit)));
}
