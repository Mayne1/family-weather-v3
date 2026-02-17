(function () {
  let weatherBackendUnavailable = false;
  let settingsApiUnauthorized = false;

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

  async function fetchBackendHourly(lat, lon) {
    if (weatherBackendUnavailable) throw new Error("backend_hourly_unavailable");
    const url = "/api/weather/hourly?lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon);
    const res = await fetch(url);
    if (res.status === 404) {
      weatherBackendUnavailable = true;
      return [];
    }
    if (!res.ok) throw new Error("backend_hourly_failed");
    const json = await res.json();
    const rows = normalizeHourly(json.hourly || json.data || json);
    return rows || [];
  }

  async function fetchOpenMeteoHourly(lat, lon) {
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=" + encodeURIComponent(lat) +
      "&longitude=" + encodeURIComponent(lon) +
      "&hourly=temperature_2m,weather_code" +
      ",precipitation_probability" +
      "&temperature_unit=fahrenheit" +
      "&timezone=auto";
    const res = await fetch(url);
    if (!res.ok) throw new Error("fallback_hourly_failed");
    const json = await res.json();
    return normalizeHourly(json.hourly || json);
  }

  async function getHourlyForecast(lat, lon) {
    try {
      const rows = await fetchBackendHourly(lat, lon);
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      if (err && err.message === "backend_hourly_unavailable") return [];
    }
    return [];
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
    getSettings: getSettings,
    saveSettings: saveSettings,
    getApiKey: getApiKey
  };
})();
