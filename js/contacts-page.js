import { getContacts, saveContacts, getNow, generateToken } from "./fw-store.js";

const CONTACT_EVENT = "fw-contacts-changed";

function emitContactsChanged() {
  window.dispatchEvent(new CustomEvent(CONTACT_EVENT));
}

function renderContacts() {
  const list = document.getElementById("fw-contact-list");
  const empty = document.getElementById("fw-contact-empty");
  if (!list || !empty) return;
  const contacts = getContacts();
  empty.classList.toggle("d-none", contacts.length > 0);

  list.innerHTML = contacts
    .map((c) => {
      const lines = [];
      if (c.phone) lines.push(`<div class="small">${c.phone}</div>`);
      if (c.email) lines.push(`<div class="small">${c.email}</div>`);
      return `
        <div class="col-md-6">
          <div class="bg-dark rounded-1 p-20 h-100">
            <h4 class="mb-2">${c.name}</h4>
            ${lines.join("") || '<div class="small text-muted">No phone/email</div>'}
            <div class="d-flex gap-2 mt-3">
              <button type="button" class="btn-main btn-line btn-small fw-contact-edit" data-id="${c.id}"><span>Edit</span></button>
              <button type="button" class="btn-main btn-line btn-small fw-contact-delete" data-id="${c.id}"><span>Delete</span></button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function resetForm() {
  const form = document.getElementById("fw-contact-form");
  const id = document.getElementById("fw-contact-id");
  const cancel = document.getElementById("fw-contact-cancel");
  form?.reset();
  if (id) id.value = "";
  cancel?.classList.add("d-none");
}

function setStatus(text, error = false) {
  const status = document.getElementById("fw-contact-status");
  if (!status) return;
  status.className = error ? "small mt-2 text-danger" : "small mt-2 text-success";
  status.textContent = text;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("fw-contact-form");
  const list = document.getElementById("fw-contact-list");
  const cancel = document.getElementById("fw-contact-cancel");
  if (!form || !list) return;

  renderContacts();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const idInput = document.getElementById("fw-contact-id");
    const nameInput = document.getElementById("fw-contact-name");
    const phoneInput = document.getElementById("fw-contact-phone");
    const emailInput = document.getElementById("fw-contact-email");
    if (!nameInput || !phoneInput || !emailInput) return;

    const id = (idInput?.value || "").trim();
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();

    if (!name) {
      setStatus("Name is required.", true);
      return;
    }
    if (!phone && !email) {
      setStatus("Add at least one contact method (phone or email).", true);
      return;
    }

    const contacts = getContacts();
    if (id) {
      const idx = contacts.findIndex((c) => c.id === id);
      if (idx >= 0) {
        contacts[idx] = { ...contacts[idx], name, phone, email };
      }
    } else {
      contacts.push({ id: generateToken(10), name, phone, email, created_at: getNow() });
    }
    saveContacts(contacts);
    emitContactsChanged();
    renderContacts();
    resetForm();
    setStatus("Saved.");
  });

  cancel?.addEventListener("click", () => {
    resetForm();
    setStatus("");
  });

  list.addEventListener("click", (event) => {
    const target = event.target;
    const button = target instanceof Element ? target.closest("button") : null;
    if (!button) return;
    const id = button.getAttribute("data-id");
    if (!id) return;
    const contacts = getContacts();

    if (button.classList.contains("fw-contact-delete")) {
      saveContacts(contacts.filter((c) => c.id !== id));
      emitContactsChanged();
      renderContacts();
      setStatus("Deleted.");
      return;
    }

    if (button.classList.contains("fw-contact-edit")) {
      const contact = contacts.find((c) => c.id === id);
      if (!contact) return;
      const idInput = document.getElementById("fw-contact-id");
      const nameInput = document.getElementById("fw-contact-name");
      const phoneInput = document.getElementById("fw-contact-phone");
      const emailInput = document.getElementById("fw-contact-email");
      if (!idInput || !nameInput || !phoneInput || !emailInput) return;
      idInput.value = contact.id;
      nameInput.value = contact.name || "";
      phoneInput.value = contact.phone || "";
      emailInput.value = contact.email || "";
      cancel?.classList.remove("d-none");
      setStatus("Editing contact.");
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key === "fw_contacts") renderContacts();
  });
  window.addEventListener(CONTACT_EVENT, renderContacts);
});
