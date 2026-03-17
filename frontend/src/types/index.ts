export interface InternalMetadata {
  runId?: string | null;
  projection: string;
  reviewId: string;
  generatedAt: string;
  status: string;
  statusCode: number;
  step: number;
  rejectionReason: string | null;
  requestToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReviewType = 'SOFTWARE' | 'SERVICE';

export interface ReviewSubject {
  subjectId: string;
  name: string;
  slug: string;
  categories: string[];
}

export interface Usage {
  durationValue: number;
  durationUnit: string;
  frequency: string;
  pricing: string;
  integratedOtherSoftware: string;
  integratedSoftware: string[];
  switchedFromOtherSoftware: string;
  usedSoftwareBeforeSwitch: string[];
}

export interface Ratings {
  easeOfUse: number;
  featuresFunctionality: number;
  customerSupport: number;
  overall: number;
}

export interface Review {
  title: string;
  summary: string;
  strength: string;
  weakness: string;
  ratings: Ratings;
}

export interface Reviewer {
  name: string;
  email: string;
  emailDomain: string;
  companyName: string | null;
  position: string | null;
  location: string | null;
  postingPreferenceCode: string;
  postingPreferenceLabel: string;
  companyWebsite: string | null;
  companyWebsiteHost: string | null;
  profileLink: string | null;
  profileLinkHost: string | null;
}

export interface Account {
  id: number;
  type: string;
  name: string;
  email: string;
  emailDomain: string;
  position: string | null;
  location: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  companyWebsiteHost: string | null;
  publicUrl: string | null;
  publicUrlHost: string | null;
  totalReviews: number;
  mergeReviewer: number;
  isGoodfirmsRegistered: boolean;
  isSpam: boolean;
  emailVerifiedAt: string | null;
  emailResult: string;
  emailReason: string | null;
  emailCheckedAt: string | null;
  googleIdPresent: boolean;
  socialIdPresent: boolean;
  inferredLoginMethod: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountContext {
  userId: string;
  accountFound: boolean;
  account: Account;
  pendingEmailVerificationRecords: any[];
}

export interface DerivedSignals {
  inferredLoginMethod: string;
  authEvidence: string[];
  reviewEmailMatchesAccountEmail: boolean;
  reviewNameMatchesAccountName: boolean;
  reviewCompanyMatchesAccountCompany: boolean | null;
  vendorConflictHints: string[];
  trustSignals: string[];
  riskHints: string[];
}

export type StatusType =
  | 'PENDING'
  | 'PROCESSING'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'FLAGGED';

export interface GroundTruth {
  agentStatus: StatusType;
  statusLabel: string;
  rejectionReason: string | null;
}

export interface Provenance {
  mongoCollection: string;
  relatedMongoCollections: string[];
  mySqlDatabase: string;
  notes: string[];
}

export interface ReviewRecord {
  mongoId: string;
  statusCode: number;
  statusLabel: string;
  step: number;
  rejectionReason: string | null;
  response: string | null;
  requestToken: string | null;
  submittedBy: number;
  publishDateUnix: number;
  publishDateIso: string;
  createdAtUnix: number;
  createdAtIso: string;
  updatedAtUnix: number;
  updatedAtIso: string;
}

export interface ReviewData {
  reviewType: ReviewType;
  internalMetadata: InternalMetadata;
  subject: ReviewSubject;
  usage: Usage;
  review: Review;
  reviewer: Reviewer;
  accountContext: AccountContext;
  derivedSignals: DerivedSignals;
  groundTruth: GroundTruth;
  provenance: Provenance;
  reviewRecord: ReviewRecord;
  agentRun?: SoftwareManualRunDetails;
}

export interface DailyRun {
  id: string;
  date: string;
  totalReviews: number;
  eligibleCount: number;
  approvedCount: number;
  rejectedCount: number;
  reviews: ReviewData[];
}

export interface ValidationCheck {
  name: string;
  status: 'PASS' | 'FLAG' | 'FAIL';
  details?: string;
}

export interface AgentChecklistResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  reason: string;
}

export interface AgentPrecheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  reason: string;
}

export interface AgentToolTrace {
  order: number;
  tool_name: string;
  arguments: Record<string, string | null>;
  response_markdown: string;
}

export interface OpenRouterUsageCall {
  order: number;
  phase: 'tool_planning' | 'final_structured_output';
  model_name: string | null;
  model_provider: string | null;
  generation_id: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  reasoning_tokens: number;
  cached_read_tokens: number;
  cache_write_tokens: number;
  exact_openrouter_cost: number;
  cache_savings: number;
}

export interface OpenRouterUsageSummary {
  call_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  reasoning_tokens: number;
  cached_read_tokens: number;
  cache_write_tokens: number;
  exact_openrouter_cost: number;
  cache_savings: number;
}

export interface SoftwareManualRunDetails {
  model: string;
  promptMarkdown: string;
  contextMarkdown: string;
  finalDecision: 'verified_pass' | 'verified_with_minor_fixes' | 'needs_manual_review' | 'reject_recommended';
  confidence: 'high' | 'medium' | 'low';
  decisionSummary: string;
  rejectReason: string | null;
  riskFlags: string[];
  prechecks: AgentPrecheck[];
  checklistResults: AgentChecklistResult[];
  improvedTitle?: string;
  improvedSummary?: string;
  improvedStrength?: string;
  improvedWeakness?: string;
  changeRationale?: string[];
  testMode: boolean;
  toolTraces: AgentToolTrace[];
  llmUsageSummary: OpenRouterUsageSummary;
  llmUsageCalls: OpenRouterUsageCall[];
  feedbackText?: string | null;
  feedbackUpdatedAt?: string | null;
}

export interface IdentityVerificationInput {
  name?: string | null;
  signup_email?: string | null;
  company_name?: string | null;
  linkedin_url?: string | null;
  company_website?: string | null;
  login_method?: string | null;
}

export interface IdentityVerificationResult {
  provider: 'hunter' | 'contactout' | 'apollo';
  review_type: 'software' | 'service';
  review_id: string;
  status: string;
  summary: string;
  inputs: IdentityVerificationInput;
  result: Record<string, string | number | boolean | null>;
}

export interface AgentRunMetadata {
  status: string;
  trigger_source: string;
  test_mode: boolean;
  created_at: string | null;
  completed_at: string | null;
  error_stage?: string | null;
  error_message?: string | null;
}

export interface AgentRunFeedbackPayload {
  feedback: string | null;
  updated_at: string | null;
}

export interface SoftwareAgentContextPayload {
  subject: {
    name: string;
    slug: string;
    category_labels: string[];
  };
  reviewer: {
    resolved: {
      name: string;
      email: string;
      company_name: string;
      position: string;
      location: string;
      company_website: string;
      profile_link: string;
      posting_preference_label: string;
      email_domain: string;
      company_website_host: string;
      profile_link_host: string;
    };
    review_submitted: Record<string, string>;
    profile_fetched: Record<string, string>;
    resolution: Record<string, string>;
  };
  review_content: {
    headline: string;
    body: string;
    strength: string;
    weakness: string;
    ratings: {
      ease_of_use: number | null;
      features_functionality: number | null;
      customer_support: number | null;
      overall: number | null;
    };
  };
  usage: {
    duration_value: number | null;
    duration_unit: string;
    frequency: string;
    pricing: string;
    integrates_other_software: string;
    integrated_software: string[];
    switched_from_other_software: string;
    used_software_before_switch: string[];
  };
  signals: {
    account_found: boolean;
    inferred_login_method: string;
    review_email_matches_account_email: boolean | null;
    review_name_matches_account_name: boolean | null;
    review_company_matches_account_company: boolean | null;
    risk_flags: string[];
    trust_flags: string[];
  };
  prechecks?: AgentPrecheck[];
}

export interface AgentReviewMetadata {
  review_id: string;
  status_code: number | null;
  status_label: string;
  step: number | null;
  submitted_by?: number | null;
  rejection_reason: string | null;
  request_token?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AgentApiOutput {
  final_decision: SoftwareManualRunDetails['finalDecision'];
  confidence: SoftwareManualRunDetails['confidence'];
  decision_summary: string;
  reject_reason?: string | null;
  risk_flags: string[];
  checklist_results: AgentChecklistResult[];
  improved_title?: string | null;
  improved_summary?: string | null;
  improved_strength?: string | null;
  improved_weakness?: string | null;
  change_rationale?: string[] | null;
}

export interface SoftwareAgentApiResponse {
  run_id?: string | null;
  review_id: string;
  model: string;
  prompt_markdown: string;
  context_markdown: string;
  context_payload: SoftwareAgentContextPayload;
  review_metadata: AgentReviewMetadata;
  run_metadata?: AgentRunMetadata | null;
  tool_traces: AgentToolTrace[];
  llm_usage_summary: OpenRouterUsageSummary;
  llm_usage_calls: OpenRouterUsageCall[];
  review_feedback?: AgentRunFeedbackPayload | null;
  output: AgentApiOutput;
}

export interface ServiceAgentContextPayload {
  subject: {
    company_name: string;
    company_slug: string;
  };
  project: {
    title: string;
    budget: string;
    industry: string;
    status_label: string;
    summary: string;
    primary_service: string;
    selected_services: string[];
  };
  reviewer: SoftwareAgentContextPayload['reviewer'];
  review_content: {
    headline: string;
    body: string;
    strength: string;
    weakness: string;
    ratings: {
      quality_work: number | null;
      scheduling_timing: number | null;
      communication: number | null;
      overall_experience: number | null;
    };
  };
  signals: SoftwareAgentContextPayload['signals'];
  prechecks?: AgentPrecheck[];
}

export interface ServiceAgentApiResponse {
  run_id?: string | null;
  review_id: string;
  model: string;
  prompt_markdown: string;
  context_markdown: string;
  context_payload: ServiceAgentContextPayload;
  review_metadata: AgentReviewMetadata;
  run_metadata?: AgentRunMetadata | null;
  tool_traces: AgentToolTrace[];
  llm_usage_summary: OpenRouterUsageSummary;
  llm_usage_calls: OpenRouterUsageCall[];
  review_feedback?: AgentRunFeedbackPayload | null;
  output: AgentApiOutput;
}

export interface AgentRunListItem {
  run_id: string;
  review_type: 'software' | 'service';
  review_id: string;
  status: string;
  final_decision: SoftwareManualRunDetails['finalDecision'] | null;
  created_at: string | null;
  completed_at: string | null;
  test_mode: boolean;
  review_title: string;
  subject_name: string;
  reviewer_name: string;
  model: string | null;
}
