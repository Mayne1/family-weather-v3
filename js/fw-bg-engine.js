(function () {
  "use strict";

  const WEATHER_CACHE_KEY = "fw_weather_cache";
  const BG_MANIFEST_URL = "/images/out-bg-nature/manifest.json";
  const BG_BASE = "/images/out-bg-nature";
  const BG_FALLBACK_CODE = "800";
  const BG_FALLBACK_STATIC = "/images/background/Cloudy weather websi.png";
  const INTEL_HINT_CACHE_MS = 2 * 60 * 1000;
  const intelHintCache = new Map();
  let manifestPromise = null;
  let debugOverride = null;

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

  function normalizeHint(hint) {
    const v = String(hint || "").toLowerCase();
    return v === "severe" || v === "normal" ? v : null;
  }

  function normalizeManifest(raw) {
    const fallback = {
      200: ["morning", "noon", "night", "severe"],
      300: ["morning", "noon", "night", "severe"],
      500: ["morning", "noon", "night", "severe"],
      600: ["morning", "noon", "night", "severe"],
      700: ["morning", "noon", "night", "severe"],
      800: ["morning", "noon", "night", "severe"],
      801: ["morning", "noon", "night", "severe"],
      802: ["morning", "noon", "night", "severe"],
      803: ["morning", "noon", "night", "severe"],
      804: ["morning", "noon", "night", "severe"]
    };
    if (!raw || typeof raw !== "object") return fallback;
    const output = {};
    Object.keys(raw).forEach(function (key) {
      const value = raw[key];
      if (Array.isArray(value)) {
        output[String(key)] = value.map(String);
      } else if (value && Array.isArray(value.variants)) {
        output[String(key)] = value.variants.map(String);
      }
    });
    if (!Object.keys(output).length) return fallback;
    return output;
  }

  function loadManifest() {
    if (manifestPromise) return manifestPromise;
    manifestPromise = fetch(BG_MANIFEST_URL, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("manifest_fetch_failed");
        return res.json();
      })
      .then(normalizeManifest)
      .catch(function () {
        return normalizeManifest(null);
      });
    return manifestPromise;
  }

  function deriveTimeVariant(date) {
    const hour = date.getHours();
    if (hour >= 5 && hour <= 10) return "morning";
    if (hour >= 11 && hour <= 16) return "noon";
    return "night";
  }

  function mapWeatherCodeToBgCode(code) {
    const n = Number(code);
    if (!Number.isFinite(n)) return BG_FALLBACK_CODE;
    if (n >= 200 && n <= 299) return "200";
    if (n >= 300 && n <= 399) return "300";
    if (n >= 500 && n <= 599) return "500";
    if (n >= 600 && n <= 699) return "600";
    if (n >= 700 && n <= 799) return "700";
    if (n >= 800 && n <= 899) return String(n);
    // Open-Meteo/NWS mappings.
    if (n >= 95) return "200";
    if ((n >= 51 && n <= 67) || (n >= 80 && n <= 82)) return "500";
    if ((n >= 71 && n <= 77) || n === 85 || n === 86) return "600";
    if (n >= 45 && n <= 48) return "700";
    if (n === 1) return "801";
    if (n === 2) return "802";
    if (n === 3) return "804";
    return "800";
  }

  function getPayloadWeatherCode(weather) {
    const current = weather && weather.weather && weather.weather.current ? weather.weather.current : {};
    if (debugOverride && debugOverride.bgCode) return String(debugOverride.bgCode);
    return mapWeatherCodeToBgCode(current.weather_code);
  }

  function buildVariantCandidates(requestedVariant, severeHint) {
    const list = [requestedVariant, "noon", "morning", "night"];
    if (severeHint === true) list.push("severe");
    return Array.from(new Set(list.filter(Boolean)));
  }

  function preloadImage(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      const timer = setTimeout(function () {
        reject(new Error("img_timeout"));
      }, timeoutMs || 5000);
      img.onload = function () {
        clearTimeout(timer);
        resolve(url);
      };
      img.onerror = function () {
        clearTimeout(timer);
        reject(new Error("img_error"));
      };
      img.src = url;
    });
  }

  async function resolveBackgroundUrl(bgCode, requestedVariant, severeHint) {
    const manifest = await loadManifest();
    const resolvedCode = manifest[bgCode] ? bgCode : BG_FALLBACK_CODE;
    const variants = Array.isArray(manifest[resolvedCode]) ? manifest[resolvedCode] : ["noon", "morning", "night"];
    const fallbacks = buildVariantCandidates(requestedVariant, severeHint);
    for (const variant of fallbacks) {
      if (!variants.includes(variant)) continue;
      const candidate = `${BG_BASE}/${resolvedCode}/${variant}.png`;
      try {
        await preloadImage(candidate, 4000);
        return { url: candidate, code: resolvedCode, variant };
      } catch (_err) {}
    }
    // Last resort static local fallback to avoid blank backgrounds.
    try {
      await preloadImage(BG_FALLBACK_STATIC, 4000);
      return { url: BG_FALLBACK_STATIC, code: resolvedCode, variant: "fallback" };
    } catch (_err) {
      return null;
    }
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
    let hint = null;
    if (typeof value === "string") {
      hint = normalizeHint(value);
    } else if (value && typeof value === "object") {
      if (value.severeHint === true) hint = "severe";
      else if (value.severeHint === false) hint = "normal";
      else hint = normalizeHint(value.background_variant_hint);
    }
    intelHintCache.set(key, { ts: Date.now(), value: hint });
    return hint;
  }

  async function pickBackgroundForWeather(weather) {
    const code = getPayloadWeatherCode(weather);
    const intelHint = await getIntelHint(weather).catch(() => null);
    const severeHint = debugOverride && typeof debugOverride.severeHint === "boolean"
      ? debugOverride.severeHint
      : intelHint === "severe";
    const timeVariant = debugOverride && debugOverride.variant
      ? String(debugOverride.variant)
      : deriveTimeVariant(new Date());
    const requestedVariant = severeHint ? "severe" : timeVariant;
    const resolved = await resolveBackgroundUrl(code, requestedVariant, severeHint);
    if (!resolved) return null;
    return {
      type: "image",
      src: resolved.url,
      code: resolved.code,
      variant: resolved.variant,
      severeHint: severeHint
    };
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

    document.documentElement.style.setProperty("--fw-bg-image-url", `url('${choice.src}')`);
    image.style.backgroundImage = "var(--fw-bg-image-url)";
    image.style.display = "block";
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.style.display = "none";
    }
    if (document.body) {
      document.body.dataset.wxVariant = String(choice.variant || "night");
      document.body.dataset.wxCode = String(choice.code || "");
      document.body.dataset.wxSevere = choice.severeHint ? "1" : "0";
    }
    if (window.location && /localhost|127\.0\.0\.1/.test(window.location.hostname || "")) {
      console.debug("[bg] code", choice.code, "variant", choice.variant, "severe", choice.severeHint);
    }
  }

  window.FWBgEngine = {
    pickBackgroundForWeather,
    applyBackground,
    setDebugOverride: function (next) {
      debugOverride = next && typeof next === "object" ? next : null;
      applyBackground();
    }
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
