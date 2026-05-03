"""Detection and sample-data endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

import aiosqlite
from fastapi import APIRouter, Depends, Request

from database import get_db, row_to_dict
from detection import run_detection
from sample_data import reset_and_seed
from schemas import DetectionRunResult

router = APIRouter(tags=["Detection"])


async def _broadcast_alerts(request: Request, alerts: list[dict]) -> None:
    manager = getattr(request.app.state, "connection_manager", None)
    if manager:
        for alert in alerts:
            await manager.broadcast({"type": "alert", "payload": alert})


async def _result_payload(db: aiosqlite.Connection, alerts: list[dict], baselines: dict[str, dict]) -> DetectionRunResult:
    cursor = await db.execute("SELECT COUNT(*) AS count FROM login_events")
    count_row = await cursor.fetchone()
    return DetectionRunResult(
        login_events=int(count_row["count"]),
        alerts_created=len(alerts),
        suppressed_or_duplicate=sum(1 for alert in alerts if alert["triage_status"] in {"suppressed", "duplicate"}),
        users_profiled=len(baselines),
        generated_at=datetime.now(timezone.utc),
        alerts=[row_to_dict(alert) for alert in alerts],
    )


@router.post("/run-detection", response_model=DetectionRunResult)
async def run_detection_endpoint(
    request: Request,
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> DetectionRunResult:
    alerts, baselines = await run_detection(db, reset_alerts=True)
    await _broadcast_alerts(request, alerts)
    return await _result_payload(db, alerts, baselines)


@router.post("/generate-sample-data", response_model=DetectionRunResult)
async def generate_sample_data_endpoint(
    request: Request,
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> DetectionRunResult:
    await reset_and_seed(db)
    alerts, baselines = await run_detection(db, reset_alerts=True)
    await _broadcast_alerts(request, alerts)
    return await _result_payload(db, alerts, baselines)
