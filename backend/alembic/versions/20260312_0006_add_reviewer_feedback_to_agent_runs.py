"""add reviewer feedback to agent runs"""

from alembic import op
import sqlalchemy as sa


revision = "20260312_0006"
down_revision = "20260312_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agent_runs",
        sa.Column("reviewer_feedback", sa.Text(), nullable=True),
    )
    op.add_column(
        "agent_runs",
        sa.Column("reviewer_feedback_updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("agent_runs", "reviewer_feedback_updated_at")
    op.drop_column("agent_runs", "reviewer_feedback")
