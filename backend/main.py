"""FastAPI application entrypoint for SentinelTravel."""

from __future__ import annotations

import json
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from database import initialize_database
from routes import alerts, dashboard, detection_routes, exports, login_events


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict[str, Any]) -> None:
        encoded = json.dumps(message)
        disconnected: list[WebSocket] = []
        for connection in self.active_connections:
            try:
                await connection.send_text(encoded)
            except RuntimeError:
                disconnected.append(connection)
        for connection in disconnected:
            self.disconnect(connection)


app = FastAPI(
    title="SentinelTravel",
    description="Identity threat detection and impossible travel analytics over synthetic authentication logs.",
    version="1.0.0",
)
app.state.connection_manager = ConnectionManager()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(login_events.router)
app.include_router(alerts.router)
app.include_router(detection_routes.router)
app.include_router(dashboard.router)
app.include_router(exports.router)


@app.on_event("startup")
async def startup() -> None:
    await initialize_database()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "online", "system": "SentinelTravel"}


@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket) -> None:
    manager: ConnectionManager = app.state.connection_manager
    await manager.connect(websocket)
    await websocket.send_text(json.dumps({"type": "ready", "payload": {"channel": "alerts"}}))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

