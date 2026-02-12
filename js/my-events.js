import {
  getCurrentUser,
  getEvents,
  saveEvents,
  getInvites,
  getRsvps,
  requireAuth
} from "./fw-store.js";

function esc(value) {
  return String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatDateTime(datetime) {
  const d = new Date(datetime);
  if (Number.isNaN(d.getTime())) return datetime || "";
  return d.toLocaleString();
}

function rsvpSummary(eventId, rsvps) {
  const rows = rsvps.filter((r) => r.eventId === eventId);
  const counts = { Going: 0, Maybe: 0, No: 0 };
  rows.forEach((row) => {
    if (counts[row.status] !== undefined) counts[row.status] += 1;
  });
  return { rows, counts };
}

function render(userEmail) {
  const grid = document.getElementById("events-grid");
  if (!grid) return;
  const invites = getInvites();
  const rsvps = getRsvps();
  const events = getEvents().filter((eventItem) => String(eventItem.owner_email || "").toLowerCase() === userEmail);

  if (!events.length) {
    grid.innerHTML = '<div class="col-12"><div class="bg-dark-2 rounded-1 p-30">No events yet. Create one to get started.</div></div>';
    return;
  }

  grid.innerHTML = events.map((eventItem) => {
    const summary = rsvpSummary(eventItem.id, rsvps);
    const inviteCount = invites.filter((inv) => inv.eventId === eventItem.id).length;
    return `
      <div class="col-lg-6">
        <div class="bg-dark-2 rounded-1 p-30 h-100" data-event-id="${esc(eventItem.id)}">
          <h4>${esc(eventItem.title)}</h4>
          <p class="mb-1">${esc(formatDateTime(eventItem.datetime))}</p>
          <p class="mb-2">${esc(eventItem.location)}</p>
          <p class="mb-3">${esc(eventItem.notes || "")}</p>
          <div class="bg-dark rounded-1 p-20 mb-3">
            <div class="subtitle mb-1">Weather Intel</div>
            <div>Weather intel will appear here <span class="badge bg-secondary">MVP</span></div>
          </div>
          <div class="small mb-3">Invites: ${inviteCount} | Going: ${summary.counts.Going} | Maybe: ${summary.counts.Maybe} | No: ${summary.counts.No}</div>
          <div class="d-flex flex-wrap gap-2 mb-3">
            <button class="btn-main btn-line" data-edit="${esc(eventItem.id)}">Edit</button>
            <button class="btn-main btn-line" data-delete="${esc(eventItem.id)}">Delete</button>
            <a class="btn-main btn-line" href="invite.html?eventId=${encodeURIComponent(eventItem.id)}">Invite Guests</a>
            <button class="btn-main btn-line" data-rsvps="${esc(eventItem.id)}">View RSVPs</button>
          </div>
          <div class="bg-dark rounded-1 p-20 d-none mb-3" data-edit-panel="${esc(eventItem.id)}">
            <input class="form-control form-control-lg mb-2" data-edit-title="${esc(eventItem.id)}" value="${esc(eventItem.title)}">
            <input class="form-control form-control-lg mb-2" data-edit-datetime="${esc(eventItem.id)}" type="datetime-local" value="${esc((eventItem.datetime || "").slice(0, 16))}">
            <input class="form-control form-control-lg mb-2" data-edit-location="${esc(eventItem.id)}" value="${esc(eventItem.location)}">
            <textarea class="form-control form-control-lg mb-2" data-edit-notes="${esc(eventItem.id)}">${esc(eventItem.notes || "")}</textarea>
            <button class="btn-main btn-line" data-save="${esc(eventItem.id)}">Save</button>
          </div>
          <div class="bg-dark rounded-1 p-20 d-none" data-rsvps-panel="${esc(eventItem.id)}">
            ${summary.rows.length ? summary.rows.map((row) => `<div class="small mb-1">${esc(row.invitee_email)} - ${esc(row.status)}${row.notes ? ` - ${esc(row.notes)}` : ""}</div>`).join("") : '<div class="small">No RSVPs yet.</div>'}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  const user = requireAuth("auth.html");
  if (!user) return;
  const userEmail = user.email.toLowerCase();

  function rerender() {
    render(userEmail);
  }

  rerender();

  document.addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-edit]");
    if (editBtn) {
      const id = editBtn.getAttribute("data-edit");
      const panel = document.querySelector(`[data-edit-panel="${id}"]`);
      panel?.classList.toggle("d-none");
      return;
    }

    const saveBtn = event.target.closest("[data-save]");
    if (saveBtn) {
      const id = saveBtn.getAttribute("data-save");
      const events = getEvents();
      const idx = events.findIndex((e) => e.id === id && String(e.owner_email || "").toLowerCase() === userEmail);
      if (idx >= 0) {
        events[idx].title = document.querySelector(`[data-edit-title="${id}"]`)?.value.trim() || events[idx].title;
        events[idx].datetime = document.querySelector(`[data-edit-datetime="${id}"]`)?.value || events[idx].datetime;
        events[idx].location = document.querySelector(`[data-edit-location="${id}"]`)?.value.trim() || events[idx].location;
        events[idx].notes = document.querySelector(`[data-edit-notes="${id}"]`)?.value.trim() || "";
        events[idx].updatedAt = new Date().toISOString();
        saveEvents(events);
      }
      rerender();
      return;
    }

    const delBtn = event.target.closest("[data-delete]");
    if (delBtn) {
      const id = delBtn.getAttribute("data-delete");
      if (!window.confirm("Delete this event?")) return;
      const events = getEvents().filter((e) => !(e.id === id && String(e.owner_email || "").toLowerCase() === userEmail));
      saveEvents(events);
      rerender();
      return;
    }

    const rsvpBtn = event.target.closest("[data-rsvps]");
    if (rsvpBtn) {
      const id = rsvpBtn.getAttribute("data-rsvps");
      const panel = document.querySelector(`[data-rsvps-panel="${id}"]`);
      panel?.classList.toggle("d-none");
    }
  });
});
