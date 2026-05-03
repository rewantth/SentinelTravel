"""Shared constants and lightweight model helpers for SentinelTravel."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


SEVERITY_THRESHOLDS = (
    ("critical", 80, 100),
    ("high", 60, 79),
    ("medium", 30, 59),
    ("low", 0, 29),
)

TRIAGE_TRANSITIONS: dict[str, set[str]] = {
    "open": {"investigating", "false_positive", "confirmed"},
    "investigating": {"false_positive", "confirmed", "open"},
    "false_positive": {"open", "investigating"},
    "confirmed": {"open", "investigating"},
    "suppressed": {"open"},
    "duplicate": {"open"},
}

ACTION_CATALOG: dict[str, dict[str, str]] = {
    "force_mfa": {
        "code": "force_mfa",
        "label": "Force MFA Verification",
        "severity": "high",
        "description": "Require the user to complete MFA before continuing access.",
    },
    "revoke_sessions": {
        "code": "revoke_sessions",
        "label": "Revoke Active Sessions",
        "severity": "critical",
        "description": "Terminate active sessions for the affected identity.",
    },
    "lock_account": {
        "code": "lock_account",
        "label": "Lock Account",
        "severity": "critical",
        "description": "Temporarily lock the identity until ownership is verified.",
    },
    "notify_soc": {
        "code": "notify_soc",
        "label": "Notify SOC",
        "severity": "medium",
        "description": "Escalate the alert to the security operations queue.",
    },
    "investigate_ip": {
        "code": "investigate_ip",
        "label": "Investigate IP",
        "severity": "medium",
        "description": "Review ASN, reputation, proxy, and TOR context for this source.",
    },
    "review_activity": {
        "code": "review_activity",
        "label": "Review Activity",
        "severity": "medium",
        "description": "Inspect recent authentication and application activity for this user.",
    },
    "check_vpn": {
        "code": "check_vpn",
        "label": "Check VPN",
        "severity": "medium",
        "description": "Validate whether the source belongs to an approved corporate VPN path.",
    },
    "reset_password": {
        "code": "reset_password",
        "label": "Reset Password",
        "severity": "high",
        "description": "Force credential rotation if compromise remains plausible.",
    },
}

MITRE_CATALOG: dict[str, dict[str, str]] = {
    "T1078": {
        "id": "T1078",
        "name": "Valid Accounts",
        "url": "https://attack.mitre.org/techniques/T1078/",
    },
    "T1110": {
        "id": "T1110",
        "name": "Brute Force",
        "url": "https://attack.mitre.org/techniques/T1110/",
    },
    "T1090": {
        "id": "T1090",
        "name": "Proxy",
        "url": "https://attack.mitre.org/techniques/T1090/",
    },
    "T1556": {
        "id": "T1556",
        "name": "Modify Authentication Process",
        "url": "https://attack.mitre.org/techniques/T1556/",
    },
}


@dataclass(frozen=True)
class RiskSignal:
    code: str
    label: str
    points: int
    detail: str


def severity_for_score(score: int) -> str:
    capped = max(0, min(100, score))
    for label, low, high in SEVERITY_THRESHOLDS:
        if low <= capped <= high:
            return label
    return "low"


def safe_json_default(value: Any) -> Any:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)

