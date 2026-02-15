(function () {
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
    const candidates = [
      "/api/weather/hourly?lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon),
      "/weather/hourly?lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon)
    ];
    let lastErr = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("backend_hourly_failed");
        const json = await res.json();
        const rows = normalizeHourly(json.hourly || json.data || json);
        if (rows && rows.length) return rows;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr) throw lastErr;
    throw new Error("backend_hourly_failed");
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
      if (rows && rows.length) return rows;
    } catch (_err) {
      // Fallback to Open-Meteo
    }
    const fallback = await fetchOpenMeteoHourly(lat, lon);
    return fallback || [];
  }

  window.apiBox = {
    getHourlyForecast: getHourlyForecast
  };
})();
