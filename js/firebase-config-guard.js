(function () {
  function isPlaceholder(value) {
    var v = String(value || "").trim().toLowerCase();
    return !v || v === "replace me" || v === "replace_me" || v === "replaceme";
  }

  function isConfigured(config) {
    if (!config || typeof config !== "object") return false;
    return !["apiKey", "authDomain", "projectId", "appId"].some(function (key) {
      return isPlaceholder(config[key]);
    });
  }

  var ok = isConfigured(window.firebaseConfig);
  window.__FW_FIREBASE_CONFIG_OK = ok;

  if (ok) return;

  console.error("Firebase not configured: update srcfirebaseconfig.js with real firebaseConfig values.");

  function showMessage() {
    if (!document.body) return;
    if (document.getElementById("fw-firebase-config-error")) return;
    var box = document.createElement("div");
    box.id = "fw-firebase-config-error";
    box.textContent = "Firebase not configured";
    box.style.position = "fixed";
    box.style.right = "16px";
    box.style.bottom = "16px";
    box.style.zIndex = "9999";
    box.style.padding = "10px 14px";
    box.style.borderRadius = "8px";
    box.style.border = "1px solid rgba(255,255,255,.25)";
    box.style.background = "rgba(120,20,20,.88)";
    box.style.color = "#fff";
    box.style.fontSize = "14px";
    box.style.boxShadow = "0 8px 20px rgba(0,0,0,.35)";
    document.body.appendChild(box);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showMessage);
  } else {
    showMessage();
  }
})();
