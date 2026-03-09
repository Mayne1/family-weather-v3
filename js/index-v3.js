console.log("V3 JS LOADED MARKER 01");
console.log("FW MARKER: js/index-v3.js loaded");

const LOC_KEY = "fw_weather_loc";
const FAV_KEY = "fw_favorites_v1";
const WEATHER_ACTIVITY_KEY = "fw_weather_activity";
let v3AdapterRef = null;

function weatherLabel(code) {
  const adapter = window.V3WeatherAdapter;
  if (adapter && typeof adapter.weatherLabel === "function") return adapter.weatherLabel(code);
  return "Cloudy";
}

function bgCode(code) {
  const n = Number(code);
  if (!Number.isFinite(n)) return "800";
  if (n >= 95) return "200";
  if ((n >= 71 && n <= 77) || n === 85 || n === 86) return "600";
  if ((n >= 51 && n <= 57) || (n >= 61 && n <= 67) || (n >= 80 && n <= 82)) return "500";
  if (n >= 45 && n <= 48) return "700";
  return "800";
}

function timeVariant() {
  const h = new Date().getHours();
  if (h < 11) return "morning";
  if (h < 18) return "noon";
  return "night";
}

function toCardinal(deg) {
  const d = Number(deg);
  if (!Number.isFinite(d)) return "--";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round((d % 360) / 45) % 8];
}

function applyBackground(code, hasSevere) {
  const variant = hasSevere ? "severe" : timeVariant();
  const path = `/images/out-bg-nature/${bgCode(code)}/${variant}.png`;
  const img = new Image();
  img.onload = () => {
    const el = document.getElementById("v3-bg");
    if (el) el.style.backgroundImage = `url('${path}')`;
  };
  img.src = path;
}

function fmtHour(iso, index) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return index === 0 ? "Now" : "--";
  if (index === 0) return "Now";
  return d.toLocaleTimeString([], { hour: "numeric" });
}

function fmtDay(dateIso) {
  const d = new Date(dateIso);
  if (!Number.isFinite(d.getTime())) return "--";
  return d.toLocaleDateString([], { weekday: "short" });
}

function fmtNowDateTime(isoLike) {
  const d = new Date(isoLike || Date.now());
  if (!Number.isFinite(d.getTime())) return "Today · --";
  const weekday = d.toLocaleDateString([], { weekday: "long" });
  const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${weekday}, ${date} · ${time}`;
}

function computeNowSummary(current, precipChance) {
  const temp = Number(current.tempF);
  const wind = Number(current.windMph);
  const pop = Number(precipChance);
  const mild = Number.isFinite(temp) && temp >= 60 && temp <= 80;
  const lowWind = Number.isFinite(wind) && wind < 12;
  const lowPop = Number.isFinite(pop) && pop <= 20;

  if (mild && lowWind && lowPop) return "Comfortable weather for family plans and quick outdoor events.";
  if (Number.isFinite(pop) && pop > 45) return "Rain risk is elevated, so keep indoor backups in mind.";
  if (Number.isFinite(wind) && wind >= 18) return "Breezy conditions may affect outdoor setup and comfort.";
  return "Conditions are manageable with light planning around timing.";
}

function renderNow(payload) {
  const current = payload.current || {};
  const precipChance = Array.isArray(payload.hourly) && payload.hourly[0] ? Math.round(payload.hourly[0].pop || 0) : 0;

  document.getElementById("v3-location").textContent = payload.location?.label || "Current Location";
  document.getElementById("v3-updated").textContent = `Updated ${new Date(current.time || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  document.getElementById("v3-now-datetime").textContent = fmtNowDateTime(current.time);
  document.getElementById("v3-now-temp").textContent = `${Math.round(current.tempF)}\u00B0F`;
  document.getElementById("v3-now-label").textContent = current.label || weatherLabel(current.weatherCode);

  const feels = current.feelsLikeF != null ? `${Math.round(current.feelsLikeF)}\u00B0` : "--";
  const hum = current.humidityPct != null ? `${Math.round(current.humidityPct)}%` : "--";
  const windMph = current.windMph != null ? `${Math.round(current.windMph)} mph` : "--";
  const windDir = current.windDir != null ? toCardinal(current.windDir) : "--";
  document.getElementById("v3-now-meta").textContent = `Feels ${feels}, humidity ${hum}, wind ${windMph} ${windDir}`;

  const aqi = payload.aqi;
  const aqiText = aqi && typeof aqi === "object"
    ? `Air quality ${aqi.usAqi != null ? aqi.usAqi : "--"}${aqi.category ? ` (${aqi.category})` : ""}`
    : "Air quality unavailable";
  document.getElementById("v3-now-aqi").textContent = aqiText;
  document.getElementById("v3-now-precip").textContent = `Precip chance next hour ${precipChance}%`;
  document.getElementById("v3-now-summary").textContent = computeNowSummary(current, precipChance);
}

function renderHourly(payload) {
  const host = document.getElementById("v3-hourly");
  const rows = Array.isArray(payload.hourly) ? payload.hourly : [];
  host.innerHTML = rows.slice(0, 5).map((row, i) => `
    <div class="v3-hour">
      <div class="v3-time">${fmtHour(row.time, i)}</div>
      <div class="v3-temp">${row.tempF != null ? `${Math.round(row.tempF)}\u00B0` : "--"}</div>
      <div class="v3-cond">${row.label || weatherLabel(row.weatherCode)}</div>
      <div class="v3-pop">${Math.round(row.pop || 0)}%</div>
    </div>
  `).join("");
}

function renderDaily(payload) {
  const host = document.getElementById("v3-daily");
  const rows = Array.isArray(payload.daily) ? payload.daily : [];
  host.innerHTML = rows.slice(0, 7).map((row) => `
    <div class="v3-day">
      <div class="v3-dayname">${fmtDay(row.date)}</div>
      <div class="v3-temp">${row.tempMaxF != null ? Math.round(row.tempMaxF) : "--"}\u00B0 / ${row.tempMinF != null ? Math.round(row.tempMinF) : "--"}\u00B0</div>
      <div class="v3-cond">${row.label || weatherLabel(row.weatherCode)}</div>
      <div class="v3-pop">${Math.round(row.pop || 0)}%</div>
    </div>
  `).join("");
}

function renderHeadsUp(payload) {
  const host = document.getElementById("v3-headsup");
  const headsUp = payload.headsUp || { count: 0, hasSevere: false, top: [] };
  const top = Array.isArray(headsUp.top) ? headsUp.top : [];

  if (!top.length) {
    host.innerHTML = '<p class="v3-alert">No active alerts right now. Conditions look steady.</p>';
    return;
  }

  const summary = headsUp.hasSevere
    ? '<p class="v3-alert"><strong>Weather needs attention.</strong> Review timing before outdoor plans.</p>'
    : `<p class="v3-alert">${headsUp.count || top.length} advisory item${(headsUp.count || top.length) === 1 ? "" : "s"} to keep in mind.</p>`;

  host.innerHTML = `${summary}${top.map((a) => `<p class="v3-alert"><strong>${a.event || "Alert"}</strong>${a.severity ? ` (${a.severity})` : ""}</p>`).join("")}`;
}

function renderFavorites(payload) {
  const host = document.getElementById("v3-favorites");
  const rows = Array.isArray(payload.favorites) ? payload.favorites : [];
  if (!rows.length) {
    host.innerHTML = '<p class="v3-muted">No favorites yet.</p>';
    return;
  }
  host.innerHTML = rows.slice(0, 5).map((row) => `
    <button type="button" class="v3-fav" data-fav-lat="${Number(row.lat)}" data-fav-lon="${Number(row.lon)}" data-fav-label="${String(row.label || "Favorite")}">
      <div class="v3-fav-name">${row.label || "Favorite"}</div>
      <div class="v3-fav-temp">${row.tempF != null ? `${Math.round(row.tempF)}\u00B0` : "--"}</div>
      <div class="v3-cond">${weatherLabel(row.weatherCode)}</div>
    </button>
  `).join("");

  host.querySelectorAll("[data-fav-lat][data-fav-lon]").forEach((el) => {
    el.addEventListener("click", () => {
      const lat = Number(el.getAttribute("data-fav-lat"));
      const lon = Number(el.getAttribute("data-fav-lon"));
      const label = String(el.getAttribute("data-fav-label") || "Favorite");
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !v3AdapterRef) return;
      const nextLoc = { lat, lon, label };
      try {
        localStorage.setItem(LOC_KEY, JSON.stringify(nextLoc));
      } catch (_err) {}
      loadAndRenderForLocation(nextLoc, v3AdapterRef).catch((err) => showStartupError(err));
    });
  });
}

function loadPreferredActivities() {
  try {
    const raw = localStorage.getItem("fw_iq_pref_activities");
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map((v) => String(v)) : [];
  } catch (_err) {
    return [];
  }
}

function getSelectedActivity() {
  try {
    const direct = String(localStorage.getItem(WEATHER_ACTIVITY_KEY) || "").trim();
    if (direct) return direct;
    const rawProfile = localStorage.getItem("fw_profile_v1");
    if (rawProfile) {
      const profile = JSON.parse(rawProfile);
      const fromProfile = String(profile && profile.weatherActivity ? profile.weatherActivity : "").trim();
      if (fromProfile) return fromProfile;
    }
  } catch (_err) {}
  return "bbq";
}

function setSelectedActivity(activity) {
  try {
    localStorage.setItem(WEATHER_ACTIVITY_KEY, String(activity || "bbq"));
  } catch (_err) {}
}

function normalizeIqUrl(detailUrl, activity) {
  const selected = String(activity || "bbq").trim() || "bbq";
  const raw = String(detailUrl || "").trim();
  if (!raw) return `/weather-iq/?activity=${encodeURIComponent(selected)}`;
  const fixed = raw.replace("/weather-iq.html", "/weather-iq/");
  try {
    const u = new URL(fixed, window.location.origin);
    u.searchParams.set("activity", selected);
    return u.pathname + u.search + u.hash;
  } catch (_err) {
    return `/weather-iq/?activity=${encodeURIComponent(selected)}`;
  }
}

function applyActivityLinks(activity) {
  const selected = String(activity || "bbq").trim() || "bbq";
  const iqHref = `/weather-iq/?activity=${encodeURIComponent(selected)}`;
  const intelHref = `/weather-intel/?activity=${encodeURIComponent(selected)}`;

  const iqTop = document.getElementById("v3-open-iq-top");
  const iqBottom = document.getElementById("v3-open-iq-bottom");
  const intel = document.getElementById("v3-open-intel");
  if (iqTop) iqTop.setAttribute("href", iqHref);
  if (iqBottom) iqBottom.setAttribute("href", iqHref);
  if (intel) intel.setAttribute("href", intelHref);

  document.querySelectorAll(".v3-iq-item").forEach((el) => {
    const href = el.getAttribute("href");
    el.setAttribute("href", normalizeIqUrl(href, selected));
  });
}

function renderWeatherIq(iq) {
  const summary = document.getElementById("v3-iq-summary");
  const host = document.getElementById("v3-iq-list");
  if (!iq || !Array.isArray(iq.activities) || !iq.activities.length) {
    summary.textContent = "Weather IQ guidance is not available yet.";
    host.innerHTML = "";
    return;
  }

  const preferredSet = new Set(loadPreferredActivities());
  const selectedActivity = getSelectedActivity();
  const prioritized = [...iq.activities].sort((a, b) => {
    const aPref = preferredSet.has(a.key) ? 1 : 0;
    const bPref = preferredSet.has(b.key) ? 1 : 0;
    return bPref - aPref;
  });

  summary.textContent = iq.summary || iq.title || "What today is good for.";
  host.innerHTML = prioritized.slice(0, 5).map((row) => `
    <a class="v3-iq-item" data-activity-key="${row.key || ""}" href="${normalizeIqUrl(row.detailUrl || "/weather-iq/", selectedActivity)}">
      <div class="v3-iq-name">${row.label || "Activity"}</div>
      <div class="v3-iq-score">${row.score != null ? `${Math.round(row.score)}/100` : "--"}</div>
      <div class="v3-iq-risk">${row.risk || "Review"}${preferredSet.has(row.key) ? " · Preferred" : ""}</div>
    </a>
  `).join("");
}

function renderAlmanac(payload) {
  const out = document.getElementById("v3-almanac-out");
  const date = document.getElementById("v3-almanac-date");
  const form = document.getElementById("v3-almanac-form");
  const zip = document.getElementById("v3-almanac-zip");
  const adapter = window.V3WeatherAdapter;

  date.value = date.value || new Date().toISOString().slice(0, 10);

  const writeAlmanacSummary = (samples) => {
    const highs = samples.map((s) => s.temp_max_f).filter((v) => Number.isFinite(v));
    const lows = samples.map((s) => s.temp_min_f).filter((v) => Number.isFinite(v));
    const avgHigh = highs.length ? Math.round(highs.reduce((a, b) => a + b, 0) / highs.length) : "--";
    const avgLow = lows.length ? Math.round(lows.reduce((a, b) => a + b, 0) / lows.length) : "--";
    out.textContent = `Avg high ${avgHigh}\u00B0F\nAvg low ${avgLow}\u00B0F\nSamples ${samples.length}`;
  };

  const samples = payload.almanac && Array.isArray(payload.almanac.samples) ? payload.almanac.samples : [];
  if (samples.length) {
    writeAlmanacSummary(samples);
  } else if (adapter && typeof adapter.getAlmanac === "function") {
    const today = new Date(date.value + "T00:00:00");
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const loc = payload.location || { lat: 37.9577, lon: -121.2908 };
    out.textContent = "Loading almanac...";
    adapter.getAlmanac(loc.lat, loc.lon, month, day, 5)
      .then((json) => {
        const arr = json && Array.isArray(json.samples) ? json.samples : [];
        if (!arr.length) {
          out.textContent = "No almanac data available.";
          return;
        }
        writeAlmanacSummary(arr);
      })
      .catch(() => {
        out.textContent = "No almanac data available.";
      });
  } else {
    out.textContent = "No almanac data available.";
  }

  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    if (!adapter || typeof adapter.getAlmanac !== "function") return;
    try {
      out.textContent = "Loading almanac...";
      const [y, m, d] = String(date.value).split("-").map(Number);
      if (!y || !m || !d) throw new Error("invalid_date");
      let loc = payload.location || { lat: 37.9577, lon: -121.2908 };
      if (zip.value && typeof adapter.geocodeZip === "function") {
        const geo = await adapter.geocodeZip(zip.value);
        if (geo) loc = geo;
      }
      const json = await adapter.getAlmanac(loc.lat, loc.lon, m, d, 5);
      const arr = json && Array.isArray(json.samples) ? json.samples : [];
      if (!arr.length) {
        out.textContent = "No almanac data available.";
        return;
      }
      const highs = arr.map((s) => s.temp_max_f).filter((v) => Number.isFinite(v));
      const lows = arr.map((s) => s.temp_min_f).filter((v) => Number.isFinite(v));
      const avgHigh = highs.length ? Math.round(highs.reduce((a, b) => a + b, 0) / highs.length) : "--";
      const avgLow = lows.length ? Math.round(lows.reduce((a, b) => a + b, 0) / lows.length) : "--";
      out.textContent = `For ${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}\nAvg high ${avgHigh}\u00B0F\nAvg low ${avgLow}\u00B0F\nSamples ${arr.length}`;
    } catch (err) {
      out.textContent = `Almanac lookup failed: ${err && err.message ? err.message : "unknown error"}`;
      console.error("V3 almanac error:", err);
    }
  });
}

function renderAvatar() {
  const slot = document.getElementById("fw-account-slot");
  if (!slot) return;
  let label = "Profile";
  try {
    const raw = localStorage.getItem("fw_profile") || localStorage.getItem("user_profile") || "";
    if (raw) {
      const parsed = JSON.parse(raw);
      label = parsed.displayName || parsed.name || parsed.email || label;
    }
  } catch (_err) {}
  const initial = String(label).trim().charAt(0).toUpperCase() || "P";
  slot.innerHTML = `<a class="v3-avatar" href="/profile.html" title="${label}" aria-label="${label}">${initial}</a>`;
}

function renderHome(payload, iq) {
  renderNow(payload);
  renderHourly(payload);
  renderDaily(payload);
  renderHeadsUp(payload);
  renderFavorites(payload);
  renderAlmanac(payload);
  renderWeatherIq(iq);
  applyActivityLinks(getSelectedActivity());
  renderAvatar();
  applyBackground(payload.current && payload.current.weatherCode, !!(payload.headsUp && payload.headsUp.hasSevere));
}

function getStoredLocation() {
  try {
    const raw = localStorage.getItem(LOC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Number.isFinite(Number(parsed.lat)) || !Number.isFinite(Number(parsed.lon))) return null;
    return {
      lat: Number(parsed.lat),
      lon: Number(parsed.lon),
      label: String(parsed.label || "Current Location")
    };
  } catch (_err) {
    return null;
  }
}

function loadFavoriteLocations() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row) => ({
        id: String(row && row.id ? row.id : `${row && row.lat},${row && row.lon}`),
        label: String((row && row.label) || "").trim(),
        lat: Number(row && row.lat),
        lon: Number(row && row.lon)
      }))
      .filter((row) => row.label && Number.isFinite(row.lat) && Number.isFinite(row.lon))
      .slice(0, 5);
  } catch (_err) {
    return [];
  }
}

async function hydrateFavorites(payload, adapter) {
  const existing = Array.isArray(payload.favorites) ? payload.favorites : [];
  if (existing.length) return existing;

  const favLocs = loadFavoriteLocations();
  if (!favLocs.length || !adapter || typeof adapter.getHomepageWeather !== "function") return [];

  const rows = await Promise.all(
    favLocs.map(async (loc) => {
      try {
        const wx = await adapter.getHomepageWeather(loc.lat, loc.lon);
        return {
          id: loc.id,
          label: loc.label,
          lat: loc.lat,
          lon: loc.lon,
          tempF: wx && wx.current ? wx.current.tempF : null,
          weatherCode: wx && wx.current ? wx.current.weatherCode : null
        };
      } catch (_err) {
        return {
          id: loc.id,
          label: loc.label,
          lat: loc.lat,
          lon: loc.lon,
          tempF: null,
          weatherCode: null
        };
      }
    })
  );
  return rows;
}

function showStartupError(err) {
  const msg = err && err.message ? err.message : String(err);
  const top = document.createElement("div");
  top.style.padding = "10px 14px";
  top.style.background = "rgba(100, 0, 0, 0.75)";
  top.style.color = "#fff";
  top.style.fontFamily = "monospace";
  top.style.fontSize = "13px";
  top.textContent = `V3 STARTUP ERROR: ${msg}`;
  document.body.prepend(top);
  console.error("V3 STARTUP ERROR", err);
}

async function loadAndRenderForLocation(loc, adapter) {
  const [weatherPayload, iqPayload] = await Promise.all([
    adapter.getHomepageWeather(loc.lat, loc.lon),
    typeof adapter.getWeatherIqSummary === "function"
      ? adapter.getWeatherIqSummary(loc.lat, loc.lon)
      : Promise.resolve(JSON.parse(JSON.stringify(adapter.MOCK_WEATHER_IQ || {})))
  ]);
  const favorites = await hydrateFavorites(weatherPayload, adapter);
  if (favorites.length) weatherPayload.favorites = favorites;
  renderHome(weatherPayload, iqPayload);
}

function wireSignOut() {
  const link = document.getElementById("v3-signout-link");
  if (!link) return;
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      const mod = await import("./logout.js");
      if (mod && typeof mod.logoutAndRedirect === "function") {
        await mod.logoutAndRedirect("index.html");
        return;
      }
      window.location.href = "index.html";
    } catch (err) {
      console.error("V3 sign-out fallback:", err);
      window.location.href = "index.html";
    }
  });
}

function initActivityPicker() {
  const picker = document.getElementById("v3-weather-activity");
  if (!picker) return;
  const selected = getSelectedActivity();
  picker.value = selected;
  applyActivityLinks(selected);
  picker.addEventListener("change", () => {
    const next = picker.value || "bbq";
    setSelectedActivity(next);
    applyActivityLinks(next);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    const adapter = window.V3WeatherAdapter;
    v3AdapterRef = adapter;
    if (!adapter || typeof adapter.getHomepageWeather !== "function") {
      throw new Error("adapter_not_loaded_or_missing_mock_payload");
    }

    wireSignOut();
    initActivityPicker();

    const fallbackLoc = adapter.DEFAULT_LOCATION || { lat: 37.9577, lon: -121.2908, label: "Stockton, CA" };
    const stored = getStoredLocation();
    const seedLoc = stored || fallbackLoc;

    const loadWeatherFlow = async () => {
      let loc = seedLoc;
      if (!stored && navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000 })
          );
          loc = { lat: Number(pos.coords.latitude), lon: Number(pos.coords.longitude), label: "Current Location" };
        } catch (_err) {
          loc = seedLoc;
        }
      }

      await loadAndRenderForLocation(loc, adapter).catch(async () => {
        await loadAndRenderForLocation(fallbackLoc, adapter).catch(() => {
          renderHome(
            JSON.parse(JSON.stringify(adapter.MOCK_PAYLOAD)),
            JSON.parse(JSON.stringify(adapter.MOCK_WEATHER_IQ || {}))
          );
        });
      });
    };

    loadWeatherFlow().catch((err) => showStartupError(err));
  } catch (err) {
    showStartupError(err);
  }
});


