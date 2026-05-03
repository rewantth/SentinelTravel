"""Detection engine and CLI report for SentinelTravel."""

from __future__ import annotations

import argparse
import json
import math
import sqlite3
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import aiosqlite

from database import DB_PATH, json_dumps, row_to_dict
from models import ACTION_CATALOG, MITRE_CATALOG, severity_for_score

IMPOSSIBLE_TRAVEL_KMH = 900


def parse_timestamp(value: Optional[Any]) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two coordinates."""
    radius_km = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    arc = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    return 2 * radius_km * math.atan2(math.sqrt(arc), math.sqrt(1 - arc))


def has_coordinates(event: dict[str, Any]) -> bool:
    return all(event.get(key) is not None for key in ("latitude", "longitude"))


def location_payload(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "country": event.get("country"),
        "city": event.get("city"),
        "latitude": event.get("latitude"),
        "longitude": event.get("longitude"),
        "ip_address": event.get("ip_address"),
        "asn": event.get("asn"),
    }


def _new_baseline() -> dict[str, Any]:
    return {
        "known_countries": set(),
        "known_cities": set(),
        "known_devices": set(),
        "known_browsers": set(),
        "known_oses": set(),
        "known_asns": set(),
        "typical_login_hours": Counter(),
        "successful_logins": 0,
    }


def _serializable_baseline(baseline: dict[str, Any]) -> dict[str, Any]:
    return {
        "known_countries": sorted(baseline["known_countries"]),
        "known_cities": sorted(baseline["known_cities"]),
        "known_devices": sorted(baseline["known_devices"]),
        "known_browsers": sorted(baseline["known_browsers"]),
        "known_oses": sorted(baseline["known_oses"]),
        "known_asns": sorted(baseline["known_asns"]),
        "typical_login_hours": sorted(int(hour) for hour in baseline["typical_login_hours"].keys()),
        "successful_logins": baseline["successful_logins"],
    }


def _update_baseline(baseline: dict[str, Any], event: dict[str, Any]) -> None:
    # Detection is personal-baseline driven: only successful logins teach the model
    # what is normal for that user.
    if event.get("login_status") != "success":
        return
    for source, target in (
        ("country", "known_countries"),
        ("city", "known_cities"),
        ("device", "known_devices"),
        ("browser", "known_browsers"),
        ("os", "known_oses"),
        ("asn", "known_asns"),
    ):
        if event.get(source):
            baseline[target].add(event[source])
    parsed = parse_timestamp(event.get("timestamp"))
    if parsed:
        baseline["typical_login_hours"][parsed.hour] += 1
    baseline["successful_logins"] += 1


def _risk_reason(code: str, points: int, detail: str) -> dict[str, Any]:
    return {"code": code, "points": points, "detail": detail}


def _failed_attempts_before_success(events: list[dict[str, Any]], current_index: int, current_time: Optional[datetime]) -> int:
    # Credential-stuffing signal: failed logins directly before a success from the
    # same user within a short attack window.
    if current_time is None:
        return 0
    count = 0
    for prior in reversed(events[:current_index]):
        prior_time = parse_timestamp(prior.get("timestamp"))
        if not prior_time:
            continue
        if current_time - prior_time > timedelta(minutes=45):
            break
        if prior.get("login_status") == "failed":
            count += 1
        elif prior.get("login_status") == "success":
            break
    return count


def _mitre_for_signals(reasons: list[dict[str, Any]]) -> list[dict[str, str]]:
    reason_codes = {reason["code"] for reason in reasons}
    techniques: list[dict[str, str]] = []
    if "impossible_travel" in reason_codes:
        techniques.append(MITRE_CATALOG["T1078"])
    if "failed_then_success" in reason_codes:
        techniques.append(MITRE_CATALOG["T1110"])
    if {"vpn_or_proxy", "tor_exit_node"} & reason_codes:
        techniques.append(MITRE_CATALOG["T1090"])
    if {"mfa_failed", "mfa_not_completed"} & reason_codes:
        techniques.append(MITRE_CATALOG["T1556"])
    return techniques


def _actions_for_signals(reasons: list[dict[str, Any]], severity: str) -> list[dict[str, str]]:
    codes = {reason["code"] for reason in reasons}
    action_codes = ["notify_soc", "review_activity"]
    if severity in {"high", "critical"}:
        action_codes.extend(["force_mfa", "revoke_sessions"])
    if {"mfa_failed", "mfa_not_completed", "failed_then_success"} & codes:
        action_codes.extend(["reset_password", "lock_account"])
    if {"vpn_or_proxy", "tor_exit_node", "suspicious_ip_reputation", "malicious_ip_reputation"} & codes:
        action_codes.extend(["investigate_ip", "check_vpn"])
    seen: set[str] = set()
    return [ACTION_CATALOG[code] for code in action_codes if not (code in seen or seen.add(code))]


def _confidence_breakdown(
    *,
    valid_coordinates: bool,
    valid_timestamp: bool,
    has_previous_login: bool,
    reasons: list[dict[str, Any]],
    baseline_available: bool,
) -> dict[str, float]:
    # Confidence is additive and transparent so the UI can explain whether an
    # alert is backed by distance, timing, baseline, and multiple signals.
    return {
        "has_valid_coordinates": 0.25 if valid_coordinates else 0.0,
        "has_valid_timestamp": 0.20 if valid_timestamp else 0.0,
        "has_previous_login": 0.20 if has_previous_login else 0.0,
        "multiple_risk_signals": 0.25 if len(reasons) >= 2 else 0.0,
        "baseline_available": 0.10 if baseline_available else 0.0,
    }


def _event_hour(event: dict[str, Any]) -> Optional[int]:
    parsed = parse_timestamp(event.get("timestamp"))
    return parsed.hour if parsed else None


def _is_normal_hour(baseline: dict[str, Any], event: dict[str, Any]) -> bool:
    hour = _event_hour(event)
    return hour is not None and hour in baseline["typical_login_hours"]


def _apply_suppression_rules(
    alert: dict[str, Any],
    current: dict[str, Any],
    baseline: dict[str, Any],
    rules: list[dict[str, Any]],
    emitted_alerts: list[dict[str, Any]],
) -> dict[str, Any]:
    # Suppression rules reduce noise without discarding the fact that the signal
    # existed; suppressed and duplicate records are retained for portfolio review.
    confidence_adjustment = 0.0
    for rule in rules:
        if not rule.get("enabled", True):
            continue
        criteria = rule.get("criteria", {})
        if rule["rule_type"] == "trusted_asn":
            if current.get("asn") in criteria.get("trusted_asns", []) and current.get("is_vpn_or_proxy"):
                alert["triage_status"] = "suppressed"
                alert["reasons"].append(_risk_reason("trusted_corporate_vpn", 0, "Source ASN matches a trusted corporate VPN suppression rule."))
                confidence_adjustment -= 0.35
        elif rule["rule_type"] == "trusted_context":
            country_ok = current.get("country") in criteria.get("trusted_countries", [])
            device_ok = current.get("device") in criteria.get("trusted_devices", [])
            if country_ok and device_ok and _is_normal_hour(baseline, current):
                reduction = int(criteria.get("risk_reduction", 20))
                alert["risk_score"] = max(0, alert["risk_score"] - reduction)
                alert["reasons"].append(_risk_reason("trusted_context_reduction", -reduction, "Trusted country, managed device, and normal login hour reduced risk."))
                confidence_adjustment -= float(criteria.get("confidence_reduction", 0.15))
        elif rule["rule_type"] == "duplicate_same_country":
            window = timedelta(hours=float(criteria.get("window_hours", 24)))
            current_time = parse_timestamp(alert["current_login_time"])
            for prior in emitted_alerts:
                prior_time = parse_timestamp(prior.get("current_login_time"))
                same_user = prior.get("user_email") == alert["user_email"]
                same_country = prior.get("current_login_location", {}).get("country") == alert["current_login_location"].get("country")
                if current_time and prior_time and same_user and same_country and current_time - prior_time <= window:
                    alert["triage_status"] = "duplicate"
                    alert["reasons"].append(_risk_reason("duplicate_same_country_24h", 0, "Same user and country already alerted within the duplicate suppression window."))
                    break
    alert["severity"] = severity_for_score(alert["risk_score"])
    alert["confidence"] = round(max(0.0, min(1.0, alert["confidence"] + confidence_adjustment)), 2)
    alert["recommended_actions"] = _actions_for_signals(alert["reasons"], alert["severity"])
    return alert


def evaluate_login(
    *,
    user_events: list[dict[str, Any]],
    current_index: int,
    previous_success: dict[str, Any],
    baseline: dict[str, Any],
    rules: list[dict[str, Any]],
    emitted_alerts: list[dict[str, Any]],
) -> Optional[dict[str, Any]]:
    current = user_events[current_index]
    previous_time = parse_timestamp(previous_success.get("timestamp"))
    current_time = parse_timestamp(current.get("timestamp"))
    valid_timestamp = previous_time is not None and current_time is not None
    valid_coordinates = has_coordinates(previous_success) and has_coordinates(current)

    distance_km = 0.0
    minutes = 0.0
    speed_kmh = 0.0
    reasons: list[dict[str, Any]] = []

    # Impossible travel is distance divided by time between successful logins.
    # Same-timestamp cross-continent events intentionally resolve to infinite speed.
    if valid_timestamp and valid_coordinates:
        distance_km = haversine_km(
            float(previous_success["latitude"]),
            float(previous_success["longitude"]),
            float(current["latitude"]),
            float(current["longitude"]),
        )
        minutes = (current_time - previous_time).total_seconds() / 60
        if minutes < 0:
            reasons.append(_risk_reason("negative_timestamp", 0, "Current login timestamp is earlier than the previous successful login."))
        elif minutes == 0 and distance_km > 50:
            speed_kmh = float("inf")
            reasons.append(_risk_reason("impossible_travel", 50, "Cross-location successful logins occurred at the same timestamp."))
        elif minutes > 0:
            speed_kmh = distance_km / (minutes / 60)
            if speed_kmh > IMPOSSIBLE_TRAVEL_KMH:
                reasons.append(
                    _risk_reason(
                        "impossible_travel",
                        50,
                        f"Required travel speed {speed_kmh:,.0f} km/h exceeds {IMPOSSIBLE_TRAVEL_KMH} km/h.",
                    )
                )
    elif not valid_coordinates:
        reasons.append(_risk_reason("missing_coordinates", 0, "Coordinates were missing, so geographic confidence is reduced."))

    # Baseline anomalies compare the event against this user's own successful
    # history, never against generic global rules.
    baseline_available = baseline["successful_logins"] > 0
    anomaly_checks = (
        ("country", "known_countries", 20, "new_country", "Country has not appeared in the user's baseline."),
        ("city", "known_cities", 10, "new_city", "City has not appeared in the user's baseline."),
        ("device", "known_devices", 15, "new_device", "Device has not appeared in the user's baseline."),
        ("asn", "known_asns", 10, "new_asn", "ASN has not appeared in the user's baseline."),
    )
    for source, baseline_key, points, code, detail in anomaly_checks:
        if current.get(source) and current[source] not in baseline[baseline_key]:
            reasons.append(_risk_reason(code, points, detail))
    if (current.get("browser") and current["browser"] not in baseline["known_browsers"]) or (
        current.get("os") and current["os"] not in baseline["known_oses"]
    ):
        reasons.append(_risk_reason("new_browser_or_os", 10, "Browser or operating system has not appeared in the user's baseline."))

    # Network, MFA, and credential-stuffing signals add identity-threat context
    # that can turn realistic travel into a high-priority SOC investigation.
    if current.get("is_vpn_or_proxy"):
        reasons.append(_risk_reason("vpn_or_proxy", 20, "Source is marked as VPN or proxy infrastructure."))
    failed_attempts = _failed_attempts_before_success(user_events, current_index, current_time)
    if failed_attempts:
        reasons.append(_risk_reason("failed_then_success", 10, f"{failed_attempts} failed login attempt(s) preceded this success."))
    if current.get("mfa_status") == "failed":
        reasons.append(_risk_reason("mfa_failed", 25, "MFA challenge failed during the authentication flow."))
    if current.get("mfa_status") == "not_completed":
        reasons.append(_risk_reason("mfa_not_completed", 25, "MFA challenge was not completed."))
    if current.get("ip_reputation") == "suspicious":
        reasons.append(_risk_reason("suspicious_ip_reputation", 15, "IP reputation is suspicious."))
    if current.get("ip_reputation") == "malicious":
        reasons.append(_risk_reason("malicious_ip_reputation", 30, "IP reputation is malicious."))
    if current.get("is_tor_exit_node"):
        reasons.append(_risk_reason("tor_exit_node", 25, "Source IP is marked as a TOR exit node."))

    risk_score = min(100, max(0, sum(reason["points"] for reason in reasons)))
    if risk_score < 30:
        return None

    severity = severity_for_score(risk_score)
    confidence_parts = _confidence_breakdown(
        valid_coordinates=valid_coordinates,
        valid_timestamp=valid_timestamp,
        has_previous_login=previous_success is not None,
        reasons=reasons,
        baseline_available=baseline_available,
    )
    possible_legitimate = bool(valid_timestamp and valid_coordinates and minutes > 0 and speed_kmh <= IMPOSSIBLE_TRAVEL_KMH and distance_km > 50)
    alert = {
        "alert_id": f"ALRT-{uuid.uuid4().hex[:12].upper()}",
        "user_email": current["user_email"],
        "previous_login_location": location_payload(previous_success),
        "current_login_location": location_payload(current),
        "previous_login_time": previous_success.get("timestamp"),
        "current_login_time": current.get("timestamp"),
        "distance_km": round(distance_km, 2),
        "time_difference_minutes": round(minutes, 2),
        "required_speed_kmh": 999999.0 if math.isinf(speed_kmh) else round(speed_kmh, 2),
        "risk_score": risk_score,
        "severity": severity,
        "reasons": reasons,
        "recommended_actions": _actions_for_signals(reasons, severity),
        "baseline_context": _serializable_baseline(baseline),
        "confidence": round(min(1.0, sum(confidence_parts.values())), 2),
        "confidence_breakdown": confidence_parts,
        "mitre_techniques": _mitre_for_signals(reasons),
        "triage_status": "open",
        "possible_legitimate_travel": possible_legitimate,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    return _apply_suppression_rules(alert, current, baseline, rules, emitted_alerts)


def detect_alerts(events: list[dict[str, Any]], rules: Optional[list[dict[str, Any]]] = None) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    rules = rules or []
    by_user: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for event in events:
        by_user[event["user_email"]].append(event)

    alerts: list[dict[str, Any]] = []
    final_baselines: dict[str, dict[str, Any]] = {}
    for user_email, user_events in by_user.items():
        ordered = sorted(user_events, key=lambda item: parse_timestamp(item.get("timestamp")) or datetime.min.replace(tzinfo=timezone.utc))
        baseline = _new_baseline()
        previous_success: Optional[dict[str, Any]] = None
        for index, current in enumerate(ordered):
            if current.get("login_status") != "success":
                continue
            # First successful login only builds a baseline; it cannot generate
            # impossible travel because no previous successful login exists.
            if previous_success is None:
                _update_baseline(baseline, current)
                previous_success = current
                continue
            alert = evaluate_login(
                user_events=ordered,
                current_index=index,
                previous_success=previous_success,
                baseline=baseline,
                rules=rules,
                emitted_alerts=alerts,
            )
            if alert:
                alerts.append(alert)
            _update_baseline(baseline, current)
            previous_success = current
        final_baselines[user_email] = _serializable_baseline(baseline)
    return alerts, final_baselines


async def _fetch_all(db: aiosqlite.Connection, query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [row_to_dict(row) for row in rows]


async def load_events(db: aiosqlite.Connection) -> list[dict[str, Any]]:
    return await _fetch_all(db, "SELECT * FROM login_events ORDER BY timestamp ASC, id ASC")


async def load_rules(db: aiosqlite.Connection) -> list[dict[str, Any]]:
    return await _fetch_all(db, "SELECT * FROM suppression_rules WHERE enabled = 1 ORDER BY id ASC")


async def persist_baselines(db: aiosqlite.Connection, baselines: dict[str, dict[str, Any]]) -> None:
    await db.execute("DELETE FROM user_baselines")
    now = datetime.now(timezone.utc).isoformat()
    for user_email, baseline in baselines.items():
        await db.execute(
            """
            INSERT INTO user_baselines (
                user_email, known_countries, known_cities, known_devices,
                known_browsers, known_oses, known_asns, typical_login_hours, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_email,
                json_dumps(baseline["known_countries"]),
                json_dumps(baseline["known_cities"]),
                json_dumps(baseline["known_devices"]),
                json_dumps(baseline["known_browsers"]),
                json_dumps(baseline["known_oses"]),
                json_dumps(baseline["known_asns"]),
                json_dumps(baseline["typical_login_hours"]),
                now,
            ),
        )


async def persist_alerts(db: aiosqlite.Connection, alerts: list[dict[str, Any]], *, reset: bool = True) -> None:
    if reset:
        await db.execute("DELETE FROM alert_notes")
        await db.execute("DELETE FROM audit_logs")
        await db.execute("DELETE FROM alerts")
    for alert in alerts:
        await db.execute(
            """
            INSERT INTO alerts (
                alert_id, user_email, previous_login_location, current_login_location,
                previous_login_time, current_login_time, distance_km, time_difference_minutes,
                required_speed_kmh, risk_score, severity, reasons, recommended_actions,
                baseline_context, confidence, confidence_breakdown, mitre_techniques,
                triage_status, possible_legitimate_travel, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                alert["alert_id"],
                alert["user_email"],
                json_dumps(alert["previous_login_location"]),
                json_dumps(alert["current_login_location"]),
                alert["previous_login_time"],
                alert["current_login_time"],
                alert["distance_km"],
                alert["time_difference_minutes"],
                alert["required_speed_kmh"],
                alert["risk_score"],
                alert["severity"],
                json_dumps(alert["reasons"]),
                json_dumps(alert["recommended_actions"]),
                json_dumps(alert["baseline_context"]),
                alert["confidence"],
                json_dumps(alert["confidence_breakdown"]),
                json_dumps(alert["mitre_techniques"]),
                alert["triage_status"],
                int(alert["possible_legitimate_travel"]),
                alert["created_at"],
            ),
        )
    await db.commit()


async def run_detection(db: aiosqlite.Connection, *, reset_alerts: bool = True) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    events = await load_events(db)
    rules = await load_rules(db)
    alerts, baselines = detect_alerts(events, rules)
    await persist_baselines(db, baselines)
    await persist_alerts(db, alerts, reset=reset_alerts)
    return alerts, baselines


def _format_alert(alert: dict[str, Any]) -> str:
    reasons = "\n".join(f"    - {reason['detail']} (+{reason['points']})" for reason in alert["reasons"])
    actions = ", ".join(action["code"] for action in alert["recommended_actions"])
    mitre = ", ".join(f"{item['id']} {item['name']}" for item in alert["mitre_techniques"]) or "none"
    return (
        f"\n[{alert['severity'].upper()}] {alert['alert_id']} risk={alert['risk_score']} confidence={alert['confidence']:.2f}\n"
        f"  {alert['previous_login_location'].get('city')} -> {alert['current_login_location'].get('city')} | "
        f"{alert['distance_km']:,.0f} km in {alert['time_difference_minutes']:,.1f} min | "
        f"required speed {alert['required_speed_kmh']:,.0f} km/h\n"
        f"  Reasons:\n{reasons}\n"
        f"  Actions: {actions}\n"
        f"  MITRE: {mitre}\n"
        f"  Triage: {alert['triage_status']}"
    )


def cli_report(user_email: Optional[str] = None, db_path: Path = DB_PATH) -> str:
    if not db_path.exists():
        return f"No database found at {db_path}. Run the API endpoint POST /generate-sample-data first."
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    try:
        params: tuple[Any, ...] = (user_email,) if user_email else ()
        where = "WHERE user_email = ?" if user_email else ""
        events = [row_to_dict(row) for row in connection.execute(f"SELECT * FROM login_events {where} ORDER BY timestamp ASC", params)]
        alerts = [row_to_dict(row) for row in connection.execute(f"SELECT * FROM alerts {where} ORDER BY current_login_time ASC", params)]
    finally:
        connection.close()

    title = f"SentinelTravel CLI Report for {user_email}" if user_email else "SentinelTravel CLI Report"
    lines = [title, "=" * len(title), "", "Login timeline:"]
    for event in events:
        marker = "OK" if event["login_status"] == "success" else "FAIL"
        lines.append(
            f"  {event['timestamp']} | {marker:<4} | {event['user_email']} | "
            f"{event.get('city')}, {event.get('country')} | {event.get('ip_address')} | "
            f"{event.get('device')} / {event.get('browser')} / {event.get('os')}"
        )
    lines.append("\nAlerts:")
    if alerts:
        lines.extend(_format_alert(alert) for alert in alerts)
    else:
        lines.append("  No alerts found for this selector.")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="SentinelTravel detection CLI")
    parser.add_argument("--user", dest="user_email", help="Filter report to a synthetic user email")
    parser.add_argument("--json", action="store_true", help="Print alerts as JSON instead of a terminal report")
    args = parser.parse_args()
    if args.json:
        connection = sqlite3.connect(DB_PATH)
        connection.row_factory = sqlite3.Row
        try:
            params: tuple[Any, ...] = (args.user_email,) if args.user_email else ()
            where = "WHERE user_email = ?" if args.user_email else ""
            rows = [row_to_dict(row) for row in connection.execute(f"SELECT * FROM alerts {where}", params)]
            print(json.dumps(rows, indent=2))
        finally:
            connection.close()
    else:
        print(cli_report(args.user_email))


if __name__ == "__main__":
    main()
