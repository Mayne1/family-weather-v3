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
      const current = cache && cache.weather && cache.weather.current ? cache.weather.current : null;
      if (!current) return null;
      const base = Number(current.weather_code);
      const precipitation = Number(current.precipitation);
      const rain = Number(current.rain) + Number(current.showers);
      const snowfall = Number(current.snowfall);
      if (Number.isFinite(snowfall) && snowfall >= 0.01) return 71;
      if ((Number.isFinite(rain) && rain >= 0.01) || (Number.isFinite(precipitation) && precipitation >= 0.05)) return 61;
      return Number.isFinite(base) ? base : null;
    } catch (_err) {
      return null;
    }
  }

  function resolveIcon(code) {
    if (code === 0) return "images/mgc-weather-icons-pack-v12/01_sun_fill.svg";
    if (code === 1 || code === 2) return "images/mgc-weather-icons-pack-v12/04_sun_cloudy_fill.svg";
    if (code === 3) return "images/mgc-weather-icons-pack-v12/06_clouds_fill.svg";
    if (code >= 45 && code <= 48) return "images/mgc-weather-icons-pack-v12/15_fog_fill.svg";
    if (code >= 51 && code <= 57) return "images/mgc-weather-icons-pack-v12/09_drizzle_fill.svg";
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "images/mgc-weather-icons-pack-v12/10_showers_fill.svg";
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "images/mgc-weather-icons-pack-v12/18_moderate_snow_fill.svg";
    if (code >= 95) return "images/mgc-weather-icons-pack-v12/14_thunderstorm_fill.svg";
    return "images/mgc-weather-icons-pack-v12/06_clouds_fill.svg";
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
      const precip = row.precipChance != null ? Math.round(row.precipChance) + "%" : "-";
      return (
        '<div class="hour-chip">' +
          '<div class="hour-label">' + label + "</div>" +
          '<img class="hour-icon" src="' + icon + '" alt="Weather icon">' +
          '<div class="hour-temp">' + temp + '&deg;F</div>' +
          '<div class="hour-precip">' + precip + '</div>' +
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

  function sceneClassFromCode(code) {
    if (code == null) return "rn-scene--cloudy";
    if (code >= 95) return "rn-scene--storm";
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "rn-scene--snow";
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rn-scene--rain";
    if (code >= 45 && code <= 48) return "rn-scene--fog";
    if (code === 0) return "rn-scene--clear";
    return "rn-scene--cloudy";
  }

  function FW_applyThemeVars() {
    try {
      const root = document.documentElement;
      if (!root) return;

      let hero = "";
      let text = "";
      let overlay = "";

      const rawSettings = localStorage.getItem("fw_settings");
      if (rawSettings) {
        const settings = JSON.parse(rawSettings);
        if (settings && typeof settings === "object") {
          hero = String(settings.heroBoxColor || "").trim();
          text = String(settings.fontColor || "").trim();
        }
      }

      if (!hero) {
        hero = localStorage.getItem("fw_hero_box_color") || localStorage.getItem("fw_hero_bg") || "";
      }
      if (!overlay) {
        overlay = localStorage.getItem("fw_overlay") || "";
      }
      if (!text) {
        text = localStorage.getItem("fw_global_font_color") || localStorage.getItem("fw_font_color") || "";
      }

      const heroColor = hero || "#1b2942";
      root.style.setProperty("--fw-hero-bg", heroColor);
      root.style.setProperty("--fw-hero-box-color", heroColor);
      root.style.setProperty("--fw-card-bg", heroColor);
      if (overlay) root.style.setProperty("--fw-overlay", overlay);
      if (text) {
        root.style.setProperty("--fw-hero-text", text);
        root.style.setProperty("--fw-font-color", text);
      }
    } catch (_err) {
      // ignore
    }
  }

  function setRightNowScene(wxCodeOrCondition) {
    const scene = document.querySelector("#fw-rightnow .rn-scene");
    if (!scene) return;

    const classes = [
      "rn-scene--rain",
      "rn-scene--snow",
      "rn-scene--cloudy",
      "rn-scene--clear",
      "rn-scene--storm",
      "rn-scene--fog"
    ];
    classes.forEach(function (c) { scene.classList.remove(c); });

    if (typeof wxCodeOrCondition === "number") {
      scene.classList.add(sceneClassFromCode(wxCodeOrCondition));
      return;
    }

    const value = String(wxCodeOrCondition || "").toLowerCase();
    if (value.indexOf("rain") >= 0) scene.classList.add("rn-scene--rain");
    else if (value.indexOf("snow") >= 0) scene.classList.add("rn-scene--snow");
    else if (value.indexOf("storm") >= 0 || value.indexOf("thunder") >= 0) scene.classList.add("rn-scene--storm");
    else if (value.indexOf("fog") >= 0) scene.classList.add("rn-scene--fog");
    else if (value.indexOf("clear") >= 0 || value.indexOf("sun") >= 0) scene.classList.add("rn-scene--clear");
    else scene.classList.add("rn-scene--cloudy");
  }

  async function initHourlyAndScene() {
    const rightNow = document.getElementById("fw-rightnow");
    let hourlyLoaded = false;
    let hourlyLoading = false;
    const tryRender = async function () {
      const hourlyHost = document.getElementById("fw-hourly-row");
      if (!hourlyHost || !window.apiBox || typeof window.apiBox.getHourlyForecast !== "function") return;
      if (!hourlyLoaded && !hourlyLoading) {
        hourlyLoading = true;
        hourlyHost.innerHTML = '<div class="small text-muted">Loading hourly forecast...</div>';
        try {
          const loc = await getLocation();
          const rows = await window.apiBox.getHourlyForecast(loc.lat, loc.lon);
          renderHourlyForecast(rows);
          hourlyLoaded = true;
        } catch (_err) {
          hourlyHost.innerHTML = '<div class="small text-muted">Hourly forecast unavailable</div>';
        } finally {
          hourlyLoading = false;
        }
      }

      const code = getCurrentWeatherCode();
      if (typeof code === "number") setRightNowScene(code);
      else setRightNowScene("cloudy");
    };

    await tryRender();

    if (rightNow) {
      const observer = new MutationObserver(function () {
        hourlyLoaded = false;
        tryRender();
      });
      observer.observe(rightNow, { childList: true });
    }

    window.addEventListener("storage", function (evt) {
      if (!evt || evt.key === CACHE_KEY) {
        const code = getCurrentWeatherCode();
        setRightNowScene(typeof code === "number" ? code : "cloudy");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    FW_applyThemeVars();
    initHourlyAndScene();
  });

  window.addEventListener("storage", FW_applyThemeVars);
})();
