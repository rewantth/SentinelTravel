"""Dashboard summary and user timeline endpoints."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from typing import Annotated, Any

import aiosqlite
from fastapi import APIRouter, Depends

from database import get_db, row_to_dict
from schemas import DashboardSummary, TimelineEvent

router = APIRouter(tags=["Dashboard"])


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def dashboard_summary(db: Annotated[aiosqlite.Connection, Depends(get_db)]) -> DashboardSummary:
    cursor = await db.execute("SELECT * FROM alerts ORDER BY current_login_time DESC")
    alerts = [row_to_dict(row) for row in await cursor.fetchall()]
    severity_counts = Counter(alert["severity"] for alert in alerts)
    status_counts = Counter(alert["triage_status"] for alert in alerts)
    country_counts = Counter(alert["current_login_location"].get("country") or "Unknown" for alert in alerts)
    top_users = Counter(alert["user_email"] for alert in alerts)
    trend: dict[str, dict[str, Any]] = defaultdict(lambda: {"date": "", "count": 0, "avg_risk": 0.0})
    risk_totals: dict[str, int] = defaultdict(int)

    for alert in alerts:
        date_key = str(alert["current_login_time"])[:10]
        trend[date_key]["date"] = date_key
        trend[date_key]["count"] += 1
        risk_totals[date_key] += int(alert["risk_score"])
        trend[date_key]["avg_risk"] = round(risk_totals[date_key] / trend[date_key]["count"], 1)

    total = len(alerts)
    return DashboardSummary(
        total_alerts=total,
        open_alerts=status_counts["open"],
        critical_alerts=severity_counts["critical"],
        high_alerts=severity_counts["high"],
        medium_alerts=severity_counts["medium"],
        suppressed_alerts=status_counts["suppressed"] + status_counts["duplicate"],
        average_risk_score=round(sum(alert["risk_score"] for alert in alerts) / total, 1) if total else 0.0,
        average_confidence=round(sum(alert["confidence"] for alert in alerts) / total, 2) if total else 0.0,
        severity_counts={label: severity_counts[label] for label in ("low", "medium", "high", "critical")},
        country_counts=[{"country": country, "count": count} for country, count in country_counts.most_common()],
        risk_trend=sorted(trend.values(), key=lambda item: item["date"]),
        top_users=[{"user_email": user, "count": count} for user, count in top_users.most_common(8)],
        recent_alerts=alerts[:8],
    )


@router.get("/users/{email}/timeline", response_model=list[TimelineEvent])
async def user_timeline(email: str, db: Annotated[aiosqlite.Connection, Depends(get_db)]) -> list[TimelineEvent]:
    login_cursor = await db.execute("SELECT * FROM login_events WHERE user_email = ? ORDER BY timestamp ASC", (email,))
    logins = [row_to_dict(row) for row in await login_cursor.fetchall()]
    alert_cursor = await db.execute("SELECT * FROM alerts WHERE user_email = ? ORDER BY current_login_time ASC", (email,))
    alerts = [row_to_dict(row) for row in await alert_cursor.fetchall()]

    timeline: list[TimelineEvent] = []
    for event in logins:
        title = "Successful login" if event["login_status"] == "success" else "Failed login attempt"
        timeline.append(
            TimelineEvent(
                kind="login",
                timestamp=datetime.fromisoformat(str(event["timestamp"]).replace("Z", "+00:00")),
                title=title,
                status=event["login_status"],
                country=event.get("country"),
                city=event.get("city"),
                device=event.get("device"),
                details={
                    "mfa_status": event.get("mfa_status"),
                    "ip_address": event.get("ip_address"),
                    "asn": event.get("asn"),
                    "browser": event.get("browser"),
                    "os": event.get("os"),
                    "vpn_or_proxy": event.get("is_vpn_or_proxy"),
                    "tor": event.get("is_tor_exit_node"),
                },
            )
        )
    for alert in alerts:
        timeline.append(
            TimelineEvent(
                kind="alert",
                timestamp=datetime.fromisoformat(str(alert["current_login_time"]).replace("Z", "+00:00")),
                title=f"{alert['severity'].upper()} alert",
                status=alert["triage_status"],
                country=alert["current_login_location"].get("country"),
                city=alert["current_login_location"].get("city"),
                device=None,
                details={
                    "alert_id": alert["alert_id"],
                    "risk_score": alert["risk_score"],
                    "confidence": alert["confidence"],
                    "reasons": alert["reasons"],
                },
            )
        )
    return sorted(timeline, key=lambda item: item.timestamp)

