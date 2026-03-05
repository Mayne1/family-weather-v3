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

  function ensureBackgroundLayers() {
    let video = document.getElementById("fw-bg-video");
    if (!video) {
      video = document.createElement("video");
      video.id = "fw-bg-video";
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute("aria-hidden", "true");
      document.body.prepend(video);
    }

    let image = document.getElementById("fw-bg-image");
    if (!image) {
      image = document.createElement("div");
      image.id = "fw-bg-image";
      image.setAttribute("aria-hidden", "true");
      document.body.prepend(image);
    }

    return { video, image };
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

  function pickBackgroundForWeather(weather) {
    const group = pickGroup(weather);
    const selected = pickVariant(group, weather) || pickVariant("mixed", weather);
    if (!selected) return { type: "image", src: "" };
    return { type: selected.type, src: selected.src, group };
  }

  function readCachedWeather() {
    try {
      const raw = localStorage.getItem(WEATHER_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_err) {
      return null;
    }
  }

  function applyBackground(weatherPayload) {
    const payload = weatherPayload || window.__FW_WEATHER_PAYLOAD || readCachedWeather();
    if (!payload) return;

    const choice = pickBackgroundForWeather(payload);
    if (!choice || !choice.src) return;

    const layers = ensureBackgroundLayers();
    const video = layers.video;
    const image = layers.image;

    if (choice.type === "video") {
      if (video.getAttribute("src") !== choice.src) {
        video.setAttribute("src", choice.src);
        video.load();
      }
      video.style.display = "block";
      image.style.display = "none";
      image.style.backgroundImage = "";
      video.play().catch(() => {});
      return;
    }

    image.style.backgroundImage = `url('${choice.src}')`;
    image.style.display = "block";
    video.pause();
    video.removeAttribute("src");
    video.style.display = "none";
  }

  window.FWBgEngine = {
    pickBackgroundForWeather,
    applyBackground
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

