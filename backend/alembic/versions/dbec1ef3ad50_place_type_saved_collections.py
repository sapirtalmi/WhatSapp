"""place_type_saved_collections

Revision ID: dbec1ef3ad50
Revises: 2f0ce6b6c8a3
Create Date: 2026-03-04 10:24:49.876132

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = 'dbec1ef3ad50'
down_revision: Union[str, None] = '2f0ce6b6c8a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add type column to places (skip if already exists)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = [c['name'] for c in inspector.get_columns('places')]
    if 'type' not in existing_cols:
        op.add_column('places', sa.Column('type', sa.Enum('food', 'travel', 'shop', 'hangout', name='placetype'), nullable=True))

    # Create saved_collections (skip if already exists)
    if 'saved_collections' not in inspector.get_table_names():
        op.create_table('saved_collections',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('collection_id', sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(['collection_id'], ['map_collections.id'], ),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', 'collection_id', name='uq_saved_collection'),
        )
        op.create_index(op.f('ix_saved_collections_id'), 'saved_collections', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_saved_collections_id'), table_name='saved_collections')
    op.drop_table('saved_collections')
    op.drop_column('places', 'type')
