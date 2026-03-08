import process from "node:process";

import { getConfig } from "./config.js";
import { logStep } from "./logger.js";
import { closeMongoClient, listSoftwareReviewIdsByCreatedRange } from "./mongo.js";
import { closeMySqlPool } from "./mysql.js";
import {
  buildReviewContext,
  type ReviewContextProjection,
  writeReviewContextMarkdown,
} from "./review-context.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const fromDate = readRequiredArg(args, "--from");
  const toDate = readRequiredArg(args, "--to");
  const projection = readProjectionArg(args);
  const outputDir = readOutputDirArg(args) || "docs/batches/review-context";
  const concurrency = readConcurrencyArg(args) || 4;

  if (!fromDate || !toDate) {
    console.error(
      "Usage: goodfirms-review-context-batch --from YYYY-MM-DD --to YYYY-MM-DD [--projection agent|audit|evaluation] [--out <dir>] [--concurrency <n>]",
    );
    process.exitCode = 1;
    return;
  }

  const createdFromInclusive = parseUtcDateToUnix(fromDate);
  const createdToExclusive = parseUtcDateToUnix(toDate);

  if (createdToExclusive <= createdFromInclusive) {
    throw new Error("--to must be later than --from");
  }

  const config = getConfig();

  try {
    logStep(
      `Listing software reviews created between ${fromDate} and ${toDate} (UTC, end exclusive)`,
    );

    const reviewIds = await listSoftwareReviewIdsByCreatedRange(
      config.mongoUri,
      createdFromInclusive,
      createdToExclusive,
    );

    logStep(`Found ${reviewIds.length} software reviews to export`);
    logStep(`Projection: ${projection}`);
    logStep(`Output dir: ${outputDir}`);
    logStep(`Concurrency: ${concurrency}`);

    let completed = 0;
    await runWithConcurrency(reviewIds, concurrency, async (reviewId) => {
      const context = await buildReviewContext(config, reviewId);
      await writeReviewContextMarkdown(context, projection, outputDir);
      completed += 1;

      if (completed % 25 === 0 || completed === reviewIds.length) {
        logStep(`Exported ${completed}/${reviewIds.length} review contexts`);
      }
    });

    logStep(`Batch context export completed for ${reviewIds.length} reviews`);
  } finally {
    await closeMongoClient();
    await closeMySqlPool();
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const limit = Math.max(1, concurrency);
  let index = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      await worker(items[currentIndex] as T);
    }
  });

  await Promise.all(runners);
}

function readRequiredArg(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  return value?.trim() ? value.trim() : null;
}

function readProjectionArg(args: string[]): ReviewContextProjection {
  const value = readRequiredArg(args, "--projection");

  if (value === "agent" || value === "audit" || value === "evaluation") {
    return value;
  }

  return "audit";
}

function readOutputDirArg(args: string[]): string | null {
  return readRequiredArg(args, "--out");
}

function readConcurrencyArg(args: string[]): number | null {
  const value = readRequiredArg(args, "--concurrency");
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("--concurrency must be a positive integer");
  }

  return parsed;
}

function parseUtcDateToUnix(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date: ${value}. Expected YYYY-MM-DD`);
  }

  const millis = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(millis)) {
    throw new Error(`Invalid date: ${value}`);
  }

  return Math.floor(millis / 1000);
}

void main();
