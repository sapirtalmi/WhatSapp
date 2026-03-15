"""add user_status and status_rsvp

Revision ID: afbed2f8fdf2
Revises: 0153d4cea442
Create Date: 2026-03-10 00:04:54.740476

"""
from typing import Sequence, Union

import geoalchemy2
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'afbed2f8fdf2'
down_revision: Union[str, None] = '0153d4cea442'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ENUMs first
    statusmode_enum = sa.Enum('live', 'plan', name='statusmode')
    activitytype_enum = sa.Enum(
        'coffee', 'drinks', 'study', 'hike', 'food', 'event', 'hangout', 'work', 'other',
        name='activitytype',
    )
    rsvpresponse_enum = sa.Enum('going', 'maybe', 'no', name='rsvpresponse')

    statusmode_enum.create(op.get_bind(), checkfirst=True)
    activitytype_enum.create(op.get_bind(), checkfirst=True)
    rsvpresponse_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'user_statuses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('mode', sa.Enum('live', 'plan', name='statusmode'), nullable=False),
        sa.Column(
            'activity_type',
            sa.Enum('coffee', 'drinks', 'study', 'hike', 'food', 'event', 'hangout', 'work', 'other', name='activitytype'),
            nullable=False,
        ),
        sa.Column('message', sa.String(length=280), nullable=True),
        sa.Column(
            'location',
            geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326),
            nullable=False,
        ),
        sa.Column('location_name', sa.String(length=200), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('visibility', sa.String(length=20), nullable=False, server_default='friends'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_user_statuses_id'), 'user_statuses', ['id'], unique=False)
    op.create_index(op.f('ix_user_statuses_user_id'), 'user_statuses', ['user_id'], unique=False)

    op.create_table(
        'status_rsvps',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('status_id', sa.Integer(), sa.ForeignKey('user_statuses.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('response', sa.Enum('going', 'maybe', 'no', name='rsvpresponse'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('status_id', 'user_id', name='uq_rsvp_pair'),
    )
    op.create_index(op.f('ix_status_rsvps_id'), 'status_rsvps', ['id'], unique=False)
    op.create_index(op.f('ix_status_rsvps_status_id'), 'status_rsvps', ['status_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_status_rsvps_status_id'), table_name='status_rsvps')
    op.drop_index(op.f('ix_status_rsvps_id'), table_name='status_rsvps')
    op.drop_table('status_rsvps')

    op.drop_index(op.f('ix_user_statuses_user_id'), table_name='user_statuses')
    op.drop_index(op.f('ix_user_statuses_id'), table_name='user_statuses')
    op.drop_table('user_statuses')

    sa.Enum(name='rsvpresponse').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='activitytype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='statusmode').drop(op.get_bind(), checkfirst=True)
