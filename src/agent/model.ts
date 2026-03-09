import type { AppConfig } from "../config.js";
import { DECISION_SCHEMA, parseDecisionPayload, requestStructuredJson } from "../openrouter.js";
import type { AgentDecision, AgentToolCall, AgentTurnResponse, OpenRouterResponseMeta } from "../types.js";

import { AGENT_SYSTEM_PROMPT } from "./prompt.js";

const TOOL_CALL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: {
      type: "string",
      enum: ["fetch_user_reviews", "fetch_url_content", "web_search"],
    },
    arguments: {
      type: "object",
      additionalProperties: false,
      properties: {
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 20,
        },
        review_id: {
          type: "string",
          minLength: 1,
        },
        url: {
          type: "string",
          minLength: 1,
        },
        query: {
          type: "string",
          minLength: 1,
        },
        domains: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
          maxItems: 5,
        },
      },
    },
  },
  required: ["name", "arguments"],
} as const;

const AGENT_TURN_SCHEMA = {
  name: "goodfirms_review_agent_turn",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      action: {
        type: "string",
        enum: ["call_tool", "final_decision"],
      },
      action_summary: {
        type: "string",
        minLength: 1,
      },
      tool_call: {
        anyOf: [TOOL_CALL_SCHEMA, { type: "null" }],
      },
      final_decision: {
        anyOf: [DECISION_SCHEMA.schema, { type: "null" }],
      },
    },
    required: ["action", "action_summary", "tool_call", "final_decision"],
  },
} as const;

export async function requestAgentTurn(
  config: AppConfig,
  prompt: string,
  reviewId: string,
  runId: string,
  turn: number,
): Promise<{ turn: AgentTurnResponse; meta: OpenRouterResponseMeta }> {
  const result = await requestStructuredJson(config, {
    systemPrompt: AGENT_SYSTEM_PROMPT,
    userPrompt: prompt,
    schemaName: AGENT_TURN_SCHEMA.name,
    schema: AGENT_TURN_SCHEMA.schema,
    strict: AGENT_TURN_SCHEMA.strict,
    reviewId,
    runId,
    metadata: {
      phase: "agent_turn",
      turn,
    },
  });

  return {
    turn: parseAgentTurnPayload(result.payload),
    meta: result.meta,
  };
}

export async function requestForcedFinalDecision(
  config: AppConfig,
  prompt: string,
  reviewId: string,
  runId: string,
  turn: number,
): Promise<{ decision: AgentDecision; meta: OpenRouterResponseMeta }> {
  const result = await requestStructuredJson(config, {
    systemPrompt: AGENT_SYSTEM_PROMPT,
    userPrompt: prompt,
    schemaName: DECISION_SCHEMA.name,
    schema: DECISION_SCHEMA.schema,
    strict: DECISION_SCHEMA.strict,
    reviewId,
    runId,
    metadata: {
      phase: "forced_final_decision",
      turn,
    },
  });

  return {
    decision: parseDecisionPayload(result.payload),
    meta: result.meta,
  };
}

function parseAgentTurnPayload(payload: unknown): AgentTurnResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Agent turn payload was not an object");
  }

  const typedPayload = payload as Record<string, unknown>;
  const action = typedPayload.action;
  const actionSummary = typedPayload.action_summary;
  const toolCall = typedPayload.tool_call;
  const finalDecision = typedPayload.final_decision;

  if (action !== "call_tool" && action !== "final_decision") {
    throw new Error(`Unexpected agent action: ${String(action)}`);
  }
  if (typeof actionSummary !== "string" || !actionSummary.trim()) {
    throw new Error("Agent action_summary was empty");
  }

  if (action === "call_tool") {
    return {
      action,
      actionSummary: actionSummary.trim(),
      toolCall: parseToolCall(toolCall),
      finalDecision: null,
    };
  }

  return {
    action,
    actionSummary: actionSummary.trim(),
    toolCall: null,
    finalDecision: parseDecisionPayload(finalDecision),
  };
}

function parseToolCall(payload: unknown): AgentToolCall {
  if (!payload || typeof payload !== "object") {
    throw new Error("Agent tool_call was not an object");
  }

  const typedPayload = payload as Record<string, unknown>;
  const name = typedPayload.name;
  if (
    name !== "fetch_user_reviews" &&
    name !== "fetch_url_content" &&
    name !== "web_search"
  ) {
    throw new Error(`Unexpected tool name: ${String(name)}`);
  }

  const argumentsValue = typedPayload.arguments;
  if (!argumentsValue || typeof argumentsValue !== "object" || Array.isArray(argumentsValue)) {
    throw new Error(`Tool arguments for ${name} were invalid`);
  }

  return {
    name,
    arguments: argumentsValue as Record<string, unknown>,
  };
}
