"""Alert export endpoints."""

from __future__ import annotations

import csv
import io
import json
from typing import Annotated

import aiosqlite
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse

from database import get_db, row_to_dict
from .utils import get_alert_or_404

router = APIRouter(tags=["Exports"])


@router.get("/alerts/{alert_id}/export/json")
async def export_alert_json(alert_id: str, db: Annotated[aiosqlite.Connection, Depends(get_db)]) -> JSONResponse:
    alert = await get_alert_or_404(db, alert_id)
    return JSONResponse(alert)


@router.get("/alerts/export/csv")
async def export_alerts_csv(db: Annotated[aiosqlite.Connection, Depends(get_db)]) -> StreamingResponse:
    cursor = await db.execute("SELECT * FROM alerts ORDER BY current_login_time DESC")
    alerts = [row_to_dict(row) for row in await cursor.fetchall()]
    output = io.StringIO()
    fieldnames = [
        "alert_id",
        "user_email",
        "severity",
        "risk_score",
        "confidence",
        "triage_status",
        "current_login_time",
        "distance_km",
        "required_speed_kmh",
        "current_country",
        "current_city",
        "reasons",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for alert in alerts:
        writer.writerow(
            {
                "alert_id": alert["alert_id"],
                "user_email": alert["user_email"],
                "severity": alert["severity"],
                "risk_score": alert["risk_score"],
                "confidence": alert["confidence"],
                "triage_status": alert["triage_status"],
                "current_login_time": alert["current_login_time"],
                "distance_km": alert["distance_km"],
                "required_speed_kmh": alert["required_speed_kmh"],
                "current_country": alert["current_login_location"].get("country"),
                "current_city": alert["current_login_location"].get("city"),
                "reasons": "; ".join(reason["code"] for reason in alert["reasons"]),
            }
        )
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sentineltravel_alerts.csv"},
    )


@router.get("/alerts/{alert_id}/export/siem", response_class=PlainTextResponse)
async def export_alert_siem(alert_id: str, db: Annotated[aiosqlite.Connection, Depends(get_db)]) -> str:
    alert = await get_alert_or_404(db, alert_id)
    event = {
        "event.kind": "alert",
        "event.module": "sentineltravel",
        "event.action": "identity_impossible_travel_detected",
        "event.severity": alert["severity"],
        "sentineltravel.alert_id": alert["alert_id"],
        "user.email": alert["user_email"],
        "source.geo.country_name": alert["current_login_location"].get("country"),
        "source.geo.city_name": alert["current_login_location"].get("city"),
        "risk.calculated_level": alert["severity"],
        "risk.calculated_score_norm": alert["risk_score"],
        "threat.technique.id": [item["id"] for item in alert["mitre_techniques"]],
        "message": " | ".join(reason["detail"] for reason in alert["reasons"]),
    }
    return json.dumps(event, separators=(",", ":"))

