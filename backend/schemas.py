"""Pydantic API schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, Field

LoginStatus = Literal["success", "failed"]
MfaStatus = Literal["success", "failed", "not_required", "not_completed"]
IpReputation = Literal["clean", "suspicious", "malicious"]
Severity = Literal["low", "medium", "high", "critical"]
TriageStatus = Literal["open", "investigating", "false_positive", "confirmed", "suppressed", "duplicate"]


class LoginEventBase(BaseModel):
    user_email: str = Field(..., examples=["alice@example.com"])
    timestamp: datetime
    ip_address: str
    country: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    device: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    login_status: LoginStatus
    mfa_status: MfaStatus
    is_vpn_or_proxy: bool = False
    asn: Optional[str] = None
    user_agent: Optional[str] = None
    ip_reputation: IpReputation = "clean"
    is_tor_exit_node: bool = False


class LoginEventCreate(LoginEventBase):
    pass


class LoginEvent(LoginEventBase):
    id: int


class CsvUploadResult(BaseModel):
    inserted: int
    rejected: int
    errors: list[str]


class RecommendedAction(BaseModel):
    code: str
    label: str
    severity: str
    description: str


class MitreTechnique(BaseModel):
    id: str
    name: str
    url: str


class Alert(BaseModel):
    alert_id: str
    user_email: str
    previous_login_location: dict[str, Any]
    current_login_location: dict[str, Any]
    previous_login_time: Optional[datetime]
    current_login_time: datetime
    distance_km: float
    time_difference_minutes: float
    required_speed_kmh: float
    risk_score: int
    severity: Severity
    reasons: list[dict[str, Any]]
    recommended_actions: list[RecommendedAction]
    baseline_context: dict[str, Any]
    confidence: float
    confidence_breakdown: dict[str, float]
    mitre_techniques: list[MitreTechnique]
    triage_status: TriageStatus
    possible_legitimate_travel: bool
    created_at: datetime


class AlertTriageUpdate(BaseModel):
    status: Literal["open", "investigating", "false_positive", "confirmed"]
    actor: str = "analyst"


class AlertNoteCreate(BaseModel):
    analyst_name: str = "analyst"
    note: str = Field(..., min_length=1, max_length=4000)


class AlertNote(BaseModel):
    id: int
    alert_id: str
    analyst_name: str
    note: str
    created_at: datetime


class AuditLog(BaseModel):
    id: int
    actor: str
    action: str
    entity_type: str
    entity_id: str
    old_value: Optional[Union[dict[str, Any], list[Any], str]]
    new_value: Optional[Union[dict[str, Any], list[Any], str]]
    timestamp: datetime


class DetectionRunResult(BaseModel):
    login_events: int
    alerts_created: int
    suppressed_or_duplicate: int
    users_profiled: int
    generated_at: datetime
    alerts: list[Alert]


class DashboardSummary(BaseModel):
    total_alerts: int
    open_alerts: int
    critical_alerts: int
    high_alerts: int
    medium_alerts: int
    suppressed_alerts: int
    average_risk_score: float
    average_confidence: float
    severity_counts: dict[str, int]
    country_counts: list[dict[str, Any]]
    risk_trend: list[dict[str, Any]]
    top_users: list[dict[str, Any]]
    recent_alerts: list[Alert]


class TimelineEvent(BaseModel):
    kind: Literal["login", "alert"]
    timestamp: datetime
    title: str
    status: str
    country: Optional[str] = None
    city: Optional[str] = None
    device: Optional[str] = None
    details: dict[str, Any] = Field(default_factory=dict)
