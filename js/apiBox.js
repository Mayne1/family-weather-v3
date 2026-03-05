(function () {
  let weatherBackendUnavailable = false;
  let settingsApiUnauthorized = false;
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

  function normalizeHourly(data) {
    if (!data) return [];
    if (Array.isArray(data.hourly)) {
      return data.hourly.map(function (row) {
        return {
          time: row.time || row.ts || null,
          temperature_2m: row.temperature_2m != null ? row.temperature_2m : row.temp,
          weather_code: row.weather_code != null ? row.weather_code : row.code,
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
          weather_code: codes[i],
          precipChance: prec[i]
        };
      });
    }
    if (Array.isArray(data.time) && Array.isArray(data.temperature_2m)) {
      return data.time.map(function (t, i) {
        return {
          time: t,
          temperature_2m: data.temperature_2m[i],
          weather_code: data.weather_code ? data.weather_code[i] : null,
          precipChance: data.precipitation_probability ? data.precipitation_probability[i] : null
        };
      });
    }
    return [];
  }

  async function fetchWeather(path, lat, lon) {
    if (weatherBackendUnavailable) throw new Error("backend_weather_unavailable");
    const url =
      "/api/weather/" +
      path +
      "?lat=" +
      encodeURIComponent(lat) +
      "&lon=" +
      encodeURIComponent(lon);
    const res = await fetch(url);
    if (res.status === 404) {
      weatherBackendUnavailable = true;
      throw new Error("backend_weather_unavailable");
    }
    if (!res.ok) throw new Error("backend_weather_failed");
    return res.json();
  }

  async function getHourlyForecast(lat, lon) {
    try {
      const json = await fetchWeather("hourly", lat, lon);
      const rows = normalizeHourly(json.hourly || json.weather || json.data || json);
      return Array.isArray(rows) ? rows : [];
    } catch (_err) {
      return [];
    }
  }

  async function getWeatherRightNow(lat, lon) {
    return fetchWeather("rightnow", lat, lon);
  }

  async function getWeatherForecast(lat, lon) {
    const json = await fetchWeather("daily", lat, lon);
    if (json && !json.daily && json.daily7) json.daily = json.daily7;
    return json;
  }

  async function getWeatherAlerts(lat, lon) {
    return fetchWeather("alerts", lat, lon);
  }

  async function getWeatherBundle(lat, lon) {
    return fetchWeather("bundle", lat, lon);
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

  async function getIntelHint(lat, lon, dateIso, scenarioOverrides) {
    try {
      const target = INTEL_BASE_URL
        ? String(INTEL_BASE_URL).replace(/\/+$/, "") + "/api/intel/live"
        : null;
      const sameOriginTargets = [
        "/api/intel/hint?lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon),
        "/api/weather/intel/hint?lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon)
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
          const candidate = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal
          });
          if (candidate.ok) {
            res = candidate;
            break;
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
      if (!json || typeof json !== "object") return null;
      const hint = json.background_variant_hint || (json.data && json.data.background_variant_hint) || null;
      if (hint !== "severe" && hint !== "normal") return null;
      return hint;
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
    getHourlyForecast: getHourlyForecast,
    getWeatherRightNow: getWeatherRightNow,
    getWeatherForecast: getWeatherForecast,
    getWeatherAlerts: getWeatherAlerts,
    getWeatherBundle: getWeatherBundle,
    getGeocodeByZip: getGeocodeByZip,
    getAlmanacDay: getAlmanacDay,
    getIntelHint: getIntelHint,
    getSettings: getSettings,
    saveSettings: saveSettings,
    getApiKey: getApiKey
  };
})();
