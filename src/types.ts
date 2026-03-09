import type { ReviewContext } from "./review-context.js";

export type ReviewDecision =
  | "PENDING"
  | "PROCESSING"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED"
  | "FLAGGED";
export type ReviewCheckStatus = "pass" | "flag" | "fail";
export type AgentToolName = "fetch_user_reviews" | "fetch_url_content" | "web_search";

export interface ReviewCheckResult {
  status: ReviewCheckStatus;
  reason: string;
}

export type RunEventType =
  | "run_started"
  | "review_loaded"
  | "review_normalized"
  | "precheck_result"
  | "review_context_built"
  | "model_request"
  | "model_response"
  | "tool_call"
  | "tool_result"
  | "loop_guard_triggered"
  | "run_completed"
  | "run_failed";

export interface SoftwareReviewDocument {
  _id: unknown;
  is_active?: unknown;
  reason?: unknown;
  response?: unknown;
  step?: unknown;
  requesttoken?: unknown;
  submitted_by?: unknown;
  publish_date?: unknown;
  software_id?: unknown;
  software_name?: unknown;
  software_slug?: unknown;
  user_id?: unknown;
  features?: unknown;
  use_in_time?: unknown;
  use_time_format?: unknown;
  frequent_use?: unknown;
  software_pricing?: unknown;
  is_integrated?: unknown;
  switched_from?: unknown;
  integrate_software?: unknown;
  used_software?: unknown;
  title?: unknown;
  summary?: unknown;
  strength?: unknown;
  weakness?: unknown;
  ease_of_use?: unknown;
  features_functionality?: unknown;
  customer_support?: unknown;
  overall?: unknown;
  client_name?: unknown;
  client_email?: unknown;
  client_company_name?: unknown;
  position?: unknown;
  location?: unknown;
  hidden_identity?: unknown;
  client_company_website?: unknown;
  client_profile_link?: unknown;
  created?: unknown;
  updated?: unknown;
}

export interface SoftwareReviewRequestDocument {
  _id: unknown;
  software_id?: unknown;
  software_review_id?: unknown;
  token?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  admin_request?: unknown;
  event?: unknown;
  error?: unknown;
  request_sent?: unknown;
  created?: unknown;
  updated?: unknown;
}

export interface NormalizedSoftwareReview {
  id: string;
  isActive: number | null;
  step: number | null;
  softwareId: string;
  softwareName: string;
  softwareSlug: string;
  userId: string;
  categories: string[];
  useInTime: number | null;
  useTimeFormat: string;
  frequentUse: string;
  softwarePricing: string;
  isIntegrated: string;
  switchedFrom: string;
  integrateSoftware: string[];
  usedSoftware: string[];
  title: string;
  summary: string;
  strength: string;
  weakness: string;
  easeOfUse: number | null;
  featuresFunctionality: number | null;
  customerSupport: number | null;
  overall: number | null;
  clientName: string;
  clientEmail: string;
  clientCompanyName: string;
  position: string;
  location: string;
  hiddenIdentity: string;
  clientCompanyWebsite: string;
  clientProfileLink: string;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface PrecheckResult {
  eligible: boolean;
  passed: string[];
  failed: string[];
}

export interface PrecheckOptions {
  skipStatusCheck?: boolean;
}

export interface AgentDecision {
  overallDecision: ReviewDecision;
  canEnhance: boolean;
  confidence: number;
  riskFlags: string[];
  summary: string;
  checks: {
    gibberish: ReviewCheckResult;
    authenticity: ReviewCheckResult;
    spam: ReviewCheckResult;
    pii: ReviewCheckResult;
    safety: ReviewCheckResult;
    consistency: ReviewCheckResult;
    specificity: ReviewCheckResult;
  };
}

export interface OpenRouterUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  output_tokens_details?: {
    reasoning_tokens?: number;
  };
}

export interface OpenRouterResponseMeta {
  responseId: string;
  model: string;
  usage: OpenRouterUsage | null;
  reasoningSummary: string | null;
  rawOutputText: string | null;
}

export interface AgentToolCall {
  name: AgentToolName;
  arguments: Record<string, unknown>;
}

export interface AgentToolResult {
  ok: boolean;
  toolName: AgentToolName;
  payload: Record<string, unknown>;
}

export interface AgentToolCallRecord {
  turn: number;
  call: AgentToolCall;
  signature: string;
  repeatedCall: boolean;
  result: AgentToolResult;
}

export interface AgentTurnResponse {
  action: "call_tool" | "final_decision";
  actionSummary: string;
  toolCall: AgentToolCall | null;
  finalDecision: AgentDecision | null;
}

export interface AgentLoopSummary {
  turnCount: number;
  toolCallCounts: Record<AgentToolName, number>;
  toolCalls: AgentToolCallRecord[];
  loopWarnings: string[];
  finalAction: "final_decision" | "forced_final_decision" | "max_turns_exhausted";
}

export interface RunLogEvent {
  timestamp: string;
  event: RunEventType;
  runId: string;
  reviewId: string;
  graphNode: string;
  durationMs?: number;
  model?: string;
  responseId?: string;
  precheckPassed?: string[];
  precheckFailed?: string[];
  decision?: ReviewDecision;
  canEnhance?: boolean;
  confidence?: number;
  summary?: string;
  riskFlags?: string[];
  checks?: AgentDecision["checks"];
  usage?: OpenRouterUsage | null;
  reasoningSummary?: string | null;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  toolName?: AgentToolName;
  toolArguments?: Record<string, unknown>;
  toolResult?: Record<string, unknown>;
  action?: "call_tool" | "final_decision";
  loopWarnings?: string[];
  data?: Record<string, unknown>;
}

export interface PipelineState {
  runId: string;
  reviewId: string;
  isTestMode: boolean;
  rawReview: SoftwareReviewDocument | null;
  normalizedReview: NormalizedSoftwareReview | null;
  reviewContext: ReviewContext | null;
  precheck: PrecheckResult | null;
  decision: AgentDecision | null;
  responseMeta: OpenRouterResponseMeta | null;
  agentSummary: AgentLoopSummary | null;
  events: RunLogEvent[];
  startTimeMs: number;
}
