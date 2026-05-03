import { Fragment } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from "react-leaflet";

import SeverityStamp from "../SeverityStamp/SeverityStamp.jsx";

const color = {
  critical: "#FF0040",
  high: "#FF6B00",
  medium: "#FFB800",
  low: "#00F5FF",
};

function hasPoint(location) {
  return Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude));
}

export default function WorldMap({ alerts = [], onSelect }) {
  const usable = alerts.filter((alert) => hasPoint(alert.previous_login_location) && hasPoint(alert.current_login_location)).slice(0, 40);

  return (
    <section className="overflow-hidden border border-line bg-void/70 shadow-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-black uppercase text-white">Global Travel Path Render</h2>
          <p className="mt-1 font-mono text-xs text-slate-400">Dark matter tile layer with synthetic geolocation tracks</p>
        </div>
        <div className="font-mono text-xs text-cyan">{usable.length} paths</div>
      </div>
      <div className="h-[420px]">
        <MapContainer center={[23, 8]} zoom={2} minZoom={2} maxZoom={7} className="h-full w-full" scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {usable.map((alert) => {
            const path = [
              [alert.previous_login_location.latitude, alert.previous_login_location.longitude],
              [alert.current_login_location.latitude, alert.current_login_location.longitude],
            ];
            const tone = color[alert.severity] || color.low;
            return (
              <Fragment key={alert.alert_id}>
                <Polyline positions={path} pathOptions={{ color: tone, weight: 3, opacity: 0.8, dashArray: "8 10" }} eventHandlers={{ click: () => onSelect(alert) }} />
                <CircleMarker
                  center={path[1]}
                  radius={8 + alert.risk_score / 12}
                  pathOptions={{ color: tone, fillColor: "#020408", fillOpacity: 0.72, weight: 3 }}
                  eventHandlers={{ click: () => onSelect(alert) }}
                >
                  <Popup>
                    <div className="min-w-[220px] bg-void p-2 font-mono text-cyan">
                      <SeverityStamp severity={alert.severity} />
                      <div className="mt-2 text-white">{alert.user_email}</div>
                      <div className="mt-1">
                        {alert.previous_login_location.city} -> {alert.current_login_location.city}
                      </div>
                      <div className="mt-1">Risk {alert.risk_score} | {Math.round(alert.required_speed_kmh).toLocaleString()} km/h</div>
                    </div>
                  </Popup>
                </CircleMarker>
              </Fragment>
            );
          })}
        </MapContainer>
      </div>
    </section>
  );
}
