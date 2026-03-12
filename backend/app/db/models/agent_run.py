from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_type: Mapped[str] = mapped_column(String(32), nullable=False)
    review_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    trigger_source: Mapped[str] = mapped_column(String(32), nullable=False, default="manual_api")
    test_mode: Mapped[bool] = mapped_column(nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="started", index=True)
    error_stage: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    final_decision: Mapped[str | None] = mapped_column(String(64), nullable=True)
    decision_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    reject_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prompt_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    context_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    context_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    review_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    tool_traces: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    llm_usage_summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    llm_usage_calls: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    output_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    reviewer_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewer_feedback_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
