import type { AgentLoopSummary, AgentToolCallRecord } from "../types.js";

export const AGENT_SYSTEM_PROMPT = [
  "You are a GoodFirms software review verification agent.",
  "Assess one software review at a time using the supplied context and a small set of bounded tools.",
  "You are expected to use tools when authenticity, identity, or external-consistency evidence is incomplete.",
  "Call at most one tool per turn.",
  "Do not repeat identical tool calls or keep searching after tool failures, empty evidence, or loop warnings.",
  "Do not return a final decision early when a missing tool check could materially change the authenticity or consistency judgment.",
  "Do not invent facts, do not accuse the reviewer of fraud with certainty, and do not rewrite the review.",
  "Use only the supplied context and tool results.",
  "Return only valid JSON matching the requested schema.",
].join(" ");

const ANALYSIS_RULES = [
  "Evaluate these checks: gibberish, authenticity, spam, pii, safety, consistency, specificity.",
  "Use check statuses strictly as pass, flag, or fail.",
  "Mark gibberish as fail only when the review text is mostly meaningless, random, or not interpretable as a real review.",
  "Mark authenticity as flag when the review feels exaggerated, suspiciously generic, weakly supported, or inconsistent with external evidence. Use fail only for strong evidence from the supplied context or tool results.",
  "Mark spam as flag or fail when the text reads like promotion, solicitation, keyword stuffing, or template spam rather than a genuine review.",
  "Mark pii as flag or fail when the review text exposes personal contact details or sensitive identifying information beyond normal reviewer metadata.",
  "Mark safety as fail for abusive, hateful, harassing, threatening, or otherwise unsafe review text.",
  "Mark consistency as flag or fail when the narrative strongly conflicts with the title, strengths, weaknesses, numeric ratings, or tool evidence.",
  "Mark specificity as flag or fail when the review is too generic, vague, or low-information to be useful.",
  "Choose overall_decision from: PENDING, PROCESSING, APPROVED, PUBLISHED, REJECTED, FLAGGED.",
  "Use PENDING only when the review should wait before analysis is complete.",
  "Use PROCESSING only when more agent/tool work is required and the review remains in progress.",
  "Use APPROVED when the agent accepts the review for progression.",
  "Use PUBLISHED only when the review is already in a final published state.",
  "Use REJECTED when the review should be rejected by the agent.",
  "Use FLAGGED when the review needs human review or evidence remains mixed.",
  "Set can_enhance to true only when the chosen overall_decision supports safe progression without changing facts or legitimizing disallowed content.",
  "Prefer a final decision over another tool call once you have enough evidence.",
].join("\n");

const TOOL_RULES = [
  "Available tools:",
  "- fetch_user_reviews: inspect other software reviews from the same current reviewer. Use this when the reviewer looks suspiciously generic, the history is unclear, or repeated/template behavior is plausible. Default output is compact. If review_id is provided, the tool returns fuller content for that specific prior review.",
  "- fetch_url_content: fetch and summarize a specific URL, such as the reviewer's company website or profile URL. Use this when a website exists in context or when the review makes claims that can be checked against the website.",
  "- web_search: search the web when direct URLs are missing, broken, or insufficient. Use short, targeted queries to find reviewer, company, or product-presence evidence.",
  "Tool usage rules:",
  "- Call one tool at a time.",
  "- Use fetch_user_reviews first for reviewer-history uncertainty.",
  "- Use fetch_url_content for URLs already present in context or discovered via search results.",
  "- Use web_search only when direct URL evidence is unavailable or insufficient.",
  "- If the reviewer has a company website, profile URL, or any externally checkable claim, prefer using a tool before finalizing authenticity as pass.",
  "- If there is a mismatch between title, body, ratings, usage duration, company identity, website identity, or software category, use a tool before finalizing unless the mismatch already proves rejection.",
  "- If the context shows missing trust evidence, generic Gmail identity, absent LinkedIn/profile, or unclear employer/product relationship, prefer at least one tool check before returning APPROVED.",
  "- You may finalize without tools only when the review is already clearly rejectable from internal evidence, or when the context is already strongly self-consistent and there is no meaningful external check available.",
  "- Do not repeat the same tool call with the same arguments.",
  "- If a tool returns an error, limit warning, or loop warning, adjust and decide from current evidence.",
].join("\n");

export function buildAgentTurnPrompt(input: {
  context: Record<string, unknown>;
  loopSummary: Pick<AgentLoopSummary, "toolCallCounts" | "loopWarnings" | "toolCalls">;
  maxTurns: number;
  nextTurn: number;
}): string {
  return [
    "Instructions:",
    ANALYSIS_RULES,
    "",
    TOOL_RULES,
    "",
    `Current turn: ${input.nextTurn} of ${input.maxTurns}.`,
    "Remaining focus: decide which review status tag best fits the evidence, whether the review looks authentic and policy-compliant, and whether it is suitable for enhancement.",
    "",
    "Tool budgets used so far:",
    JSON.stringify(input.loopSummary.toolCallCounts, null, 2),
    "",
    "Loop warnings:",
    input.loopSummary.loopWarnings.length > 0
      ? JSON.stringify(input.loopSummary.loopWarnings, null, 2)
      : "[]",
    "",
    "Executed tool calls so far:",
    JSON.stringify(summarizeToolCalls(input.loopSummary.toolCalls), null, 2),
    "",
    "Agent-visible review context:",
    JSON.stringify(input.context, null, 2),
    "",
    "Return either:",
    '- {"action":"call_tool", ...} when a single tool call is necessary now, or',
    '- {"action":"final_decision", ...} when you have enough evidence.',
  ].join("\n");
}

export function buildForcedFinalDecisionPrompt(input: {
  context: Record<string, unknown>;
  loopSummary: Pick<AgentLoopSummary, "toolCallCounts" | "loopWarnings" | "toolCalls">;
  reason: string;
}): string {
  return [
    "Instructions:",
    ANALYSIS_RULES,
    "",
    `You must now return a final decision. Do not request another tool.`,
    `Forced-finalization reason: ${input.reason}`,
    "",
    "Executed tool calls so far:",
    JSON.stringify(summarizeToolCalls(input.loopSummary.toolCalls), null, 2),
    "",
    "Loop warnings:",
    input.loopSummary.loopWarnings.length > 0
      ? JSON.stringify(input.loopSummary.loopWarnings, null, 2)
      : "[]",
    "",
    "Agent-visible review context:",
    JSON.stringify(input.context, null, 2),
  ].join("\n");
}

function summarizeToolCalls(toolCalls: AgentToolCallRecord[]) {
  return toolCalls.map((entry) => ({
    turn: entry.turn,
    tool: entry.call.name,
    arguments: entry.call.arguments,
    repeated_call: entry.repeatedCall,
    ok: entry.result.ok,
    result: entry.result.payload,
  }));
}
