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

function safeEmail(email) {
    if (!email) return "My Account";
    return email.length > 28 ? `${email.slice(0, 28)}...` : email;
}

function renderAuthItems(menu, user) {
    clearAuthItems(menu);

    if (user && user.email) {
        const account = createAuthNavItem(`My Account (${safeEmail(user.email)})`, "settings.html", "fa fa-user");
        const logout = createAuthNavItem("Sign Out", "#", "fa fa-right-from-bracket");
        logout.link.addEventListener("click", async (event) => {
            event.preventDefault();
            try {
                await signOutUser();
            } catch (err) {
                console.error(err);
            }
        });
        menu.appendChild(account.li);
        menu.appendChild(logout.li);
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

