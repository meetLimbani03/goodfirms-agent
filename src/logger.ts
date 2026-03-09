import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { nowIso, timestampFilePart } from "./utils.js";
import type { PipelineState, RunLogEvent } from "./types.js";

export function pushEvent(
  state: PipelineState,
  event: Omit<RunLogEvent, "timestamp" | "runId" | "reviewId">,
): void {
  state.events.push({
    timestamp: nowIso(),
    runId: state.runId,
    reviewId: state.reviewId,
    ...event,
  });
}

export function logStep(message: string): void {
  console.log(`[${nowIso()}] ${message}`);
}

export function logCheck(label: string, passed: boolean, details?: string): void {
  const status = passed ? "PASS" : "FAIL";
  const suffix = details ? `: ${details}` : "";
  console.log(`  [${status}] ${label}${suffix}`);
}

export async function flushRunLog(state: PipelineState, logDir: string): Promise<string> {
  await mkdir(logDir, { recursive: true });

  const fileName = `${timestampFilePart()}_${state.reviewId}.jsonl`;
  const filePath = path.join(logDir, fileName);
  const body = `${state.events.map((event) => JSON.stringify(event)).join("\n")}\n`;

  await writeFile(filePath, body, "utf8");
  return filePath;
}
