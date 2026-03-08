import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import type { AppConfig } from "./config.js";
import { pushEvent } from "./logger.js";
import { loadSoftwareReviewById } from "./mongo.js";
import { normalizeReview } from "./normalize.js";
import { requestDecision } from "./openrouter.js";
import { runPrechecks } from "./precheck.js";
import { buildAnalysisPrompt } from "./prompt.js";
import type { PipelineState } from "./types.js";

const State = Annotation.Root({
  runId: Annotation<string>(),
  reviewId: Annotation<string>(),
  isTestMode: Annotation<boolean>(),
  rawReview: Annotation<PipelineState["rawReview"]>(),
  normalizedReview: Annotation<PipelineState["normalizedReview"]>(),
  prompt: Annotation<PipelineState["prompt"]>(),
  precheck: Annotation<PipelineState["precheck"]>(),
  decision: Annotation<PipelineState["decision"]>(),
  responseMeta: Annotation<PipelineState["responseMeta"]>(),
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
    .addNode("buildAnalysisPrompt", async (state: PipelineState) => {
      if (!state.precheck?.eligible) {
        return { prompt: null };
      }

      if (!state.normalizedReview) {
        throw new Error("Cannot build prompt before normalization");
      }

      return {
        prompt: buildAnalysisPrompt(state.normalizedReview),
      };
    })
    .addNode("callDecisionModel", async (state: PipelineState) => {
      const startedAt = Date.now();
      if (!state.precheck?.eligible) {
        return {
          decision: null,
          responseMeta: null,
        };
      }

      if (!state.prompt) {
        throw new Error("Cannot call model without a prompt");
      }

      const result = await requestDecision(config, state.prompt, state.reviewId, state.runId);
      pushEvent(state, {
        event: "model_response",
        graphNode: "callDecisionModel",
        durationMs: Date.now() - startedAt,
        model: result.meta.model,
        responseId: result.meta.responseId,
        decision: result.decision.overallDecision,
        canEnhance: result.decision.canEnhance,
        confidence: result.decision.confidence,
        summary: result.decision.summary,
        riskFlags: result.decision.riskFlags,
        checks: result.decision.checks,
        usage: result.meta.usage,
        reasoningSummary: result.meta.reasoningSummary,
      });

      return {
        decision: result.decision,
        responseMeta: result.meta,
      };
    })
    .addEdge(START, "loadReview")
    .addEdge("loadReview", "normalizeReview")
    .addEdge("normalizeReview", "runPrechecks")
    .addConditionalEdges("runPrechecks", (state: PipelineState) =>
      state.precheck?.eligible ? "buildAnalysisPrompt" : END,
    )
    .addEdge("buildAnalysisPrompt", "callDecisionModel")
    .addEdge("callDecisionModel", END)
    .compile();
}
