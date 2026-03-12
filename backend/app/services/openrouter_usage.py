from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal

from langchain_core.messages import AIMessage

from app.schemas.software_review_agent import OpenRouterUsageCall, OpenRouterUsageSummary


def build_usage_call(
    message: AIMessage,
    *,
    order: int,
    phase: Literal["tool_planning", "final_structured_output"],
) -> OpenRouterUsageCall:
    response_metadata = _mapping(message.response_metadata)
    token_usage = _mapping(response_metadata.get("token_usage"))
    completion_details = _mapping(token_usage.get("completion_tokens_details"))
    prompt_details = _mapping(token_usage.get("prompt_tokens_details"))

    return OpenRouterUsageCall(
        order=order,
        phase=phase,
        model_name=_text(response_metadata.get("model_name")) or None,
        model_provider=_text(response_metadata.get("model_provider")) or None,
        generation_id=_text(response_metadata.get("id")) or None,
        prompt_tokens=_int(token_usage.get("prompt_tokens")),
        completion_tokens=_int(token_usage.get("completion_tokens")),
        total_tokens=_int(token_usage.get("total_tokens")),
        reasoning_tokens=_int(completion_details.get("reasoning_tokens")),
        cached_read_tokens=_int(prompt_details.get("cached_tokens")),
        cache_write_tokens=_int(prompt_details.get("cache_write_tokens")),
        exact_openrouter_cost=_float(token_usage.get("cost")),
        cache_savings=_float(token_usage.get("cache_discount")),
    )


def summarize_usage(calls: list[OpenRouterUsageCall]) -> OpenRouterUsageSummary:
    return OpenRouterUsageSummary(
        call_count=len(calls),
        prompt_tokens=sum(call.prompt_tokens for call in calls),
        completion_tokens=sum(call.completion_tokens for call in calls),
        total_tokens=sum(call.total_tokens for call in calls),
        reasoning_tokens=sum(call.reasoning_tokens for call in calls),
        cached_read_tokens=sum(call.cached_read_tokens for call in calls),
        cache_write_tokens=sum(call.cache_write_tokens for call in calls),
        exact_openrouter_cost=sum(call.exact_openrouter_cost for call in calls),
        cache_savings=sum(call.cache_savings for call in calls),
    )


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0
