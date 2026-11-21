"""Weather lookup using Open-Meteo (no API key required) with in-memory caching."""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from typing import Any

# WMO Weather interpretation codes -> (short label, icon key)
_WMO_CODES: dict[int, tuple[str, str]] = {
    0: ("Clear Sky", "sun"),
    1: ("Mostly Clear", "sun"),
    2: ("Partly Cloudy", "partly-cloudy"),
    3: ("Overcast", "cloud"),
    45: ("Fog", "fog"),
    48: ("Rime Fog", "fog"),
    51: ("Light Drizzle", "rain"),
    53: ("Drizzle", "rain"),
    55: ("Heavy Drizzle", "rain"),
    56: ("Freezing Drizzle", "snow"),
    57: ("Freezing Drizzle", "snow"),
    61: ("Light Rain", "rain"),
    63: ("Rain", "rain"),
    65: ("Heavy Rain", "rain"),
    66: ("Freezing Rain", "snow"),
    67: ("Freezing Rain", "snow"),
    71: ("Light Snow", "snow"),
    73: ("Snow", "snow"),
    75: ("Heavy Snow", "snow"),
    77: ("Snow Grains", "snow"),
    80: ("Rain Showers", "rain"),
    81: ("Rain Showers", "rain"),
    82: ("Heavy Showers", "rain"),
    85: ("Snow Showers", "snow"),
    86: ("Heavy Snow", "snow"),
    95: ("Thunderstorm", "storm"),
    96: ("Thunderstorm + Hail", "storm"),
    99: ("Severe Storm", "storm"),
}

_CACHE_TTL_SEC = 600.0  # 10 minutes
_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_geo_cache: dict[str, dict[str, Any]] = {}


def _fetch_json(url: str, timeout: float = 8.0) -> dict[str, Any]:
    req = urllib.request.Request(url, headers={"User-Agent": "RigTachMetrix/1.1"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _geocode_location(query: str) -> dict[str, Any]:
    key = query.strip().lower()
    if key in _geo_cache:
        return _geo_cache[key]

    # Try full query first, then fallback to city-only before comma if needed
    attempts = [query.strip()]
    if "," in query:
        city_part = query.split(",", 1)[0].strip()
        if city_part and city_part not in attempts:
            attempts.append(city_part)

    for q in attempts:
        encoded = urllib.parse.quote(q)
        url = f"https://geocoding-api.open-meteo.com/v1/search?name={encoded}&count=5&language=en&format=json"
        data = _fetch_json(url)
        results = data.get("results") or []
        if results:
            # If user supplied state/region after comma, prefer matching admin1/country
            chosen = results[0]
            if "," in query:
                hint = query.split(",", 1)[1].strip().lower()
                for item in results:
                    admin = str(item.get("admin1", "")).lower()
                    country = str(item.get("country_code", "")).lower()
                    if hint and (hint in admin or hint == country):
                        chosen = item
                        break
            name = chosen.get("name", query.strip())
            admin1 = chosen.get("admin1") or ""
            country_code = chosen.get("country_code") or ""
            label_parts = [name]
            if admin1 and admin1.lower() != name.lower():
                label_parts.append(admin1)
            elif country_code:
                label_parts.append(country_code)
            geo = {
                "lat": float(chosen["latitude"]),
                "lon": float(chosen["longitude"]),
                "label": ", ".join(label_parts),
            }
            _geo_cache[key] = geo
            return geo

    raise ValueError(f"Location '{query}' not found")


def _demo_weather(location: str) -> dict[str, Any]:
    return {
        "ok": True,
        "location": location or "Des Moines, Iowa",
        "temp_c": 21.0,
        "feels_like_c": 20.5,
        "high_c": 24.0,
        "low_c": 13.0,
        "humidity": 48,
        "wind_kph": 14.5,
        "condition": "Partly Cloudy",
        "icon": "partly-cloudy",
        "is_day": True,
        "updated_at": time.time(),
    }


def get_weather(location: str, demo: bool = False) -> dict[str, Any]:
    loc = (location or "").strip() or "Des Moines, IA"
    if demo:
        return _demo_weather(loc)

    cache_key = loc.lower()
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and (now - cached[0]) < _CACHE_TTL_SEC:
        return cached[1]

    try:
        geo = _geocode_location(loc)
        params = urllib.parse.urlencode(
            {
                "latitude": geo["lat"],
                "longitude": geo["lon"],
                "current": "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m",
                "daily": "temperature_2m_max,temperature_2m_min",
                "forecast_days": 1,
                "timezone": "auto",
            }
        )
        data = _fetch_json(f"https://api.open-meteo.com/v1/forecast?{params}")
        cur = data.get("current", {})
        daily = data.get("daily", {})
        code = int(cur.get("weather_code", 0))
        condition, icon = _WMO_CODES.get(code, ("Clear", "sun"))
        is_day = bool(cur.get("is_day", 1))
        if not is_day and icon == "sun":
            icon = "moon"

        highs = daily.get("temperature_2m_max") or [cur.get("temperature_2m", 0)]
        lows = daily.get("temperature_2m_min") or [cur.get("temperature_2m", 0)]

        payload = {
            "ok": True,
            "location": geo["label"],
            "temp_c": round(float(cur.get("temperature_2m", 0.0)), 1),
            "feels_like_c": round(float(cur.get("apparent_temperature", 0.0)), 1),
            "high_c": round(float(highs[0]), 1),
            "low_c": round(float(lows[0]), 1),
            "humidity": int(cur.get("relative_humidity_2m", 0)),
            "wind_kph": round(float(cur.get("wind_speed_10m", 0.0)), 1),
            "condition": condition,
            "icon": icon,
            "is_day": is_day,
            "updated_at": now,
        }
        _cache[cache_key] = (now, payload)
        return payload
    except Exception as exc:
        return {
            "ok": False,
            "location": loc,
            "error": str(exc),
        }
