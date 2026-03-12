"""create agent runs table"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260311_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("review_type", sa.String(length=32), nullable=False),
        sa.Column("review_id", sa.String(length=64), nullable=False),
        sa.Column("trigger_source", sa.String(length=32), nullable=False),
        sa.Column("test_mode", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("error_stage", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("model", sa.String(length=255), nullable=True),
        sa.Column("decision", sa.String(length=64), nullable=True),
        sa.Column("reject_reason", sa.String(length=255), nullable=True),
        sa.Column("prompt_markdown", sa.Text(), nullable=True),
        sa.Column("context_markdown", sa.Text(), nullable=True),
        sa.Column("context_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("review_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("tool_traces", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("output_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_agent_runs_review_id", "agent_runs", ["review_id"], unique=False)
    op.create_index("ix_agent_runs_status", "agent_runs", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_agent_runs_status", table_name="agent_runs")
    op.drop_index("ix_agent_runs_review_id", table_name="agent_runs")
    op.drop_table("agent_runs")
