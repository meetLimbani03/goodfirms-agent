import test from "node:test";
import assert from "node:assert/strict";

import type { AppConfig } from "../config.js";
import type { ReviewContext } from "../review-context.js";
import type { AgentToolResult, AgentTurnResponse, OpenRouterResponseMeta, PipelineState } from "../types.js";

import { runDecisionAgent } from "./loop.js";

function makeConfig(overrides: Partial<AppConfig["agentToolLimits"]> = {}): AppConfig {
  return {
    mongoUri: "mongodb://localhost:27017/test",
    openRouterApiKey: "test-key",
    openRouterModel: "test-model",
    logDir: "logs/test",
    mySql: {
      host: "localhost",
      port: 3306,
      user: "root",
      password: "pw",
      database: "GoodFirms",
    },
    agentToolLimits: {
      maxTurns: overrides.maxTurns ?? 2,
      perTool: {
        fetch_user_reviews: overrides.perTool?.fetch_user_reviews ?? 2,
        fetch_url_content: overrides.perTool?.fetch_url_content ?? 2,
        web_search: overrides.perTool?.web_search ?? 2,
      },
    },
  };
}

function makeState(): PipelineState {
  return {
    runId: "run-123",
    reviewId: "507f1f77bcf86cd799439011",
    isTestMode: true,
    rawReview: null,
    normalizedReview: null,
    reviewContext: makeContext(),
    precheck: null,
    decision: null,
    responseMeta: null,
    agentSummary: null,
    events: [],
    startTimeMs: Date.now(),
  };
}

function makeContext(): ReviewContext {
  return {
    contextVersion: "2026-03-08",
    generatedAt: "2026-03-08T00:00:00.000Z",
    reviewType: "software",
    reviewId: "507f1f77bcf86cd799439011",
    reviewRecord: {
      mongoId: "507f1f77bcf86cd799439011",
      statusCode: 2,
      statusLabel: "Rejected",
      step: 3,
      rejectionReason: "Unable to verify the reviewer",
      response: null,
      requestToken: null,
      submittedBy: null,
      publishDateUnix: null,
      publishDateIso: null,
      createdAtUnix: 1700000000,
      createdAtIso: "2023-11-14T22:13:20.000Z",
      updatedAtUnix: 1700003600,
      updatedAtIso: "2023-11-14T23:13:20.000Z",
    },
    software: {
      softwareId: "soft-1",
      name: "D5 Render",
      slug: "d5-render",
      categories: ["Rendering"],
    },
    usage: {
      durationValue: 6,
      durationUnit: "months",
      frequency: "daily",
      pricing: "mid-tier",
      integratedOtherSoftware: "yes",
      integratedSoftware: ["Slack"],
      switchedFromOtherSoftware: "no",
      usedSoftwareBeforeSwitch: [],
    },
    reviewContent: {
      title: "Useful software",
      summary: "It saves us time.",
      strength: "Fast",
      weakness: "Limited library",
      ratings: {
        easeOfUse: 4,
        featuresFunctionality: 4,
        customerSupport: 4,
        overall: 4,
      },
    },
    reviewerProfile: {
      name: "Jane Doe",
      email: "jane@example.com",
      emailDomain: "example.com",
      companyName: "Acme",
      position: "Designer",
      location: "us",
      postingPreferenceCode: "2",
      postingPreferenceLabel: "Only display my name with the review",
      companyWebsite: "https://acme.test",
      companyWebsiteHost: "acme.test",
      profileLink: "https://linkedin.com/in/jane",
      profileLinkHost: "linkedin.com",
    },
    accountContext: {
      userId: "42",
      accountFound: true,
      account: {
        id: 42,
        type: "company",
        name: "Jane Doe",
        email: "jane@example.com",
        emailDomain: "example.com",
        position: "Designer",
        location: "us",
        companyName: "Acme",
        companyWebsite: "https://acme.test",
        companyWebsiteHost: "acme.test",
        publicUrl: "https://linkedin.com/in/jane",
        publicUrlHost: "linkedin.com",
        totalReviews: 1,
        mergeReviewer: 0,
        isGoodfirmsRegistered: true,
        isSpam: false,
        emailVerifiedAt: "2026-02-01 00:00:00",
        emailResult: "accepted_email",
        emailReason: null,
        emailCheckedAt: "2026-02-01 00:00:00",
        googleIdPresent: true,
        socialIdPresent: false,
        inferredLoginMethod: "google",
        createdAt: "2026-02-01 00:00:00",
        updatedAt: "2026-02-01 00:00:00",
      },
      pendingEmailVerificationRecords: [],
    },
    requestContext: {
      found: false,
      request: null,
    },
    derivedSignals: {
      inferredLoginMethod: "google",
      authEvidence: ["google_id present"],
      reviewEmailMatchesAccountEmail: true,
      reviewNameMatchesAccountName: true,
      reviewCompanyMatchesAccountCompany: true,
      vendorConflictHints: [],
      trustSignals: ["user is_goodfirms_registered=1"],
      riskHints: [],
    },
    groundTruth: {
      statusLabel: "Rejected",
      rejectionReason: "Unable to verify the reviewer",
      isPending: false,
      isPublished: false,
      isRejected: true,
    },
    provenance: {
      mongoCollection: "software-reviews",
      relatedMongoCollections: [],
      mySqlDatabase: "GoodFirms",
      notes: ["test"],
    },
  };
}

function makeMeta(): OpenRouterResponseMeta {
  return {
    responseId: "resp-1",
    model: "test-model",
    usage: null,
    reasoningSummary: null,
    rawOutputText: "{}",
  };
}

function makeFinalDecision() {
  return {
    overallDecision: "borderline" as const,
    canEnhance: false,
    confidence: 0.6,
    riskFlags: ["needs_more_verification"],
    summary: "The review remains borderline after tool checks.",
    checks: {
      gibberish: { status: "pass" as const, reason: "Readable." },
      authenticity: { status: "flag" as const, reason: "Signals remain mixed." },
      spam: { status: "pass" as const, reason: "Not promotional." },
      pii: { status: "pass" as const, reason: "No review-body PII." },
      safety: { status: "pass" as const, reason: "No unsafe language." },
      consistency: { status: "pass" as const, reason: "No hard contradictions." },
      specificity: { status: "flag" as const, reason: "Could be more concrete." },
    },
  };
}

test("runDecisionAgent blocks duplicate identical tool calls and forces a final decision", async () => {
  const requestedTurns: number[] = [];
  const actions: AgentTurnResponse[] = [
    {
      action: "call_tool",
      actionSummary: "Check the user's prior reviews first.",
      toolCall: { name: "fetch_user_reviews", arguments: {} },
      finalDecision: null,
    },
    {
      action: "call_tool",
      actionSummary: "Retry the same prior-review lookup.",
      toolCall: { name: "fetch_user_reviews", arguments: {} },
      finalDecision: null,
    },
  ];

  const result = await runDecisionAgent(makeConfig(), makeState(), {
    requestTurn: async (_config, _prompt, _reviewId, _runId, turn) => {
      requestedTurns.push(turn);
      return {
        turn: actions[turn - 1]!,
        meta: makeMeta(),
      };
    },
    requestForcedFinal: async () => ({
      decision: makeFinalDecision(),
      meta: makeMeta(),
    }),
    executeTool: async (): Promise<AgentToolResult> => ({
      ok: true,
      toolName: "fetch_user_reviews",
      payload: {
        mode: "compact_list",
        total_found: 1,
        reviews: [],
      },
    }),
  });

  assert.deepEqual(requestedTurns, [1, 2]);
  assert.equal(result.agentSummary.toolCalls.length, 2);
  assert.equal(result.agentSummary.toolCalls[1]?.repeatedCall, true);
  assert.match(result.agentSummary.loopWarnings[0] ?? "", /repeated identical tool call blocked/);
  assert.equal(result.agentSummary.finalAction, "forced_final_decision");
});

test("runDecisionAgent enforces per-tool limits", async () => {
  const result = await runDecisionAgent(
    makeConfig({
      maxTurns: 2,
      perTool: {
        fetch_user_reviews: 2,
        fetch_url_content: 1,
        web_search: 2,
      },
    }),
    makeState(),
    {
      requestTurn: async (_config, _prompt, _reviewId, _runId, turn) => ({
        turn:
          turn === 1
            ? {
                action: "call_tool",
                actionSummary: "Fetch the company website.",
                toolCall: {
                  name: "fetch_url_content",
                  arguments: { url: "https://acme.test" },
                },
                finalDecision: null,
              }
            : {
                action: "call_tool",
                actionSummary: "Fetch a second page even though the budget is exhausted.",
                toolCall: {
                  name: "fetch_url_content",
                  arguments: { url: "https://linkedin.com/in/jane" },
                },
                finalDecision: null,
              },
        meta: makeMeta(),
      }),
      requestForcedFinal: async () => ({
        decision: makeFinalDecision(),
        meta: makeMeta(),
      }),
      executeTool: async (runtime, toolCall): Promise<AgentToolResult> => ({
        ok: true,
        toolName: toolCall.name,
        payload: {
          url: toolCall.arguments.url,
          review_id: runtime.reviewContext.reviewId,
        },
      }),
    },
  );

  assert.equal(result.agentSummary.toolCallCounts.fetch_url_content, 1);
  assert.equal(result.agentSummary.toolCalls[1]?.result.ok, false);
  assert.equal(
    result.agentSummary.toolCalls[1]?.result.payload.error,
    "tool_call_limit_reached",
  );
  assert.match(result.agentSummary.loopWarnings[0] ?? "", /tool limit reached/);
});
