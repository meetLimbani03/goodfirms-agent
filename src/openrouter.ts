import type { AppConfig } from "./config.js";
import { ANALYSIS_SYSTEM_PROMPT } from "./prompt.js";
import type { AgentDecision, OpenRouterResponseMeta } from "./types.js";

const DECISION_SCHEMA = {
  name: "goodfirms_review_analysis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      overall_decision: {
        type: "string",
        enum: ["safe", "borderline", "high_risk", "reject"],
      },
      can_enhance: {
        type: "boolean",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      risk_flags: {
        type: "array",
        items: {
          type: "string",
        },
      },
      reason_summary: {
        type: "string",
        minLength: 1,
      },
      checks: {
        type: "object",
        additionalProperties: false,
        properties: {
          gibberish: checkSchema(),
          authenticity: checkSchema(),
          spam: checkSchema(),
          pii: checkSchema(),
          safety: checkSchema(),
          consistency: checkSchema(),
          specificity: checkSchema(),
        },
        required: [
          "gibberish",
          "authenticity",
          "spam",
          "pii",
          "safety",
          "consistency",
          "specificity",
        ],
      },
    },
    required: [
      "overall_decision",
      "can_enhance",
      "confidence",
      "risk_flags",
      "reason_summary",
      "checks",
    ],
  },
} as const;

interface OpenRouterRawResponse {
  id?: unknown;
  model?: unknown;
  usage?: {
    input_tokens?: unknown;
    output_tokens?: unknown;
    total_tokens?: unknown;
    output_tokens_details?: {
      reasoning_tokens?: unknown;
    };
  };
  output?: unknown;
}

export async function requestDecision(
  config: AppConfig,
  prompt: string,
  reviewId: string,
  runId: string,
): Promise<{ decision: AgentDecision; meta: OpenRouterResponseMeta }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.openRouterApiKey}`,
    "Content-Type": "application/json",
  };

  if (config.openRouterHttpReferer) {
    headers["HTTP-Referer"] = config.openRouterHttpReferer;
  }

  if (config.openRouterTitle) {
    headers["X-Title"] = config.openRouterTitle;
  }

  const response = await fetch("https://openrouter.ai/api/v1/responses", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.openRouterModel,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: ANALYSIS_SYSTEM_PROMPT,
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: DECISION_SCHEMA.name,
          schema: DECISION_SCHEMA.schema,
          strict: DECISION_SCHEMA.strict,
        },
      },
      metadata: {
        run_id: runId,
        review_id: reviewId,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter request failed (${response.status}): ${errorBody}`);
  }

  const rawResponse = (await response.json()) as OpenRouterRawResponse;
  const rawOutputText = collectOutputText(rawResponse.output);
  const parsedDecision = parseDecisionPayload(rawOutputText);

  const meta: OpenRouterResponseMeta = {
    responseId: typeof rawResponse.id === "string" ? rawResponse.id : "",
    model: typeof rawResponse.model === "string" ? rawResponse.model : config.openRouterModel,
    usage: normalizeUsage(rawResponse.usage),
    reasoningSummary: collectReasoningSummary(rawResponse.output),
    rawOutputText,
  };

  return {
    decision: parsedDecision,
    meta,
  };
}

function parseDecisionPayload(rawOutputText: string | null): AgentDecision {
  if (!rawOutputText) {
    throw new Error("OpenRouter response did not include parseable output text");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOutputText);
  } catch (error) {
    throw new Error(
      `OpenRouter response was not valid JSON: ${(error as Error).message}. Body: ${rawOutputText}`,
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("OpenRouter decision payload was not an object");
  }

  const payload = parsed as Record<string, unknown>;
  const decision = payload.overall_decision;
  const canEnhance = payload.can_enhance;
  const confidence = payload.confidence;
  const riskFlags = payload.risk_flags;
  const reasonSummary = payload.reason_summary;
  const checks = payload.checks;

  if (
    decision !== "safe" &&
    decision !== "borderline" &&
    decision !== "high_risk" &&
    decision !== "reject"
  ) {
    throw new Error(`Unexpected decision: ${String(decision)}`);
  }

  if (typeof canEnhance !== "boolean") {
    throw new Error("Decision can_enhance was not boolean");
  }

  if (typeof confidence !== "number") {
    throw new Error("Decision confidence was not numeric");
  }

  if (!Array.isArray(riskFlags) || riskFlags.some((flag) => typeof flag !== "string")) {
    throw new Error("Decision risk_flags was not a string array");
  }

  if (typeof reasonSummary !== "string" || !reasonSummary.trim()) {
    throw new Error("Decision reason_summary was empty");
  }

  const normalizedChecks = normalizeChecks(checks);

  return {
    overallDecision: decision,
    canEnhance,
    confidence,
    riskFlags,
    summary: reasonSummary.trim(),
    checks: normalizedChecks,
  };
}

function checkSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      status: {
        type: "string",
        enum: ["pass", "flag", "fail"],
      },
      reason: {
        type: "string",
        minLength: 1,
      },
    },
    required: ["status", "reason"],
  } as const;
}

function normalizeChecks(value: unknown): AgentDecision["checks"] {
  if (!value || typeof value !== "object") {
    throw new Error("Decision checks payload was missing");
  }

  const payload = value as Record<string, unknown>;

  return {
    gibberish: normalizeCheckResult(payload.gibberish, "gibberish"),
    authenticity: normalizeCheckResult(payload.authenticity, "authenticity"),
    spam: normalizeCheckResult(payload.spam, "spam"),
    pii: normalizeCheckResult(payload.pii, "pii"),
    safety: normalizeCheckResult(payload.safety, "safety"),
    consistency: normalizeCheckResult(payload.consistency, "consistency"),
    specificity: normalizeCheckResult(payload.specificity, "specificity"),
  };
}

function normalizeCheckResult(value: unknown, label: string): AgentDecision["checks"]["gibberish"] {
  if (!value || typeof value !== "object") {
    throw new Error(`Decision check ${label} was not an object`);
  }

  const payload = value as Record<string, unknown>;
  const status = payload.status;
  const reason = payload.reason;

  if (status !== "pass" && status !== "flag" && status !== "fail") {
    throw new Error(`Decision check ${label} had invalid status`);
  }

  if (typeof reason !== "string" || !reason.trim()) {
    throw new Error(`Decision check ${label} reason was empty`);
  }

  return {
    status,
    reason: reason.trim(),
  };
}

function normalizeUsage(usage: OpenRouterRawResponse["usage"]): OpenRouterResponseMeta["usage"] {
  if (!usage) {
    return null;
  }

  const normalized: NonNullable<OpenRouterResponseMeta["usage"]> = {};
  const inputTokens = normalizeOptionalNumber(usage.input_tokens);
  const outputTokens = normalizeOptionalNumber(usage.output_tokens);
  const totalTokens = normalizeOptionalNumber(usage.total_tokens);

  if (inputTokens !== undefined) {
    normalized.input_tokens = inputTokens;
  }

  if (outputTokens !== undefined) {
    normalized.output_tokens = outputTokens;
  }

  if (totalTokens !== undefined) {
    normalized.total_tokens = totalTokens;
  }

  const reasoningTokens = usage.output_tokens_details
    ? normalizeOptionalNumber(usage.output_tokens_details.reasoning_tokens)
    : undefined;

  if (reasoningTokens !== undefined) {
    normalized.output_tokens_details = {
      reasoning_tokens: reasoningTokens,
    };
  }

  return normalized;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function collectOutputText(output: unknown): string | null {
  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") {
        continue;
      }

      const candidate =
        (contentItem as { text?: unknown }).text ??
        (contentItem as { json?: unknown }).json ??
        (contentItem as { value?: unknown }).value;

      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return null;
}

function collectReasoningSummary(output: unknown): string | null {
  if (!Array.isArray(output)) {
    return null;
  }

  const parts: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const itemRecord = item as Record<string, unknown>;
    const itemType = itemRecord.type;

    if (itemType === "reasoning") {
      const summary = itemRecord.summary;
      if (typeof summary === "string" && summary.trim()) {
        parts.push(summary.trim());
      }
    }

    const content = itemRecord.content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") {
        continue;
      }

      const contentRecord = contentItem as Record<string, unknown>;
      if (contentRecord.type === "reasoning" && typeof contentRecord.summary === "string") {
        const summary = contentRecord.summary.trim();
        if (summary) {
          parts.push(summary);
        }
      }
    }
  }

  return parts.length > 0 ? parts.join("\n") : null;
}
