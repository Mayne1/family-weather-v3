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
    link.href = "settings.html";
    link.className = "menu-item menu-item-auth";
    link.innerHTML = `
        <span class="fw-avatar">${getInitial(user)}</span>
        <span class="fw-auth-text">${getIdentityLabel(user)}</span>
    `;

    li.appendChild(link);
    return li;
}

function renderAuthItems(menu, user) {
    clearAuthItems(menu);

    if (user && user.email) {
        const logout = createAuthNavItem("Sign Out", "#", "fa fa-right-from-bracket");
        logout.link.addEventListener("click", async (event) => {
            event.preventDefault();
            try {
                await signOutUser();
            } catch (err) {
                console.error(err);
            }
        });
        menu.appendChild(logout.li);
        menu.appendChild(createAuthIdentityItem(user));
        return;
    }

    const login = createAuthNavItem("Sign In", "login.html", "fa fa-right-to-bracket");
    const signup = createAuthNavItem("Sign Up", "login.html#signup", "fa fa-user-plus");
    menu.appendChild(login.li);
    menu.appendChild(signup.li);
}

document.addEventListener("DOMContentLoaded", () => {
    const menu = document.getElementById("mainmenu");
    if (!menu) return;

    onAuthChanged((user) => {
        renderAuthItems(menu, user);
    });
});
