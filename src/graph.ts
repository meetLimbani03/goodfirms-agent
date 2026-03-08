import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import { runDecisionAgent } from "./agent/loop.js";
import type { AppConfig } from "./config.js";
import { pushEvent } from "./logger.js";
import { loadSoftwareReviewById } from "./mongo.js";
import { normalizeReview } from "./normalize.js";
import { runPrechecks } from "./precheck.js";
import { buildReviewContextFromDocument } from "./review-context.js";
import type { PipelineState } from "./types.js";

const State = Annotation.Root({
  runId: Annotation<string>(),
  reviewId: Annotation<string>(),
  isTestMode: Annotation<boolean>(),
  rawReview: Annotation<PipelineState["rawReview"]>(),
  normalizedReview: Annotation<PipelineState["normalizedReview"]>(),
  reviewContext: Annotation<PipelineState["reviewContext"]>(),
  precheck: Annotation<PipelineState["precheck"]>(),
  decision: Annotation<PipelineState["decision"]>(),
  responseMeta: Annotation<PipelineState["responseMeta"]>(),
  agentSummary: Annotation<PipelineState["agentSummary"]>(),
  events: Annotation<PipelineState["events"]>(),
  startTimeMs: Annotation<number>(),
});

export function createPipelineGraph(config: AppConfig) {
  return new StateGraph(State)
    .addNode("loadReview", async (state: PipelineState) => {
      const startedAt = Date.now();
      const rawReview = await loadSoftwareReviewById(config.mongoUri, state.reviewId);

      if (!rawReview) {
        throw new Error(`Software review not found: ${state.reviewId}`);
      }

      pushEvent(state, {
        event: "review_loaded",
        graphNode: "loadReview",
        durationMs: Date.now() - startedAt,
        data: {
          softwareName: typeof rawReview.software_name === "string" ? rawReview.software_name : "",
          step: rawReview.step,
          isActive: rawReview.is_active,
        },
      });

      return { rawReview };
    })
    .addNode("normalizeReview", async (state: PipelineState) => {
      const startedAt = Date.now();
      if (!state.rawReview) {
        throw new Error("Cannot normalize review before it is loaded");
      }

      const normalizedReview = normalizeReview(state.rawReview);
      pushEvent(state, {
        event: "review_normalized",
        graphNode: "normalizeReview",
        durationMs: Date.now() - startedAt,
        data: {
          categories: normalizedReview.categories,
          hiddenIdentity: normalizedReview.hiddenIdentity,
          ratings: {
            easeOfUse: normalizedReview.easeOfUse,
            featuresFunctionality: normalizedReview.featuresFunctionality,
            customerSupport: normalizedReview.customerSupport,
            overall: normalizedReview.overall,
          },
        },
      });

      return { normalizedReview };
    })
    .addNode("runPrechecks", async (state: PipelineState) => {
      const startedAt = Date.now();
      if (!state.normalizedReview) {
        throw new Error("Cannot run prechecks before normalization");
      }

      const precheck = runPrechecks(state.normalizedReview, {
        skipStatusCheck: state.isTestMode,
      });
      pushEvent(state, {
        event: "precheck_result",
        graphNode: "runPrechecks",
        durationMs: Date.now() - startedAt,
        precheckPassed: precheck.passed,
        precheckFailed: precheck.failed,
      });

      return { precheck };
    })
    .addNode("buildReviewContext", async (state: PipelineState) => {
      if (!state.precheck?.eligible) {
        return { reviewContext: null };
      }

      if (!state.rawReview) {
        throw new Error("Cannot build review context before the review is loaded");
      }

      const startedAt = Date.now();
      const reviewContext = await buildReviewContextFromDocument(config, state.rawReview);
      pushEvent(state, {
        event: "review_context_built",
        graphNode: "buildReviewContext",
        durationMs: Date.now() - startedAt,
        data: {
          userId: reviewContext.accountContext.userId,
          requestFound: reviewContext.requestContext.found,
          inferredLoginMethod: reviewContext.derivedSignals.inferredLoginMethod,
        },
      });

      return {
        reviewContext,
      };
    })
    .addNode("runDecisionAgent", async (state: PipelineState) => {
      const startedAt = Date.now();
      if (!state.precheck?.eligible) {
        return {
          decision: null,
          responseMeta: null,
          agentSummary: null,
        };
      }

      if (!state.reviewContext) {
        throw new Error("Cannot call agent without review context");
      }

      const result = await runDecisionAgent(config, state);
      pushEvent(state, {
        event: "model_response",
        graphNode: "runDecisionAgent",
        durationMs: Date.now() - startedAt,
        model: result.responseMeta.model,
        responseId: result.responseMeta.responseId,
        decision: result.decision.overallDecision,
        canEnhance: result.decision.canEnhance,
        confidence: result.decision.confidence,
        summary: result.decision.summary,
        riskFlags: result.decision.riskFlags,
        checks: result.decision.checks,
        usage: result.responseMeta.usage,
        reasoningSummary: result.responseMeta.reasoningSummary,
        data: {
          finalAction: result.agentSummary.finalAction,
          turnCount: result.agentSummary.turnCount,
          toolCallCounts: result.agentSummary.toolCallCounts,
        },
      });

      return {
        decision: result.decision,
        responseMeta: result.responseMeta,
        agentSummary: result.agentSummary,
      };
    })
    .addEdge(START, "loadReview")
    .addEdge("loadReview", "normalizeReview")
    .addEdge("normalizeReview", "runPrechecks")
    .addConditionalEdges("runPrechecks", (state: PipelineState) =>
      state.precheck?.eligible ? "buildReviewContext" : END,
    )
    .addEdge("buildReviewContext", "runDecisionAgent")
    .addEdge("runDecisionAgent", END)
    .compile();
}
