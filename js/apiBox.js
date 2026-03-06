(function () {
  let settingsApiUnauthorized = false;
  const PUBLIC_WEATHER_CACHE_MS = 2 * 60 * 1000;
  const publicWeatherCache = new Map();
  // Optional local-dev override. In production, leave unset so same-origin proxy is used.
  const INTEL_BASE_URL =
    typeof window !== "undefined" && typeof window.FW_INTEL_BASE_URL === "string"
      ? window.FW_INTEL_BASE_URL.trim()
      : "";

  function getApiKey() {
    try {
      const fromStorage = String(localStorage.getItem("fw_api_key") || "").trim();
      if (fromStorage) return fromStorage;
    } catch (_err) {}
    if (typeof window !== "undefined" && typeof window.FW_API_KEY === "string") {
      const fromWindow = window.FW_API_KEY.trim();
      if (fromWindow) return fromWindow;
    }
    return null;
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

  function normalizeHourly(data) {
    if (!data) return [];
    if (Array.isArray(data.hours)) {
      return data.hours.map(function (row) {
        return {
          time: row.startTime || row.time || row.ts || null,
          temperature_2m: row.tempF != null ? row.tempF : (row.temperature_2m != null ? row.temperature_2m : row.temp),
          weather_code: normalizeWeatherCode(row.weather_code != null ? row.weather_code : row.code),
          precipChance: row.pop != null ? row.pop : (row.precipChance != null ? row.precipChance : row.precipitation_probability)
        };
      });
    }
    if (Array.isArray(data.hourly)) {
      return data.hourly.map(function (row) {
        return {
          time: row.time || row.ts || null,
          temperature_2m: row.temperature_2m != null ? row.temperature_2m : row.temp,
          weather_code: normalizeWeatherCode(row.weather_code != null ? row.weather_code : row.code),
          precipChance: row.precipChance != null ? row.precipChance : row.precipitation_probability
        };
      });
    }
    if (data.hourly && Array.isArray(data.hourly.time)) {
      const temps = data.hourly.temperature_2m || [];
      const codes = data.hourly.weather_code || [];
      const prec = data.hourly.precipitation_probability || [];
      return data.hourly.time.map(function (t, i) {
        return {
          time: t,
          temperature_2m: temps[i],
          weather_code: normalizeWeatherCode(codes[i]),
          precipChance: prec[i]
        };
      });
    }
    if (Array.isArray(data.time) && Array.isArray(data.temperature_2m)) {
      return data.time.map(function (t, i) {
        return {
          time: t,
          temperature_2m: data.temperature_2m[i],
          weather_code: data.weather_code ? normalizeWeatherCode(data.weather_code[i]) : null,
          precipChance: data.precipitation_probability ? data.precipitation_probability[i] : null
        };
      });
    }
    return [];
  }

  function siteKey(lat, lon) {
    return `${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;
  }

  function getCachedPublicWeather(lat, lon) {
    const key = siteKey(lat, lon);
    const hit = publicWeatherCache.get(key);
    if (!hit) return null;
    if (Date.now() >= hit.expiresAt) {
      publicWeatherCache.delete(key);
      return null;
    }
    return hit.value;
  }

  function setCachedPublicWeather(lat, lon, value) {
    publicWeatherCache.set(siteKey(lat, lon), {
      value: value,
      expiresAt: Date.now() + PUBLIC_WEATHER_CACHE_MS
    });
    return value;
  }

  async function fetchPublicWeather(lat, lon) {
    const cached = getCachedPublicWeather(lat, lon);
    if (cached) return cached;

    const targets = [
      "/api/public-weather?lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon),
      "/api/weather/public-weather?lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon),
      "/api/site-weather?lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon),
      "/api/weather/site-weather?lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon)
    ];
    for (const url of targets) {
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json && json.ok !== false && json.current && Array.isArray(json.hourly) && Array.isArray(json.daily)) {
          return setCachedPublicWeather(lat, lon, json);
        }
        if (json && json.weather && json.weather.current) {
          const adapted = {
            ok: true,
            location: json.location || { lat: Number(lat), lon: Number(lon) },
            current: json.weather.current || null,
            hourly: Array.isArray(json.weather.hourly) ? json.weather.hourly : [],
            daily: Array.isArray(json.weather.daily) ? json.weather.daily : [],
            headsUp: Array.isArray(json.headsUp) ? { count: json.headsUp.length, hasSevere: false, top: json.headsUp } : (json.headsUp || { count: 0, hasSevere: false, top: [] }),
            favorites: Array.isArray(json.favorites) ? json.favorites : []
          };
          return setCachedPublicWeather(lat, lon, adapted);
        }
      }
      if (res.status !== 404) break;
    }
    throw new Error("public_weather_unavailable");
  }

  function toLegacyWeatherMatrix(hourly, daily) {
    const rowsHourly = Array.isArray(hourly) ? hourly : [];
    const rowsDaily = Array.isArray(daily) ? daily : [];
    return {
      hourly: {
        time: rowsHourly.map(function (h) { return h.startTime || h.time || null; }),
        precipitation_probability: rowsHourly.map(function (h) { return h.pop != null ? h.pop : null; }),
        weather_code: rowsHourly.map(function (h) { return normalizeWeatherCode(h.weatherCode != null ? h.weatherCode : h.weather_code); }),
        precipitation: rowsHourly.map(function () { return 0; }),
        rain: rowsHourly.map(function () { return 0; }),
        showers: rowsHourly.map(function () { return 0; }),
        snowfall: rowsHourly.map(function () { return 0; })
      },
      daily: {
        time: rowsDaily.map(function (d) { return d.date || null; }),
        weather_code: rowsDaily.map(function (d) { return normalizeWeatherCode(d.weatherCode != null ? d.weatherCode : d.weather_code); }),
        temperature_2m_max: rowsDaily.map(function (d) { return d.tempMaxF != null ? d.tempMaxF : null; }),
        temperature_2m_min: rowsDaily.map(function (d) { return d.tempMinF != null ? d.tempMinF : null; }),
        precipitation_probability_max: rowsDaily.map(function (d) { return d.precipChance != null ? d.precipChance : null; }),
        wind_speed_10m_max: rowsDaily.map(function (d) { return d.windMaxMph != null ? d.windMaxMph : null; })
      }
    };
  }

  function toLegacyBundle(site, lat, lon) {
    const current = site && site.current ? site.current : {};
    const hourly = site && Array.isArray(site.hourly) ? site.hourly : [];
    const daily = site && Array.isArray(site.daily) ? site.daily : [];
    const headsUp = site && site.headsUp ? site.headsUp : { count: 0, hasSevere: false, top: [] };
    const heads = Array.isArray(headsUp.top) ? headsUp.top : (Array.isArray(headsUp) ? headsUp : []);
    const matrix = toLegacyWeatherMatrix(hourly, daily);

    return {
      ok: true,
      source: "public-weather",
      location: { lat: Number(lat), lon: Number(lon) },
      rightNow: {
        time: current.time || null,
        temperature_2m: current.tempF != null ? current.tempF : (current.temperature_2m != null ? current.temperature_2m : null),
        apparent_temperature: current.feelsLikeF != null ? current.feelsLikeF : (current.apparent_temperature != null ? current.apparent_temperature : null),
        relative_humidity_2m: current.humidityPct != null ? current.humidityPct : (current.relative_humidity_2m != null ? current.relative_humidity_2m : null),
        wind_speed_10m: current.windMph != null ? current.windMph : (current.wind_speed_10m != null ? current.wind_speed_10m : null),
        wind_direction_10m: current.windDir != null ? current.windDir : (current.wind_direction_10m != null ? current.wind_direction_10m : null),
        weather_code: normalizeWeatherCode(current.weatherCode != null ? current.weatherCode : current.weather_code),
        precipitation: 0,
        rain: 0,
        showers: 0,
        snowfall: 0
      },
      hourly: hourly.map(function (h) {
        return {
          time: h.startTime || h.time || null,
          temperature_2m: h.tempF != null ? h.tempF : (h.temperature_2m != null ? h.temperature_2m : null),
          weather_code: normalizeWeatherCode(h.weatherCode != null ? h.weatherCode : h.weather_code),
          precipChance: h.pop != null ? h.pop : (h.precipChance != null ? h.precipChance : null)
        };
      }),
      daily7: matrix.daily,
      daily: matrix.daily,
      weather: {
        current: {
          time: current.time || null,
          temperature_2m: current.tempF != null ? current.tempF : (current.temperature_2m != null ? current.temperature_2m : null),
          apparent_temperature: current.feelsLikeF != null ? current.feelsLikeF : (current.apparent_temperature != null ? current.apparent_temperature : null),
          relative_humidity_2m: current.humidityPct != null ? current.humidityPct : (current.relative_humidity_2m != null ? current.relative_humidity_2m : null),
          wind_speed_10m: current.windMph != null ? current.windMph : (current.wind_speed_10m != null ? current.wind_speed_10m : null),
          wind_direction_10m: current.windDir != null ? current.windDir : (current.wind_direction_10m != null ? current.wind_direction_10m : null),
          weather_code: normalizeWeatherCode(current.weatherCode != null ? current.weatherCode : current.weather_code),
          precipitation: 0,
          rain: 0,
          showers: 0,
          snowfall: 0
        },
        hourly: matrix.hourly,
        daily: matrix.daily
      },
      headsUp: {
        count: headsUp.count != null ? headsUp.count : heads.length,
        top: heads.map(function (h) {
          return {
            event: h.title || h.event || "Weather Alert",
            severity: h.severity || null,
            effective: h.effective || null,
            ends: h.ends || null
          };
        }),
        hasSevere: !!headsUp.hasSevere
      },
      favorites: Array.isArray(site && site.favorites) ? site.favorites : []
    };
  }

  async function getHourlyForecast(lat, lon) {
    try {
      const site = await fetchPublicWeather(lat, lon);
      const rows = normalizeHourly(site && site.hourly ? site.hourly : []);
      if (Array.isArray(rows) && rows.length) return rows;
      return [];
    } catch (_err) {
      return [];
    }
  }

  async function getWeatherRightNow(lat, lon) {
    const site = await fetchPublicWeather(lat, lon);
    const bundle = toLegacyBundle(site, lat, lon);
    return {
      ok: true,
      source: bundle.source,
      location: bundle.location,
      rightNow: bundle.rightNow,
      weather: { current: bundle.weather.current }
    };
  }

  async function getWeatherForecast(lat, lon) {
    const site = await fetchPublicWeather(lat, lon);
    const json = toLegacyBundle(site, lat, lon);
    if (json && !json.daily && json.daily7) json.daily = json.daily7;
    return json;
  }

  async function getWeatherAlerts(lat, lon) {
    const site = await fetchPublicWeather(lat, lon);
    const bundle = toLegacyBundle(site, lat, lon);
    return {
      ok: true,
      source: bundle.source,
      location: bundle.location,
      alerts: bundle.headsUp.top,
      headsUp: bundle.headsUp
    };
  }

  async function getWeatherBundle(lat, lon) {
    const site = await fetchPublicWeather(lat, lon);
    return toLegacyBundle(site, lat, lon);
  }

  function severityRank(value) {
    var v = String(value || "").toLowerCase();
    if (v === "extreme") return 5;
    if (v === "severe") return 4;
    if (v === "moderate") return 3;
    if (v === "minor") return 2;
    return 1;
  }

  function buildHeadsUpFromAlerts(alerts) {
    var list = Array.isArray(alerts) ? alerts.slice() : [];
    list.sort(function (a, b) {
      return severityRank(b && b.severity) - severityRank(a && a.severity);
    });
    return {
      count: list.length,
      top: list.slice(0, 3),
      hasSevere: list.some(function (a) { return severityRank(a && a.severity) >= 4; })
    };
  }

  async function getGeocodeByZip(zip) {
    const cleanZip = String(zip || "").replace(/[^0-9]/g, "").slice(0, 5);
    if (!cleanZip) return null;
    const res = await fetch("/api/weather/geocode?zip=" + encodeURIComponent(cleanZip));
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || !json.ok) return null;
    return {
      lat: json.lat,
      lon: json.lon,
      label: json.label || ("ZIP " + cleanZip)
    };
  }

  async function getAlmanacDay(lat, lon, month, day, years) {
    const query =
      "/api/weather/almanac?lat=" +
      encodeURIComponent(lat) +
      "&lon=" +
      encodeURIComponent(lon) +
      "&month=" +
      encodeURIComponent(month) +
      "&day=" +
      encodeURIComponent(day) +
      "&years=" +
      encodeURIComponent(years);
    const res = await fetch(query);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || !json.ok || !Array.isArray(json.samples)) return null;
    return json;
  }

  function parseIntelHintResponse(json) {
    if (!json || typeof json !== "object") return null;
    const hint = json.background_variant_hint || (json.data && json.data.background_variant_hint) || null;
    const severeHint =
      typeof json.severeHint === "boolean"
        ? json.severeHint
        : hint === "severe";
    return {
      ok: json.ok !== false,
      severeHint: !!severeHint,
      background_variant_hint: severeHint ? "severe" : "normal",
      severity_tier: json.severity_tier || (json.data && json.data.severity_tier) || null
    };
  }

  async function getIntelHint(lat, lon, dateIso, scenarioOverrides) {
    try {
      const target = INTEL_BASE_URL
        ? String(INTEL_BASE_URL).replace(/\/+$/, "") + "/api/intel/live"
        : null;
      const date = dateIso || new Date().toISOString().slice(0, 10);
      const sameOriginTargets = [
        "/api/intel/hint?lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon) + "&dateIso=" + encodeURIComponent(date),
        "/api/weather/intel/hint?lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon) + "&dateIso=" + encodeURIComponent(date)
      ];
      const controller = new AbortController();
      const timeout = setTimeout(function () {
        controller.abort();
      }, 3000);
      const body = {
        lat: lat,
        lon: lon,
        dateIso: dateIso || new Date().toISOString().slice(0, 10),
        scenarioOverrides:
          scenarioOverrides && typeof scenarioOverrides === "object"
            ? scenarioOverrides
            : { preferences: { enabledModules: [] } }
      };
      let res = null;
      if (target) {
        res = await fetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal
        });
      } else {
        for (const url of sameOriginTargets) {
          // Prefer simple GET proxy endpoints in production.
          const candidate = await fetch(url, {
            signal: controller.signal
          });
          if (candidate.ok) {
            res = candidate;
            break;
          }
          if (candidate.status === 404) {
            // Backward compatibility path: old POST endpoint.
            const legacy = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: controller.signal
            });
            if (legacy.ok) {
              res = legacy;
              break;
            }
            if (legacy.status !== 404) {
              res = legacy;
              break;
            }
          }
          if (candidate.status !== 404) {
            res = candidate;
            break;
          }
        }
      }
      clearTimeout(timeout);
      if (!res || !res.ok) return null;
      const json = await res.json();
      const normalized = parseIntelHintResponse(json);
      return normalized && normalized.ok ? normalized : null;
    } catch (_err) {
      return null;
    }
  }

  async function getSettings(ownerEmail) {
    if (settingsApiUnauthorized) return {};
    const owner = String(ownerEmail || "").trim().toLowerCase();
    if (!owner) throw new Error("owner_email_required");
    const apiKey = getApiKey();
    const headers = apiKey ? { "X-API-Key": apiKey } : undefined;
    const res = await fetch("/api/settings/me?owner_email=" + encodeURIComponent(owner), { headers: headers });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        settingsApiUnauthorized = true;
        return { ok: false, status: res.status };
      }
      throw new Error("settings_fetch_failed");
    }
    const json = await res.json();
    if (json && typeof json === "object" && json.settings && typeof json.settings === "object") {
      return json.settings;
    }
    if (json && typeof json === "object") return json;
    return {};
  }

  async function saveSettings(ownerEmail, settings) {
    const owner = String(ownerEmail || "").trim().toLowerCase();
    if (!owner) throw new Error("owner_email_required");
    const apiKey = getApiKey();
    const payload = {
      owner_email: owner,
      settings: settings && typeof settings === "object" ? settings : {}
    };
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["X-API-Key"] = apiKey;
    const res = await fetch("/api/settings/me", {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("settings_save_failed");
    return res.json();
  }

  window.apiBox = {
    getPublicWeather: fetchPublicWeather,
    getSiteWeather: fetchPublicWeather,
    getHourlyForecast: getHourlyForecast,
    getWeatherRightNow: getWeatherRightNow,
    getWeatherForecast: getWeatherForecast,
    getWeatherAlerts: getWeatherAlerts,
    getWeatherBundle: getWeatherBundle,
    normalizeWeatherCode: normalizeWeatherCode,
    getGeocodeByZip: getGeocodeByZip,
    getAlmanacDay: getAlmanacDay,
    getIntelHint: getIntelHint,
    getSettings: getSettings,
    saveSettings: saveSettings,
    getApiKey: getApiKey
  };
})();
