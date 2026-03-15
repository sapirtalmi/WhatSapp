"""extra_data_exercise_type

Revision ID: 3eafd4117ad2
Revises: dbec1ef3ad50
Create Date: 2026-03-04 23:58:27.944304

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '3eafd4117ad2'
down_revision: Union[str, None] = 'dbec1ef3ad50'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE placetype ADD VALUE IF NOT EXISTS 'exercise'")
    op.add_column('places', sa.Column('extra_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('places', 'extra_data')
    # Note: PostgreSQL does not support removing enum values
