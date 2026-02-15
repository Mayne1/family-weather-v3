(function () {
  function normalizeHourly(data) {
    if (!data) return [];
    if (Array.isArray(data.hourly)) return data.hourly;
    if (data.hourly && Array.isArray(data.hourly.time)) {
      const temps = data.hourly.temperature_2m || [];
      const codes = data.hourly.weather_code || [];
      return data.hourly.time.map(function (t, i) {
        return { time: t, temperature_2m: temps[i], weather_code: codes[i] };
      });
    }
    if (Array.isArray(data.time) && Array.isArray(data.temperature_2m)) {
      return data.time.map(function (t, i) {
        return { time: t, temperature_2m: data.temperature_2m[i], weather_code: data.weather_code ? data.weather_code[i] : null };
      });
    }
    return [];
  }

  async function fetchBackendHourly(lat, lon) {
    const url = "/weather/hourly?lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon);
    const res = await fetch(url);
    if (!res.ok) throw new Error("backend_hourly_failed");
    const json = await res.json();
    return normalizeHourly(json.hourly || json.data || json);
  }

  async function fetchOpenMeteoHourly(lat, lon) {
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=" + encodeURIComponent(lat) +
      "&longitude=" + encodeURIComponent(lon) +
      "&hourly=temperature_2m,weather_code" +
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
