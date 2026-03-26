"""add broadcast chat message models

Revision ID: a1b2c3d4e5f6
Revises: c1ce1593505d
Create Date: 2026-03-26 00:00:00.000000

"""
from typing import Sequence, Union

import geoalchemy2
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "c1ce1593505d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Create ENUM types ──────────────────────────────────────────────────────
    broadcasttype_enum = sa.Enum(
        "trip", "food", "drinks", "hangout", "sport", "other",
        name="broadcasttype",
    )
    broadcastvisibility_enum = sa.Enum(
        "friends", "friends_of_friends", "public",
        name="broadcastvisibility",
    )
    requeststatus_enum = sa.Enum(
        "pending", "accepted", "declined",
        name="requeststatus",
    )

    broadcasttype_enum.create(op.get_bind(), checkfirst=True)
    broadcastvisibility_enum.create(op.get_bind(), checkfirst=True)
    requeststatus_enum.create(op.get_bind(), checkfirst=True)

    # ── broadcasts ────────────────────────────────────────────────────────────
    op.create_table(
        "broadcasts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("creator_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("type", sa.Enum("trip", "food", "drinks", "hangout", "sport", "other", name="broadcasttype"), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column(
            "location",
            geoalchemy2.types.Geometry(geometry_type="POINT", srid=4326),
            nullable=False,
        ),
        sa.Column("location_name", sa.String(length=200), nullable=True),
        sa.Column("event_datetime", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_flexible", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "visibility",
            sa.Enum("friends", "friends_of_friends", "public", name="broadcastvisibility"),
            nullable=False,
            server_default="public",
        ),
        sa.Column("max_participants", sa.Integer(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_broadcasts_id"), "broadcasts", ["id"], unique=False)
    op.create_index(op.f("ix_broadcasts_creator_id"), "broadcasts", ["creator_id"], unique=False)

    # ── broadcast_requests ────────────────────────────────────────────────────
    op.create_table(
        "broadcast_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("broadcast_id", sa.Integer(), sa.ForeignKey("broadcasts.id"), nullable=False),
        sa.Column("requester_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "accepted", "declined", name="requeststatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("broadcast_id", "requester_id", name="uq_broadcast_request"),
    )
    op.create_index(op.f("ix_broadcast_requests_id"), "broadcast_requests", ["id"], unique=False)
    op.create_index(op.f("ix_broadcast_requests_broadcast_id"), "broadcast_requests", ["broadcast_id"], unique=False)
    op.create_index(op.f("ix_broadcast_requests_requester_id"), "broadcast_requests", ["requester_id"], unique=False)

    # ── chats ─────────────────────────────────────────────────────────────────
    op.create_table(
        "chats",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("broadcast_id", sa.Integer(), sa.ForeignKey("broadcasts.id"), nullable=True),
        sa.Column("participant_1_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("participant_2_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chats_id"), "chats", ["id"], unique=False)
    op.create_index(op.f("ix_chats_broadcast_id"), "chats", ["broadcast_id"], unique=False)

    # ── messages ──────────────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("chat_id", sa.Integer(), sa.ForeignKey("chats.id"), nullable=False),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content", sa.String(length=2000), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_messages_id"), "messages", ["id"], unique=False)
    op.create_index(op.f("ix_messages_chat_id"), "messages", ["chat_id"], unique=False)
    op.create_index(op.f("ix_messages_sender_id"), "messages", ["sender_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_messages_sender_id"), table_name="messages")
    op.drop_index(op.f("ix_messages_chat_id"), table_name="messages")
    op.drop_index(op.f("ix_messages_id"), table_name="messages")
    op.drop_table("messages")

    op.drop_index(op.f("ix_chats_broadcast_id"), table_name="chats")
    op.drop_index(op.f("ix_chats_id"), table_name="chats")
    op.drop_table("chats")

    op.drop_index(op.f("ix_broadcast_requests_requester_id"), table_name="broadcast_requests")
    op.drop_index(op.f("ix_broadcast_requests_broadcast_id"), table_name="broadcast_requests")
    op.drop_index(op.f("ix_broadcast_requests_id"), table_name="broadcast_requests")
    op.drop_table("broadcast_requests")

    op.drop_index(op.f("ix_broadcasts_creator_id"), table_name="broadcasts")
    op.drop_index(op.f("ix_broadcasts_id"), table_name="broadcasts")
    op.drop_table("broadcasts")

    sa.Enum(name="requeststatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="broadcastvisibility").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="broadcasttype").drop(op.get_bind(), checkfirst=True)
