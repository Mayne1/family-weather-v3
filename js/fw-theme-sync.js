(function () {
  var SETTINGS_KEY = "fw_settings";

  function normalizeHexColor(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    var normalized = raw.charAt(0) === "#" ? raw : "#" + raw;
    return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : "";
  }

  function readSettingsCache() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_err) {
      return null;
    }
  }

  function writeSettingsCache(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings || {}));
    } catch (_err) {
      // no-op
    }
  }

  function getOwnerEmail() {
    try {
      var raw = localStorage.getItem("fw_auth_user");
      var user = raw ? JSON.parse(raw) : null;
      return user && user.email ? String(user.email).trim().toLowerCase() : "";
    } catch (_err) {
      return "";
    }
  }

  function applySettings(settings) {
    if (!settings || typeof settings !== "object") return;
    var body = document.body;
    var root = document.documentElement;
    if (!body || !root) return;

    if (settings.theme === "light" || settings.theme === "dark") {
      body.classList.remove("dark-scheme", "light-scheme");
      body.classList.add(settings.theme === "light" ? "light-scheme" : "dark-scheme");
    }

    if (settings.background) {
      body.classList.remove("fw-bg-default", "fw-bg-gradient", "fw-bg-pattern");
      body.classList.add("fw-bg-" + settings.background);
    }

    if (settings.font) {
      body.classList.remove("fw-font-system", "fw-font-serif", "fw-font-mono");
      body.classList.add("fw-font-" + settings.font);
    }

    var uiColor = normalizeHexColor(settings.uiColor);
    if (uiColor) root.style.setProperty("--fw-ui-accent", uiColor);

    var fontColor = normalizeHexColor(settings.fontColor);
    if (fontColor) {
      root.style.setProperty("--fw-font-color", fontColor);
      root.style.setProperty("--fw-hero-text", fontColor);
    }

    var heroBoxColor = normalizeHexColor(settings.heroBoxColor);
    if (heroBoxColor) {
      root.style.setProperty("--fw-hero-box-color", heroBoxColor);
      root.style.setProperty("--fw-hero-bg", heroBoxColor);
    }
  }

  async function syncSettingsFromApi() {
    if (!window.apiBox || typeof window.apiBox.getSettings !== "function") return false;
    var ownerEmail = getOwnerEmail();
    if (!ownerEmail) return false;
    try {
      var remote = await window.apiBox.getSettings(ownerEmail);
      if (remote && typeof remote === "object") {
        applySettings(remote);
        writeSettingsCache(remote);
      }
      return true;
    } catch (_err) {
      // keep local cache behavior when API is unavailable
      return false;
    }
  }

  function initThemeSync() {
    applySettings(readSettingsCache());
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      syncSettingsFromApi().then(function (ok) {
        if (ok || attempts >= 8) clearInterval(timer);
      });
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initThemeSync);
  } else {
    initThemeSync();
  }
  window.addEventListener("storage", function (event) {
    if (!event || event.key === SETTINGS_KEY) applySettings(readSettingsCache());
  });
})();
