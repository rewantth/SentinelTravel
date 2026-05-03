import React from "react";
import { Fragment, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";

import SeverityStamp from "../SeverityStamp/SeverityStamp.jsx";

const ALERTS_URL = "http://localhost:8000/alerts";
const ALERTS_WS = "ws://localhost:8000/ws/alerts";

const severityColors = {
  critical: "#FF0040",
  high: "#FF6B00",
  medium: "#FFB800",
  low: "#00F5FF",
};

const countryRadiusKm = {
  "United States": 1750,
  "United Kingdom": 420,
  Germany: 520,
  Japan: 700,
  India: 1050,
  Singapore: 170,
  "United Arab Emirates": 420,
  Brazil: 1400,
  France: 560,
  Ireland: 360,
  Canada: 1500,
  Mexico: 900,
  Netherlands: 260,
  Nigeria: 620,
  "South Africa": 760,
  Kenya: 560,
  Russia: 1600,
};

function normalize(value) {
  return String(value || "low").toLowerCase();
}

function hasCoordinates(location = {}) {
  return Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude));
}

function markerIcon(severity) {
  const color = severityColors[severity] || severityColors.low;
  const criticalPulse = severity === "critical" ? "<span class='world-marker-pulse'></span>" : "";

  return L.divIcon({
    className: "",
    html: `
      <span class="world-marker" style="--marker-color:${color}">
        ${criticalPulse}
        <span class="world-marker-core"></span>
      </span>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function locationLabel(location = {}) {
  return [location.city, location.country].filter(Boolean).join(", ") || "Unknown";
}

function IntelligenceCard({ alert, onClose }) {
  if (!alert) {
    return null;
  }

  const severity = normalize(alert.severity);
  const color = severityColors[severity] || severityColors.low;

  return (
    <aside className="absolute left-4 top-4 z-[500] max-w-sm border bg-panel/95 p-4 shadow-panel backdrop-blur" style={{ borderColor: color }}>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 font-mono text-xs text-textMuted transition hover:text-cyan"
      >
        CLOSE
      </button>
      <SeverityStamp severity={severity} />
      <div className="mt-4 break-all font-mono text-sm text-cyan">{alert.user_email}</div>
      <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-xs">
        <div>
          <div className="uppercase text-textMuted">Risk</div>
          <div className="mt-1 font-orbitron text-3xl font-black" style={{ color }}>
            {Math.round(alert.risk_score || 0)}
          </div>
        </div>
        <div>
          <div className="uppercase text-textMuted">Speed</div>
          <div className="mt-1 font-orbitron text-2xl font-black" style={{ color }}>
            {Math.round(alert.required_speed_kmh || 0).toLocaleString()}
          </div>
          <div className="text-textMuted">km/h</div>
        </div>
      </div>
      <div className="mt-4 border-t border-borderDefault pt-3 font-mono text-xs text-textPrimary">
        <div className="text-textMuted">FROM</div>
        <div>{locationLabel(alert.previous_login_location)}</div>
        <div className="mt-2 text-textMuted">TO</div>
        <div className="text-cyan">{locationLabel(alert.current_login_location)}</div>
      </div>
    </aside>
  );
}

export default function WorldMap() {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadAlerts() {
      try {
        setError("");
        const response = await fetch(ALERTS_URL, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`alerts request failed: ${response.status}`);
        }
        setAlerts(await response.json());
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError("MAP ALERT FEED OFFLINE");
        }
      }
    }

    loadAlerts();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const socket = new WebSocket(ALERTS_WS);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "alert" && message.payload?.alert_id) {
          setAlerts((current) => [message.payload, ...current.filter((alert) => alert.alert_id !== message.payload.alert_id)]);
        }
      } catch {
        setError("MAP WEBSOCKET DECODE FAILURE");
      }
    };
    socket.onerror = () => setError("MAP ALERT STREAM OFFLINE");
    return () => socket.close();
  }, []);

  const drawableAlerts = useMemo(
    () => alerts.filter((alert) => hasCoordinates(alert.current_login_location) && hasCoordinates(alert.previous_login_location)),
    [alerts],
  );

  const countryOverlays = useMemo(() => {
    const severityRank = { low: 1, medium: 2, high: 3, critical: 4 };
    const byCountry = new Map();
    for (const alert of drawableAlerts) {
      const location = alert.current_login_location;
      const country = location.country || "Unknown";
      const existing = byCountry.get(country);
      const severity = normalize(alert.severity);
      if (!existing) {
        byCountry.set(country, {
          country,
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          count: 1,
          severity,
        });
      } else {
        existing.count += 1;
        existing.latitude = (existing.latitude * (existing.count - 1) + Number(location.latitude)) / existing.count;
        existing.longitude = (existing.longitude * (existing.count - 1) + Number(location.longitude)) / existing.count;
        if (severityRank[severity] > severityRank[existing.severity]) {
          existing.severity = severity;
        }
      }
    }
    return Array.from(byCountry.values());
  }, [drawableAlerts]);

  return (
    <section className="relative min-h-[calc(100vh-180px)] overflow-hidden border border-borderDefault bg-panel/76 shadow-panel">
      <div className="relative z-10 flex items-center justify-between border-b border-borderDefault p-4">
        <div>
          <h2 className="font-orbitron text-xl font-black uppercase text-textPrimary">World Map</h2>
          <div className={`mt-1 font-mono text-xs uppercase ${error ? "text-crimson" : "text-cyan"}`}>
            {error || `${drawableAlerts.length} travel paths rendered`}
          </div>
        </div>
      </div>

      <div className="relative h-[calc(100vh-255px)] min-h-[560px]">
        <MapContainer center={[24, 5]} zoom={2} minZoom={2} maxZoom={7} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {countryOverlays.map((country) => {
            const color = normalize(country.severity) === "medium" ? severityColors.medium : severityColors.critical;
            const radius = (countryRadiusKm[country.country] || 520) * 1000;
            return (
              <Circle
                key={`overlay-${country.country}`}
                center={[country.latitude, country.longitude]}
                radius={radius}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: normalize(country.severity) === "medium" ? 0.08 : 0.12,
                  opacity: 0.18,
                  weight: 1,
                }}
              />
            );
          })}
          {drawableAlerts.map((alert) => {
            const severity = normalize(alert.severity);
            const color = severityColors[severity] || severityColors.low;
            const previous = [Number(alert.previous_login_location.latitude), Number(alert.previous_login_location.longitude)];
            const current = [Number(alert.current_login_location.latitude), Number(alert.current_login_location.longitude)];

            return (
              <Fragment key={alert.alert_id}>
                <Polyline
                  positions={[previous, current]}
                  pathOptions={{
                    color,
                    opacity: 0.85,
                    weight: severity === "critical" ? 3.4 : 2.4,
                    dashArray: "9 11",
                    className: "travel-line-dash",
                  }}
                />
                <Marker position={current} icon={markerIcon(severity)} eventHandlers={{ click: () => setSelectedAlert(alert) }} />
              </Fragment>
            );
          })}
        </MapContainer>

        <IntelligenceCard alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      </div>
    </section>
  );
}
