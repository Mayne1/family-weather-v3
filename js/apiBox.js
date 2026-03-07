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

  function toFiniteNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function toSafeTime(value, fallback) {
    if (value == null) return fallback;
    const str = String(value).trim();
    return str || fallback;
  }

  function normalizeWeatherCode(value) {
    const code = toFiniteNumber(value, 3);
    if (code >= 95) return 95;
    if ((code >= 80 && code <= 82) || (code >= 61 && code <= 67)) return 61;
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 71;
    if (code >= 51 && code <= 57) return 51;
    if (code >= 45 && code <= 48) return 45;
    if (code === 0) return 0;
    if (code === 1 || code === 2) return 2;
    return 3;
  }

  function ensureLocation(raw, lat, lon) {
    const loc = raw && typeof raw === "object" ? raw : {};
    return {
      lat: toFiniteNumber(loc.lat, toFiniteNumber(lat, 37.9577)),
      lon: toFiniteNumber(loc.lon, toFiniteNumber(lon, -121.2908)),
      label: String(loc.label || "Current Location")
    };
  }

  function normalizeHourly(raw) {
    const fallbackTime = new Date().toISOString();
    const out = {
      time: [],
      temperature_2m: [],
      weather_code: [],
      precipitation_probability: [],
      precipitation: [],
      rain: [],
      showers: [],
      snowfall: []
    };
    if (!raw) return out;

    if (raw.hourly && Array.isArray(raw.hourly.time)) raw = raw.hourly;

    if (Array.isArray(raw.time)) {
      const len = raw.time.length;
      for (let i = 0; i < len; i += 1) {
        out.time.push(toSafeTime(raw.time[i], fallbackTime));
        out.temperature_2m.push(
          toFiniteNumber(
            Array.isArray(raw.temperature_2m) ? raw.temperature_2m[i] : undefined,
            0
          )
        );
        out.weather_code.push(
          normalizeWeatherCode(
            Array.isArray(raw.weather_code)
              ? raw.weather_code[i]
              : Array.isArray(raw.code)
                ? raw.code[i]
                : undefined
          )
        );
        out.precipitation_probability.push(
          toFiniteNumber(
            Array.isArray(raw.precipitation_probability)
              ? raw.precipitation_probability[i]
              : Array.isArray(raw.pop)
                ? raw.pop[i]
                : Array.isArray(raw.precipChance)
                  ? raw.precipChance[i]
                  : undefined,
            0
          )
        );
        out.precipitation.push(
          toFiniteNumber(
            Array.isArray(raw.precipitation) ? raw.precipitation[i] : undefined,
            0
          )
        );
        out.rain.push(
          toFiniteNumber(
            Array.isArray(raw.rain) ? raw.rain[i] : undefined,
            0
          )
        );
        out.showers.push(
          toFiniteNumber(
            Array.isArray(raw.showers) ? raw.showers[i] : undefined,
            0
          )
        );
        out.snowfall.push(
          toFiniteNumber(
            Array.isArray(raw.snowfall) ? raw.snowfall[i] : undefined,
            0
          )
        );
      }
      return out;
    }

    const rows = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.hourly)
        ? raw.hourly
        : Array.isArray(raw.hours)
          ? raw.hours
          : null;
    if (!rows) return out;

    for (const row of rows) {
      const r = row && typeof row === "object" ? row : {};
      out.time.push(toSafeTime(r.time || r.startTime || r.ts, fallbackTime));
      out.temperature_2m.push(
        toFiniteNumber(
          r.temperature_2m != null ? r.temperature_2m : (r.tempF != null ? r.tempF : r.temp),
          0
        )
      );
      out.weather_code.push(normalizeWeatherCode(r.weather_code != null ? r.weather_code : (r.weatherCode != null ? r.weatherCode : r.code)));
      out.precipitation_probability.push(
        toFiniteNumber(
          r.precipitation_probability != null
            ? r.precipitation_probability
            : (r.precipChance != null ? r.precipChance : r.pop),
          0
        )
      );
      out.precipitation.push(toFiniteNumber(r.precipitation, 0));
      out.rain.push(toFiniteNumber(r.rain, 0));
      out.showers.push(toFiniteNumber(r.showers, 0));
      out.snowfall.push(toFiniteNumber(r.snowfall, 0));
    }
    return out;
  }

  function normalizeDailyShape(raw) {
    const out = {
      time: [],
      weather_code: [],
      temperature_2m_max: [],
      temperature_2m_min: [],
      precipitation_probability_max: [],
      wind_speed_10m_max: []
    };
    if (!raw) return out;

    if (raw.daily && Array.isArray(raw.daily.time)) raw = raw.daily;

    if (Array.isArray(raw.time)) {
      const len = raw.time.length;
      for (let i = 0; i < len; i += 1) {
        out.time.push(toSafeTime(raw.time[i], ""));
        out.weather_code.push(
          normalizeWeatherCode(
            Array.isArray(raw.weather_code)
              ? raw.weather_code[i]
              : Array.isArray(raw.code)
                ? raw.code[i]
                : undefined
          )
        );
        out.temperature_2m_max.push(
          toFiniteNumber(
            Array.isArray(raw.temperature_2m_max) ? raw.temperature_2m_max[i] : undefined,
            0
          )
        );
        out.temperature_2m_min.push(
          toFiniteNumber(
            Array.isArray(raw.temperature_2m_min) ? raw.temperature_2m_min[i] : undefined,
            0
          )
        );
        out.precipitation_probability_max.push(
          toFiniteNumber(
            Array.isArray(raw.precipitation_probability_max)
              ? raw.precipitation_probability_max[i]
              : Array.isArray(raw.pop)
                ? raw.pop[i]
                : Array.isArray(raw.precipChance)
                  ? raw.precipChance[i]
                  : undefined,
            0
          )
        );
        out.wind_speed_10m_max.push(
          toFiniteNumber(
            Array.isArray(raw.wind_speed_10m_max)
              ? raw.wind_speed_10m_max[i]
              : Array.isArray(raw.wind_mph)
                ? raw.wind_mph[i]
                : undefined,
            0
          )
        );
      }
      return out;
    }

    const rows = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.days)
        ? raw.days
        : Array.isArray(raw.daily7)
          ? raw.daily7
          : null;
    if (!rows) return out;

    for (const row of rows) {
      const r = row && typeof row === "object" ? row : {};
      out.time.push(toSafeTime(r.date || r.time, ""));
      out.weather_code.push(normalizeWeatherCode(r.weather_code != null ? r.weather_code : (r.weatherCode != null ? r.weatherCode : r.code)));
      out.temperature_2m_max.push(
        toFiniteNumber(
          r.temperature_2m_max != null ? r.temperature_2m_max : (r.tempMaxF != null ? r.tempMaxF : r.temp_max_f),
          0
        )
      );
      out.temperature_2m_min.push(
        toFiniteNumber(
          r.temperature_2m_min != null ? r.temperature_2m_min : (r.tempMinF != null ? r.tempMinF : r.temp_min_f),
          0
        )
      );
      out.precipitation_probability_max.push(
        toFiniteNumber(
          r.precipitation_probability_max != null ? r.precipitation_probability_max : (r.precipChance != null ? r.precipChance : r.pop),
          0
        )
      );
      out.wind_speed_10m_max.push(
        toFiniteNumber(
          r.wind_speed_10m_max != null ? r.wind_speed_10m_max : (r.windMaxMph != null ? r.windMaxMph : r.wind_mph),
          0
        )
      );
    }
    return out;
  }

  function normalizeCurrentShape(raw, hourlyShape) {
    const nowIso = new Date().toISOString();
    const r = raw && typeof raw === "object" ? raw : {};
    const firstHourTemp =
      hourlyShape && Array.isArray(hourlyShape.temperature_2m) && hourlyShape.temperature_2m.length
        ? hourlyShape.temperature_2m[0]
        : 0;
    const firstHourCode =
      hourlyShape && Array.isArray(hourlyShape.weather_code) && hourlyShape.weather_code.length
        ? hourlyShape.weather_code[0]
        : 3;
    const firstHourTime =
      hourlyShape && Array.isArray(hourlyShape.time) && hourlyShape.time.length
        ? hourlyShape.time[0]
        : nowIso;

    return {
      time: toSafeTime(r.time || r.ts || r.startTime, firstHourTime || nowIso),
      temperature_2m: toFiniteNumber(
        r.temperature_2m != null ? r.temperature_2m : (r.tempF != null ? r.tempF : r.temp),
        firstHourTemp
      ),
      apparent_temperature: toFiniteNumber(
        r.apparent_temperature != null ? r.apparent_temperature : (r.feelsLikeF != null ? r.feelsLikeF : r.feels_like_f),
        toFiniteNumber(r.temperature_2m != null ? r.temperature_2m : (r.tempF != null ? r.tempF : r.temp), firstHourTemp)
      ),
      relative_humidity_2m: toFiniteNumber(
        r.relative_humidity_2m != null ? r.relative_humidity_2m : (r.humidityPct != null ? r.humidityPct : r.humidity_pct),
        0
      ),
      wind_speed_10m: toFiniteNumber(
        r.wind_speed_10m != null ? r.wind_speed_10m : (r.windMph != null ? r.windMph : r.wind_mph),
        0
      ),
      wind_direction_10m: toFiniteNumber(
        r.wind_direction_10m != null ? r.wind_direction_10m : (r.windDir != null ? r.windDir : r.wind_deg),
        0
      ),
      weather_code: normalizeWeatherCode(
        r.weather_code != null
          ? r.weather_code
          : (r.weatherCode != null ? r.weatherCode : (r.code != null ? r.code : firstHourCode))
      ),
      precipitation: toFiniteNumber(r.precipitation, 0),
      rain: toFiniteNumber(r.rain, 0),
      showers: toFiniteNumber(r.showers, 0),
      snowfall: toFiniteNumber(r.snowfall, 0)
    };
  }

  function normalizeAlerts(raw) {
    return Array.isArray(raw) ? raw : [];
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

  function ensureHeadsUp(raw, alerts) {
    if (raw && typeof raw === "object") {
      const top = Array.isArray(raw.top) ? raw.top : [];
      return {
        count: toFiniteNumber(raw.count, top.length),
        top: top,
        hasSevere: typeof raw.hasSevere === "boolean"
          ? raw.hasSevere
          : top.some(function (a) { return severityRank(a && a.severity) >= 4; })
      };
    }
    return buildHeadsUpFromAlerts(alerts);
  }

  function hourlyShapeToRows(shape) {
    const len = Array.isArray(shape.time) ? shape.time.length : 0;
    const rows = [];
    for (let i = 0; i < len; i += 1) {
      rows.push({
        time: shape.time[i],
        temperature_2m: toFiniteNumber(shape.temperature_2m[i], 0),
        weather_code: normalizeWeatherCode(shape.weather_code[i]),
        precipChance: toFiniteNumber(shape.precipitation_probability[i], 0)
      });
    }
    return rows;
  }

  function normalizeBundleContract(rawBundle, lat, lon, sourceLabel) {
    const json = rawBundle && typeof rawBundle === "object" ? rawBundle : {};
    const location = ensureLocation(json.location, lat, lon);
    const hourly = normalizeHourly(
      (json.weather && json.weather.hourly) ||
      json.hourly ||
      json.hours ||
      json.data
    );
    const daily = normalizeDailyShape(
      (json.weather && json.weather.daily) ||
      json.daily ||
      json.forecast ||
      json.daily7 ||
      json.days7
    );
    const current = normalizeCurrentShape(
      (json.weather && json.weather.current) || json.rightNow || json.current,
      hourly
    );
    const alerts = normalizeAlerts(json.alerts);
    const headsUp = ensureHeadsUp(json.headsUp, alerts);

    if (!Array.isArray(hourly.time) || !Array.isArray(daily.time)) {
      throw new Error("normalize_bundle_invalid_arrays");
    }
    if (!current || typeof current !== "object") {
      throw new Error("normalize_bundle_missing_current");
    }
    if (!hourly.time.length && !daily.time.length) {
      throw new Error("normalize_bundle_missing_hourly_and_daily");
    }

    return {
      ok: true,
      source: sourceLabel || "nws",
      location: location,
      weather: {
        current: current,
        hourly: hourly,
        daily: daily
      },
      alerts: alerts,
      headsUp: headsUp
    };
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

    let lastError = null;
    for (const base of bases) {
      const url =
        base +
        "/" +
        path +
        "?lat=" +
        encodeURIComponent(lat) +
        "&lon=" +
        encodeURIComponent(lon);
      try {
        const res = await fetch(url);
        if (res.ok) {
          weatherBasePath = base;
          return res.json();
        }
        if (res.status === 404 || res.status >= 500) {
          lastError = new Error("backend_weather_http_" + res.status);
          continue;
        }
        throw new Error("backend_weather_http_" + res.status);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("backend_weather_request_failed");
        continue;
      }
    }
    throw new Error(
      "backend_weather_unavailable_" +
      path +
      (lastError && lastError.message ? "_" + lastError.message : "")
    );
  }

  async function getHourlyForecast(lat, lon) {
    try {
      const json = await fetchWeather("forecast10", lat, lon);
      const shape = normalizeHourly(
        (json && json.hourly) ||
        (json && json.weather && json.weather.hourly) ||
        json
      );
      if (!shape.time.length) throw new Error("normalize_hourly_empty");
      return hourlyShapeToRows(shape);
    } catch (_err) {
      const bundle = await getWeatherBundle(lat, lon);
      return hourlyShapeToRows(bundle.weather.hourly);
    }
  }

  async function getWeatherRightNow(lat, lon) {
    const json = await fetchWeather("current", lat, lon);
    const current = normalizeCurrentShape(
      (json && json.rightNow) ||
      (json && json.current) ||
      (json && json.weather && json.weather.current),
      normalizeHourly((json && json.hourly) || (json && json.weather && json.weather.hourly))
    );
    return {
      ok: true,
      source: "nws",
      location: ensureLocation(json && json.location, lat, lon),
      rightNow: current,
      weather: { current: current }
    };
  }

  async function getWeatherForecast(lat, lon) {
    const json = await fetchWeather("forecast10", lat, lon);
    const daily = normalizeDailyShape(
      (json && json.daily) ||
      (json && json.forecast) ||
      (json && json.daily7) ||
      (json && json.days7) ||
      (json && json.weather && json.weather.daily) ||
      json
    );
    return {
      ok: true,
      source: "nws",
      location: ensureLocation(json && json.location, lat, lon),
      daily7: daily,
      daily: daily,
      weather: { daily: daily }
    };
  }

  async function getWeatherAlerts(lat, lon) {
    const json = await fetchWeather("alerts", lat, lon);
    const alerts = normalizeAlerts(json && json.alerts);
    return {
      ok: true,
      source: "nws",
      location: ensureLocation(json && json.location, lat, lon),
      alerts: alerts,
      headsUp: ensureHeadsUp(json && json.headsUp, alerts)
    };
  }

  async function getWeatherBundle(lat, lon) {
    const [currentJson, forecastJson] = await Promise.all([
      fetchWeather("current", lat, lon),
      fetchWeather("forecast10", lat, lon)
    ]);

    const location =
      (currentJson && currentJson.location) ||
      (forecastJson && forecastJson.location) ||
      { lat: lat, lon: lon };
    const current =
      (currentJson && (currentJson.rightNow || currentJson.current)) ||
      (currentJson && currentJson.weather && currentJson.weather.current) ||
      null;

    const bundle = {
      location: location,
      current: current,
      forecast: forecastJson || null,
      alerts: [],
      headsUp: { count: 0, top: [] }
    };

    return normalizeBundleContract(bundle, lat, lon, "nws-composed");
  }

  async function fetchPublicWeather(lat, lon) {
    return getWeatherBundle(lat, lon);
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
    try {
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
          const candidate = await fetch(url, { signal: controller.signal });
          if (candidate.ok) {
            res = candidate;
            break;
          }
          if (candidate.status === 404) {
            const legacy = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: controller.signal
            });
            if (legacy.ok || legacy.status !== 404) {
              res = legacy;
              break;
            }
          } else {
            res = candidate;
            break;
          }
        }
      }
      if (!res || !res.ok) return null;
      const json = await res.json();
      const normalized = parseIntelHintResponse(json);
      return normalized && normalized.ok ? normalized : null;
    } catch (_err) {
      return null;
    } finally {
      clearTimeout(timeout);
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
    normalizeHourly: normalizeHourly,
    normalizeCurrentShape: normalizeCurrentShape,
    normalizeDailyShape: normalizeDailyShape,
    getGeocodeByZip: getGeocodeByZip,
    getAlmanacDay: getAlmanacDay,
    getIntelHint: getIntelHint,
    getSettings: getSettings,
    saveSettings: saveSettings,
    getApiKey: getApiKey
  };
})();
