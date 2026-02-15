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

  function getCurrentWeatherCode() {
    try {
      const cacheRaw = localStorage.getItem(CACHE_KEY);
      if (!cacheRaw) return null;
      const cache = JSON.parse(cacheRaw);
      return cache && cache.weather && cache.weather.current ? cache.weather.current.weather_code : null;
    } catch (_err) {
      return null;
    }
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

  function weatherClassFromCode(code) {
    if (code == null) return "rn-wx--cloudy";
    if (code >= 95) return "rn-wx--thunder";
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "rn-wx--snow";
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rn-wx--rain";
    if (code >= 45 && code <= 48) return "rn-wx--wind";
    if (code === 0) return "rn-wx--clear";
    if (code === 1 || code === 2 || code === 3) return "rn-wx--cloudy";
    return "rn-wx--cloudy";
  }

  function rightNowSceneHtml() {
    return (
      '<div class="rn-scene" aria-hidden="true">' +
        '<div class="rn-layer rn-clouds"></div>' +
        '<div class="rn-layer rn-rain"><span></span><span></span><span></span><span></span></div>' +
        '<div class="rn-layer rn-snow"><span></span><span></span><span></span><span></span></div>' +
        '<div class="rn-layer rn-clear"></div>' +
        '<div class="rn-layer rn-thunder"></div>' +
        '<div class="rn-layer rn-wind"><span></span><span></span><span></span></div>' +
        '<svg class="rn-house" viewBox="0 0 120 120" role="img" aria-label="House">' +
          '<path d="M20 58 L60 26 L100 58" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path>' +
          '<rect x="30" y="58" width="60" height="42" rx="4" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.9)" stroke-width="4"></rect>' +
          '<rect x="54" y="74" width="12" height="26" rx="2" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.8)" stroke-width="2"></rect>' +
          '<rect x="40" y="69" width="10" height="10" rx="1" fill="rgba(255,255,255,0.25)"></rect>' +
          '<rect x="70" y="69" width="10" height="10" rx="1" fill="rgba(255,255,255,0.25)"></rect>' +
        '</svg>' +
      '</div>'
    );
  }

  function setRightNowScene(wxCodeOrCondition) {
    const card = document.getElementById("fw-rightnow");
    if (!card) return;
    if (!card.querySelector(".rn-scene")) {
      card.insertAdjacentHTML("beforeend", rightNowSceneHtml());
    }

    const classes = [
      "rn-wx--rain",
      "rn-wx--snow",
      "rn-wx--cloudy",
      "rn-wx--clear",
      "rn-wx--thunder",
      "rn-wx--wind"
    ];
    classes.forEach(function (c) { card.classList.remove(c); });

    let effectClass = "rn-wx--cloudy";
    if (typeof wxCodeOrCondition === "number") {
      effectClass = weatherClassFromCode(wxCodeOrCondition);
    } else if (typeof wxCodeOrCondition === "string" && wxCodeOrCondition.trim()) {
      const value = wxCodeOrCondition.trim().toLowerCase();
      if (value.indexOf("rain") >= 0) effectClass = "rn-wx--rain";
      else if (value.indexOf("snow") >= 0) effectClass = "rn-wx--snow";
      else if (value.indexOf("thunder") >= 0 || value.indexOf("storm") >= 0) effectClass = "rn-wx--thunder";
      else if (value.indexOf("wind") >= 0 || value.indexOf("tornado") >= 0 || value.indexOf("fog") >= 0) effectClass = "rn-wx--wind";
      else if (value.indexOf("clear") >= 0 || value.indexOf("sun") >= 0) effectClass = "rn-wx--clear";
      else effectClass = "rn-wx--cloudy";
    }

    card.classList.add(effectClass);
  }

  function initRightNowScene() {
    const card = document.getElementById("fw-rightnow");
    if (!card) return;

    const applyFromCache = function () {
      const code = getCurrentWeatherCode();
      if (typeof code === "number") setRightNowScene(code);
      else setRightNowScene("cloudy");
    };

    applyFromCache();

    const observer = new MutationObserver(function () {
      applyFromCache();
    });
    observer.observe(card, { childList: true, subtree: true });

    window.addEventListener("storage", function (evt) {
      if (!evt || evt.key === CACHE_KEY) applyFromCache();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initHourly();
    initRightNowScene();
  });
})();