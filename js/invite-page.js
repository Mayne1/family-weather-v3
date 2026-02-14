import {
  generateToken,
  getCurrentUser,
  getContacts,
  getEvents,
  getGroups,
  getInvites,
  saveInvites,
  requireAuth,
  normalizeEmail,
  getNow
} from "./fw-store.js";

function parseEmails(raw) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const parts = String(raw || "")
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const valid = [];
  const invalid = [];
  parts.forEach((item) => {
    const email = normalizeEmail(item);
    if (emailPattern.test(email)) valid.push(email);
    else invalid.push(item);
  });
  return { valid: Array.from(new Set(valid)), invalid };
}

function parsePhones(raw) {
  const parts = String(raw || "")
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const valid = [];
  const invalid = [];
  parts.forEach((item) => {
    const compact = item.replace(/[^\d+]/g, "");
    const normalized = compact.startsWith("+") ? compact : `+${compact}`;
    if (/^\+\d{10,15}$/.test(normalized)) valid.push(normalized);
    else invalid.push(item);
  });
  return { valid: Array.from(new Set(valid)), invalid };
}

document.addEventListener("DOMContentLoaded", () => {
  const user = requireAuth("auth.html");
  if (!user) return;

  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("eventId");
  const eventInput = document.getElementById("fw-invite-event");
  const emailInput = document.getElementById("fw-invite-emails");
  const countEl = document.getElementById("fw-email-count");
  const phoneCountEl = document.getElementById("fw-phone-count");
  const statusEl = document.getElementById("fw-invite-status");
  const form = document.getElementById("fw-invite-form");
  const groupSelect = document.getElementById("fw-invite-group");
  const groupPreview = document.getElementById("fw-invite-group-preview");
  const transportSelect = document.getElementById("fw-invite-transport");
  const phoneInput = document.getElementById("fw-invite-phones");
  const emailWrap = document.getElementById("fw-email-wrap");
  const phoneWrap = document.getElementById("fw-phone-wrap");
  const sendEmailBtn = document.getElementById("fw-send-email-btn");
  const sendSmsBtn = document.getElementById("fw-send-sms-btn");

  const events = getEvents();
  const ownedEvent = events.find((e) => e.id === eventId && normalizeEmail(e.owner_email) === normalizeEmail(user.email));
  if (eventInput && ownedEvent) eventInput.value = ownedEvent.title;
  if (eventInput && !ownedEvent && eventId) eventInput.value = eventId;

  if (!eventId && statusEl) {
    statusEl.className = "mt-3 text-warning";
    statusEl.textContent = "Select an event from My Events.";
  }

  function refreshEmailCount() {
    const parsed = parseEmails(emailInput?.value || "");
    if (countEl) countEl.textContent = `${parsed.valid.length} valid emails / ${parsed.invalid.length} invalid`;
    return parsed;
  }

  function refreshPhoneCount() {
    const parsed = parsePhones(phoneInput?.value || "");
    if (phoneCountEl) phoneCountEl.textContent = `${parsed.valid.length} valid numbers / ${parsed.invalid.length} invalid`;
    return parsed;
  }

  function isSmsTransport() {
    return transportSelect?.value === "sms";
  }

  function setTransport(mode) {
    if (transportSelect) transportSelect.value = mode;
    updateTransportUi();
    updateGroupSelection();
  }

  function updateTransportUi() {
    const sms = isSmsTransport();
    if (emailWrap) emailWrap.style.display = sms ? "none" : "";
    if (phoneWrap) phoneWrap.style.display = sms ? "" : "none";
    if (emailInput) emailInput.required = !sms;
    if (phoneInput) phoneInput.required = sms;
    if (statusEl) {
      statusEl.className = "mt-3 text-light-50";
      statusEl.textContent = sms
        ? "SMS mode: sends invite links by text via backend."
        : "Email mode: generate invite links for your guests.";
    }
  }

  emailInput?.addEventListener("input", refreshEmailCount);
  phoneInput?.addEventListener("input", refreshPhoneCount);
  transportSelect?.addEventListener("change", updateTransportUi);
  sendSmsBtn?.addEventListener("click", () => {
    setTransport("sms");
    form?.requestSubmit();
  });
  sendEmailBtn?.addEventListener("click", () => {
    setTransport("email");
  });
  refreshEmailCount();
  refreshPhoneCount();
  updateTransportUi();

  function renderGroupOptions() {
    if (!groupSelect) return;
    const groups = getGroups();
    const currentValue = groupSelect.value;
    groupSelect.innerHTML = '<option value="">No group selected</option>' +
      groups.map((g) => `<option value="${g.id}">${g.name}</option>`).join("");
    if (currentValue && groups.some((g) => g.id === currentValue)) {
      groupSelect.value = currentValue;
    }
    updateGroupSelection();
  }

  function updateGroupSelection() {
    if (!groupSelect || !groupPreview || !emailInput || !phoneInput) return;
    const selected = getGroups().find((g) => g.id === groupSelect.value);
    if (!selected) {
      groupPreview.textContent = "No group selected.";
      return;
    }
    const contacts = getContacts();
    const members = (selected.members || [])
      .map((id) => contacts.find((c) => c.id === id))
      .filter(Boolean);
    const names = members.map((m) => m.name).join(", ");
    const memberEmails = members.map((m) => normalizeEmail(m.email)).filter(Boolean);
    const memberPhones = members
      .map((m) => String(m.phone || "").trim())
      .filter(Boolean);
    if (memberEmails.length && !isSmsTransport()) {
      emailInput.value = memberEmails.join(", ");
      refreshEmailCount();
    }
    if (memberPhones.length && isSmsTransport()) {
      phoneInput.value = memberPhones.join(", ");
      refreshPhoneCount();
    }
    groupPreview.textContent = `${members.length} member(s): ${names || "No linked contacts"}`;
  }

  groupSelect?.addEventListener("change", updateGroupSelection);
  window.addEventListener("storage", (event) => {
    if (event.key === "fw_groups" || event.key === "fw_contacts") renderGroupOptions();
  });
  renderGroupOptions();

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!eventId) return;
    const invites = getInvites();
    const links = [];

    if (isSmsTransport()) {
      const parsedPhones = refreshPhoneCount();
      if (!parsedPhones.valid.length) {
        if (statusEl) {
          statusEl.className = "mt-3 text-danger";
          statusEl.textContent = "Add at least one valid phone number.";
        }
        return;
      }

      const outbound = [];
      parsedPhones.valid.forEach((phone) => {
        const existing = invites.find((inv) => inv.eventId === eventId && inv.invitee_phone === phone);
        const token = existing ? existing.token : generateToken();
        if (!existing) {
          invites.push({
            token,
            eventId,
            invitee_phone: phone,
            invitee_email: `${phone.replace(/[^\d]/g, "")}@sms.local`,
            owner_email: normalizeEmail(user.email),
            createdAt: getNow()
          });
        }
        const link = new URL(`rsvp.html?token=${token}`, window.location.href).toString();
        links.push(link);
        outbound.push({ phone, token, link });
      });
      saveInvites(invites);

      const payload = {
        eventId,
        eventTitle: eventInput?.value?.trim() || "",
        message: (document.getElementById("fw-invite-message")?.value || "").trim(),
        invites: outbound
      };

      try {
        const res = await fetch("/api/invites/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`SMS send failed (${res.status})`);
        if (statusEl) {
          statusEl.className = "mt-3 text-success";
          statusEl.textContent = `Sent ${outbound.length} SMS invite(s).`;
        }
      } catch (err) {
        if (statusEl) {
          statusEl.className = "mt-3 text-danger";
          statusEl.textContent = err?.message || "Failed to send SMS invites.";
        }
      }
      return;
    }

    const parsed = refreshEmailCount();
    if (!parsed.valid.length) {
      if (statusEl) {
        statusEl.className = "mt-3 text-danger";
        statusEl.textContent = "Add at least one valid email.";
      }
      return;
    }

    parsed.valid.forEach((inviteeEmail) => {
      const existing = invites.find((inv) => inv.eventId === eventId && inv.invitee_email === inviteeEmail);
      const token = existing ? existing.token : generateToken();
      if (!existing) {
        invites.push({
          token,
          eventId,
          invitee_email: inviteeEmail,
          owner_email: normalizeEmail(user.email),
          createdAt: getNow()
        });
      }
      links.push(new URL(`rsvp.html?token=${token}`, window.location.href).toString());
    });
    saveInvites(invites);

    if (statusEl) {
      statusEl.className = "mt-3 text-success";
      statusEl.innerHTML = `
        <div class="mb-2">Generated ${links.length} RSVP link(s).</div>
        <div class="small mb-2">${links.map((l) => `<div>${l}</div>`).join("")}</div>
        <button id="fw-copy-all" type="button" class="btn-main btn-line">Copy all</button>
      `;
      document.getElementById("fw-copy-all")?.addEventListener("click", () => {
        const blob = links.join("\n");
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(blob);
        } else {
          window.prompt("Copy links:", blob);
        }
      });
    }
  });
});
