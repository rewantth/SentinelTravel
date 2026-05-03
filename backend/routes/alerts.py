"""Alert retrieval, triage, notes, and audit endpoints."""

from __future__ import annotations

from typing import Annotated, Optional

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query

from database import get_db, row_to_dict
from models import TRIAGE_TRANSITIONS
from schemas import Alert, AlertNote, AlertNoteCreate, AlertTriageUpdate, AuditLog
from .utils import get_alert_or_404, model_to_dict, write_audit_log

router = APIRouter(tags=["Alerts"])


@router.get("/alerts", response_model=list[Alert])
async def list_alerts(
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
    severity: Optional[str] = None,
    triage_status: Optional[str] = None,
    user_email: Optional[str] = None,
    include_suppressed: bool = True,
    limit: int = Query(250, ge=1, le=1000),
) -> list[dict]:
    clauses: list[str] = []
    params: list[object] = []
    if severity:
        clauses.append("severity = ?")
        params.append(severity)
    if triage_status:
        clauses.append("triage_status = ?")
        params.append(triage_status)
    elif not include_suppressed:
        clauses.append("triage_status NOT IN ('suppressed','duplicate')")
    if user_email:
        clauses.append("user_email = ?")
        params.append(user_email)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.append(limit)
    cursor = await db.execute(f"SELECT * FROM alerts {where} ORDER BY risk_score DESC, current_login_time DESC LIMIT ?", tuple(params))
    rows = await cursor.fetchall()
    return [row_to_dict(row) for row in rows]


@router.get("/alerts/{alert_id}", response_model=Alert)
async def get_alert(alert_id: str, db: Annotated[aiosqlite.Connection, Depends(get_db)]) -> dict:
    return await get_alert_or_404(db, alert_id)


@router.patch("/alerts/{alert_id}/triage", response_model=Alert)
async def update_alert_triage(
    alert_id: str,
    payload: AlertTriageUpdate,
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> dict:
    alert = await get_alert_or_404(db, alert_id)
    old_status = alert["triage_status"]
    new_status = payload.status
    if new_status != old_status and new_status not in TRIAGE_TRANSITIONS.get(old_status, set()):
        raise HTTPException(status_code=409, detail=f"Invalid triage transition {old_status} -> {new_status}")
    await db.execute("UPDATE alerts SET triage_status = ? WHERE alert_id = ?", (new_status, alert_id))
    await write_audit_log(
        db,
        actor=payload.actor,
        action="triage_status_changed",
        entity_type="alert",
        entity_id=alert_id,
        old_value={"triage_status": old_status},
        new_value={"triage_status": new_status},
    )
    await db.commit()
    return await get_alert_or_404(db, alert_id)


@router.post("/alerts/{alert_id}/notes", response_model=AlertNote, status_code=201)
async def add_alert_note(
    alert_id: str,
    payload: AlertNoteCreate,
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> dict:
    await get_alert_or_404(db, alert_id)
    note = model_to_dict(payload)
    cursor = await db.execute(
        """
        INSERT INTO alert_notes (alert_id, analyst_name, note, created_at)
        VALUES (?, ?, ?, datetime('now'))
        """,
        (alert_id, note["analyst_name"], note["note"]),
    )
    await write_audit_log(
        db,
        actor=note["analyst_name"],
        action="note_added",
        entity_type="alert",
        entity_id=alert_id,
        new_value={"note": note["note"]},
    )
    await db.commit()
    row_cursor = await db.execute("SELECT * FROM alert_notes WHERE id = ?", (cursor.lastrowid,))
    row = await row_cursor.fetchone()
    return row_to_dict(row)


@router.get("/alerts/{alert_id}/notes", response_model=list[AlertNote])
async def list_alert_notes(alert_id: str, db: Annotated[aiosqlite.Connection, Depends(get_db)]) -> list[dict]:
    await get_alert_or_404(db, alert_id)
    cursor = await db.execute("SELECT * FROM alert_notes WHERE alert_id = ? ORDER BY created_at DESC", (alert_id,))
    rows = await cursor.fetchall()
    return [row_to_dict(row) for row in rows]


@router.get("/alerts/{alert_id}/audit-logs", response_model=list[AuditLog])
async def list_alert_audit_logs(alert_id: str, db: Annotated[aiosqlite.Connection, Depends(get_db)]) -> list[dict]:
    await get_alert_or_404(db, alert_id)
    cursor = await db.execute(
        "SELECT * FROM audit_logs WHERE entity_type = 'alert' AND entity_id = ? ORDER BY timestamp DESC",
        (alert_id,),
    )
    rows = await cursor.fetchall()
    return [row_to_dict(row) for row in rows]
