import process from "node:process";

import { getConfig } from "./config.js";
import { createPipelineGraph } from "./graph.js";
import { flushRunLog, logCheck, logStep, pushEvent } from "./logger.js";
import { closeMongoClient } from "./mongo.js";
import { createRunId } from "./utils.js";
import type { PipelineState } from "./types.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const isTestMode = args.includes("--test");
  const positionalArgs = args.filter((arg) => arg !== "--test");
  const reviewId = positionalArgs[0]?.trim();
  if (!reviewId || positionalArgs.length !== 1) {
    console.error("Usage: goodfirms-review [--test] <software_review_mongo_id>");
    process.exitCode = 1;
    return;
  }

  const config = getConfig();
  const state: PipelineState = {
    runId: createRunId(),
    reviewId,
    isTestMode,
    rawReview: null,
    normalizedReview: null,
    prompt: null,
    precheck: null,
    decision: null,
    responseMeta: null,
    events: [],
    startTimeMs: Date.now(),
  };

  pushEvent(state, {
    event: "run_started",
    graphNode: "cli",
    model: config.openRouterModel,
  });

  logStep(`Starting software review pipeline for ${reviewId}`);
  logStep(`Model from .env: ${config.openRouterModel}`);
  if (isTestMode) {
    logStep("Test mode enabled: skipping the is_active pending-status precheck only");
  }

  try {
    const graph = createPipelineGraph(config);
    const finalState = (await graph.invoke(state)) as PipelineState;

    logStep("Precheck results");
    for (const label of finalState.precheck?.passed ?? []) {
      logCheck(label, true);
    }
    for (const label of finalState.precheck?.failed ?? []) {
      logCheck(label, false);
    }

    if (!finalState.precheck?.eligible) {
      logStep("Review is not eligible for the agent. Exiting before model call.");
      pushEvent(finalState, {
        event: "run_completed",
        graphNode: "cli",
        durationMs: Date.now() - finalState.startTimeMs,
        ...(finalState.precheck?.passed ? { precheckPassed: finalState.precheck.passed } : {}),
        ...(finalState.precheck?.failed ? { precheckFailed: finalState.precheck.failed } : {}),
      });

      const logPath = await flushRunLog(finalState, config.logDir);
      logStep(`Run log written to ${logPath}`);
      process.exitCode = 2;
      return;
    }

    logStep("Model response");
    console.log(`  Response ID: ${finalState.responseMeta?.responseId || "n/a"}`);
    console.log(`  Model: ${finalState.responseMeta?.model || config.openRouterModel}`);
    console.log(`  Overall Decision: ${finalState.decision?.overallDecision || "n/a"}`);
    console.log(`  Can Enhance: ${finalState.decision?.canEnhance ?? "n/a"}`);
    console.log(`  Confidence: ${finalState.decision?.confidence ?? "n/a"}`);
    console.log(`  Summary: ${finalState.decision?.summary || "n/a"}`);
    console.log(
      `  Risk Flags: ${
        finalState.decision?.riskFlags.length ? finalState.decision.riskFlags.join(", ") : "none"
      }`,
    );
    if (finalState.decision?.checks) {
      console.log("  Checks:");
      for (const [checkName, checkResult] of Object.entries(finalState.decision.checks)) {
        console.log(`    - ${checkName}: ${checkResult.status} (${checkResult.reason})`);
      }
    }
    console.log(
      `  Tokens: ${JSON.stringify(finalState.responseMeta?.usage ?? {}, null, 0) || "n/a"}`,
    );

    const reasoningTokens =
      finalState.responseMeta?.usage?.output_tokens_details?.reasoning_tokens ?? null;
    console.log(`  Reasoning Tokens: ${reasoningTokens ?? "not exposed"}`);

    if (finalState.responseMeta?.reasoningSummary) {
      console.log("  Reasoning Summary:");
      console.log(finalState.responseMeta.reasoningSummary);
    }

    pushEvent(finalState, {
      event: "run_completed",
      graphNode: "cli",
      durationMs: Date.now() - finalState.startTimeMs,
      model: finalState.responseMeta?.model || config.openRouterModel,
      ...(finalState.responseMeta?.responseId
        ? { responseId: finalState.responseMeta.responseId }
        : {}),
      ...(finalState.decision?.overallDecision
        ? { decision: finalState.decision.overallDecision }
        : {}),
      ...(finalState.decision?.canEnhance !== undefined
        ? { canEnhance: finalState.decision.canEnhance }
        : {}),
      ...(finalState.decision?.confidence !== undefined
        ? { confidence: finalState.decision.confidence }
        : {}),
      ...(finalState.decision?.summary
        ? { summary: finalState.decision.summary }
        : {}),
      ...(finalState.decision?.riskFlags ? { riskFlags: finalState.decision.riskFlags } : {}),
      ...(finalState.decision?.checks ? { checks: finalState.decision.checks } : {}),
      ...(finalState.responseMeta?.usage ? { usage: finalState.responseMeta.usage } : {}),
      ...(finalState.responseMeta?.reasoningSummary
        ? { reasoningSummary: finalState.responseMeta.reasoningSummary }
        : {}),
      ...(finalState.precheck?.passed ? { precheckPassed: finalState.precheck.passed } : {}),
      ...(finalState.precheck?.failed ? { precheckFailed: finalState.precheck.failed } : {}),
    });

    const logPath = await flushRunLog(finalState, config.logDir);
    logStep(`Run log written to ${logPath}`);
    process.exitCode = finalState.decision?.canEnhance ? 0 : 3;
  } catch (error) {
    const typedError = error as Error;
    logStep(`Pipeline failed: ${typedError.message}`);
    pushEvent(state, {
      event: "run_failed",
      graphNode: "cli",
      durationMs: Date.now() - state.startTimeMs,
      model: config.openRouterModel,
      error: {
        name: typedError.name,
        message: typedError.message,
        ...(typedError.stack ? { stack: typedError.stack } : {}),
      },
    });

    const logPath = await flushRunLog(state, config.logDir);
    logStep(`Run log written to ${logPath}`);
    process.exitCode = 1;
  } finally {
    await closeMongoClient();
  }
}

void main();
