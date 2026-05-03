const countryFlags = {
  "United States": "🇺🇸",
  "United Kingdom": "🇬🇧",
  Germany: "🇩🇪",
  Japan: "🇯🇵",
  India: "🇮🇳",
  Singapore: "🇸🇬",
  "United Arab Emirates": "🇦🇪",
  Brazil: "🇧🇷",
  France: "🇫🇷",
  Ireland: "🇮🇪",
  Canada: "🇨🇦",
  Mexico: "🇲🇽",
  Netherlands: "🇳🇱",
  Nigeria: "🇳🇬",
  "South Africa": "🇿🇦",
  Kenya: "🇰🇪",
  Russia: "🇷🇺",
};

export function countryFlag(country) {
  return countryFlags[country] || "🏴";
}

export function normalizeSeverity(value) {
  return String(value || "low").toLowerCase();
}

export function formatUtcTime(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--:-- UTC";
  }
  return date.toISOString().slice(11, 19) + " UTC";
}

export function formatLocalTime(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--:-- LOCAL";
  }
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

export function formatDualTime(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--:-- UTC / --:--:-- LOCAL";
  }
  return `${formatUtcTime(date)} / ${formatLocalTime(date)}`;
}

export function formatLocation(location = {}) {
  return [location.city, location.country].filter(Boolean).join(", ") || "Unknown";
}

export function formatIpContext(location = {}) {
  const flag = countryFlag(location.country);
  const ip = location.ip_address || "0.0.0.0";
  const city = location.city || "Unknown";
  const country = location.country || "Unknown";
  const asn = location.asn || "ASN unknown";
  return `${flag} ${ip} (${city}, ${country}) - ${asn}`;
}

export async function copyToClipboard(value) {
  const text = String(value || "");
  if (!text) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function severityColor(severity) {
  const normalized = normalizeSeverity(severity);
  if (normalized === "critical") {
    return "#FF0040";
  }
  if (normalized === "high") {
    return "#FF6B00";
  }
  if (normalized === "medium") {
    return "#FFB800";
  }
  return "#00F5FF";
}
