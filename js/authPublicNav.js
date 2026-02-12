import { onAuthChanged, signOutUser } from "../firebase/firebaseAuth.js";

function createItem(text, href, iconClass) {
    const li = document.createElement("li");
    li.setAttribute("data-auth-item", "true");
    const link = document.createElement("a");
    link.className = "menu-item";
    link.href = href;
    link.innerHTML = `<i class="${iconClass} me-2"></i>${text}`;
    li.appendChild(link);
    return { li, link };
}

function getAccountSlot() {
    return document.getElementById("fw-account-slot");
}

function clearAccountSlot() {
    const slot = getAccountSlot();
    if (slot) slot.innerHTML = "";
}

function createIdentity(user) {
    const label = user?.displayName?.trim() || user?.email || "My Account";
    const initial = label.charAt(0).toUpperCase() || "U";
    const li = document.createElement("li");
    li.setAttribute("data-auth-item", "true");
    const link = document.createElement("a");
    link.className = "menu-item menu-item-auth";
    link.href = "profile.html";
    link.innerHTML = `<span class="fw-avatar">${initial}</span><span class="fw-auth-text">${label}</span>`;
    li.appendChild(link);
    return li;
}

function createAccountButton(user) {
    const label = user?.displayName?.trim() || user?.email || "Account";
    const initial = label.charAt(0).toUpperCase() || "U";
    const link = document.createElement("a");
    link.href = "profile.html";
    link.className = "fw-account-icon";
    link.setAttribute("aria-label", label);
    link.setAttribute("title", label);
    link.setAttribute("data-tooltip", label);
    link.innerHTML = `<span class="fw-avatar">${initial}</span>`;
    return link;
}

function createSignInButton() {
    const link = document.createElement("a");
    link.href = "auth.html";
    link.className = "btn-main btn-line fx-slide nav-cta";
    link.innerHTML = "<span><i class=\"fa fa-sign-in me-2\"></i>Sign In</span>";
    return link;
}

document.addEventListener("DOMContentLoaded", () => {
    const menu = document.getElementById("mainmenu");
    if (!menu) return;

    const privateLinks = Array.from(menu.querySelectorAll("[data-private-nav='true']"));

    onAuthChanged((user) => {
        menu.querySelectorAll("li[data-auth-item='true']").forEach((el) => el.remove());
        clearAccountSlot();
        const slot = getAccountSlot();

        if (user && user.email) {
            privateLinks.forEach((el) => (el.style.display = ""));
            const logout = createItem("Sign Out", "#", "fa fa-sign-out");
            logout.link.addEventListener("click", async (event) => {
                event.preventDefault();
                await signOutUser();
            });
            menu.appendChild(logout.li);
            if (slot) {
                slot.appendChild(createAccountButton(user));
            } else {
                menu.appendChild(createIdentity(user));
            }
            return;
        }

        privateLinks.forEach((el) => (el.style.display = "none"));
        menu.appendChild(createItem("Sign In", "auth.html", "fa fa-sign-in").li);
        menu.appendChild(createItem("Sign Up", "auth.html#signup", "fa fa-user-plus").li);
        if (slot) slot.appendChild(createSignInButton());
    });
});
