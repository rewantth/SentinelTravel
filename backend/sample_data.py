"""Dynamic synthetic authentication scenarios for SentinelTravel.

The seed generator models a fictional enterprise identity environment for
NexusCorp. It intentionally uses only synthetic identities, synthetic events,
and reserved or documentation-friendly network context. The data changes on
every run while preserving the 15 SOC scenarios expected by the detection
engine.
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import aiosqlite

from database import json_dumps

COMPANY_NAME = "NexusCorp"
COMPANY_DOMAIN = "nexuscorp.io"

EMPLOYEE_NAME_POOL: tuple[tuple[str, str, str], ...] = (
    ("Aarav", "Sharma", "South Asian"),
    ("Anika", "Patel", "South Asian"),
    ("Ishaan", "Mehta", "South Asian"),
    ("Priya", "Nair", "South Asian"),
    ("Rohan", "Kapoor", "South Asian"),
    ("Sana", "Iyer", "South Asian"),
    ("Vikram", "Rao", "South Asian"),
    ("Nadia", "Rahman", "South Asian"),
    ("Kenji", "Tanaka", "East Asian"),
    ("Mei", "Chen", "East Asian"),
    ("Hana", "Kim", "East Asian"),
    ("Joon", "Park", "East Asian"),
    ("Yuki", "Nakamura", "East Asian"),
    ("Liang", "Zhou", "East Asian"),
    ("Aiko", "Mori", "East Asian"),
    ("Minseo", "Choi", "East Asian"),
    ("Lukas", "Schneider", "European"),
    ("Sofia", "Rossi", "European"),
    ("Elena", "Kovacs", "European"),
    ("Mateo", "Garcia", "European"),
    ("Amelie", "Dubois", "European"),
    ("Oscar", "Lindberg", "European"),
    ("Freya", "Hughes", "European"),
    ("Jonas", "Muller", "European"),
    ("Amina", "Okafor", "African"),
    ("Kwame", "Mensah", "African"),
    ("Zola", "Nkosi", "African"),
    ("Tariq", "Adebayo", "African"),
    ("Nia", "Mwangi", "African"),
    ("Kofi", "Boateng", "African"),
    ("Imani", "Diallo", "African"),
    ("Samira", "Mbeki", "African"),
    ("Camila", "Torres", "Latin American"),
    ("Diego", "Ramirez", "Latin American"),
    ("Lucia", "Fernandez", "Latin American"),
    ("Santiago", "Morales", "Latin American"),
    ("Valentina", "Silva", "Latin American"),
    ("Mateo", "Herrera", "Latin American"),
    ("Isabella", "Costa", "Latin American"),
    ("Rafael", "Alvarez", "Latin American"),
    ("Layla", "Haddad", "Middle Eastern"),
    ("Omar", "Al-Fayed", "Middle Eastern"),
    ("Yara", "Mansour", "Middle Eastern"),
    ("Karim", "Nasser", "Middle Eastern"),
    ("Mariam", "Saleh", "Middle Eastern"),
    ("Rami", "Khalil", "Middle Eastern"),
    ("Noor", "Abboud", "Middle Eastern"),
    ("Zain", "Qureshi", "Middle Eastern"),
    ("Emma", "Johansson", "European"),
    ("Theo", "Bergstrom", "European"),
    ("Maya", "Singh", "South Asian"),
    ("Haruto", "Sato", "East Asian"),
    ("Lina", "Hassan", "Middle Eastern"),
    ("Andre", "Moreira", "Latin American"),
    ("Fatima", "Bello", "African"),
    ("Clara", "Weber", "European"),
    ("Dae", "Lim", "East Asian"),
    ("Neha", "Desai", "South Asian"),
    ("Carlos", "Vega", "Latin American"),
    ("Salma", "Karim", "Middle Eastern"),
)

DEVICE_FINGERPRINTS = (
    {"device": 'MacBook Pro 14" M3', "os": "macOS Sonoma 14.3", "mobile": False},
    {"device": "Dell XPS 15", "os": "Windows 11 23H2", "mobile": False},
    {"device": "ThinkPad X1 Carbon", "os": "Windows 11 23H2", "mobile": False},
    {"device": "iPhone 15 Pro", "os": "iOS 17.3.1", "mobile": True},
    {"device": "Samsung Galaxy S24", "os": "Android 14", "mobile": True},
    {"device": "iPad Pro M2", "os": "iOS 17.3.1", "mobile": True},
    {"device": "Surface Laptop 5", "os": "Windows 11 23H2", "mobile": False},
    {"device": "ASUS ROG Zephyrus", "os": "Windows 11 23H2", "mobile": False},
    {"device": "Dell XPS 15", "os": "Ubuntu 22.04.3 LTS", "mobile": False},
    {"device": "ThinkPad X1 Carbon", "os": "Ubuntu 22.04.3 LTS", "mobile": False},
)

BROWSERS = (
    "Chrome 122.0.6261",
    "Firefox 123.0.1",
    "Safari 17.3.1",
    "Edge 122.0.2365",
    "Brave 1.63.165",
)

COUNTRY_ASNS = {
    "United States": ("Comcast AS7922", "AT&T AS7018", "Verizon Business AS701"),
    "United Kingdom": ("BT AS2856", "Virgin Media AS5089", "Vodafone UK AS5378"),
    "Germany": ("Deutsche Telekom AS3320", "Vodafone DE AS3209", "Telefonica Germany AS6805"),
    "Japan": ("SoftBank AS17676", "NTT Communications AS4713", "KDDI AS2516"),
    "India": ("Airtel AS9498", "Jio AS55836", "Tata Communications AS4755"),
    "Singapore": ("Singtel AS3758", "StarHub AS4657", "M1 AS17547"),
    "United Arab Emirates": ("Etisalat AS5384", "du AS15802"),
    "Brazil": ("Claro BR AS28573", "Vivo AS18881", "TIM Brasil AS26615"),
    "France": ("Orange AS3215", "Free SAS AS12322", "SFR AS15557"),
    "Ireland": ("Eir AS5466", "Virgin Media IE AS6830"),
    "Canada": ("Rogers AS812", "Bell Canada AS577", "Telus AS852"),
    "Mexico": ("Telmex AS8151", "Megacable AS13999"),
    "Netherlands": ("KPN AS1136", "Ziggo AS33915"),
    "Nigeria": ("MTN AS30999", "Airtel NG AS36873"),
    "South Africa": ("MTN AS16637", "Vodacom AS36994"),
    "Kenya": ("Safaricom AS33771", "Airtel KE AS36926"),
    "Russia": ("Rostelecom AS12389", "MTS AS8359"),
}

COUNTRY_IP_PREFIXES = {
    "United States": (72, 98, 174),
    "United Kingdom": (86, 90),
    "Germany": (84, 217),
    "Japan": (126, 153),
    "India": (49, 117),
    "Singapore": (58, 103),
    "United Arab Emirates": (5, 94),
    "Brazil": (177, 187),
    "France": (82, 88),
    "Ireland": (78, 89),
    "Canada": (70, 99),
    "Mexico": (189, 201),
    "Netherlands": (145, 213),
    "Nigeria": (41, 102),
    "South Africa": (105, 196),
    "Kenya": (41, 102),
    "Russia": (95, 178),
}

LOCATIONS: dict[str, dict[str, Any]] = {
    "new_york": {"country": "United States", "city": "New York", "latitude": 40.7128, "longitude": -74.0060, "tz_offset": -4},
    "san_francisco": {"country": "United States", "city": "San Francisco", "latitude": 37.7749, "longitude": -122.4194, "tz_offset": -7},
    "chicago": {"country": "United States", "city": "Chicago", "latitude": 41.8781, "longitude": -87.6298, "tz_offset": -5},
    "austin": {"country": "United States", "city": "Austin", "latitude": 30.2672, "longitude": -97.7431, "tz_offset": -5},
    "london": {"country": "United Kingdom", "city": "London", "latitude": 51.5072, "longitude": -0.1276, "tz_offset": 1},
    "manchester": {"country": "United Kingdom", "city": "Manchester", "latitude": 53.4808, "longitude": -2.2426, "tz_offset": 1},
    "berlin": {"country": "Germany", "city": "Berlin", "latitude": 52.52, "longitude": 13.405, "tz_offset": 2},
    "munich": {"country": "Germany", "city": "Munich", "latitude": 48.1351, "longitude": 11.5820, "tz_offset": 2},
    "tokyo": {"country": "Japan", "city": "Tokyo", "latitude": 35.6762, "longitude": 139.6503, "tz_offset": 9},
    "osaka": {"country": "Japan", "city": "Osaka", "latitude": 34.6937, "longitude": 135.5023, "tz_offset": 9},
    "mumbai": {"country": "India", "city": "Mumbai", "latitude": 19.0760, "longitude": 72.8777, "tz_offset": 5.5},
    "bengaluru": {"country": "India", "city": "Bengaluru", "latitude": 12.9716, "longitude": 77.5946, "tz_offset": 5.5},
    "singapore": {"country": "Singapore", "city": "Singapore", "latitude": 1.3521, "longitude": 103.8198, "tz_offset": 8},
    "dubai": {"country": "United Arab Emirates", "city": "Dubai", "latitude": 25.2048, "longitude": 55.2708, "tz_offset": 4},
    "sao_paulo": {"country": "Brazil", "city": "Sao Paulo", "latitude": -23.5505, "longitude": -46.6333, "tz_offset": -3},
    "paris": {"country": "France", "city": "Paris", "latitude": 48.8566, "longitude": 2.3522, "tz_offset": 2},
    "dublin": {"country": "Ireland", "city": "Dublin", "latitude": 53.3498, "longitude": -6.2603, "tz_offset": 1},
    "toronto": {"country": "Canada", "city": "Toronto", "latitude": 43.6532, "longitude": -79.3832, "tz_offset": -4},
    "mexico_city": {"country": "Mexico", "city": "Mexico City", "latitude": 19.4326, "longitude": -99.1332, "tz_offset": -6},
    "amsterdam": {"country": "Netherlands", "city": "Amsterdam", "latitude": 52.3676, "longitude": 4.9041, "tz_offset": 2},
    "lagos": {"country": "Nigeria", "city": "Lagos", "latitude": 6.5244, "longitude": 3.3792, "tz_offset": 1},
    "johannesburg": {"country": "South Africa", "city": "Johannesburg", "latitude": -26.2041, "longitude": 28.0473, "tz_offset": 2},
    "nairobi": {"country": "Kenya", "city": "Nairobi", "latitude": -1.2921, "longitude": 36.8219, "tz_offset": 3},
    "moscow": {"country": "Russia", "city": "Moscow", "latitude": 55.7558, "longitude": 37.6173, "tz_offset": 3},
}

HOME_LOCATION_KEYS = (
    "new_york",
    "san_francisco",
    "chicago",
    "austin",
    "london",
    "manchester",
    "berlin",
    "munich",
    "tokyo",
    "osaka",
    "mumbai",
    "bengaluru",
    "singapore",
    "sao_paulo",
    "paris",
    "dublin",
    "toronto",
    "lagos",
    "johannesburg",
    "nairobi",
)

SUSPICIOUS_DEVICE = {"device": "Unmanaged Linux VPS", "os": "Ubuntu 22.04.3 LTS", "mobile": False}
TOR_DEVICE = {"device": "Unknown Virtual Workstation", "os": "Ubuntu 22.04.3 LTS", "mobile": False}
CORPORATE_VPN_ASN = f"{COMPANY_NAME} VPN AS65001"


@dataclass(frozen=True)
class UserProfile:
    email: str
    full_name: str
    region: str
    home_location: str
    device: dict[str, Any]
    browser: str
    asn: str


def _email(first_name: str, last_name: str) -> str:
    normalized = re.sub(r"[^a-z0-9.]", "", f"{first_name}.{last_name}".lower())
    return f"{normalized}@{COMPANY_DOMAIN}"


def _select_users(rng: random.Random) -> list[tuple[str, str, str]]:
    return rng.sample(list(EMPLOYEE_NAME_POOL), 10)


def _random_ip(country: str, rng: random.Random, *, vpn: bool = False, tor: bool = False, malicious: bool = False) -> str:
    if vpn:
        return f"45.66.10.{rng.randint(12, 240)}"
    if tor:
        return f"185.220.{rng.randint(100, 103)}.{rng.randint(2, 254)}"
    if malicious:
        return f"198.51.100.{rng.randint(20, 240)}"
    prefixes = COUNTRY_IP_PREFIXES.get(country, (203,))
    return f"{rng.choice(prefixes)}.{rng.randint(1, 254)}.{rng.randint(0, 255)}.{rng.randint(2, 254)}"


def _country_asn(country: str, rng: random.Random, *, vpn: bool = False, tor: bool = False, malicious: bool = False) -> str:
    if vpn:
        return CORPORATE_VPN_ASN
    if tor:
        return "Tor Relay Coalition AS60729"
    if malicious:
        return "Bulletproof Hosting AS20473"
    return rng.choice(COUNTRY_ASNS.get(country, ("GlobalTransit AS64535",)))


def _local_datetime(days_ago: int, location_key: str, hour: int, minute: int) -> datetime:
    location = LOCATIONS[location_key]
    now_utc = datetime.now(timezone.utc)
    offset = float(location["tz_offset"])
    local_midnight = (now_utc + timedelta(hours=offset)).replace(hour=0, minute=0, second=0, microsecond=0)
    local_value = local_midnight - timedelta(days=days_ago) + timedelta(hours=hour, minutes=minute)
    return (local_value - timedelta(hours=offset)).astimezone(timezone.utc)


def _business_time(rng: random.Random, location_key: str, days_ago: int | None = None) -> datetime:
    day = days_ago if days_ago is not None else rng.randint(3, 29)
    candidate = _local_datetime(day, location_key, rng.randint(8, 17), rng.choice((0, 7, 14, 22, 31, 44, 53)))
    # Weekend logins are less frequent. Push most generated weekends to Monday.
    if candidate.weekday() >= 5 and rng.random() < 0.82:
        candidate -= timedelta(days=candidate.weekday() - 0)
    return candidate


def _suspicious_time(location_key: str, days_ago: int, minute: int = 7) -> datetime:
    return _local_datetime(days_ago, location_key, 3, minute)


def _user_agent(device: dict[str, Any], browser: str) -> str:
    browser_token = browser.replace(" ", "/")
    os_value = str(device["os"])
    device_name = str(device["device"])
    if "macOS" in os_value:
        return f"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36 (KHTML, like Gecko) {browser_token} Safari/537.36 NexusCorpMDM/{device_name}"
    if "Windows" in os_value:
        return f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) {browser_token} Safari/537.36 NexusCorpMDM/{device_name}"
    if "iOS" in os_value:
        return f"Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) {browser_token} Mobile/15E148"
    if "Android" in os_value:
        return f"Mozilla/5.0 (Linux; Android 14; {device_name}) AppleWebKit/537.36 (KHTML, like Gecko) {browser_token} Mobile Safari/537.36"
    return f"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) {browser_token} Safari/537.36"


def _build_profiles(rng: random.Random) -> list[UserProfile]:
    profiles: list[UserProfile] = []
    home_locations = list(HOME_LOCATION_KEYS)
    rng.shuffle(home_locations)
    for index, (first, last, region) in enumerate(_select_users(rng)):
        home_key = home_locations[index % len(home_locations)]
        country = LOCATIONS[home_key]["country"]
        device = rng.choice(DEVICE_FINGERPRINTS)
        browser = "Safari 17.3.1" if device["os"].startswith(("macOS", "iOS")) and rng.random() < 0.55 else rng.choice(BROWSERS)
        profiles.append(
            UserProfile(
                email=_email(first, last),
                full_name=f"{first} {last}",
                region=region,
                home_location=home_key,
                device=device,
                browser=browser,
                asn=_country_asn(country, rng),
            )
        )
    return profiles


def _event(
    profile: UserProfile,
    timestamp: datetime,
    location_key: str,
    rng: random.Random,
    *,
    device: dict[str, Any] | None = None,
    browser: str | None = None,
    login_status: str = "success",
    mfa_status: str = "success",
    is_vpn_or_proxy: bool = False,
    asn: str | None = None,
    ip_address: str | None = None,
    ip_reputation: str = "clean",
    is_tor_exit_node: bool = False,
) -> dict[str, Any]:
    location = LOCATIONS[location_key]
    resolved_device = device or profile.device
    resolved_browser = browser or profile.browser
    resolved_asn = asn or _country_asn(
        str(location["country"]),
        rng,
        vpn=is_vpn_or_proxy and asn is None,
        tor=is_tor_exit_node,
        malicious=ip_reputation == "malicious",
    )
    resolved_ip = ip_address or _random_ip(
        str(location["country"]),
        rng,
        vpn=is_vpn_or_proxy and resolved_asn == CORPORATE_VPN_ASN,
        tor=is_tor_exit_node,
        malicious=ip_reputation == "malicious",
    )
    return {
        "user_email": profile.email,
        "timestamp": timestamp.isoformat(),
        "ip_address": resolved_ip,
        "country": location["country"],
        "city": location["city"],
        "latitude": location["latitude"],
        "longitude": location["longitude"],
        "device": resolved_device["device"],
        "browser": resolved_browser,
        "os": resolved_device["os"],
        "login_status": login_status,
        "mfa_status": mfa_status,
        "is_vpn_or_proxy": is_vpn_or_proxy,
        "asn": resolved_asn,
        "user_agent": _user_agent(resolved_device, resolved_browser),
        "ip_reputation": ip_reputation,
        "is_tor_exit_node": is_tor_exit_node,
    }


def _add_baseline_events(events: list[dict[str, Any]], profiles: list[UserProfile], rng: random.Random) -> None:
    for profile in profiles:
        used_days = sorted(rng.sample(range(8, 30), 5), reverse=True)
        for sequence, days_ago in enumerate(used_days):
            mfa_status = "not_required" if sequence % 4 == 0 else "success"
            events.append(_event(profile, _business_time(rng, profile.home_location, days_ago), profile.home_location, rng, asn=profile.asn, mfa_status=mfa_status))


def _managed_device(profile: UserProfile) -> dict[str, Any]:
    return {"device": profile.device["device"], "os": profile.device["os"], "mobile": profile.device.get("mobile", False)}


def _alternate_device(profile: UserProfile, rng: random.Random) -> dict[str, Any]:
    alternatives = [item for item in DEVICE_FINGERPRINTS if item["device"] != profile.device["device"]]
    return rng.choice(alternatives)


def generate_login_events() -> list[dict[str, Any]]:
    rng = random.Random()
    profiles = _build_profiles(rng)
    events: list[dict[str, Any]] = []
    _add_baseline_events(events, profiles, rng)

    # 1. Impossible travel: London to Singapore in one hour.
    impossible_user = profiles[0]
    impossible_device = _managed_device(impossible_user)
    london_time = _business_time(rng, "london", 2).replace(minute=0, second=0, microsecond=0)
    events.append(_event(impossible_user, london_time, "london", rng, device=impossible_device, asn=_country_asn("United Kingdom", rng)))
    events.append(
        _event(
            impossible_user,
            london_time + timedelta(hours=1),
            "singapore",
            rng,
            device=SUSPICIOUS_DEVICE,
            browser="Firefox 123.0.1",
            asn=_country_asn("Singapore", rng),
            ip_reputation="suspicious",
        )
    )
    # 13. Duplicate same-user same-country alert inside 24 hours.
    events.append(
        _event(
            impossible_user,
            london_time + timedelta(hours=4),
            "singapore",
            rng,
            device=SUSPICIOUS_DEVICE,
            browser="Firefox 123.0.1",
            asn=_country_asn("Singapore", rng),
            is_vpn_or_proxy=True,
            ip_reputation="suspicious",
        )
    )

    # 2. VPN/proxy plus new country.
    vpn_user = profiles[1]
    events.append(
        _event(
            vpn_user,
            _suspicious_time("amsterdam", 4, 12),
            "amsterdam",
            rng,
            is_vpn_or_proxy=True,
            asn="Commercial Exit VPN AS9009",
            ip_reputation="suspicious",
        )
    )

    # 3. Credential stuffing: six failures, then success at 3am local time.
    stuffing_user = profiles[2]
    success_time = _suspicious_time("berlin", 3, 34)
    for attempt in range(6):
        events.append(
            _event(
                stuffing_user,
                success_time - timedelta(minutes=(6 - attempt) * 4),
                "berlin",
                rng,
                device=SUSPICIOUS_DEVICE,
                browser="Chrome 122.0.6261",
                login_status="failed",
                mfa_status="failed",
                asn=_country_asn("Germany", rng),
                ip_reputation="suspicious",
            )
        )
    events.append(
        _event(
            stuffing_user,
            success_time,
            "berlin",
            rng,
            device=SUSPICIOUS_DEVICE,
            browser="Chrome 122.0.6261",
            asn=_country_asn("Germany", rng),
            ip_reputation="suspicious",
        )
    )

    # 4. New device login from a plausible business trip.
    new_device_user = profiles[3]
    events.append(
        _event(
            new_device_user,
            _business_time(rng, "sao_paulo", 5),
            "sao_paulo",
            rng,
            device=_alternate_device(new_device_user, rng),
            browser="Brave 1.63.165",
            asn=_country_asn("Brazil", rng),
        )
    )

    # 5. MFA failed from a new country.
    mfa_failed_user = profiles[4]
    events.append(
        _event(
            mfa_failed_user,
            _suspicious_time("paris", 6, 19),
            "paris",
            rng,
            device=_alternate_device(mfa_failed_user, rng),
            browser="Edge 122.0.2365",
            mfa_status="failed",
            asn=_country_asn("France", rng),
            ip_reputation="suspicious",
        )
    )

    # 6. MFA not completed with VPN and new ASN.
    mfa_pending_user = profiles[5]
    events.append(
        _event(
            mfa_pending_user,
            _suspicious_time("dublin", 7, 43),
            "dublin",
            rng,
            is_vpn_or_proxy=True,
            asn="Residential Proxy Exchange AS398101",
            mfa_status="not_completed",
            ip_reputation="suspicious",
        )
    )

    # 7. Cross-continent same-timestamp login edge case.
    same_stamp_user = profiles[6]
    same_stamp = _business_time(rng, "tokyo", 2).replace(second=0, microsecond=0)
    events.append(_event(same_stamp_user, same_stamp, "tokyo", rng, asn=_country_asn("Japan", rng)))
    events.append(_event(same_stamp_user, same_stamp, "london", rng, asn=_country_asn("United Kingdom", rng)))

    # 8. Gradual legitimate travel: New York -> London -> Dubai -> Tokyo.
    traveler_user = profiles[7]
    route_start = _business_time(rng, "new_york", 11).replace(hour=14, minute=0, second=0, microsecond=0)
    for offset_hours, location_key in ((0, "new_york"), (16, "london"), (44, "dubai"), (78, "tokyo")):
        country = LOCATIONS[location_key]["country"]
        events.append(_event(traveler_user, route_start + timedelta(hours=offset_hours), location_key, rng, asn=_country_asn(str(country), rng)))

    # 9. TOR exit node login.
    tor_user = profiles[8]
    events.append(
        _event(
            tor_user,
            _suspicious_time("toronto", 8, 5),
            "toronto",
            rng,
            device=TOR_DEVICE,
            browser="Firefox 123.0.1",
            asn="Tor Relay Coalition AS60729",
            ip_address=_random_ip("Canada", rng, tor=True),
            is_tor_exit_node=True,
            ip_reputation="suspicious",
        )
    )

    # 10. Malicious IP reputation login.
    malicious_user = profiles[9]
    events.append(
        _event(
            malicious_user,
            _suspicious_time("mexico_city", 9, 28),
            "mexico_city",
            rng,
            device=SUSPICIOUS_DEVICE,
            browser="Chrome 122.0.6261",
            asn="Bulletproof Hosting AS20473",
            ip_address=_random_ip("Mexico", rng, malicious=True),
            ip_reputation="malicious",
        )
    )

    # 11. Trusted corporate VPN false-positive suppression test.
    events.append(
        _event(
            new_device_user,
            _business_time(rng, new_device_user.home_location, 1),
            new_device_user.home_location,
            rng,
            is_vpn_or_proxy=True,
            asn=CORPORATE_VPN_ASN,
            ip_address=_random_ip(LOCATIONS[new_device_user.home_location]["country"], rng, vpn=True),
            mfa_status="success",
        )
    )

    # 12. New ASN login from a familiar country.
    home_country = str(LOCATIONS[mfa_failed_user.home_location]["country"])
    events.append(
        _event(
            mfa_failed_user,
            _business_time(rng, mfa_failed_user.home_location, 1),
            mfa_failed_user.home_location,
            rng,
            asn=f"New Fiber Backbone AS{rng.randint(41000, 48999)}",
        )
    )

    # 14. New browser and OS from otherwise normal geography.
    events.append(
        _event(
            mfa_pending_user,
            _business_time(rng, mfa_pending_user.home_location, 2),
            mfa_pending_user.home_location,
            rng,
            device={"device": "ASUS ROG Zephyrus", "os": "Ubuntu 22.04.3 LTS", "mobile": False},
            browser="Brave 1.63.165",
            asn=_country_asn(str(LOCATIONS[mfa_pending_user.home_location]["country"]), rng),
        )
    )

    # 15. New country login against an active geopolitical-risk destination.
    events.append(
        _event(
            vpn_user,
            _suspicious_time("moscow", 5, 2),
            "moscow",
            rng,
            device=SUSPICIOUS_DEVICE,
            browser="Firefox 123.0.1",
            asn=_country_asn("Russia", rng),
            ip_reputation="suspicious",
        )
    )

    # Keep generated timelines deterministic for the detection engine after a
    # dynamic seed run: events are sorted by timestamp and user.
    return sorted(events, key=lambda item: (item["timestamp"], item["user_email"], item["ip_address"]))


def suppression_rules() -> list[dict[str, Any]]:
    return [
        {
            "name": "Trusted NexusCorp corporate VPN ASN",
            "rule_type": "trusted_asn",
            "criteria": {
                "trusted_asns": [CORPORATE_VPN_ASN],
                "trusted_countries": ["United States", "United Kingdom", "Germany", "India", "Japan", "Singapore"],
                "trusted_devices": [item["device"] for item in DEVICE_FINGERPRINTS],
                "trusted_ip_ranges": ["45.66.10.0/24"],
            },
            "effect": "suppress",
        },
        {
            "name": "Trusted country plus trusted managed device during normal hours",
            "rule_type": "trusted_context",
            "criteria": {
                "trusted_countries": ["United States", "United Kingdom", "Germany", "India", "Japan", "Singapore"],
                "trusted_devices": [item["device"] for item in DEVICE_FINGERPRINTS],
                "risk_reduction": 20,
                "confidence_reduction": 0.15,
            },
            "effect": "reduce_risk",
        },
        {
            "name": "Duplicate same-user same-country alert within 24 hours",
            "rule_type": "duplicate_same_country",
            "criteria": {"window_hours": 24},
            "effect": "mark_duplicate",
        },
    ]


async def reset_and_seed(db: aiosqlite.Connection) -> int:
    await db.executescript(
        """
        DELETE FROM alert_notes;
        DELETE FROM audit_logs;
        DELETE FROM alerts;
        DELETE FROM user_baselines;
        DELETE FROM login_events;
        DELETE FROM suppression_rules;
        DELETE FROM sqlite_sequence WHERE name IN ('login_events','alert_notes','audit_logs','suppression_rules');
        """
    )

    events = generate_login_events()
    for item in events:
        await db.execute(
            """
            INSERT INTO login_events (
                user_email, timestamp, ip_address, country, city, latitude, longitude,
                device, browser, os, login_status, mfa_status, is_vpn_or_proxy,
                asn, user_agent, ip_reputation, is_tor_exit_node
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item["user_email"],
                item["timestamp"],
                item["ip_address"],
                item["country"],
                item["city"],
                item["latitude"],
                item["longitude"],
                item["device"],
                item["browser"],
                item["os"],
                item["login_status"],
                item["mfa_status"],
                int(item["is_vpn_or_proxy"]),
                item["asn"],
                item["user_agent"],
                item["ip_reputation"],
                int(item["is_tor_exit_node"]),
            ),
        )

    now = datetime.now(timezone.utc).isoformat()
    for rule in suppression_rules():
        await db.execute(
            """
            INSERT INTO suppression_rules (name, rule_type, criteria, effect, enabled, created_at)
            VALUES (?, ?, ?, ?, 1, ?)
            """,
            (rule["name"], rule["rule_type"], json_dumps(rule["criteria"]), rule["effect"], now),
        )

    await db.commit()
    return len(events)
