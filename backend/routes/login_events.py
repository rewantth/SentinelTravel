"""Login event ingestion and listing endpoints."""

from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Annotated, Optional

import aiosqlite
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import ValidationError

from database import get_db, row_to_dict
from schemas import CsvUploadResult, LoginEvent, LoginEventCreate
from .utils import insert_login_event, model_to_dict

router = APIRouter(tags=["Login Events"])


@router.get("/login-events", response_model=list[LoginEvent])
async def list_login_events(
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
    user_email: Optional[str] = None,
    limit: int = Query(500, ge=1, le=5000),
) -> list[dict]:
    params: list[object] = []
    where = ""
    if user_email:
        where = "WHERE user_email = ?"
        params.append(user_email)
    params.append(limit)
    cursor = await db.execute(f"SELECT * FROM login_events {where} ORDER BY timestamp DESC, id DESC LIMIT ?", tuple(params))
    rows = await cursor.fetchall()
    return [row_to_dict(row) for row in rows]


@router.post("/login-events", response_model=LoginEvent, status_code=201)
async def create_login_event(
    payload: LoginEventCreate,
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
) -> dict:
    return await insert_login_event(db, model_to_dict(payload))


def _parse_bool(value: object) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def _csv_row_to_payload(row: dict[str, str]) -> LoginEventCreate:
    data = dict(row)
    for key in ("latitude", "longitude"):
        data[key] = float(data[key]) if data.get(key) not in (None, "") else None
    for key in ("is_vpn_or_proxy", "is_tor_exit_node"):
        data[key] = _parse_bool(data.get(key, False))
    data["timestamp"] = datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))
    return LoginEventCreate(**data)


@router.post("/upload-login-events-csv", response_model=CsvUploadResult)
async def upload_login_events_csv(
    db: Annotated[aiosqlite.Connection, Depends(get_db)],
    file: UploadFile = File(...),
) -> CsvUploadResult:
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload must be a CSV file")
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    inserted = 0
    errors: list[str] = []
    for index, row in enumerate(reader, start=2):
        try:
            payload = _csv_row_to_payload(row)
            await insert_login_event(db, model_to_dict(payload))
            inserted += 1
        except (ValidationError, ValueError, KeyError) as exc:
            errors.append(f"row {index}: {exc}")
    return CsvUploadResult(inserted=inserted, rejected=len(errors), errors=errors)
