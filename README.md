██████████████████████████████████████
██  SENTINELTRAVEL  ████████████████
██  Identity Threat Detection       ██
██████████████████████████████████████

# SentinelTravel

**Identity Threat Detection & Impossible Travel Analytics Platform**

SentinelTravel is a full-stack SOC platform for detecting impossible geographic travel, identity compromise signals, VPN/proxy usage, MFA failures, TOR access, malicious IP reputation, and credential-stuffing patterns from synthetic authentication logs. The frontend is built as a live "Neural Threat Grid": a tactical cyber operations environment with boot telemetry, real-time alert streaming, hexagonal threat nodes, mission briefings, analyst notes, audit logs, kill-switch actions, and SIEM-style exports.

All data is synthetic. NexusCorp, all employees, login events, IP addresses, device fingerprints, and attack scenarios are generated for demonstration only.


## Overview

Identity attacks often look like normal successful logins until timing, geography, device, MFA, IP reputation, and user baseline context are correlated. SentinelTravel turns authentication activity into explainable SOC alerts by calculating travel speed, comparing each event against personal baselines, scoring risk, mapping signals to MITRE ATT&CK, and supporting triage workflows that feel like a real analyst console.

## Architecture

```text
                +-------------------------------------------+
                | React Neural Threat Grid                  |
                | Boot sequence, ticker, kill switch,       |
                | Leaflet maps, Recharts, WebSocket feed    |
                +---------------------+---------------------+
                                      |
                                      | REST + /ws/alerts
                                      v
       +------------------------------+------------------------------+
       | FastAPI backend                                             |
       | login events, alerts, detection, dashboard, exports         |
       +-------------------+----------------------+------------------+
                           |                      |
                           v                      v
        +------------------+-----------+   +------+------------------+
        | detection.py                  |   | sample_data.py          |
        | Haversine, baseline profiling,|   | Dynamic NexusCorp users |
        | risk, confidence, MITRE,      |   | 15 synthetic scenarios  |
        | suppression, triage outputs   |   | real-world context      |
        +------------------+-----------+   +-------------------------+
                           |
                           v
        +------------------+-----------+
        | SQLite + aiosqlite           |
        | login_events, alerts,        |
        | baselines, notes, audit,     |
        | suppression_rules            |
        +------------------------------+
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS |
| SOC UI | Boot sequence, CRT scanlines, threat ticker, decision log |
| Visualization | Leaflet, React Leaflet, Recharts |
| Backend | FastAPI, Pydantic |
| Database | SQLite with aiosqlite |
| Streaming | FastAPI WebSocket at `/ws/alerts` |
| CLI | `.venv/bin/python detection.py --user firstname.lastname@nexuscorp.io` |

## Live Features

- Terminal boot sequence with skippable platform initialization
- Live threat ticker scrolling high-priority alert intelligence
- Global threat level meter calculated from recent critical alert density
- Analyst identity panel with live session timer and clearance level
- Optional critical-alert radar ping, screen-border flash, and browser notification
- Neural Threat Grid with glowing hex nodes, animated travel vectors, and WebSocket shockwave pulses
- Signal Intercepts with animated counters, sparklines, and system confidence meter
- Mission Briefing takeover with risk ring, confidence bars, MITRE tags, travel map, raw user agent, copy actions, notes, and audit tape
- Immediate Response kill-switch panel for terminate session, lock account, alert SOC team, and force MFA
- Session-persistent Decision Log using localStorage
- World Map with CartoDB Dark Matter tiles, glowing alert markers, animated travel paths, and geopolitical risk overlay
- Alerts Briefing List with terminal filters, severity stamps, pulsing risk scores, confidence bars, and action strip
- User Mission Log timeline with country branches, device changes, failed logins, MFA failures, and suspicious event markers
- Fixed Signal Intercept Tape with WebSocket connected/offline state
- System Status bar for backend, WebSocket, DB event count, detection engine, and last scan
- Keyboard shortcuts: `G` grid, `A` alerts, `M` map, `C` charts, `T` timeline, `ESC` close mission briefing
- Dynamic browser tab title for critical alert count versus monitoring state

## Detection Logic

The detector groups `login_events` by `user_email`, sorts them by timestamp, and compares each successful login with the previous successful login for that identity. Failed logins are retained for credential-stuffing context but do not become travel baselines.

Distance is calculated with the Haversine formula:

```text
a = sin2(dlat/2) + cos(lat1) * cos(lat2) * sin2(dlon/2)
c = 2 * atan2(sqrt(a), sqrt(1-a))
distance_km = 6371 * c
```

Required speed is:

```text
required_speed_kmh = distance_km / (time_difference_minutes / 60)
```

Impossible travel fires when required speed is greater than `900 km/h`. Same-timestamp cross-continent logins resolve to effectively impossible speed. The engine handles first logins, failed logins, same-city events, missing coordinates, negative timestamps, gradual legitimate travel, duplicate suppression, and trusted corporate VPN context.

## Risk Scoring

Scores are capped at 100.

| Signal | Points |
| --- | ---: |
| Impossible travel | +50 |
| New country | +20 |
| New city | +10 |
| New device | +15 |
| New browser or OS | +10 |
| VPN/proxy | +20 |
| Failed then successful login | +10 |
| MFA failed or not completed | +25 |
| New ASN | +10 |
| Suspicious IP reputation | +15 |
| Malicious IP reputation | +30 |
| TOR exit node | +25 |

| Severity | Score |
| --- | --- |
| Low | 0-29 |
| Medium | 30-59 |
| High | 60-79 |
| Critical | 80-100 |

## Confidence Score

| Factor | Weight |
| --- | ---: |
| Valid coordinates | 0.25 |
| Valid timestamp | 0.20 |
| Previous login exists | 0.20 |
| Multiple risk signals | 0.25 |
| Baseline available | 0.10 |

The API returns `confidence_breakdown` so analysts can see exactly why the system trusts or distrusts a finding.

## MITRE ATT&CK Mapping

| Technique | Trigger |
| --- | --- |
| T1078 Valid Accounts | Impossible travel after successful login |
| T1110 Brute Force | Multiple failed logins followed by success |
| T1090 Proxy | VPN/proxy or TOR usage |
| T1556 Modify Authentication Process | MFA failed or not completed |

## Triage Workflow

```text
open
  |
  v
investigating
  |              |
  v              v
confirmed   false_positive
```

Every triage change writes an audit entry. Suppressed and duplicate alerts remain visible so the reviewer can inspect how noise reduction affected the alert.

## API Reference

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/login-events` | List synthetic login events |
| POST | `/login-events` | Create a synthetic login event |
| POST | `/upload-login-events-csv` | Upload synthetic CSV login events |
| GET | `/alerts` | List alerts |
| GET | `/alerts/{id}` | Get alert detail |
| PATCH | `/alerts/{id}/triage` | Change triage status |
| POST | `/alerts/{id}/notes` | Add analyst note |
| GET | `/alerts/{id}/notes` | List alert notes |
| GET | `/alerts/{id}/audit-logs` | List audit events for alert |
| POST | `/run-detection` | Rebuild alerts from login events |
| POST | `/generate-sample-data` | Reset and generate dynamic NexusCorp scenarios |
| GET | `/dashboard/summary` | Summary stats, trends, countries, recent alerts |
| GET | `/users/{email}/timeline` | User login and alert mission log |
| GET | `/alerts/{id}/export/json` | Export one alert as JSON |
| GET | `/alerts/export/csv` | Export alerts as CSV |
| GET | `/alerts/{id}/export/siem` | Export one alert as SIEM-style JSON |
| WS | `/ws/alerts` | Stream new alerts in real time |

## WebSocket Usage

```js
const socket = new WebSocket("ws://localhost:8000/ws/alerts");
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === "alert") {
    console.log(message.payload);
  }
};
```

## Local Setup

1. Create and activate a Python environment.

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. Install backend dependencies.

```bash
pip install -r requirements.txt
```

3. Start the API on port 8000.

```bash
uvicorn backend.main:app --reload --port 8000
```

4. Generate synthetic NexusCorp data.

```bash
curl -X POST http://localhost:8000/generate-sample-data
```

5. Install frontend dependencies.

```bash
cd frontend
npm install
```

6. Start the React app.

```bash
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`.

## CLI Usage

Generate sample data through the API first, then run:

```bash
.venv/bin/python detection.py
.venv/bin/python detection.py --user firstname.lastname@nexuscorp.io
.venv/bin/python detection.py --json
```

The report prints the login timeline, alert distance, required speed, risk score, severity, reasons, actions, MITRE mapping, and triage state.

## Sample Data System

The sample generator creates a dynamic fictional company identity environment:

- Company: `NexusCorp`
- Domain: `nexuscorp.io`
- 50+ international employee names across South Asian, East Asian, European, African, Latin American, and Middle Eastern naming patterns
- 10 random users selected on every `generate-sample-data` run
- Realistic device fingerprints such as MacBook Pro 14" M3, Dell XPS 15, ThinkPad X1 Carbon, iPhone 15 Pro, Samsung Galaxy S24, iPad Pro M2, Surface Laptop 5, and ASUS ROG Zephyrus
- Real browser and OS versions including Chrome 122, Firefox 123, Safari 17.3.1, Edge 122, Brave 1.63, macOS Sonoma 14.3, Windows 11 23H2, Ubuntu 22.04.3 LTS, iOS 17.3.1, and Android 14
- Country-aware IP generation for the United States, United Kingdom, Germany, Japan, India, Singapore, UAE, Brazil, France, Ireland, Canada, Mexico, Netherlands, Nigeria, South Africa, Kenya, and Russia
- Business-hour login behavior over the last 30 days, with suspicious 2am-4am local activity and lower weekend frequency
- Corporate VPN suppression test using `NexusCorp VPN AS65001`

## Synthetic Scenarios

- Normal consistent logins for baseline building
- London to Singapore in one hour
- VPN/proxy plus new country
- Credential stuffing with six failures followed by 3am success
- New device login
- MFA failed
- MFA not completed
- Cross-continent same-timestamp login
- Gradual legitimate travel from New York to London to Dubai to Tokyo
- TOR exit node login
- Malicious IP reputation login
- Trusted corporate VPN suppression
- Duplicate same-user same-country alert within 24 hours
- New ASN login
- New browser and OS login
- New country login in an active geopolitical-risk destination


## Future Improvements

- ML-based anomaly detection using isolation forests or autoencoders
- SIEM integration with Splunk or Elastic
- Email and Slack alerting
- Okta, Azure AD, or Google Workspace log ingestion simulation
- Real IP reputation API integration with AbuseIPDB or VirusTotal
- Docker and docker-compose deployment
- Role-based access control with JWT auth
- Unit tests and CI/CD pipeline
- Cloud deployment on AWS or GCP
