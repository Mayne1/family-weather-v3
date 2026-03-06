"use strict";

function roundKey(lat, lon, decimals = 3) {
  return `${Number(lat).toFixed(decimals)},${Number(lon).toFixed(decimals)}`;
}

function normalizeWeatherCode(value) {
  const code = Number(value);
  if (!Number.isFinite(code)) return 3;
  if (code >= 95) return 95;
  if ((code >= 80 && code <= 82) || (code >= 61 && code <= 67)) return 61;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 71;
  if (code >= 51 && code <= 57) return 51;
  if (code >= 45 && code <= 48) return 45;
  if (code === 0) return 0;
  if (code === 1 || code === 2) return 2;
  if (code === 3) return 3;
  return code;
}

function codeLabel(code) {
  const n = normalizeWeatherCode(code);
  if (n === 0) return "Clear";
  if (n === 2) return "Partly Cloudy";
  if (n === 3) return "Cloudy";
  if (n === 45) return "Fog";
  if (n === 51) return "Drizzle";
  if (n === 61) return "Rain";
  if (n === 71) return "Snow";
  if (n >= 95) return "Thunder";
  return "Cloudy";
}

function iconForCode(code) {
  const n = normalizeWeatherCode(code);
  if (n === 0) return "images/mgc-weather-icons-pack-v12/01_sun_fill.svg";
  if (n === 2) return "images/mgc-weather-icons-pack-v12/04_sun_cloudy_fill.svg";
  if (n === 3) return "images/mgc-weather-icons-pack-v12/06_clouds_fill.svg";
  if (n === 45) return "images/mgc-weather-icons-pack-v12/15_fog_fill.svg";
  if (n === 51) return "images/mgc-weather-icons-pack-v12/09_drizzle_fill.svg";
  if (n === 61) return "images/mgc-weather-icons-pack-v12/10_showers_fill.svg";
  if (n === 71) return "images/mgc-weather-icons-pack-v12/18_moderate_snow_fill.svg";
  if (n >= 95) return "images/mgc-weather-icons-pack-v12/14_thunderstorm_fill.svg";
  return "images/mgc-weather-icons-pack-v12/06_clouds_fill.svg";
}

function normalizeHeadsUp(input) {
  const source = input && Array.isArray(input.top) ? input.top : [];
  const top = source.slice(0, 5).map((a) => ({
    title: a.event || a.headline || "Weather Alert",
    severity: a.severity || null,
    effective: a.effective || null,
    ends: a.ends || null
  }));
  const hasSevere = top.some((h) => {
    const s = String(h.severity || "").toLowerCase();
    return s === "severe" || s === "extreme";
  });
  return {
    count: top.length,
    hasSevere,
    top
  };
}

function normalizeDaily(days) {
  if (!Array.isArray(days)) return [];
  return days.slice(0, 7).map((d) => {
    const code = normalizeWeatherCode(d.weather_code);
    return {
      date: d.date || null,
      tempMaxF: d.temp_max_f != null ? d.temp_max_f : null,
      tempMinF: d.temp_min_f != null ? d.temp_min_f : null,
      weatherCode: code,
      label: codeLabel(code),
      precipChance: d.precip_prob_pct != null ? d.precip_prob_pct : null,
      windMaxMph: d.wind_max_mph != null ? d.wind_max_mph : null,
      icon: iconForCode(code)
    };
  });
}

function normalizeHourly(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 24).map((r) => {
    const code = normalizeWeatherCode(r.weather_code);
    return {
      startTime: r.time || null,
      tempF: r.temperature_2m != null ? r.temperature_2m : null,
      weatherCode: code,
      label: codeLabel(code),
      wind: r.wind_speed_10m != null ? `${Math.round(r.wind_speed_10m)} mph` : null,
      pop: r.precipChance != null ? r.precipChance : null,
      icon: iconForCode(code)
    };
  });
}

function findPrecipChance(hourly, currentTime) {
  if (!Array.isArray(hourly) || !hourly.length) return null;
  if (!currentTime) return hourly[0].pop != null ? hourly[0].pop : null;
  const idx = hourly.findIndex((h) => h.startTime === currentTime);
  if (idx >= 0) return hourly[idx].pop != null ? hourly[idx].pop : null;
  return hourly[0].pop != null ? hourly[0].pop : null;
}

function normalizeFavoriteCurrent(location, rightNow) {
  if (!location || !rightNow) return null;
  const code = normalizeWeatherCode(rightNow.weather_code);
  return {
    id: location.id != null ? String(location.id) : `${location.lat},${location.lon}`,
    label: location.label || "Favorite",
    lat: location.lat,
    lon: location.lon,
    tempF: rightNow.temperature_2m != null ? rightNow.temperature_2m : null,
    weatherCode: code,
    icon: iconForCode(code)
  };
}

function createAdapter(options) {
  const getBundle = options.getBundle;
  const getRightNow = options.getRightNow;
  const getFavorites = options.getFavorites || (async () => []);
  const ttlMs = options.ttlMs || 5 * 60 * 1000;
  const cache = new Map();

  function getCached(key) {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() >= hit.expiresAt) {
      cache.delete(key);
      return null;
    }
    return hit.value;
  }

  function setCached(key, value) {
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  async function buildFavorites() {
    const favLocs = await getFavorites();
    if (!Array.isArray(favLocs) || !favLocs.length) return [];
    const rows = await Promise.all(
      favLocs.slice(0, 5).map(async (loc) => {
        try {
          const j = await getRightNow(loc.lat, loc.lon);
          return normalizeFavoriteCurrent(loc, j && j.rightNow ? j.rightNow : null);
        } catch (_err) {
          return null;
        }
      })
    );
    return rows.filter(Boolean);
  }

  async function getPublicWeather(lat, lon) {
    const key = roundKey(lat, lon, 3);
    const cached = getCached(key);
    if (cached) return cached;

    const bundle = await getBundle(lat, lon);
    const hourly = normalizeHourly(bundle && bundle.hourly ? bundle.hourly : []);
    const daily = normalizeDaily(bundle && bundle.days7 ? bundle.days7 : []);
    const rawCurrent = bundle && bundle.rightNow ? bundle.rightNow : null;
    const currentCode = normalizeWeatherCode(rawCurrent && rawCurrent.weather_code);
    const favorites = await buildFavorites();

    const payload = {
      ok: true,
      location: bundle && bundle.location ? bundle.location : { lat: Number(lat), lon: Number(lon) },
      current: {
        time: rawCurrent && rawCurrent.time ? rawCurrent.time : null,
        tempF: rawCurrent && rawCurrent.temperature_2m != null ? rawCurrent.temperature_2m : null,
        feelsLikeF: rawCurrent && rawCurrent.apparent_temperature != null ? rawCurrent.apparent_temperature : null,
        humidityPct: rawCurrent && rawCurrent.relative_humidity_2m != null ? rawCurrent.relative_humidity_2m : null,
        windMph: rawCurrent && rawCurrent.wind_speed_10m != null ? rawCurrent.wind_speed_10m : null,
        windDir: rawCurrent && rawCurrent.wind_direction_10m != null ? rawCurrent.wind_direction_10m : null,
        weatherCode: currentCode,
        label: codeLabel(currentCode),
        precipChance: findPrecipChance(hourly, rawCurrent && rawCurrent.time ? rawCurrent.time : null),
        icon: iconForCode(currentCode)
      },
      hourly,
      daily,
      headsUp: normalizeHeadsUp(bundle && bundle.headsUp ? bundle.headsUp : null),
      favorites
    };

    return setCached(key, payload);
  }

  return {
    getPublicWeather,
    normalizeWeatherCode
  };
}

module.exports = {
  createAdapter,
  normalizeWeatherCode
};

