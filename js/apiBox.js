(function () {
  let settingsApiUnauthorized = false;
  let weatherBasePath = "/api/weather";
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

  async function fetchWeather(path, lat, lon) {
    const candidates = [];
    if (weatherBasePath) candidates.push(weatherBasePath);
    candidates.push("/api/weather");
    const seen = new Set();
    const bases = candidates.filter(function (base) {
      if (!base || seen.has(base)) return false;
      seen.add(base);
      return true;
    });
    for (const base of bases) {
      const url =
        base +
        "/" +
        path +
        "?lat=" +
        encodeURIComponent(lat) +
        "&lon=" +
        encodeURIComponent(lon);
      const res = await fetch(url);
      if (res.ok) {
        weatherBasePath = base;
        return res.json();
      }
      if (res.status === 404) continue;
      throw new Error("backend_weather_failed");
    }
    throw new Error("backend_weather_not_found");
  }

  function normalizeDailyShape(raw) {
    if (!raw) return null;
    if (raw.daily && Array.isArray(raw.daily.time)) return raw.daily;
    if (Array.isArray(raw.time)) return raw;
    if (Array.isArray(raw.days)) {
      return {
        time: raw.days.map(function (d) { return d.date || d.time || null; }),
        weather_code: raw.days.map(function (d) { return normalizeWeatherCode(d.weather_code != null ? d.weather_code : d.code); }),
        temperature_2m_max: raw.days.map(function (d) { return d.temperature_2m_max != null ? d.temperature_2m_max : d.temp_max_f; }),
        temperature_2m_min: raw.days.map(function (d) { return d.temperature_2m_min != null ? d.temperature_2m_min : d.temp_min_f; }),
        precipitation_probability_max: raw.days.map(function (d) { return d.precipitation_probability_max != null ? d.precipitation_probability_max : d.pop; }),
        wind_speed_10m_max: raw.days.map(function (d) { return d.wind_speed_10m_max != null ? d.wind_speed_10m_max : d.wind_mph; })
      };
    }
    return null;
  }

  function normalizeCurrentShape(raw) {
    if (!raw || typeof raw !== "object") return null;
    return {
      time: raw.time || raw.ts || raw.startTime || null,
      temperature_2m: raw.temperature_2m != null ? raw.temperature_2m : raw.tempF,
      apparent_temperature: raw.apparent_temperature != null ? raw.apparent_temperature : raw.feelsLikeF,
      relative_humidity_2m: raw.relative_humidity_2m != null ? raw.relative_humidity_2m : raw.humidityPct,
      wind_speed_10m: raw.wind_speed_10m != null ? raw.wind_speed_10m : raw.windMph,
      wind_direction_10m: raw.wind_direction_10m != null ? raw.wind_direction_10m : raw.windDir,
      weather_code: normalizeWeatherCode(raw.weather_code != null ? raw.weather_code : raw.weatherCode),
      precipitation: raw.precipitation != null ? raw.precipitation : 0,
      rain: raw.rain != null ? raw.rain : 0,
      showers: raw.showers != null ? raw.showers : 0,
      snowfall: raw.snowfall != null ? raw.snowfall : 0
    };
  }

  async function getHourlyForecast(lat, lon) {
    try {
      const json = await fetchWeather("hourly", lat, lon);
      const rows = normalizeHourly(json.hourly || json.weather || json.data || json);
      if (Array.isArray(rows) && rows.length) return rows;
    } catch (_err) {
      // Try bundle fallback below.
    }
    try {
      const bundle = await getWeatherBundle(lat, lon);
      return normalizeHourly(bundle && (bundle.hourly || (bundle.weather && bundle.weather.hourly)));
    } catch (_err2) {
      return [];
    }
  }

  async function getWeatherRightNow(lat, lon) {
    try {
      const json = await fetchWeather("rightnow", lat, lon);
      const current = normalizeCurrentShape(json.rightNow || (json.weather && json.weather.current) || json.current);
      return {
        ok: true,
        source: "nws",
        location: json.location || { lat: Number(lat), lon: Number(lon) },
        rightNow: current,
        weather: { current: current }
      };
    } catch (_err) {
      const json = await fetchWeather("current", lat, lon);
      const current = normalizeCurrentShape(json.current || json.rightNow || (json.weather && json.weather.current));
      return {
        ok: true,
        source: "nws",
        location: json.location || { lat: Number(lat), lon: Number(lon) },
        rightNow: current,
        weather: { current: current }
      };
    }
  }

  async function getWeatherForecast(lat, lon) {
    const json = await fetchWeather("daily", lat, lon);
    const daily = normalizeDailyShape(json.daily || json.daily7 || json.days7 || (json.weather && json.weather.daily) || json);
    return {
      ok: true,
      source: "nws",
      location: json.location || { lat: Number(lat), lon: Number(lon) },
      daily7: daily,
      daily: daily,
      weather: { daily: daily }
    };
  }

  async function getWeatherAlerts(lat, lon) {
    const json = await fetchWeather("alerts", lat, lon);
    const alerts = Array.isArray(json.alerts) ? json.alerts : [];
    return {
      ok: true,
      source: "nws",
      location: json.location || { lat: Number(lat), lon: Number(lon) },
      alerts: alerts,
      headsUp: json.headsUp || buildHeadsUpFromAlerts(alerts)
    };
  }

  async function getWeatherBundle(lat, lon) {
    try {
      const json = await fetchWeather("bundle", lat, lon);
      const current = normalizeCurrentShape(json.rightNow || json.current || (json.weather && json.weather.current));
      const hourly = normalizeHourly((json.weather && json.weather.hourly) || json.hourly || json.data || json);
      const daily = normalizeDailyShape((json.weather && json.weather.daily) || json.daily || json.daily7 || json.days7);
      const alerts = Array.isArray(json.alerts) ? json.alerts : [];
      return {
        ok: true,
        source: "nws",
        location: json.location || { lat: Number(lat), lon: Number(lon) },
        rightNow: current,
        hourly: hourly,
        daily7: daily,
        daily: daily,
        alerts: alerts,
        headsUp: json.headsUp || buildHeadsUpFromAlerts(alerts),
        favorites: Array.isArray(json.favorites) ? json.favorites : [],
        weather: {
          current: current,
          hourly: Array.isArray(hourly)
            ? {
                time: hourly.map(function (h) { return h.time || null; }),
                temperature_2m: hourly.map(function (h) { return h.temperature_2m; }),
                weather_code: hourly.map(function (h) { return h.weather_code; }),
                precipitation_probability: hourly.map(function (h) { return h.precipChance; })
              }
            : hourly,
          daily: daily
        }
      };
    } catch (_err) {
      const [rightNow, hourly, daily, alerts] = await Promise.all([
        getWeatherRightNow(lat, lon).catch(function () { return null; }),
        fetchWeather("hourly", lat, lon).catch(function () { return null; }),
        fetchWeather("daily", lat, lon).catch(function () { return null; }),
        fetchWeather("alerts", lat, lon).catch(function () { return null; })
      ]);
      if (!rightNow && !hourly && !daily && !alerts) throw new Error("bundle_unavailable");
      const current = rightNow ? rightNow.rightNow : null;
      const hourlyRows = normalizeHourly(hourly && (hourly.hourly || hourly.weather || hourly.data || hourly));
      const dailyObj = normalizeDailyShape(daily && (daily.daily || daily.daily7 || daily.days7 || (daily.weather && daily.weather.daily) || daily));
      const alertRows = alerts && Array.isArray(alerts.alerts) ? alerts.alerts : [];
      return {
        ok: true,
        source: "nws",
        location:
          (rightNow && rightNow.location) ||
          (hourly && hourly.location) ||
          (daily && daily.location) ||
          (alerts && alerts.location) ||
          { lat: Number(lat), lon: Number(lon) },
        rightNow: current,
        hourly: hourlyRows,
        daily7: dailyObj,
        daily: dailyObj,
        alerts: alertRows,
        headsUp: alerts && alerts.headsUp ? alerts.headsUp : buildHeadsUpFromAlerts(alertRows),
        favorites: [],
        weather: {
          current: current,
          hourly: {
            time: hourlyRows.map(function (h) { return h.time || null; }),
            temperature_2m: hourlyRows.map(function (h) { return h.temperature_2m; }),
            weather_code: hourlyRows.map(function (h) { return h.weather_code; }),
            precipitation_probability: hourlyRows.map(function (h) { return h.precipChance; })
          },
          daily: dailyObj
        }
      };
    }
  }

  async function fetchPublicWeather(lat, lon) {
    return getWeatherBundle(lat, lon);
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
