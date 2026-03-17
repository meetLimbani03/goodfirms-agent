from __future__ import annotations

from dataclasses import dataclass

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import StructuredTool
from langchain_openai import ChatOpenAI

from app.core.config import Settings
from app.core.logging import logger
from app.schemas.software_review_agent import (
    AgentToolTrace,
    OpenRouterUsageCall,
    OpenRouterUsageSummary,
    SoftwareReviewAgentOutput,
)
from app.services.agent_tool_runner import execute_tool_calls
from app.services.openrouter_usage import build_usage_call, summarize_usage
from app.services.public_web_search import PublicWebSearchService, PublicWebSearchToolInput
from app.services.reviewer_history import ReviewerHistoryLookupService, ReviewerHistoryToolInput
from app.services.software_review_context import SoftwareAgentContext


@dataclass
class SoftwareReviewAgentRunResult:
    output: SoftwareReviewAgentOutput
    tool_traces: list[AgentToolTrace]
    llm_usage_summary: OpenRouterUsageSummary
    llm_usage_calls: list[OpenRouterUsageCall]


class SoftwareReviewAgentService:
    def __init__(
        self,
        settings: Settings,
        reviewer_history_service: ReviewerHistoryLookupService,
        public_web_search_service: PublicWebSearchService,
    ) -> None:
        headers = {}
        if settings.openrouter.site_url:
            headers["HTTP-Referer"] = settings.openrouter.site_url
        if settings.openrouter.app_name:
            headers["X-Title"] = settings.openrouter.app_name

        shared_kwargs = {
            "model": settings.openrouter.model,
            "api_key": settings.openrouter.api_key,
            "base_url": settings.openrouter.base_url,
            "temperature": 0,
            "default_headers": headers or None,
        }

        self._reviewer_history_service = reviewer_history_service
        self._public_web_search_service = public_web_search_service
        self._tool_enabled_model = ChatOpenAI(**shared_kwargs)
        self._structured_model = ChatOpenAI(**shared_kwargs).with_structured_output(
            SoftwareReviewAgentOutput,
            include_raw=True,
        )

    def run(self, context: SoftwareAgentContext) -> SoftwareReviewAgentRunResult:
        current_review_id = str(context.metadata.get("review_id", "") or "").strip() or None
        logger.info(
            "software_agent_run_started review_id={review_id} model={model}",
            review_id=current_review_id,
            model=self._tool_enabled_model.model_name,
        )
        reviewer_history_tool = StructuredTool.from_function(
            name="reviewer_review_history_lookup",
            description=(
                "Look up review history for a reviewer, except the current review being processed. "
                "Pass reviewer_id to get a compact list of the reviewer's other reviews. "
                "Optionally pass review_ids_csv as a comma-separated list of review ids to get full context for those specific reviews, except the current review."
            ),
            func=lambda reviewer_id, review_ids_csv=None: self._reviewer_history_service.lookup(
                reviewer_id,
                review_ids_csv,
                exclude_review_id=current_review_id,
            ),
            args_schema=ReviewerHistoryToolInput,
        )
        tools = [reviewer_history_tool]
        if self._public_web_search_service.enabled:
            tools.append(
                StructuredTool.from_function(
                    name="public_web_search",
                    description=(
                        "Search the public web using SerpApi Google results for external corroboration. "
                        "Use this for LinkedIn profile discovery, indexed LinkedIn posts/activity, company-site corroboration, "
                        "or resolving old-company/current-company ambiguity. "
                        "Important parameters: q for the advanced query, as_sitesearch for a domain restriction, "
                        "as_qdr for recency, gl for country bias, hl for language, num for result count, start for pagination, and filter for duplicate control. "
                        "This tool can be called multiple times in parallel with different targeted queries."
                    ),
                    func=self._public_web_search_service.search,
                    args_schema=PublicWebSearchToolInput,
                )
            )
        tools_by_name = {tool.name: tool for tool in tools}
        messages = [
            SystemMessage(content=context.prompt_markdown),
            HumanMessage(content=context.context_markdown),
        ]
        tool_traces: list[AgentToolTrace] = []
        llm_usage_calls: list[OpenRouterUsageCall] = []

        for turn_index in range(5):
            logger.info(
                "software_agent_tool_planning_turn_started review_id={review_id} turn={turn}",
                review_id=current_review_id,
                turn=turn_index + 1,
            )
            ai_message = self._tool_enabled_model.bind_tools(tools).invoke(messages)
            llm_usage_calls.append(
                build_usage_call(
                    ai_message,
                    order=len(llm_usage_calls) + 1,
                    phase="tool_planning",
                )
            )
            messages.append(ai_message)
            logger.info(
                "software_agent_tool_planning_turn_completed review_id={review_id} turn={turn} tool_calls={tool_calls}",
                review_id=current_review_id,
                turn=turn_index + 1,
                tool_calls=len(ai_message.tool_calls or []),
            )

            if not ai_message.tool_calls:
                break

            new_traces, tool_messages = execute_tool_calls(
                ai_message.tool_calls,
                tools_by_name=tools_by_name,
                starting_order=len(tool_traces) + 1,
            )
            tool_traces.extend(new_traces)
            messages.extend(tool_messages)
            logger.info(
                "software_agent_tool_execution_completed review_id={review_id} turn={turn} executed_tools={executed_tools}",
                review_id=current_review_id,
                turn=turn_index + 1,
                executed_tools=",".join(trace.tool_name for trace in new_traces) or "none",
            )

        logger.info("software_agent_structured_output_started review_id={review_id}", review_id=current_review_id)
        structured_result = self._structured_model.invoke(messages)
        raw_message = structured_result["raw"]
        parsing_error = structured_result.get("parsing_error")
        if parsing_error is not None:
            raise parsing_error

        llm_usage_calls.append(
            build_usage_call(
                raw_message,
                order=len(llm_usage_calls) + 1,
                phase="final_structured_output",
            )
        )
        output = structured_result["parsed"]
        logger.info(
            "software_agent_run_completed review_id={review_id} final_decision={final_decision} confidence={confidence} tool_trace_count={tool_trace_count}",
            review_id=current_review_id,
            final_decision=output.final_decision,
            confidence=output.confidence,
            tool_trace_count=len(tool_traces),
        )
        return SoftwareReviewAgentRunResult(
            output=output,
            tool_traces=tool_traces,
            llm_usage_summary=summarize_usage(llm_usage_calls),
            llm_usage_calls=llm_usage_calls,
        )
