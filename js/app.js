(function () {
  const CACHE_KEY = "fw_weather_cache";
  const LOC_KEY = "fw_weather_loc";
  const FALLBACK = { lat: 37.9577, lon: -121.2908 };

  function getStoredLocation() {
    try {
      const cacheRaw = localStorage.getItem(CACHE_KEY);
      if (cacheRaw) {
        const cache = JSON.parse(cacheRaw);
        if (cache && cache.location && typeof cache.location.lat === "number" && typeof cache.location.lon === "number") {
          return { lat: cache.location.lat, lon: cache.location.lon };
        }
      }
      const locRaw = localStorage.getItem(LOC_KEY);
      if (locRaw) {
        const loc = JSON.parse(locRaw);
        if (loc && typeof loc.lat === "number" && typeof loc.lon === "number") {
          return { lat: loc.lat, lon: loc.lon };
        }
      }
    } catch (_err) {
      // ignore parse errors
    }
    return null;
  }

  function resolveIcon(code) {
    if (code === 0) return "images/fw-icons/sun.svg";
    if (code === 1 || code === 2) return "images/fw-icons/partly-cloudy.svg";
    if (code === 3) return "images/fw-icons/cloudy.svg";
    if (code >= 45 && code <= 48) return "images/fw-icons/fog.svg";
    if (code >= 51 && code <= 67) return "images/fw-icons/rain.svg";
    if (code >= 71 && code <= 86) return "images/fw-icons/snow.svg";
    if (code >= 95) return "images/fw-icons/thunderstorm.svg";
    return "images/fw-icons/cloudy.svg";
  }

  function hourLabel(timeValue, idx) {
    if (!timeValue) return idx === 0 ? "Now" : "-";
    const d = new Date(timeValue);
    if (Number.isNaN(d.getTime())) return idx === 0 ? "Now" : "-";
    if (idx === 0) return "Now";
    return d.toLocaleTimeString([], { hour: "numeric" });
  }

  function renderHourlyForecast(rows) {
    const host = document.getElementById("fw-hourly-row");
    if (!host) return;
    if (!rows || !rows.length) {
      host.innerHTML = '<div class="small text-muted">Hourly forecast unavailable</div>';
      return;
    }
    const first12 = rows.slice(0, 12);
    host.innerHTML = first12.map(function (row, idx) {
      const label = hourLabel(row.time, idx);
      const temp = row.temperature_2m != null ? Math.round(row.temperature_2m) : "-";
      const icon = resolveIcon(row.weather_code);
      return (
        '<div class="hour-chip">' +
          '<div class="hour-label">' + label + "</div>" +
          '<img class="hour-icon" src="' + icon + '" alt="Weather icon">' +
          '<div class="hour-temp">' + temp + '&deg;F</div>' +
        "</div>"
      );
    }).join("");
  }

  function getLocation() {
    const saved = getStoredLocation();
    if (saved) return Promise.resolve(saved);
    return new Promise(function (resolve) {
      if (!navigator.geolocation) {
        resolve(FALLBACK);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        function () {
          resolve(FALLBACK);
        },
        { timeout: 6000 }
      );
    });
  }

  async function initHourly() {
    const host = document.getElementById("fw-hourly-row");
    if (!host || !window.apiBox || typeof window.apiBox.getHourlyForecast !== "function") return;
    host.innerHTML = '<div class="small text-muted">Loading hourly forecast...</div>';
    try {
      const loc = await getLocation();
      const rows = await window.apiBox.getHourlyForecast(loc.lat, loc.lon);
      renderHourlyForecast(rows);
    } catch (_err) {
      host.innerHTML = '<div class="small text-muted">Hourly forecast unavailable</div>';
    }
  }

  document.addEventListener("DOMContentLoaded", initHourly);
})();
