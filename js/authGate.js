import { onAuthChanged } from "../firebase/firebaseAuth.js";

export function initAuthGate() {
    onAuthChanged((user) => {
        document.body.setAttribute("data-auth-state", user ? "signed-in" : "signed-out");
    });
}

document.addEventListener("DOMContentLoaded", initAuthGate);

