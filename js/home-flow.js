import { getCurrentUser } from "./fw-store.js";

function goWithAuth(target, needsAuth) {
  if (needsAuth && !getCurrentUser()) {
    const next = encodeURIComponent(target);
    window.location.href = `auth.html?next=${next}`;
    return;
  }
  window.location.href = target;
}

document.addEventListener("DOMContentLoaded", () => {
  const cards = Array.from(document.querySelectorAll("#section-flows .row.g-4 .col-lg-3 .hover > div"));
  if (cards.length < 4) return;

  const flows = [
    { href: "create-event.html", auth: true },
    { href: "my-events.html", auth: true },
    { href: "invite.html", auth: true },
    { href: "rsvp.html", auth: false }
  ];

  cards.slice(0, 4).forEach((card, idx) => {
    const flow = flows[idx];
    if (!flow) return;
    card.style.cursor = "pointer";
    card.addEventListener("click", () => goWithAuth(flow.href, flow.auth));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        goWithAuth(flow.href, flow.auth);
      }
    });
    if (!card.hasAttribute("tabindex")) card.setAttribute("tabindex", "0");
  });
});
