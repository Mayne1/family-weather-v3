import { getEvents, getInvites, getRsvps, saveRsvps, getNow } from "./fw-store.js";

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const form = document.getElementById("rsvp-form");
  const message = document.getElementById("rsvp-message");
  const emailInput = document.getElementById("rsvp-email");
  const statusInput = document.getElementById("rsvp-status");
  const notesInput = document.getElementById("rsvp-notes");
  const eventSummary = document.getElementById("rsvp-event-summary");
  const eventMeta = document.getElementById("rsvp-event-meta");

  if (!token) {
    if (eventSummary) {
      eventSummary.innerHTML = `
        <h4>Invalid RSVP link</h4>
        <p class="mb-0">If you are an event owner, go to My Events to view RSVPs.</p>
      `;
    }
    if (form) form.style.display = "none";
    return;
  }

  const invite = getInvites().find((inv) => inv.token === token);
  if (!invite) {
    if (eventSummary) eventSummary.innerHTML = "<h4>Invalid RSVP link</h4>";
    if (form) form.style.display = "none";
    return;
  }

  const eventItem = getEvents().find((evt) => evt.id === invite.eventId);
  if (eventSummary) {
    eventSummary.innerHTML = `
      <div class="subtitle">Event Details</div>
      <h4 class="mb-2">${eventItem ? eventItem.title : "Event"}</h4>
      <div class="small">${eventItem ? new Date(eventItem.datetime).toLocaleString() : ""}</div>
      <div class="small">${eventItem ? eventItem.location : ""}</div>
    `;
  }
  if (eventMeta) eventMeta.textContent = `Invited as: ${invite.invitee_email}`;
  if (emailInput) {
    emailInput.value = invite.invitee_email;
    emailInput.readOnly = true;
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = statusInput?.value || "";
    if (!["Going", "Maybe", "No", "Can't Go"].includes(status)) {
      setText("rsvp-message", "Please choose a status.");
      return;
    }
    const normalizedStatus = status === "Can't Go" ? "No" : status;
    const all = getRsvps();
    const filtered = all.filter((row) => !(row.eventId === invite.eventId && row.invitee_email === invite.invitee_email));
    filtered.push({
      eventId: invite.eventId,
      invitee_email: invite.invitee_email,
      status: normalizedStatus,
      notes: (notesInput?.value || "").trim(),
      updatedAt: getNow()
    });
    saveRsvps(filtered);
    if (message) {
      message.className = "mt-3 text-success";
      message.textContent = "Thanks, your RSVP was recorded.";
    }
  });
});
