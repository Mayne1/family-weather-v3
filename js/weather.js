"use strict";

const express = require("express");
const https = require("https");
const http = require("http");
const nws = require("./nws-adapter");

const router = express.Router();
const INTEL_HINT_TTL_MS = 5 * 60 * 1000;
const intelHintCache = new Map();
const INTEL_ENGINE_BASE_URL = process.env.INTEL_ENGINE_BASE_URL || "http://127.0.0.1:5173";

// ---------- helper: https GET -> JSON ----------
function httpsGetJson(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`provider_http_${res.statusCode}`));
          }
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error("provider_json_parse_failed"));
        }
      });
    });

    req.on("error", () => reject(new Error("provider_request_failed")));
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("provider_timeout"));
    });
  });
}

function parseLatLon(req) {
  const DEFAULT_LAT = 37.9577;   // Stockton
  const DEFAULT_LON = -121.2908;
  const lat = Number(req.query.lat ?? DEFAULT_LAT);
  const lon = Number(req.query.lon ?? DEFAULT_LON);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function roundedKey(lat, lon, decimals = 3) {
  return `${Number(lat).toFixed(decimals)},${Number(lon).toFixed(decimals)}`;
}

function getCachedIntelHint(key) {
  const hit = intelHintCache.get(key);
  if (!hit) return null;
  if (Date.now() >= hit.expiresAt) {
    intelHintCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCachedIntelHint(key, value) {
  intelHintCache.set(key, { value, expiresAt: Date.now() + INTEL_HINT_TTL_MS });
  return value;
}

function postJson(urlString, payload, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let urlObj;
    try {
      urlObj = new URL(urlString);
    } catch (_err) {
      reject(new Error("bad_url"));
      return;
    }
    const body = JSON.stringify(payload || {});
    const client = urlObj.protocol === "https:" ? https : http;
    const req = client.request(
      urlObj,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`intel_http_${res.statusCode || 0}`));
            return;
          }
          try {
            const json = raw ? JSON.parse(raw) : {};
            resolve(json);
          } catch (_err) {
            reject(new Error("intel_parse_failed"));
          }
        });
      }
    );
    req.on("error", () => reject(new Error("intel_request_failed")));
    req.setTimeout(timeoutMs, () => req.destroy(new Error("intel_timeout")));
    req.write(body);
    req.end();
  });
}

// ---------- WEATHER (public, NWS-backed) ----------
router.get("/rightnow", async (req, res) => {
  const loc = parseLatLon(req);
  if (!loc) {
    return res.status(400).json({ ok: false, error: "invalid_lat_lon" });
  }
  try {
    const json = await nws.getRightNow(loc.lat, loc.lon);
    return res.json(json);
  } catch (e) {
    return res.status(502).json({ ok: false, error: "nws_rightnow_failed" });
  }
});

// Compatibility alias used by older clients
router.get("/current", async (req, res) => {
  const loc = parseLatLon(req);
  if (!loc) return res.status(400).json({ ok: false, error: "invalid_lat_lon" });
  try {
    const json = await nws.getRightNow(loc.lat, loc.lon);
    return res.json({
      ok: true,
      location: json.location,
      current: {
        temp_f: json.rightNow ? json.rightNow.temperature_2m : null,
        feels_like_f: json.rightNow ? json.rightNow.apparent_temperature : null,
        wind_mph: json.rightNow ? json.rightNow.wind_speed_10m : null,
        weather_code: json.rightNow ? json.rightNow.weather_code : null,
        humidity_pct: json.rightNow ? json.rightNow.relative_humidity_2m : null
      },
      source: "nws"
    });
  } catch (_err) {
    return res.status(502).json({ ok: false, error: "nws_current_failed" });
  }
});

router.get("/hourly", async (req, res) => {
  const loc = parseLatLon(req);
  if (!loc) {
    return res.status(400).json({ ok: false, error: "invalid_lat_lon" });
  }
  try {
    const json = await nws.getHourly(loc.lat, loc.lon);
    return res.json(json);
  } catch (_err) {
    return res.status(502).json({ ok: false, error: "nws_hourly_failed" });
  }
});

router.get("/forecast", async (req, res) => {
  const loc = parseLatLon(req);
  if (!loc) {
    return res.status(400).json({ ok: false, error: "invalid_lat_lon" });
  }
  try {
    const json = await nws.getForecast(loc.lat, loc.lon);
    return res.json(json);
  } catch (_err) {
    return res.status(502).json({ ok: false, error: "nws_forecast_failed" });
  }
});

router.get("/daily", async (req, res) => {
  const loc = parseLatLon(req);
  if (!loc) {
    return res.status(400).json({ ok: false, error: "invalid_lat_lon" });
  }
  try {
    const json = await nws.getForecast(loc.lat, loc.lon);
    return res.json({
      ok: true,
      source: "nws",
      location: json.location,
      daily7: json.daily7,
      days7: json.days7,
      forecastHorizonDays: json.forecastHorizonDays,
      horizonNote: json.horizonNote
    });
  } catch (_err) {
    return res.status(502).json({ ok: false, error: "nws_daily_failed" });
  }
});

// Compatibility alias
router.get("/forecast10", async (req, res) => {
  const loc = parseLatLon(req);
  if (!loc) {
    return res.status(400).json({ ok: false, error: "invalid_lat_lon" });
  }
  try {
    const json = await nws.getForecast(loc.lat, loc.lon);
    return res.json({
      ok: true,
      location: json.location,
      days: json.days7,
      forecastHorizonDays: json.forecastHorizonDays,
      horizonNote: json.horizonNote,
      source: "nws"
    });
  } catch (_err) {
    return res.status(502).json({ ok: false, error: "nws_forecast10_failed" });
  }
});

router.get("/alerts", async (req, res) => {
  const loc = parseLatLon(req);
  if (!loc) {
    return res.status(400).json({ ok: false, error: "invalid_lat_lon" });
  }
  try {
    const json = await nws.getAlerts(loc.lat, loc.lon);
    return res.json(json);
  } catch (_err) {
    return res.status(502).json({ ok: false, error: "nws_alerts_failed" });
  }
});

router.get("/bundle", async (req, res) => {
  const loc = parseLatLon(req);
  if (!loc) {
    return res.status(400).json({ ok: false, error: "invalid_lat_lon" });
  }
  try {
    const json = await nws.getBundle(loc.lat, loc.lon);
    return res.json(json);
  } catch (_err) {
    return res.status(502).json({ ok: false, error: "nws_bundle_failed" });
  }
});

async function handleIntelHint(req, res) {
  const loc = parseLatLon(req);
  if (!loc) {
    return res.status(400).json({ ok: false, error: "invalid_lat_lon" });
  }

  const key = roundedKey(loc.lat, loc.lon, 3);
  const cached = getCachedIntelHint(key);
  if (cached) {
    return res.json(cached);
  }

  const dateIso = new Date().toISOString().slice(0, 10);

  try {
    const base = String(INTEL_ENGINE_BASE_URL || "").replace(/\/+$/, "");
    const intelUrl = `${base}/api/intel/live`;
    const json = await postJson(intelUrl, {
      lat: loc.lat,
      lon: loc.lon,
      dateIso
    });

    const hint = json.background_variant_hint || (json.data && json.data.background_variant_hint) || null;
    const payload = {
      ok: true,
      background_variant_hint: hint,
      severity_tier: json.severity_tier || (json.data && json.data.severity_tier) || null
    };
    return res.json(setCachedIntelHint(key, payload));
  } catch (_err) {
    return res.json({ ok: false });
  }
}

// GET /api/intel/hint?lat=..&lon=..
// Proxies to intel engine /api/intel/live and returns only hint payload.
router.get("/intel/hint", handleIntelHint);

// Backward-compatible alias.
router.post("/intel/hint", handleIntelHint);



// ---------- GEO (public) ----------
// GET /weather/geocode?zip=95206
// ZIP-first geocoding (US MVP) via Zippopotam.us
router.get("/geocode", async (req, res) => {
  try {
    const zipRaw = (req.query.zip || "").toString().trim();
    const zip = zipRaw.replace(/[^0-9]/g, "").slice(0, 5);
    if (!zip) return res.status(400).json({ ok: false, error: "missing_zip" });

    const url = `https://api.zippopotam.us/us/${zip}`;
    const j = await httpsGetJson(url, 8000);

    const place = (j.places && j.places[0]) ? j.places[0] : null;
    if (!place) return res.status(404).json({ ok: false, error: "zip_not_found" });

    const lat = Number(place.latitude);
    const lon = Number(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(502).json({ ok: false, error: "zip_bad_coords" });
    }

    const label = `${place["place name"]}, ${place["state abbreviation"]} ${zip}`;
    return res.json({ ok: true, lat, lon, label });
  } catch (e) {
    return res.status(502).json({ ok: false, error: "geocode_failed" });
  }
});



// ---------- ALMANAC (public) ----------
// GET /weather/almanac?lat=37.9&lon=-121.2&month=2&day=2&years=5
// Returns last N years' same-day highs/lows/precip + summary averages.
router.get("/almanac", async (req, res) => {
  try {
    const lat = Number.parseFloat(req.query.lat);
    const lon = Number.parseFloat(req.query.lon);

    const month = Number.parseInt(req.query.month, 10);
    const day = Number.parseInt(req.query.day, 10);
    const years = Math.max(1, Math.min(20, Number.parseInt(req.query.years ?? "5", 10)));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ ok: false, error: "invalid_lat_lon" });
    }
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return res.status(400).json({ ok: false, error: "invalid_month" });
    }
    if (!Number.isFinite(day) || day < 1 || day > 31) {
      return res.status(400).json({ ok: false, error: "invalid_day" });
    }

    const now = new Date();
    const thisYear = now.getUTCFullYear();

    function pad2(n){ return String(n).padStart(2, "0"); }
    function ymd(y,m,d){ return `${y}-${pad2(m)}-${pad2(d)}`; }

    const samples = [];
    for (let i = 0; i < years; i++) {
      const y = thisYear - 1 - i; // last full years (avoid partial current year confusion)
      const date = ymd(y, month, day);

      const url =
        "https://archive-api.open-meteo.com/v1/archive" +
        `?latitude=${encodeURIComponent(lat)}` +
        `&longitude=${encodeURIComponent(lon)}` +
        `&start_date=${encodeURIComponent(date)}` +
        `&end_date=${encodeURIComponent(date)}` +
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code" +
        "&temperature_unit=fahrenheit" +
        "&timezone=auto";

      const j = await httpsGetJson(url, 12000);
      const d = j.daily || {};

      const tmax = Array.isArray(d.temperature_2m_max) ? d.temperature_2m_max[0] : null;
      const tmin = Array.isArray(d.temperature_2m_min) ? d.temperature_2m_min[0] : null;
      const prcp = Array.isArray(d.precipitation_sum) ? d.precipitation_sum[0] : null;
      const code = Array.isArray(d.weather_code) ? d.weather_code[0] : null;

      samples.push({
        year: y,
        date,
        temp_max_f: tmax,
        temp_min_f: tmin,
        precip_sum_mm: prcp,
        weather_code: code
      });
    }

    // summary
    const maxes = samples.map(s => s.temp_max_f).filter(v => typeof v === "number" && Number.isFinite(v));
    const mins  = samples.map(s => s.temp_min_f).filter(v => typeof v === "number" && Number.isFinite(v));
    const precs = samples.map(s => s.precip_sum_mm).filter(v => typeof v === "number" && Number.isFinite(v));

    const avg = (arr) => arr.length ? (arr.reduce((a,b)=>a+b,0) / arr.length) : null;
    const rainDays = precs.filter(v => v > 0.2).length; // >0.2mm ~= "it rained"
    const wettest = precs.length ? Math.max(...precs) : null;

    return res.json({
      ok: true,
      location: { lat, lon },
      query: { month, day, years },
      samples,
      summary: {
        avg_high_f: avg(maxes),
        avg_low_f: avg(mins),
        rain_days: rainDays,
        wettest_precip_mm: wettest
      },
      source: "open-meteo-archive"
    });
  } catch (e) {
    console.error("almanac error:", e && (e.message || e));
    return res.status(502).json({ ok: false, error: "almanac_failed" });
  }
});

module.exports = router;
