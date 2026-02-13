import { onAuthChanged, signOutUser } from "../firebase/firebaseAuth.js";

const PROFILE_KEY = "fw_profile_v1";
const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC"
];

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (_err) {
    return "UTC";
  }
}

function getInitial(fullName, email) {
  const source = String(fullName || email || "F").trim();
  return source.charAt(0).toUpperCase() || "F";
}

function readProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_err) {
    return null;
  }
}

function writeProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function setMessage(text, isError = false) {
  const el = document.getElementById("fw-profile-save-msg");
  if (!el) return;
  el.className = isError ? "small text-danger" : "small text-success";
  el.textContent = text;
}

function showSavedBanner() {
  const banner = document.getElementById("fw-profile-save-banner");
  if (!banner) return;
  banner.classList.remove("d-none");
  window.clearTimeout(showSavedBanner.hideTimer);
  showSavedBanner.hideTimer = window.setTimeout(() => {
    banner.classList.add("d-none");
  }, 2200);
}
showSavedBanner.hideTimer = 0;

function buildTimezoneOptions(selectEl, selectedValue) {
  if (!selectEl) return;
  const options = Array.from(new Set([selectedValue, ...COMMON_TIMEZONES].filter(Boolean)));
  selectEl.innerHTML = "";
  options.forEach((zone) => {
    const option = document.createElement("option");
    option.value = zone;
    option.textContent = zone;
    selectEl.appendChild(option);
  });
  selectEl.value = selectedValue || options[0] || "UTC";
}

function renderHeader(profile) {
  const avatar = document.getElementById("fw-profile-avatar-fallback");
  const name = document.getElementById("fw-profile-header-name");
  const role = document.getElementById("fw-profile-header-role");
  const status = document.getElementById("fw-profile-header-status");
  const email = document.getElementById("fw-profile-account-email");
  if (avatar) avatar.textContent = getInitial(profile.fullName, profile.email);
  if (name) name.textContent = profile.fullName || "Family Member";
  if (role) role.textContent = profile.role || "Family Member";
  if (status) status.textContent = profile.status || "Active";
  if (email) email.textContent = profile.email || "-";
}

function getDefaultsForUser(user) {
  const browserTimezone = getBrowserTimezone();
  const nameFromEmail = (user.email || "").split("@")[0] || "Family Member";
  return {
    fullName: user.displayName || nameFromEmail,
    email: user.email || "",
    phone: "",
    homeCityZip: "",
    timezone: browserTimezone,
    units: "fahrenheit",
    dashboardView: "right-now",
    severeAlerts: true,
    dailySummary: true,
    favoriteLocations: "",
    role: "Family Member",
    status: "Active",
    updatedAt: new Date().toISOString()
  };
}

function renderSignedOut() {
  document.getElementById("fw-profile-gate")?.classList.remove("d-none");
  document.getElementById("fw-profile-content")?.classList.add("d-none");
}

function renderSignedIn(user) {
  const gate = document.getElementById("fw-profile-gate");
  const content = document.getElementById("fw-profile-content");
  const profileForm = document.getElementById("fw-profile-form");
  const prefsForm = document.getElementById("fw-preferences-form");
  const saveBtn = document.getElementById("fw-profile-save");
  const signOutBtn = document.getElementById("fw-profile-signout");
  if (!gate || !content || !profileForm || !prefsForm || !saveBtn) return;

  gate.classList.add("d-none");
  content.classList.remove("d-none");

  const fields = {
    fullName: document.getElementById("fw-full-name"),
    email: document.getElementById("fw-email"),
    phone: document.getElementById("fw-phone"),
    homeCityZip: document.getElementById("fw-home-city-zip"),
    timezone: document.getElementById("fw-timezone"),
    units: document.getElementById("fw-units"),
    dashboardView: document.getElementById("fw-dashboard-view"),
    severeAlerts: document.getElementById("fw-severe-alerts"),
    dailySummary: document.getElementById("fw-daily-summary"),
    favoriteLocations: document.getElementById("fw-favorite-locations")
  };
  if (Object.values(fields).some((el) => !el)) return;

  const defaults = getDefaultsForUser(user);
  const stored = readProfile() || {};
  const profile = { ...defaults, ...stored, email: user.email || stored.email || "" };

  buildTimezoneOptions(fields.timezone, profile.timezone || defaults.timezone);
  fields.fullName.value = profile.fullName || "";
  fields.email.value = profile.email || "";
  fields.phone.value = profile.phone || "";
  fields.homeCityZip.value = profile.homeCityZip || "";
  fields.timezone.value = profile.timezone || defaults.timezone;
  fields.units.value = profile.units || "fahrenheit";
  fields.dashboardView.value = profile.dashboardView || "right-now";
  fields.severeAlerts.checked = Boolean(profile.severeAlerts);
  fields.dailySummary.checked = Boolean(profile.dailySummary);
  fields.favoriteLocations.value = profile.favoriteLocations || "";
  renderHeader(profile);
  setMessage("");

  const saveProfileState = () => {
    if (!profileForm.reportValidity()) {
      setMessage("Please complete required profile fields.", true);
      return;
    }

    const next = {
      fullName: fields.fullName.value.trim(),
      email: fields.email.value.trim(),
      phone: fields.phone.value.trim(),
      homeCityZip: fields.homeCityZip.value.trim(),
      timezone: fields.timezone.value,
      units: fields.units.value,
      dashboardView: fields.dashboardView.value,
      severeAlerts: fields.severeAlerts.checked,
      dailySummary: fields.dailySummary.checked,
      favoriteLocations: fields.favoriteLocations.value.trim(),
      role: "Family Member",
      status: "Active",
      updatedAt: new Date().toISOString()
    };

    writeProfile(next);
    renderHeader(next);
    setMessage("Saved");
    showSavedBanner();
  };

  saveBtn.addEventListener("click", saveProfileState);
  profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveProfileState();
  });
  prefsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveProfileState();
  });

  signOutBtn?.addEventListener("click", async () => {
    await signOutUser();
    window.location.href = "index.html";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  onAuthChanged((user) => {
    if (!user || !user.email) {
      renderSignedOut();
      return;
    }
    renderSignedIn(user);
  });
});
