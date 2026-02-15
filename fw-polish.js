(function () {
  const CACHE_KEY = "fw_weather_cache";
  const LOC_KEY = "fw_weather_loc";
  const FAV_PRIMARY_KEY = "fw_favorites_v1";
  const FAV_FALLBACK_KEY = "fw_fab5";
  const FAV_CACHE_KEY = "fw_fav_cache_v1";
  const FAV_CACHE_TTL = 10 * 60 * 1000;

  function safeParse(raw, fallback) {
    try {
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (_err) {
      return fallback;
    }
  }

  function dayOverlayColor() {
    const colors = [
      "rgba(105, 153, 255, 0.08)",
      "rgba(104, 188, 255, 0.08)",
      "rgba(95, 210, 196, 0.08)",
      "rgba(118, 205, 130, 0.08)",
      "rgba(241, 187, 86, 0.08)",
      "rgba(226, 149, 106, 0.08)",
      "rgba(170, 145, 230, 0.08)"
    ];
    return colors[new Date().getDay() % colors.length];
  }

  function ensureDailyOverlay() {
    if (document.getElementById("fw-day-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "fw-day-overlay";
    document.body.prepend(overlay);
    document.documentElement.style.setProperty("--fw-day-overlay", dayOverlayColor());
  }

  function iconForCode(code) {
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

  function activeLocation() {
    const c = safeParse(localStorage.getItem(CACHE_KEY), null);
    if (c && c.location && Number.isFinite(c.location.lat) && Number.isFinite(c.location.lon)) {
      return c.location;
    }
    const loc = safeParse(localStorage.getItem(LOC_KEY), null);
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon)) return loc;
    return { lat: 37.9577, lon: -121.2908, label: "Stockton, CA" };
  }

  function ensureHourlyCard() {
    const weatherSection = document.getElementById("section-weather");
    if (!weatherSection || document.getElementById("fw-hourly-polish")) return;
    const container = weatherSection.querySelector(".container");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "row g-4 mt-1";
    row.innerHTML = [
      '<div class="col-lg-12">',
      '  <div id="fw-hourly-polish" class="bg-dark-2 rounded-1 p-30 h-100 fw-hourly-card">',
      '    <div class="subtitle">Hourly Forecast</div>',
      '    <div id="fw-hourly-polish-row" class="fw-hourly-row" aria-live="polite">Hourly forecast not connected yet</div>',
      '  </div>',
      '</div>'
    ].join("");
    container.appendChild(row);
  }

  function formatHour(value, idx, nowMs) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    if (idx === 0 && Math.abs(d.getTime() - nowMs) <= 90 * 60 * 1000) return "Now";
    return d.toLocaleTimeString([], { hour: "numeric" });
  }

  function normalizeHourlyRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(function (r) {
      return {
        time: r.time || r.ts || null,
        temp: r.temperature_2m != null ? r.temperature_2m : r.temp,
        code: r.weather_code != null ? r.weather_code : r.code
      };
    }).filter(function (r) {
      return r && r.time;
    });
  }

  async function renderHourlyCard() {
    const host = document.getElementById("fw-hourly-polish-row");
    if (!host) return;
    if (!window.apiBox || typeof window.apiBox.getHourlyForecast !== "function") {
      host.innerHTML = '<div class="small text-muted">Hourly forecast not connected yet</div>';
      return;
    }

    host.innerHTML = '<div class="small text-muted">Loading hourly forecast...</div>';
    try {
      const loc = activeLocation();
      const rowsRaw = await window.apiBox.getHourlyForecast(loc.lat, loc.lon);
      const allRows = normalizeHourlyRows(rowsRaw);
      const nowMs = Date.now();
      let startIdx = allRows.findIndex(function (row) {
        const t = Date.parse(row.time);
        return Number.isFinite(t) && t >= nowMs - (30 * 60 * 1000);
      });
      if (startIdx < 0) startIdx = Math.max(0, allRows.length - 18);
      const rows = allRows.slice(startIdx, startIdx + 18);
      if (!rows.length) {
        host.innerHTML = '<div class="small text-muted">Hourly forecast not connected yet</div>';
        return;
      }
      host.innerHTML = rows.map(function (row, idx) {
        const temp = row.temp != null ? Math.round(row.temp) + "&deg;F" : "--";
        return [
          '<div class="fw-hourly-tile">',
          '  <div class="fw-hourly-time">' + formatHour(row.time, idx, nowMs) + '</div>',
          '  <div class="fw-hourly-icon"><img src="' + iconForCode(row.code) + '" alt=""></div>',
          '  <div class="fw-hourly-temp">' + temp + '</div>',
          '</div>'
        ].join("");
      }).join("");
    } catch (_err) {
      host.innerHTML = '<div class="small text-muted">Hourly forecast not connected yet</div>';
    }
  }

  function loadFavorites() {
    const primary = safeParse(localStorage.getItem(FAV_PRIMARY_KEY), null);
    if (Array.isArray(primary) && primary.length) return primary.slice(0, 5);

    const fallback = safeParse(localStorage.getItem(FAV_FALLBACK_KEY), null);
    if (Array.isArray(fallback) && fallback.length) return fallback.slice(0, 5);

    if (!localStorage.getItem(FAV_FALLBACK_KEY)) {
      localStorage.setItem(FAV_FALLBACK_KEY, JSON.stringify([]));
    }
    return [];
  }

  function loadFavCache() {
    return safeParse(localStorage.getItem(FAV_CACHE_KEY), {});
  }

  function saveFavCache(cache) {
    localStorage.setItem(FAV_CACHE_KEY, JSON.stringify(cache || {}));
  }

  async function fetchFavCurrent(lat, lon) {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + encodeURIComponent(lat) +
      "&longitude=" + encodeURIComponent(lon) +
      "&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto";
    const res = await fetch(url);
    if (!res.ok) throw new Error("fav_fetch_failed");
    const json = await res.json();
    const c = json && json.current;
    if (!c) throw new Error("fav_missing");
    return { temp: Math.round(c.temperature_2m), code: c.weather_code, ts: Date.now() };
  }

  async function mapLimit(items, limit, iterator) {
    const output = new Array(items.length);
    let next = 0;
    async function worker() {
      while (next < items.length) {
        const i = next;
        next += 1;
        output[i] = await iterator(items[i], i);
      }
    }
    const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }).map(worker);
    await Promise.all(workers);
    return output;
  }

  function normalizeFavRow(row) {
    const lat = Number(row && row.lat);
    const lon = Number(row && row.lon);
    return {
      id: String((row && row.id) || ""),
      label: String((row && row.label) || (row && row.query) || "").trim(),
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null
    };
  }

  async function renderFabFive() {
    const strip = document.getElementById("fw-favorites-strip");
    if (!strip) return;
    strip.classList.add("fw-fab5-vertical");

    const favs = loadFavorites().map(normalizeFavRow).filter(function (f) {
      return f.label && Number.isFinite(f.lat) && Number.isFinite(f.lon);
    }).slice(0, 5);

    if (!favs.length) {
      strip.innerHTML = '<div class="small text-muted">No favorites yet. Manage them in Settings.</div>';
      return;
    }

    const cache = loadFavCache();
    const now = Date.now();

    const rows = await mapLimit(favs, 2, async function (fav) {
      const key = fav.id || (fav.lat + "," + fav.lon);
      const cached = cache[key];
      if (cached && cached.ts && now - cached.ts < FAV_CACHE_TTL) {
        return { ...fav, wx: cached };
      }
      try {
        const wx = await fetchFavCurrent(fav.lat, fav.lon);
        cache[key] = wx;
        return { ...fav, wx: wx };
      } catch (_err) {
        return { ...fav, wx: null };
      }
    });
    saveFavCache(cache);

    strip.innerHTML = rows.map(function (row) {
      const code = row.wx && row.wx.code != null ? row.wx.code : 3;
      const temp = row.wx && row.wx.temp != null ? row.wx.temp + "&deg;F" : "--";
      return [
        '<button type="button" class="fw-fab5-row" data-fab5-id="' + row.id + '">',
        '  <span class="fw-fab5-label">' + row.label + '</span>',
        '  <span><img src="' + iconForCode(code) + '" alt="" width="20" height="20"></span>',
        '  <span class="fw-fab5-temp">' + temp + '</span>',
        '  <span class="fw-fab5-updated">updated</span>',
        '</button>'
      ].join("");
    }).join("");

    strip.querySelectorAll(".fw-fab5-row").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-fab5-id");
        const chosen = rows.find(function (r) { return r.id === id; });
        if (!chosen) return;
        localStorage.setItem(LOC_KEY, JSON.stringify({ lat: chosen.lat, lon: chosen.lon, label: chosen.label }));
        localStorage.removeItem(CACHE_KEY);
        window.location.reload();
      });
    });
  }

  function polishDiorama() {
    const scene = document.querySelector("#fw-rightnow .rn-scene");
    if (!scene) return;
    scene.classList.add("fw-scene-upgraded");
  }

  function initHome() {
    ensureHourlyCard();
    renderHourlyCard();
    polishDiorama();
    renderFabFive();
    // Run a couple of delayed passes after legacy widgets finish rendering.
    setTimeout(renderFabFive, 500);
    setTimeout(renderFabFive, 1500);

    window.addEventListener("storage", function (evt) {
      if (!evt) return;
      if (evt.key === FAV_PRIMARY_KEY || evt.key === FAV_FALLBACK_KEY || evt.key === CACHE_KEY || evt.key === LOC_KEY) {
        renderFabFive();
        renderHourlyCard();
      }
    });

    window.addEventListener("fw:favorites", function () {
      renderFabFive();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    ensureDailyOverlay();
    const isHome = !!document.getElementById("fw-rightnow") && !!document.getElementById("fw-forecast");
    if (isHome) initHome();
  });
})();
