import { onAuthChanged } from "../firebase/firebaseAuth.js";

function updateAuthState(user) {
    const label = document.getElementById("fw-auth-state-label");
    const action = document.getElementById("fw-auth-state-action");
    if (!label || !action) return;

    if (user && user.email) {
        label.textContent = `Signed in as ${user.email}`;
        action.textContent = "Manage Account";
        action.href = "settings.html";
        return;
    }

    label.textContent = "You are not signed in.";
    action.textContent = "Sign In";
    action.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
    onAuthChanged((user) => updateAuthState(user));
});

