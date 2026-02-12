import { getCurrentUser, getEvents, saveEvents, requireAuth } from "./fw-store.js";

document.addEventListener("DOMContentLoaded", () => {
  const user = requireAuth("auth.html");
  if (!user) return;

  const form = document.getElementById("fw-create-form");
  const msg = document.getElementById("fw-create-message");
  const hostEmail = document.getElementById("fw-event-email");
  if (hostEmail && !hostEmail.value) hostEmail.value = user.email;
  if (!form) return;

  form.addEventListener("submit", (event) => {
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

    const location = [street, unit, city, state, zip].filter(Boolean).join(", ");
    const now = new Date().toISOString();
    const newEvent = {
      id: `evt_${Date.now()}`,
      owner_email: (hostOverride || user.email).toLowerCase(),
      title,
      datetime: `${date}T${time}`,
      location,
      notes,
      createdAt: now,
      updatedAt: now
    };

    const events = getEvents();
    events.unshift(newEvent);
    saveEvents(events);
    window.location.href = "my-events.html";
  });
});
