"""Async SQLite setup and small row helpers."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, AsyncIterator, Optional, Union

import aiosqlite

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("SENTINELTRAVEL_DB", BASE_DIR / "sentineltravel.db"))


async def connect_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys = ON")
    await db.execute("PRAGMA journal_mode = WAL")
    return db


async def get_db() -> AsyncIterator[aiosqlite.Connection]:
    db = await connect_db()
    try:
        yield db
    finally:
        await db.close()


def json_dumps(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def json_loads(value: Optional[str], default: Any) -> Any:
    if value in (None, ""):
        return default
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def row_to_dict(row: Union[aiosqlite.Row, dict[str, Any]]) -> dict[str, Any]:
    raw = dict(row)
    for key in (
        "reasons",
        "recommended_actions",
        "baseline_context",
        "confidence_breakdown",
        "mitre_techniques",
        "previous_login_location",
        "current_login_location",
        "known_countries",
        "known_cities",
        "known_devices",
        "known_browsers",
        "known_oses",
        "known_asns",
        "typical_login_hours",
        "criteria",
        "old_value",
        "new_value",
    ):
        if key in raw:
            default = [] if key.startswith("known_") or key in {"reasons", "recommended_actions", "mitre_techniques", "typical_login_hours"} else {}
            raw[key] = json_loads(raw[key], default)
    for key in ("is_vpn_or_proxy", "is_tor_exit_node", "possible_legitimate_travel", "enabled"):
        if key in raw and raw[key] is not None:
            raw[key] = bool(raw[key])
    return raw


async def initialize_database() -> None:
    db = await connect_db()
    try:
        await db.executescript(
            """
            CREATE TABLE IF NOT EXISTS login_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                ip_address TEXT NOT NULL,
                country TEXT,
                city TEXT,
                latitude REAL,
                longitude REAL,
                device TEXT,
                browser TEXT,
                os TEXT,
                login_status TEXT NOT NULL CHECK (login_status IN ('success','failed')),
                mfa_status TEXT NOT NULL CHECK (mfa_status IN ('success','failed','not_required','not_completed')),
                is_vpn_or_proxy INTEGER NOT NULL DEFAULT 0,
                asn TEXT,
                user_agent TEXT,
                ip_reputation TEXT NOT NULL CHECK (ip_reputation IN ('clean','suspicious','malicious')),
                is_tor_exit_node INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS alerts (
                alert_id TEXT PRIMARY KEY,
                user_email TEXT NOT NULL,
                previous_login_location TEXT NOT NULL,
                current_login_location TEXT NOT NULL,
                previous_login_time TEXT,
                current_login_time TEXT NOT NULL,
                distance_km REAL NOT NULL,
                time_difference_minutes REAL NOT NULL,
                required_speed_kmh REAL NOT NULL,
                risk_score INTEGER NOT NULL,
                severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
                reasons TEXT NOT NULL,
                recommended_actions TEXT NOT NULL,
                baseline_context TEXT NOT NULL,
                confidence REAL NOT NULL,
                confidence_breakdown TEXT NOT NULL,
                mitre_techniques TEXT NOT NULL,
                triage_status TEXT NOT NULL DEFAULT 'open',
                possible_legitimate_travel INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_baselines (
                user_email TEXT PRIMARY KEY,
                known_countries TEXT NOT NULL,
                known_cities TEXT NOT NULL,
                known_devices TEXT NOT NULL,
                known_browsers TEXT NOT NULL,
                known_oses TEXT NOT NULL,
                known_asns TEXT NOT NULL,
                typical_login_hours TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS alert_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_id TEXT NOT NULL REFERENCES alerts(alert_id) ON DELETE CASCADE,
                analyst_name TEXT NOT NULL,
                note TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                actor TEXT NOT NULL,
                action TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                timestamp TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS suppression_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                rule_type TEXT NOT NULL,
                criteria TEXT NOT NULL,
                effect TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_login_events_user_time
                ON login_events(user_email, timestamp);
            CREATE INDEX IF NOT EXISTS idx_alerts_user_created
                ON alerts(user_email, created_at);
            CREATE INDEX IF NOT EXISTS idx_alerts_status_severity
                ON alerts(triage_status, severity);
            CREATE INDEX IF NOT EXISTS idx_audit_entity
                ON audit_logs(entity_type, entity_id, timestamp);
            """
        )
        await db.commit()
    finally:
        await db.close()
