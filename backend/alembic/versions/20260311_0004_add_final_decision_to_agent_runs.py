"""add final decision to agent runs"""

from alembic import op
import sqlalchemy as sa


revision = "20260311_0004"
down_revision = "20260311_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agent_runs",
        sa.Column("final_decision", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("agent_runs", "final_decision")

