(function () {
  "use strict";

  const WEATHER_CACHE_KEY = "fw_weather_cache";
  const LOC_KEY = "fw_weather_loc";
  const GROUPS = [
    "clear",
    "partly_cloudy",
    "cloudy",
    "fog",
    "rain",
    "drizzle",
    "thunder",
    "snow",
    "sleet",
    "hail",
    "wind",
    "mixed"
  ];
  const INTEL_HINT_CACHE_MS = 2 * 60 * 1000;
  const intelHintCache = new Map();

  function ensureBackgroundLayers() {
    let image = document.getElementById("fw-bg-image");
    if (!image) {
      image = document.createElement("div");
      image.id = "fw-bg-image";
      image.setAttribute("aria-hidden", "true");
      document.body.prepend(image);
    }

    return { image };
  }

  function toLower(value) {
    return String(value || "").toLowerCase();
  }

  function hashString(value) {
    let hash = 0;
    const text = String(value || "");
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return hash >>> 0;
  }

  function dayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function locationSeed(weather) {
    const payloadLoc = weather && weather.location ? weather.location : null;
    const locRaw = localStorage.getItem(LOC_KEY);
    let parsedLoc = null;
    try {
      parsedLoc = locRaw ? JSON.parse(locRaw) : null;
    } catch (_err) {
      parsedLoc = null;
    }

    const label = payloadLoc && payloadLoc.label ? payloadLoc.label : parsedLoc && parsedLoc.label ? parsedLoc.label : "";
    const lat = payloadLoc && payloadLoc.lat != null ? payloadLoc.lat : parsedLoc && parsedLoc.lat != null ? parsedLoc.lat : "";
    const lon = payloadLoc && payloadLoc.lon != null ? payloadLoc.lon : parsedLoc && parsedLoc.lon != null ? parsedLoc.lon : "";
    return `${label}|${lat}|${lon}|${dayKey()}`;
  }

  function mixedFromCode(code) {
    return code === 66 || code === 67;
  }

  function snowFromCode(code) {
    return (code >= 71 && code <= 77) || code === 85 || code === 86;
  }

  function rainFromCode(code) {
    return (code >= 61 && code <= 65) || (code >= 80 && code <= 82);
  }

  function drizzleFromCode(code) {
    return code >= 51 && code <= 57;
  }

  function thunderFromCode(code) {
    return code >= 95 && code <= 99;
  }

  function fogFromCode(code) {
    return code >= 45 && code <= 48;
  }

  function cloudyFromCode(code) {
    return code === 3;
  }

  function partlyFromCode(code) {
    return code === 1 || code === 2;
  }

  function pickGroup(weather) {
    const current = weather && weather.weather && weather.weather.current ? weather.weather.current : {};
    const code = Number(current.weather_code);
    const rain = Number(current.rain || 0) + Number(current.showers || 0) + Number(current.precipitation || 0);
    const snow = Number(current.snowfall || 0);
    const text = toLower(current.weather_text || current.description || current.summary || "");

    if (
      text.includes("wintry mix") ||
      text.includes("rain and snow") ||
      text.includes("mixed precipitation") ||
      text.includes("sleet") ||
      mixedFromCode(code) ||
      (rain > 0 && snow > 0)
    ) return "mixed";

    if (snowFromCode(code) || text.includes("snow")) return "snow";
    if (thunderFromCode(code) || text.includes("thunder")) return "thunder";
    if (rainFromCode(code) || text.includes("rain")) return "rain";
    if (drizzleFromCode(code) || text.includes("drizzle")) return "drizzle";
    if (fogFromCode(code) || text.includes("fog") || text.includes("mist") || text.includes("haze")) return "fog";
    if (cloudyFromCode(code) || text.includes("overcast") || text.includes("cloudy")) return "cloudy";
    if (partlyFromCode(code) || text.includes("partly")) return "partly_cloudy";
    return "clear";
  }

  function pickVariant(group, weather) {
    const assets = (window.FW_BG_ASSETS && window.FW_BG_ASSETS[group]) || [];
    if (!assets.length) return null;
    const idx = hashString(`${locationSeed(weather)}|${group}`) % assets.length;
    return assets[idx];
  }

  function normalizeHint(hint) {
    const v = String(hint || "").toLowerCase();
    return v === "severe" || v === "normal" ? v : null;
  }

  function decideVariant(input) {
    const intelHint = normalizeHint(input && input.intelHint);
    if (intelHint === "severe") return "severe";

    const nowLocalHour = Number(input && input.nowLocalHour);
    const hour = Number.isFinite(nowLocalHour) ? nowLocalHour : new Date().getHours();
    if (hour >= 5 && hour <= 10) return "morning";
    if (hour >= 11 && hour <= 16) return "noon";
    return "night";
  }

  function getWeatherCode(weather) {
    const current = weather && weather.weather && weather.weather.current ? weather.weather.current : {};
    const code = Number(current.weather_code);
    return Number.isFinite(code) ? code : 3;
  }

  function variantAssetIndex(variant, total) {
    if (!total) return 0;
    if (variant === "morning") return 0 % total;
    if (variant === "noon") return 1 % total;
    if (variant === "night") return 2 % total;
    return (total - 1 + total) % total; // severe => use strongest/final variant
  }

  function imageAssetsForGroup(group) {
    const assets = (window.FW_BG_ASSETS && window.FW_BG_ASSETS[group]) || [];
    return assets.filter(function (a) {
      return a && a.type === "image" && typeof a.src === "string";
    });
  }

  function pickVariantForGroup(group, variant, weather) {
    const assets = imageAssetsForGroup(group);
    if (!assets.length) return null;
    const idx = variantAssetIndex(variant, assets.length);
    return assets[idx] || assets[hashString(`${locationSeed(weather)}|${group}`) % assets.length];
  }

  function pickImageFallback(group, weather) {
    const assets = imageAssetsForGroup(group);
    if (!assets.length) return null;
    const idx = hashString(`${locationSeed(weather)}|${group}`) % assets.length;
    return assets[idx];
  }

  async function getIntelHint(weather) {
    const loc = weather && weather.location ? weather.location : null;
    const lat = loc && Number.isFinite(Number(loc.lat)) ? Number(loc.lat) : null;
    const lon = loc && Number.isFinite(Number(loc.lon)) ? Number(loc.lon) : null;
    if (lat == null || lon == null) return null;

    const dateIso = new Date().toISOString().slice(0, 10);
    const key = `${lat.toFixed(3)},${lon.toFixed(3)},${dateIso}`;
    const cached = intelHintCache.get(key);
    if (cached && Date.now() - cached.ts < INTEL_HINT_CACHE_MS) return cached.value;

    if (!window.apiBox || typeof window.apiBox.getIntelHint !== "function") {
      intelHintCache.set(key, { ts: Date.now(), value: null });
      return null;
    }

    const value = await window.apiBox.getIntelHint(lat, lon, dateIso);
    const hint = normalizeHint(value);
    intelHintCache.set(key, { ts: Date.now(), value: hint });
    return hint;
  }

  async function pickBackgroundForWeather(weather) {
    const group = pickGroup(weather);
    const code = getWeatherCode(weather);
    const intelHint = await getIntelHint(weather).catch(() => null);
    const variant = decideVariant({
      nowLocalHour: new Date().getHours(),
      intelHint
    });

    const selected =
      pickVariantForGroup(group, variant, weather) ||
      pickImageFallback(group, weather) ||
      pickImageFallback("mixed", weather);
    if (!selected) return { type: "image", src: "" };
    return { type: "image", src: selected.src, group, variant, code, intelHint };
  }

  function readCachedWeather() {
    try {
      const raw = localStorage.getItem(WEATHER_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_err) {
      return null;
    }
  }

  async function applyBackground(weatherPayload) {
    const payload = weatherPayload || window.__FW_WEATHER_PAYLOAD || readCachedWeather();
    if (!payload) return;

    const choice = await pickBackgroundForWeather(payload);
    if (!choice || !choice.src) return;

    const layers = ensureBackgroundLayers();
    const image = layers.image;
    const video = document.getElementById("fw-bg-video");

    image.style.backgroundImage = `url('${choice.src}')`;
    image.style.display = "block";
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.style.display = "none";
    }
    if (document.body) {
      document.body.dataset.wxVariant = String(choice.variant || "night");
      document.body.dataset.wxCode = String(choice.code || "");
    }
    if (window.location && /localhost|127\.0\.0\.1/.test(window.location.hostname || "")) {
      console.debug("[bg] code", choice.code, "variant", choice.variant, "intel", choice.intelHint);
    }
  }

  window.FWBgEngine = {
    pickBackgroundForWeather,
    applyBackground,
    decideVariant
  };

  document.addEventListener("DOMContentLoaded", function () {
    ensureBackgroundLayers();
    applyBackground();
  });

  window.addEventListener("fw:weather", function (evt) {
    const payload = evt && evt.detail && evt.detail.payload ? evt.detail.payload : null;
    applyBackground(payload);
  });

  window.addEventListener("storage", function (evt) {
    if (!evt || evt.key !== WEATHER_CACHE_KEY) return;
    applyBackground();
  });
})();
