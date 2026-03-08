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
