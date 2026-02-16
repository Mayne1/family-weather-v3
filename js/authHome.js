import { onAuthChanged } from "../firebase/firebaseAuth.js";

function updateAuthState(user) {
    const label = document.getElementById("fw-auth-state-label");
    const action = document.getElementById("fw-auth-state-action");
    if (!label || !action) return;

    if (user && user.email) {
        label.innerHTML = `<span class="fw-auth-prefix">Signed in as:</span> <span class="fw-auth-email">${user.email}</span><span class="fw-auth-short">Signed in</span>`;
        action.textContent = "Profile";
        action.href = "profile.html";
        return;
    }

    label.textContent = "You are not signed in.";
    action.textContent = "Sign In";
    action.href = "auth.html";
}

document.addEventListener("DOMContentLoaded", () => {
    onAuthChanged((user) => updateAuthState(user));
});
