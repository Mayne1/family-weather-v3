"use strict";

const https = require("https");
const NWS_BASE = "https://api.weather.gov";
const DEFAULT_USER_AGENT =
  process.env.NWS_USER_AGENT || "family-weather-v3 (support@thefamilyweather.com)";

const HEADERS = {
  "User-Agent": DEFAULT_USER_AGENT,
  Accept: "application/geo+json"
};

const TTL = {
  pointsMs: 6 * 60 * 60 * 1000,
  hourlyMs: 5 * 60 * 1000,
  forecastMs: 30 * 60 * 1000,
  alertsMs: 2 * 60 * 1000
};
const DAILY_DAYS_MAX = 7;

const cache = {
  points: new Map(),
  hourly: new Map(),
  forecast: new Map(),
  alerts: new Map()
};

function cacheGet(store, key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() >= hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(store, key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

function roundCoord(v, decimals = 3) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(decimals));
}

function coordKey(lat, lon, decimals = 3) {
  return `${roundCoord(lat, decimals)},${roundCoord(lon, decimals)}`;
}

function toDateYmd(isoTs) {
  const d = new Date(isoTs);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function cardinalToDegrees(cardinal) {
  const key = String(cardinal || "").trim().toUpperCase();
  const map = {
    N: 0,
    NNE: 22.5,
    NE: 45,
    ENE: 67.5,
    E: 90,
    ESE: 112.5,
    SE: 135,
    SSE: 157.5,
    S: 180,
    SSW: 202.5,
    SW: 225,
    WSW: 247.5,
    W: 270,
    WNW: 292.5,
    NW: 315,
    NNW: 337.5
  };
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
}

function parseWindMph(text) {
  const raw = String(text || "").toLowerCase();
  const nums = (raw.match(/\d+(\.\d+)?/g) || [])
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));

  let minMph = null;
  let maxMph = null;
  if (raw.includes(" to ") && nums.length >= 2) {
    minMph = nums[0];
    maxMph = nums[1];
  } else if (nums.length >= 1) {
    minMph = nums[0];
    maxMph = nums[0];
  }

  const gustMatch = raw.match(/gusts?\s+(?:as high as|up to)?\s*(\d+(\.\d+)?)/);
  const gustMph = gustMatch ? Number(gustMatch[1]) : null;
  const avgMph = minMph != null && maxMph != null ? (minMph + maxMph) / 2 : null;

  return {
    text: text || null,
    minMph,
    maxMph,
    avgMph,
    gustMph: Number.isFinite(gustMph) ? gustMph : null
  };
}

function conditionToCode(text) {
  const s = String(text || "").toLowerCase();
  if (!s) return 3;
  if (s.includes("thunder")) return 95;
  if (s.includes("snow") || s.includes("flurr") || s.includes("blizzard")) return 71;
  if (s.includes("sleet") || s.includes("ice pellets") || s.includes("freezing rain")) return 67;
  if (s.includes("rain") || s.includes("showers") || s.includes("drizzle")) return 61;
  if (s.includes("fog") || s.includes("mist") || s.includes("haze") || s.includes("smoke")) return 45;
  if (s.includes("partly cloudy") || s.includes("mostly sunny") || s.includes("partly sunny")) return 2;
  if (s.includes("sunny") || s.includes("clear")) return 0;
  if (s.includes("cloud")) return 3;
  return 3;
}

function severityRank(v) {
  const s = String(v || "").toLowerCase();
  if (s === "extreme") return 5;
  if (s === "severe") return 4;
  if (s === "moderate") return 3;
  if (s === "minor") return 2;
  return 1;
}

function urgencyRank(v) {
  const s = String(v || "").toLowerCase();
  if (s === "immediate") return 4;
  if (s === "expected") return 3;
  if (s === "future") return 2;
  return 1;
}

function certaintyRank(v) {
  const s = String(v || "").toLowerCase();
  if (s === "observed") return 4;
  if (s === "likely") return 3;
  if (s === "possible") return 2;
  return 1;
}

function sortAlerts(a, b) {
  const sa = severityRank(a.severity);
  const sb = severityRank(b.severity);
  if (sa !== sb) return sb - sa;
  const ua = urgencyRank(a.urgency);
  const ub = urgencyRank(b.urgency);
  if (ua !== ub) return ub - ua;
  const ca = certaintyRank(a.certainty);
  const cb = certaintyRank(b.certainty);
  if (ca !== cb) return cb - ca;
  return Date.parse(b.effective || 0) - Date.parse(a.effective || 0);
}

function normalizeAlert(feature) {
  const p = (feature && feature.properties) || {};
  return {
    event: p.event || null,
    severity: p.severity || null,
    urgency: p.urgency || null,
    certainty: p.certainty || null,
    headline: p.headline || p.event || null,
    effective: p.effective || null,
    ends: p.ends || p.expires || null,
    instruction: p.instruction || null,
    senderName: p.senderName || null
  };
}

function buildHeadsUp(alerts) {
  const sorted = alerts.slice().sort(sortAlerts);
  return {
    count: alerts.length,
    top: sorted.slice(0, 3),
    hasSevere: sorted.some((a) => severityRank(a.severity) >= 4)
  };
}

function normalizeHourlyPeriod(period) {
  const wind = parseWindMph(period.windSpeed);
  const weatherCode = conditionToCode(period.shortForecast);
  const pop = period.probabilityOfPrecipitation ? period.probabilityOfPrecipitation.value : null;

  return {
    time: period.startTime || null,
    temperature_2m: period.temperature != null ? period.temperature : null,
    weather_code: weatherCode,
    precipChance: pop != null ? pop : null,
    wind_speed_10m: wind.avgMph,
    wind_speed_range_mph: {
      min: wind.minMph,
      max: wind.maxMph
    },
    wind_gust_mph: wind.gustMph,
    wind_direction_10m: cardinalToDegrees(period.windDirection),
    wind_direction_cardinal: period.windDirection || null,
    precipitation: 0,
    rain: weatherCode === 61 || weatherCode === 67 ? 0.01 : 0,
    showers: 0,
    snowfall: weatherCode === 71 ? 0.01 : 0,
    shortForecast: period.shortForecast || null,
    detailedForecast: period.detailedForecast || null
  };
}

function pickCurrentHourly(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const now = Date.now();
  let best = rows[0];
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const ts = Date.parse(row.time || "");
    if (!Number.isFinite(ts)) continue;
    const delta = Math.abs(ts - now);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = row;
    }
  }
  return best;
}

function rowsToHourlyMatrix(rows) {
  return {
    time: rows.map((r) => r.time),
    precipitation_probability: rows.map((r) => r.precipChance),
    weather_code: rows.map((r) => r.weather_code),
    precipitation: rows.map((r) => r.precipitation || 0),
    rain: rows.map((r) => r.rain || 0),
    showers: rows.map((r) => r.showers || 0),
    snowfall: rows.map((r) => r.snowfall || 0)
  };
}

function buildCurrentFromHourly(row) {
  if (!row) return null;
  return {
    temperature_2m: row.temperature_2m,
    apparent_temperature: row.temperature_2m,
    relative_humidity_2m: null,
    weather_code: row.weather_code,
    wind_speed_10m: row.wind_speed_10m,
    wind_direction_10m: row.wind_direction_10m,
    precipitation: row.precipitation || 0,
    rain: row.rain || 0,
    showers: row.showers || 0,
    snowfall: row.snowfall || 0,
    time: row.time || null
  };
}

function normalizeDaily(periods) {
  const dayPeriods = periods.filter((p) => p && p.isDaytime === true);
  const dayByDate = new Map();
  for (const p of dayPeriods) {
    const date = toDateYmd(p.startTime);
    if (date && !dayByDate.has(date)) dayByDate.set(date, p);
  }

  const nightByDate = new Map();
  for (const p of periods) {
    if (!p || p.isDaytime !== false) continue;
    const date = toDateYmd(p.startTime);
    if (date && !nightByDate.has(date)) nightByDate.set(date, p);
  }

  const dates = Array.from(dayByDate.keys()).sort().slice(0, DAILY_DAYS_MAX);
  const daily = {
    time: [],
    weather_code: [],
    temperature_2m_max: [],
    temperature_2m_min: [],
    precipitation_probability_max: [],
    wind_speed_10m_max: []
  };

  const days = [];
  for (const date of dates) {
    const day = dayByDate.get(date);
    const night = nightByDate.get(date) || null;
    const wind = parseWindMph(day.windSpeed);
    const code = conditionToCode(day.shortForecast);
    const pop = day.probabilityOfPrecipitation ? day.probabilityOfPrecipitation.value : null;
    const tMax = day.temperature != null ? day.temperature : null;
    const tMin = night && night.temperature != null ? night.temperature : null;
    const windMax = wind.maxMph != null ? wind.maxMph : wind.avgMph;

    daily.time.push(date);
    daily.weather_code.push(code);
    daily.temperature_2m_max.push(tMax);
    daily.temperature_2m_min.push(tMin);
    daily.precipitation_probability_max.push(pop);
    daily.wind_speed_10m_max.push(windMax != null ? windMax : null);

    days.push({
      date,
      name: day.name || null,
      weather_code: code,
      temp_max_f: tMax,
      temp_min_f: tMin,
      precip_prob_pct: pop,
      wind_max_mph: windMax != null ? windMax : null,
      shortForecast: day.shortForecast || null,
      detailedForecast: day.detailedForecast || null
    });
  }

  return { daily, days };
}

async function fetchJson(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: HEADERS
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`nws_http_${res.statusCode || 0}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (_err) {
            reject(new Error("nws_json_parse_failed"));
          }
        });
      }
    );
    req.on("error", (err) => {
      reject(err || new Error("nws_request_failed"));
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("nws_timeout"));
    });
  });
}

async function getPoints(lat, lon) {
  const key = coordKey(lat, lon, 3);
  const hit = cacheGet(cache.points, key);
  if (hit) return hit;
  const data = await fetchJson(`${NWS_BASE}/points/${lat},${lon}`);
  const props = (data && data.properties) || {};
  const value = {
    forecast: props.forecast || null,
    forecastHourly: props.forecastHourly || null,
    gridId: props.gridId || null,
    gridX: props.gridX || null,
    gridY: props.gridY || null
  };
  if (!value.forecastHourly || !value.forecast) throw new Error("nws_points_incomplete");
  return cacheSet(cache.points, key, value, TTL.pointsMs);
}

async function getHourly(lat, lon) {
  const key = coordKey(lat, lon, 3);
  const hit = cacheGet(cache.hourly, key);
  if (hit) return hit;

  const points = await getPoints(lat, lon);
  const json = await fetchJson(points.forecastHourly);
  const periods = (json && json.properties && json.properties.periods) || [];
  const hourlyRows = periods.map(normalizeHourlyPeriod);
  const current = buildCurrentFromHourly(pickCurrentHourly(hourlyRows));
  const hourlyMatrix = rowsToHourlyMatrix(hourlyRows);

  const value = {
    ok: true,
    source: "nws",
    location: {
      lat: Number(lat),
      lon: Number(lon),
      gridId: points.gridId,
      gridX: points.gridX,
      gridY: points.gridY
    },
    periods: periods.length,
    hourly: hourlyRows,
    weather: {
      current,
      hourly: hourlyMatrix
    }
  };

  return cacheSet(cache.hourly, key, value, TTL.hourlyMs);
}

async function getRightNow(lat, lon) {
  const hourly = await getHourly(lat, lon);
  return {
    ok: true,
    source: "nws",
    location: hourly.location,
    rightNow: hourly.weather.current,
    weather: {
      current: hourly.weather.current
    }
  };
}

async function getForecast(lat, lon) {
  const key = coordKey(lat, lon, 3);
  const hit = cacheGet(cache.forecast, key);
  if (hit) return hit;

  const points = await getPoints(lat, lon);
  const json = await fetchJson(points.forecast);
  const periods = (json && json.properties && json.properties.periods) || [];
  const normalized = normalizeDaily(periods);
  const horizonDays = normalized.days.length;

  const value = {
    ok: true,
    source: "nws",
    location: {
      lat: Number(lat),
      lon: Number(lon),
      gridId: points.gridId,
      gridX: points.gridX,
      gridY: points.gridY
    },
    daily7: normalized.daily,
    days7: normalized.days,
    daily: normalized.daily, // compatibility
    days: normalized.days, // compatibility
    forecastHorizonDays: horizonDays,
    horizonNote:
      horizonDays < DAILY_DAYS_MAX
        ? `NWS daily forecast currently provides ${horizonDays} day periods for this location.`
        : null,
    weather: {
      daily: normalized.daily
    }
  };

  return cacheSet(cache.forecast, key, value, TTL.forecastMs);
}

async function getAlerts(lat, lon) {
  const key = coordKey(lat, lon, 3);
  const hit = cacheGet(cache.alerts, key);
  if (hit) return hit;

  const url = `${NWS_BASE}/alerts/active?point=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`;
  const json = await fetchJson(url);
  const features = Array.isArray(json && json.features) ? json.features : [];
  const alerts = features.map(normalizeAlert);
  const headsUp = buildHeadsUp(alerts);

  const value = {
    ok: true,
    source: "nws",
    location: { lat: Number(lat), lon: Number(lon) },
    alerts,
    headsUp
  };

  return cacheSet(cache.alerts, key, value, TTL.alertsMs);
}

async function getBundle(lat, lon) {
  const [rightNow, hourly, forecast, alerts] = await Promise.all([
    getRightNow(lat, lon),
    getHourly(lat, lon),
    getForecast(lat, lon),
    getAlerts(lat, lon)
  ]);

  return {
    ok: true,
    source: "nws",
    location: rightNow.location || { lat: Number(lat), lon: Number(lon) },
    rightNow: rightNow.rightNow,
    hourly: hourly.hourly,
    daily7: forecast.daily7,
    daily: forecast.daily7, // compatibility
    alerts: alerts.alerts,
    headsUp: alerts.headsUp,
    weather: {
      current: rightNow.rightNow,
      hourly: hourly.weather.hourly,
      daily: forecast.daily7
    }
  };
}

module.exports = {
  parseWindMph,
  conditionToCode,
  getPoints,
  getRightNow,
  getHourly,
  getForecast,
  getAlerts,
  getBundle
};
