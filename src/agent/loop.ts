import type { AppConfig } from "../config.js";
import { pushEvent } from "../logger.js";
import { projectReviewContext, type ReviewContext } from "../review-context.js";
import type {
  AgentLoopSummary,
  AgentToolCall,
  AgentToolCallRecord,
  AgentToolResult,
  AgentTurnResponse,
  OpenRouterResponseMeta,
  PipelineState,
} from "../types.js";

import { requestAgentTurn, requestForcedFinalDecision } from "./model.js";
import { buildAgentTurnPrompt, buildForcedFinalDecisionPrompt } from "./prompt.js";
import { executeAgentTool } from "./tools.js";

interface AgentLoopDependencies {
  requestTurn?: (
    config: AppConfig,
    prompt: string,
    reviewId: string,
    runId: string,
    turn: number,
  ) => Promise<{ turn: AgentTurnResponse; meta: OpenRouterResponseMeta }>;
  requestForcedFinal?: (
    config: AppConfig,
    prompt: string,
    reviewId: string,
    runId: string,
    turn: number,
  ) => Promise<{ decision: PipelineState["decision"]; meta: OpenRouterResponseMeta }>;
  executeTool?: (
    runtime: { config: AppConfig; reviewContext: ReviewContext },
    toolCall: AgentToolCall,
  ) => Promise<AgentToolResult>;
}

export async function runDecisionAgent(
  config: AppConfig,
  state: PipelineState,
  dependencies: AgentLoopDependencies = {},
): Promise<{
  decision: NonNullable<PipelineState["decision"]>;
  responseMeta: OpenRouterResponseMeta;
  agentSummary: AgentLoopSummary;
}> {
  if (!state.reviewContext) {
    throw new Error("Cannot run agent without review context");
  }

  const requestTurn = dependencies.requestTurn ?? requestAgentTurn;
  const requestForcedFinal = dependencies.requestForcedFinal ?? requestForcedFinalDecision;
  const executeToolCall = dependencies.executeTool ?? executeAgentTool;
  const agentContext = projectReviewContext(state.reviewContext, "agent");

  const agentSummary: AgentLoopSummary = {
    turnCount: 0,
    toolCallCounts: {
      fetch_user_reviews: 0,
      fetch_url_content: 0,
      web_search: 0,
    },
    toolCalls: [],
    loopWarnings: [],
    finalAction: "max_turns_exhausted",
  };

  for (let turnNumber = 1; turnNumber <= config.agentToolLimits.maxTurns; turnNumber += 1) {
    agentSummary.turnCount = turnNumber;
    const prompt = buildAgentTurnPrompt({
      context: agentContext,
      loopSummary: agentSummary,
      maxTurns: config.agentToolLimits.maxTurns,
      nextTurn: turnNumber,
    });

    pushEvent(state, {
      event: "model_request",
      graphNode: "runDecisionAgent",
      data: {
        phase: "agent_turn",
        turn: turnNumber,
      },
    });

    const turnResult = await requestTurn(config, prompt, state.reviewId, state.runId, turnNumber);
    pushEvent(state, {
      event: "model_response",
      graphNode: "runDecisionAgent",
      model: turnResult.meta.model,
      responseId: turnResult.meta.responseId,
      action: turnResult.turn.action,
      usage: turnResult.meta.usage,
      reasoningSummary: turnResult.meta.reasoningSummary,
      data: {
        phase: "agent_turn",
        turn: turnNumber,
        actionSummary: turnResult.turn.actionSummary,
      },
    });

    if (turnResult.turn.action === "final_decision" && turnResult.turn.finalDecision) {
      agentSummary.finalAction = "final_decision";
      return {
        decision: turnResult.turn.finalDecision,
        responseMeta: turnResult.meta,
        agentSummary,
      };
    }

    if (!turnResult.turn.toolCall) {
      agentSummary.loopWarnings.push(`turn ${turnNumber}: model returned call_tool without tool_call`);
      pushEvent(state, {
        event: "loop_guard_triggered",
        graphNode: "runDecisionAgent",
        loopWarnings: [...agentSummary.loopWarnings],
        data: {
          phase: "missing_tool_call",
          turn: turnNumber,
        },
      });
      break;
    }

    const toolRecord = await runToolCall(
      config,
      state.reviewContext,
      turnResult.turn.toolCall,
      turnNumber,
      agentSummary,
      executeToolCall,
    );
    agentSummary.toolCalls.push(toolRecord);

    pushEvent(state, {
      event: "tool_call",
      graphNode: "runDecisionAgent",
      toolName: toolRecord.call.name,
      toolArguments: toolRecord.call.arguments,
      data: {
        turn: turnNumber,
        repeatedCall: toolRecord.repeatedCall,
      },
    });
    pushEvent(state, {
      event: "tool_result",
      graphNode: "runDecisionAgent",
      toolName: toolRecord.call.name,
      toolResult: toolRecord.result.payload,
      data: {
        turn: turnNumber,
        ok: toolRecord.result.ok,
      },
    });
    if (!toolRecord.result.ok && toolRecord.result.payload.warning) {
      pushEvent(state, {
        event: "loop_guard_triggered",
        graphNode: "runDecisionAgent",
        toolName: toolRecord.call.name,
        loopWarnings: [...agentSummary.loopWarnings],
        data: {
          turn: turnNumber,
          warning: toolRecord.result.payload.warning,
        },
      });
    }
  }

  const forcedPrompt = buildForcedFinalDecisionPrompt({
    context: agentContext,
    loopSummary: agentSummary,
    reason:
      agentSummary.loopWarnings[agentSummary.loopWarnings.length - 1] ??
      "max tool turns reached before the model finalized",
  });

  pushEvent(state, {
    event: "model_request",
    graphNode: "runDecisionAgent",
    data: {
      phase: "forced_final_decision",
      turn: agentSummary.turnCount + 1,
    },
  });

  const forcedResult = await requestForcedFinal(
    config,
    forcedPrompt,
    state.reviewId,
    state.runId,
    agentSummary.turnCount + 1,
  );

  agentSummary.finalAction = "forced_final_decision";
  pushEvent(state, {
    event: "model_response",
    graphNode: "runDecisionAgent",
    model: forcedResult.meta.model,
    responseId: forcedResult.meta.responseId,
    action: "final_decision",
    ...(forcedResult.decision?.overallDecision
      ? { decision: forcedResult.decision.overallDecision }
      : {}),
    ...(forcedResult.decision?.canEnhance !== undefined
      ? { canEnhance: forcedResult.decision.canEnhance }
      : {}),
    ...(forcedResult.decision?.confidence !== undefined
      ? { confidence: forcedResult.decision.confidence }
      : {}),
    ...(forcedResult.decision?.summary ? { summary: forcedResult.decision.summary } : {}),
    ...(forcedResult.decision?.riskFlags ? { riskFlags: forcedResult.decision.riskFlags } : {}),
    ...(forcedResult.decision?.checks ? { checks: forcedResult.decision.checks } : {}),
    usage: forcedResult.meta.usage,
    reasoningSummary: forcedResult.meta.reasoningSummary,
    data: {
      phase: "forced_final_decision",
    },
  });

  if (!forcedResult.decision) {
    throw new Error("Forced final decision did not return a decision");
  }

  return {
    decision: forcedResult.decision,
    responseMeta: forcedResult.meta,
    agentSummary,
  };
}

async function runToolCall(
  config: AppConfig,
  reviewContext: ReviewContext,
  toolCall: AgentToolCall,
  turnNumber: number,
  agentSummary: AgentLoopSummary,
  executeToolCall: (
    runtime: { config: AppConfig; reviewContext: ReviewContext },
    toolCall: AgentToolCall,
  ) => Promise<AgentToolResult>,
): Promise<AgentToolCallRecord> {
  const signature = JSON.stringify({
    name: toolCall.name,
    arguments: normalizeSignatureArguments(toolCall.arguments),
  });
  const previousMatch = agentSummary.toolCalls.some((entry) => entry.signature === signature);
  const toolLimit = config.agentToolLimits.perTool[toolCall.name];

  let result: AgentToolResult;
  if (previousMatch) {
    const warning = `turn ${turnNumber}: repeated identical tool call blocked for ${toolCall.name}`;
    agentSummary.loopWarnings.push(warning);
    result = {
      ok: false,
      toolName: toolCall.name,
      payload: {
        error: "loop_detected_duplicate_tool_call",
        warning,
      },
    };
  } else if (agentSummary.toolCallCounts[toolCall.name] >= toolLimit) {
    const warning = `turn ${turnNumber}: tool limit reached for ${toolCall.name}`;
    agentSummary.loopWarnings.push(warning);
    result = {
      ok: false,
      toolName: toolCall.name,
      payload: {
        error: "tool_call_limit_reached",
        warning,
        max_allowed: toolLimit,
      },
    };
  } else {
    agentSummary.toolCallCounts[toolCall.name] += 1;
    result = await executeToolCall({ config, reviewContext }, toolCall);
  }

  return {
    turn: turnNumber,
    call: toolCall,
    signature,
    repeatedCall: previousMatch,
    result,
  };
}

function normalizeSignatureArguments(argumentsValue: Record<string, unknown>): Record<string, unknown> {
  const entries = Object.entries(argumentsValue).sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries.map(([key, value]) => [key, normalizeSignatureValue(value)]));
}

function normalizeSignatureValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeSignatureValue(entry));
  }
  if (value && typeof value === "object") {
    return normalizeSignatureArguments(value as Record<string, unknown>);
  }
  return value;
}
