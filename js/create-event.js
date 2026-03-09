import { getCurrentUser, getEvents, saveEvents, requireAuth } from "./fw-store.js";

const DEFAULT_COORDS = { lat: 37.9577, lon: -121.2908, label: "Stockton, CA" };
const WEATHER_ACTIVITY_KEY = "fw_weather_activity";

function getSelectedActivity() {
  try {
    const raw = String(localStorage.getItem(WEATHER_ACTIVITY_KEY) || "").trim();
    return raw || "bbq";
  } catch (_err) {
    return "bbq";
  }
}

async function geocodeByZip(zip) {
  const clean = String(zip || "").replace(/[^0-9]/g, "").slice(0, 5);
  if (!clean) return null;
  try {
    const res = await fetch("/api/weather/geocode?zip=" + encodeURIComponent(clean));
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || json.ok !== true) return null;
    if (!Number.isFinite(Number(json.lat)) || !Number.isFinite(Number(json.lon))) return null;
    return {
      lat: Number(json.lat),
      lon: Number(json.lon),
      label: String(json.label || `ZIP ${clean}`)
    };
  } catch (_err) {
    return null;
  }
}

async function getIntelHint(lat, lon, dateIso) {
  try {
    const url =
      "/api/intel/hint?lat=" +
      encodeURIComponent(lat) +
      "&lon=" +
      encodeURIComponent(lon) +
      "&dateIso=" +
      encodeURIComponent(dateIso);
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || typeof json !== "object") return null;
    return {
      severeHint: Boolean(json.severeHint),
      background_variant_hint: String(json.background_variant_hint || "normal"),
      severity_tier: String(json.severity_tier || "NONE")
    };
  } catch (_err) {
    return null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const user = requireAuth("auth.html");
  if (!user) return;

  const form = document.getElementById("fw-create-form");
  const msg = document.getElementById("fw-create-message");
  const hostEmail = document.getElementById("fw-event-email");
  if (hostEmail && !hostEmail.value) hostEmail.value = user.email;
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = (document.getElementById("fw-event-title")?.value || "").trim();
    const date = document.getElementById("fw-event-date")?.value || "";
    const time = document.getElementById("fw-event-time")?.value || "";
    const street = (document.getElementById("fw-event-street")?.value || "").trim();
    const unit = (document.getElementById("fw-event-unit")?.value || "").trim();
    const city = (document.getElementById("fw-event-city")?.value || "").trim();
    const state = (document.getElementById("fw-event-state")?.value || "").trim().toUpperCase();
    const zip = (document.getElementById("fw-event-zip")?.value || "").trim();
    const notes = (document.getElementById("fw-event-desc")?.value || "").trim();
    const hostOverride = (document.getElementById("fw-event-email")?.value || "").trim();

    if (!title || !date || !time || !street || !city || !state || !zip) {
      if (msg) msg.textContent = "Please complete all required fields.";
      return;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    if (msg) msg.textContent = "Creating event and weather intel...";

    const location = [street, unit, city, state, zip].filter(Boolean).join(", ");
    const now = new Date().toISOString();
    const activity = getSelectedActivity();
    const geo = (await geocodeByZip(zip)) || DEFAULT_COORDS;
    const intel = await getIntelHint(geo.lat, geo.lon, date);
    const intelUrl =
      "/weather-intel/?activity=" +
      encodeURIComponent(activity) +
      "&lat=" +
      encodeURIComponent(geo.lat) +
      "&lon=" +
      encodeURIComponent(geo.lon) +
      "&dateIso=" +
      encodeURIComponent(date);

    const newEvent = {
      id: `evt_${Date.now()}`,
      owner_email: (hostOverride || user.email).toLowerCase(),
      title,
      datetime: `${date}T${time}`,
      location,
      notes,
      weatherIntel: {
        activity,
        lat: geo.lat,
        lon: geo.lon,
        locationLabel: geo.label || location,
        dateIso: date,
        severeHint: intel ? Boolean(intel.severeHint) : false,
        background_variant_hint: intel ? String(intel.background_variant_hint || "normal") : "normal",
        severity_tier: intel ? String(intel.severity_tier || "NONE") : "NONE",
        intelUrl,
        updatedAt: now
      },
      createdAt: now,
      updatedAt: now
    };

    const events = getEvents();
    events.unshift(newEvent);
    saveEvents(events);
    window.location.href = "my-events.html";
  });
});
