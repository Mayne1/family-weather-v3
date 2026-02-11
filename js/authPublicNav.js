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

function createIdentity(user) {
    const label = user?.displayName?.trim() || user?.email || "My Account";
    const initial = label.charAt(0).toUpperCase() || "U";
    const li = document.createElement("li");
    li.setAttribute("data-auth-item", "true");
    const link = document.createElement("a");
    link.className = "menu-item menu-item-auth";
    link.href = "settings.html";
    link.innerHTML = `<span class="fw-avatar">${initial}</span><span class="fw-auth-text">${label}</span>`;
    li.appendChild(link);
    return li;
}

document.addEventListener("DOMContentLoaded", () => {
    const menu = document.getElementById("mainmenu");
    if (!menu) return;

    const privateLinks = Array.from(menu.querySelectorAll("[data-private-nav='true']"));

    onAuthChanged((user) => {
        menu.querySelectorAll("li[data-auth-item='true']").forEach((el) => el.remove());

        if (user && user.email) {
            privateLinks.forEach((el) => (el.style.display = ""));
            const logout = createItem("Sign Out", "#", "fa fa-right-from-bracket");
            logout.link.addEventListener("click", async (event) => {
                event.preventDefault();
                await signOutUser();
            });
            menu.appendChild(createIdentity(user));
            menu.appendChild(logout.li);
            return;
        }

        privateLinks.forEach((el) => (el.style.display = "none"));
        menu.appendChild(createItem("Sign In", "login.html", "fa fa-right-to-bracket").li);
        menu.appendChild(createItem("Sign Up", "login.html#signup", "fa fa-user-plus").li);
    });
});

