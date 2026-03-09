import test from "node:test";
import assert from "node:assert/strict";

import { getConfig } from "./config.js";
import { requestDecision } from "./openrouter.js";

test("requestDecision parses structured analysis payloads", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = "test-model";
  process.env.MONGODB_URI = "mongodb://localhost:27017/test";
  process.env.MYSQL_HOST = "localhost";
  process.env.MYSQL_PORT = "3306";
  process.env.MYSQL_USER = "root";
  process.env.MYSQL_PASS = "pw";
  process.env.MYSQL_DB = "GoodFirms";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        id: "resp_123",
        model: "test-model",
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          output_tokens_details: { reasoning_tokens: 7 },
        },
        output: [
          {
            type: "reasoning",
            summary: "The review is coherent and specific enough.",
          },
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  overall_decision: "APPROVED",
                  can_enhance: true,
                  confidence: 0.86,
                  risk_flags: [],
                  reason_summary: "The review is specific and internally consistent.",
                  checks: {
                    gibberish: {
                      status: "pass",
                      reason: "The text is coherent and readable.",
                    },
                    authenticity: {
                      status: "pass",
                      reason: "The review includes plausible product usage details.",
                    },
                    spam: {
                      status: "pass",
                      reason: "The tone is testimonial rather than promotional spam.",
                    },
                    pii: {
                      status: "pass",
                      reason: "The review body does not expose private contact details.",
                    },
                    safety: {
                      status: "pass",
                      reason: "No abusive or unsafe language is present.",
                    },
                    consistency: {
                      status: "pass",
                      reason: "The narrative matches the ratings.",
                    },
                    specificity: {
                      status: "pass",
                      reason: "The review includes concrete product feedback.",
                    },
                  },
                }),
              },
            ],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  try {
    const result = await requestDecision(
      getConfig(),
      "test prompt",
      "507f1f77bcf86cd799439011",
      "run-123",
    );

    assert.equal(result.decision.overallDecision, "APPROVED");
    assert.equal(result.decision.canEnhance, true);
    assert.equal(result.decision.checks.specificity.status, "pass");
    assert.equal(result.meta.responseId, "resp_123");
    assert.equal(result.meta.usage?.output_tokens_details?.reasoning_tokens, 7);
    assert.equal(result.meta.reasoningSummary, "The review is coherent and specific enough.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
