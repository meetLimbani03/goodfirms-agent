import process from "node:process";

import { getConfig } from "./config.js";
import { closeMongoClient } from "./mongo.js";
import { closeMySqlPool } from "./mysql.js";
import {
  buildReviewContext,
  type ReviewContextProjection,
  writeReviewContextMarkdown,
} from "./review-context.js";
import { logStep } from "./logger.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const reviewId = args[0]?.trim();
  const projection = readProjectionArg(args);
  const outputDir = readOutputDirArg(args) || "docs/batches/review-context";

  if (!reviewId) {
    console.error(
      "Usage: goodfirms-review-context <software_review_mongo_id> [--projection agent|audit|evaluation] [--out <dir>]",
    );
    process.exitCode = 1;
    return;
  }

  const config = getConfig();
  logStep(`Building review context for ${reviewId}`);
  logStep(`Projection: ${projection}`);

  try {
    const context = await buildReviewContext(config, reviewId);
    const filePath = await writeReviewContextMarkdown(context, projection, outputDir);
    logStep(`Review context written to ${filePath}`);
  } finally {
    await closeMongoClient();
    await closeMySqlPool();
  }
}

function readProjectionArg(args: string[]): ReviewContextProjection {
  const index = args.indexOf("--projection");
  const value = index >= 0 ? args[index + 1] : undefined;

  if (value === "agent" || value === "audit" || value === "evaluation") {
    return value;
  }

  return "audit";
}

function readOutputDirArg(args: string[]): string | null {
  const index = args.indexOf("--out");
  const value = index >= 0 ? args[index + 1] : undefined;
  return value?.trim() ? value.trim() : null;
}

void main();
