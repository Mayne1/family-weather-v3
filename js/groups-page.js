import { getContacts, getCurrentUser, getGroups, saveGroups, getNow, generateToken } from "./fw-store.js";

const GROUP_EVENT = "fw-groups-changed";
const CONTACT_EVENT = "fw-contacts-changed";

function emitGroupsChanged() {
  window.dispatchEvent(new CustomEvent(GROUP_EVENT));
}

function renderContactChecklist() {
  const wrap = document.getElementById("fw-group-contacts");
  const empty = document.getElementById("fw-group-no-contacts");
  if (!wrap || !empty) return;
  const contacts = getContacts();
  empty.classList.toggle("d-none", contacts.length > 0);
  wrap.innerHTML = contacts
    .map(
      (c) => `
      <div class="col-md-6">
        <label class="form-check p-12 rounded-1 bg-dark d-flex align-items-center gap-2">
          <input class="form-check-input fw-group-member" type="checkbox" value="${c.id}">
          <span>${c.name}</span>
        </label>
      </div>
    `
    )
    .join("");
}

function renderGroups() {
  const list = document.getElementById("fw-group-list");
  const empty = document.getElementById("fw-group-empty");
  if (!list || !empty) return;
  const groups = getGroups();
  const contacts = getContacts();
  const map = new Map(contacts.map((c) => [c.id, c]));
  empty.classList.toggle("d-none", groups.length > 0);

  list.innerHTML = groups
    .map((g) => {
      const members = (g.members || []).map((id) => map.get(id)?.name).filter(Boolean);
      return `
        <div class="col-md-6">
          <div class="bg-dark rounded-1 p-20 h-100">
            <h4 class="mb-1">${g.name}</h4>
            <div class="small text-muted mb-2">${members.length} members</div>
            <details>
              <summary class="small">View members</summary>
              <div class="small mt-2">${members.join(", ") || "No members"}</div>
            </details>
          </div>
        </div>
      `;
    })
    .join("");
}

function setStatus(text, error = false) {
  const status = document.getElementById("fw-group-status");
  if (!status) return;
  status.className = error ? "small mt-2 text-danger" : "small mt-2 text-success";
  status.textContent = text;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("fw-group-form");
  const nameInput = document.getElementById("fw-group-name");
  if (!form || !nameInput) return;

  renderContactChecklist();
  renderGroups();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      setStatus("Group name is required.", true);
      return;
    }
    const members = Array.from(document.querySelectorAll(".fw-group-member:checked")).map((n) => n.value);
    const owner = getCurrentUser()?.email || "";
    const groups = getGroups();
    groups.push({
      id: generateToken(10),
      name,
      members,
      owner_email: owner,
      created_at: getNow()
    });
    saveGroups(groups);
    emitGroupsChanged();
    form.reset();
    renderGroups();
    setStatus("Group saved.");
  });

  window.addEventListener("storage", (event) => {
    if (event.key === "fw_groups") renderGroups();
    if (event.key === "fw_contacts") {
      renderContactChecklist();
      renderGroups();
    }
  });
  window.addEventListener(CONTACT_EVENT, () => {
    renderContactChecklist();
    renderGroups();
  });
  window.addEventListener(GROUP_EVENT, renderGroups);
});
