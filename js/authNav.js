import { onAuthChanged, signOutUser } from "../firebase/firebaseAuth.js";

function createAuthNavItem(text, href, iconClass, extraClass) {
    const li = document.createElement("li");
    li.setAttribute("data-auth-item", "true");

    const link = document.createElement("a");
    link.className = `menu-item ${extraClass || ""}`.trim();
    link.href = href;
    link.innerHTML = `<i class="${iconClass} me-2"></i>${text}`;
    li.appendChild(link);
    return { li, link };
}

function clearAuthItems(menu) {
    menu.querySelectorAll("li[data-auth-item='true']").forEach((item) => item.remove());
}

function getAccountSlot() {
    return document.getElementById("fw-account-slot");
}

function clearAccountSlot() {
    const slot = getAccountSlot();
    if (slot) slot.innerHTML = "";
}

function getIdentityLabel(user) {
    if (user?.displayName && user.displayName.trim()) return user.displayName.trim();
    if (user?.email) return user.email;
    return "My Account";
}

function getInitial(user) {
    const source = getIdentityLabel(user);
    return source.charAt(0).toUpperCase() || "U";
}

function createAuthIdentityItem(user) {
    const li = document.createElement("li");
    li.setAttribute("data-auth-item", "true");
    li.className = "fw-auth-identity-wrap";

    const link = document.createElement("a");
    link.href = "profile.html";
    link.className = "menu-item menu-item-auth";
    link.innerHTML = `
        <span class="fw-avatar">${getInitial(user)}</span>
        <span class="fw-auth-text">${getIdentityLabel(user)}</span>
    `;

    li.appendChild(link);
    return li;
}

function createAccountButton(user) {
    const label = getIdentityLabel(user);
    const initial = getInitial(user);
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

function createSignOutButton() {
    const button = document.createElement("a");
    button.href = "#";
    button.className = "btn-main btn-line fx-slide nav-cta";
    button.innerHTML = "<span><i class=\"fa fa-sign-out me-2\"></i>Sign Out</span>";
    button.addEventListener("click", async (event) => {
        event.preventDefault();
        try {
            await signOutUser();
            window.location.href = "index.html";
        } catch (err) {
            console.error(err);
        }
    });
    return button;
}

function renderAuthItems(menu, user) {
    clearAuthItems(menu);
    clearAccountSlot();
    const slot = getAccountSlot();

    if (user && user.email) {
        if (slot) {
            slot.appendChild(createSignOutButton());
            slot.appendChild(createAccountButton(user));
        } else {
            menu.appendChild(createAuthIdentityItem(user));
            const logout = createAuthNavItem("Sign Out", "#", "fa fa-sign-out");
            logout.link.addEventListener("click", async (event) => {
                event.preventDefault();
                try {
                    await signOutUser();
                    window.location.href = "index.html";
                } catch (err) {
                    console.error(err);
                }
            });
            menu.appendChild(logout.li);
        }
        return;
    }

    const login = createAuthNavItem("Sign In", "auth.html", "fa fa-sign-in");
    const signup = createAuthNavItem("Sign Up", "auth.html#signup", "fa fa-user-plus");
    login.link.href = "auth.html";
    menu.appendChild(login.li);
    menu.appendChild(signup.li);
    if (slot) slot.appendChild(createSignInButton());
}

document.addEventListener("DOMContentLoaded", () => {
    const menu = document.getElementById("mainmenu");
    if (!menu) return;

    onAuthChanged((user) => {
        renderAuthItems(menu, user);
    });
});
