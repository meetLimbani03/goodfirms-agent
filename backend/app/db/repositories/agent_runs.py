from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.models.agent_run import AgentRun


class AgentRunRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create_started_run(self, review_type: str, review_id: str, test_mode: bool, trigger_source: str) -> AgentRun:
        run = AgentRun(
            review_type=review_type,
            review_id=review_id,
            test_mode=test_mode,
            trigger_source=trigger_source,
            status="started",
        )
        self._session.add(run)
        self._session.flush()
        return run

    def list_completed_runs(self, *, review_type: str, limit: int = 100) -> list[AgentRun]:
        statement = (
            select(AgentRun)
            .where(
                AgentRun.review_type == review_type,
                AgentRun.status == "completed",
            )
            .order_by(desc(AgentRun.completed_at), desc(AgentRun.created_at))
            .limit(limit)
        )
        return list(self._session.scalars(statement))

    def get_run(self, run_id: UUID | str) -> AgentRun | None:
        return self._session.get(AgentRun, run_id)

    def mark_completed(
        self,
        run_id: UUID | str,
        *,
        model: str,
        final_decision: str,
        decision_summary: str,
        reject_reason: str | None,
        prompt_markdown: str,
        context_markdown: str,
        context_payload: dict[str, Any],
        review_metadata: dict[str, Any],
        tool_traces: list[dict[str, Any]],
        llm_usage_summary: dict[str, Any],
        llm_usage_calls: list[dict[str, Any]],
        output_payload: dict[str, Any],
    ) -> AgentRun:
        run = self._session.get(AgentRun, run_id)
        if run is None:
            raise LookupError(f"Agent run not found: {run_id}")

        run.status = "completed"
        run.model = model
        run.final_decision = final_decision
        run.decision_summary = decision_summary
        run.reject_reason = reject_reason
        run.prompt_markdown = prompt_markdown
        run.context_markdown = context_markdown
        run.context_payload = context_payload
        run.review_metadata = review_metadata
        run.tool_traces = tool_traces
        run.llm_usage_summary = llm_usage_summary
        run.llm_usage_calls = llm_usage_calls
        run.output_payload = output_payload
        run.error_stage = None
        run.error_message = None
        run.completed_at = datetime.now(UTC)
        self._session.flush()
        return run

    def mark_failed(self, run_id: UUID | str, *, error_stage: str, error_message: str) -> AgentRun:
        run = self._session.get(AgentRun, run_id)
        if run is None:
            raise LookupError(f"Agent run not found: {run_id}")

        run.status = "failed"
        run.error_stage = error_stage
        run.error_message = error_message
        run.completed_at = datetime.now(UTC)
        self._session.flush()
        return run

    def update_feedback(self, run_id: UUID | str, *, feedback: str) -> AgentRun:
        run = self._session.get(AgentRun, run_id)
        if run is None:
            raise LookupError(f"Agent run not found: {run_id}")

        run.reviewer_feedback = feedback
        run.reviewer_feedback_updated_at = datetime.now(UTC)
        self._session.flush()
        return run
