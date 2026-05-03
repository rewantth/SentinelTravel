"""Route-level helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import aiosqlite

from database import json_dumps, row_to_dict


def model_to_dict(model: Any) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def isoformat(value: Any) -> str:
    if isinstance(value, datetime):
        return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).isoformat()
    return str(value)


async def insert_login_event(db: aiosqlite.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    cursor = await db.execute(
        """
        INSERT INTO login_events (
            user_email, timestamp, ip_address, country, city, latitude, longitude,
            device, browser, os, login_status, mfa_status, is_vpn_or_proxy,
            asn, user_agent, ip_reputation, is_tor_exit_node
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload["user_email"],
            isoformat(payload["timestamp"]),
            payload["ip_address"],
            payload.get("country"),
            payload.get("city"),
            payload.get("latitude"),
            payload.get("longitude"),
            payload.get("device"),
            payload.get("browser"),
            payload.get("os"),
            payload["login_status"],
            payload["mfa_status"],
            int(payload.get("is_vpn_or_proxy", False)),
            payload.get("asn"),
            payload.get("user_agent"),
            payload.get("ip_reputation", "clean"),
            int(payload.get("is_tor_exit_node", False)),
        ),
    )
    await db.commit()
    row_cursor = await db.execute("SELECT * FROM login_events WHERE id = ?", (cursor.lastrowid,))
    row = await row_cursor.fetchone()
    return row_to_dict(row)


async def get_alert_or_404(db: aiosqlite.Connection, alert_id: str) -> dict[str, Any]:
    cursor = await db.execute("SELECT * FROM alerts WHERE alert_id = ?", (alert_id,))
    row = await cursor.fetchone()
    if row is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Alert not found")
    return row_to_dict(row)


async def write_audit_log(
    db: aiosqlite.Connection,
    *,
    actor: str,
    action: str,
    entity_type: str,
    entity_id: str,
    old_value: Any = None,
    new_value: Any = None,
) -> None:
    await db.execute(
        """
        INSERT INTO audit_logs (actor, action, entity_type, entity_id, old_value, new_value, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            actor,
            action,
            entity_type,
            entity_id,
            json_dumps(old_value) if old_value is not None else None,
            json_dumps(new_value) if new_value is not None else None,
            datetime.now(timezone.utc).isoformat(),
        ),
    )
