from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


RejectReason = Literal[
    "Unable to verify the reviewer",
    "Reviews are accepted only from clients of the company",
    "Reviews are not accepted from former employees",
    "Review has already been published before",
]

FinalDecision = Literal[
    "verified_pass",
    "verified_with_minor_fixes",
    "needs_manual_review",
    "reject_recommended",
]

ConfidenceLevel = Literal["high", "medium", "low"]

ChecklistResultName = Literal[
    "readability_and_coherence",
    "title_summary_alignment",
    "internal_consistency",
    "specificity_and_usefulness",
    "strength_weakness_separation",
    "reviewer_authenticity_signals",
    "rewrite_policy_followed",
]


class ChecklistResult(BaseModel):
    name: ChecklistResultName
    status: Literal["pass", "fail", "warning"]
    reason: str = Field(min_length=1)


class AgentToolTrace(BaseModel):
    order: int
    tool_name: str
    arguments: dict[str, str | None]
    response_markdown: str


class OpenRouterUsageCall(BaseModel):
    order: int
    phase: Literal["tool_planning", "final_structured_output"]
    model_name: str | None = None
    model_provider: str | None = None
    generation_id: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    reasoning_tokens: int = 0
    cached_read_tokens: int = 0
    cache_write_tokens: int = 0
    exact_openrouter_cost: float = 0.0
    cache_savings: float = 0.0


class OpenRouterUsageSummary(BaseModel):
    call_count: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    reasoning_tokens: int = 0
    cached_read_tokens: int = 0
    cache_write_tokens: int = 0
    exact_openrouter_cost: float = 0.0
    cache_savings: float = 0.0


class AgentRunMetadata(BaseModel):
    status: str
    trigger_source: str
    test_mode: bool
    created_at: str | None = None
    completed_at: str | None = None
    error_stage: str | None = None
    error_message: str | None = None


class AgentRunFeedback(BaseModel):
    feedback: str | None = None
    updated_at: str | None = None


class AgentRunFeedbackUpdateRequest(BaseModel):
    feedback: str = Field(min_length=1, max_length=5000)


class AgentRunListItem(BaseModel):
    run_id: str
    review_type: Literal["software", "service"]
    review_id: str
    status: str
    final_decision: FinalDecision | None = None
    created_at: str | None = None
    completed_at: str | None = None
    test_mode: bool
    review_title: str
    subject_name: str
    reviewer_name: str
    model: str | None = None


class SoftwareReviewAgentOutput(BaseModel):
    final_decision: FinalDecision = Field(
        description="Machine-readable final decision for the review outcome."
    )
    confidence: ConfidenceLevel = Field(
        description=(
            "Confidence in the final decision. Use high when evidence is strong and consistent, "
            "medium when some uncertainty remains, and low when evidence is weak or conflicting."
        )
    )
    decision_summary: str = Field(
        min_length=1,
        description=(
            "Concise but detailed explanation of what you found, how you interpreted those findings, "
            "and why they led to the final decision. Include the main evidence, conflicts, and any tool "
            "results that materially influenced the outcome."
        ),
    )
    reject_reason: RejectReason | None = Field(
        default=None,
        description="Return only when a reject recommendation is justified. Omit when no reject reason applies.",
    )
    risk_flags: list[str] = Field(
        default_factory=list,
        description="Compact machine-readable risk flags that influenced the decision.",
    )
    checklist_results: list[ChecklistResult] = Field(
        default_factory=list,
        description="Structured results for the required validation checks.",
    )
    improved_title: str | None = Field(
        default=None,
        description="Return only if the title needs an edit. Omit when no title edit is needed.",
    )
    improved_summary: str | None = Field(
        default=None,
        description="Return only if the summary needs an edit. Omit when no summary edit is needed.",
    )
    improved_strength: str | None = Field(
        default=None,
        description="Return only if the strength text needs an edit. Omit when no strength edit is needed.",
    )
    improved_weakness: str | None = Field(
        default=None,
        description="Return only if the weakness text needs an edit. Omit when no weakness edit is needed.",
    )
    change_rationale: list[str] | None = Field(
        default=None,
        description="Return only when at least one improved_* field is provided. Omit when no edits are proposed.",
    )


class SoftwareReviewAgentResponse(BaseModel):
    run_id: str | None = None
    review_id: str
    model: str
    prompt_markdown: str
    context_markdown: str
    context_payload: dict[str, Any]
    review_metadata: dict[str, Any]
    run_metadata: AgentRunMetadata | None = None
    tool_traces: list[AgentToolTrace] = Field(default_factory=list)
    llm_usage_summary: OpenRouterUsageSummary = Field(default_factory=OpenRouterUsageSummary)
    llm_usage_calls: list[OpenRouterUsageCall] = Field(default_factory=list)
    review_feedback: AgentRunFeedback | None = None
    output: SoftwareReviewAgentOutput
