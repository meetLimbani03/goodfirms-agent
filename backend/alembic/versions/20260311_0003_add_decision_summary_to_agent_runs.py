"""add decision summary to agent runs"""

from alembic import op
import sqlalchemy as sa


revision = "20260311_0003"
down_revision = "20260311_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agent_runs",
        sa.Column("decision_summary", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("agent_runs", "decision_summary")

