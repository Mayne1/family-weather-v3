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

document.addEventListener("DOMContentLoaded", () => {
  const user = requireAuth("auth.html");
  if (!user) return;

  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("eventId");
  const eventInput = document.getElementById("fw-invite-event");
  const emailInput = document.getElementById("fw-invite-emails");
  const countEl = document.getElementById("fw-email-count");
  const statusEl = document.getElementById("fw-invite-status");
  const form = document.getElementById("fw-invite-form");
  const groupSelect = document.getElementById("fw-invite-group");
  const groupPreview = document.getElementById("fw-invite-group-preview");

  const events = getEvents();
  const ownedEvent = events.find((e) => e.id === eventId && normalizeEmail(e.owner_email) === normalizeEmail(user.email));
  if (eventInput && ownedEvent) eventInput.value = ownedEvent.title;
  if (eventInput && !ownedEvent && eventId) eventInput.value = eventId;

  if (!eventId && statusEl) {
    statusEl.className = "mt-3 text-warning";
    statusEl.textContent = "Select an event from My Events.";
  }

  function refreshCount() {
    const parsed = parseEmails(emailInput?.value || "");
    if (countEl) countEl.textContent = `${parsed.valid.length} valid emails / ${parsed.invalid.length} invalid`;
    return parsed;
  }

  emailInput?.addEventListener("input", refreshCount);
  refreshCount();

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
    if (!groupSelect || !groupPreview || !emailInput) return;
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
    if (memberEmails.length) {
      emailInput.value = memberEmails.join(", ");
      refreshCount();
    }
    groupPreview.textContent = `${members.length} member(s): ${names || "No linked contacts"}`;
  }

  groupSelect?.addEventListener("change", updateGroupSelection);
  window.addEventListener("storage", (event) => {
    if (event.key === "fw_groups" || event.key === "fw_contacts") renderGroupOptions();
  });
  renderGroupOptions();

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!eventId) return;
    const parsed = refreshCount();
    if (!parsed.valid.length) {
      if (statusEl) {
        statusEl.className = "mt-3 text-danger";
        statusEl.textContent = "Add at least one valid email.";
      }
      return;
    }

    const invites = getInvites();
    const links = [];
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
