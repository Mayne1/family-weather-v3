import { signInWithEmail, signUpWithEmail, onAuthChanged, getAuthErrorMessage } from "../firebase/firebaseAuth.js";

function setMessage(text, isError) {
    const message = document.getElementById("auth-message");
    if (!message) return;
    message.textContent = text || "";
    message.className = isError ? "mt-3 text-danger" : "mt-3 text-success";
}

function isFirebaseConfigured() {
    return window.__FW_FIREBASE_CONFIG_OK !== false;
}

function getFormValues() {
    const email = (document.getElementById("auth-email")?.value || "").trim();
    const username = (document.getElementById("auth-username")?.value || "").trim();
    const password = document.getElementById("auth-password")?.value || "";
    return { email, username, password };
}

async function handleSignIn(event) {
    event.preventDefault();
    if (!isFirebaseConfigured()) {
        setMessage("Firebase not configured", true);
        return;
    }
    const { email, password } = getFormValues();
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    try {
        await signInWithEmail(email, password);
        setMessage("Signed in. Redirecting...", false);
        window.location.href = next || "index.html";
    } catch (err) {
        setMessage(getAuthErrorMessage(err), true);
    }
}

async function handleSignUp(event) {
    event.preventDefault();
    if (!isFirebaseConfigured()) {
        setMessage("Firebase not configured", true);
        return;
    }
    const { email, username, password } = getFormValues();
    if (!username) {
        setMessage("Username is required for sign up.", true);
        return;
    }
    try {
        await signUpWithEmail(email, password, username);
        setMessage("Account created. Redirecting...", false);
        window.location.href = "profile.html";
    } catch (err) {
        setMessage(getAuthErrorMessage(err), true);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const signInBtn = document.getElementById("btn-sign-in");
    const signUpBtn = document.getElementById("btn-sign-up");

    signInBtn?.addEventListener("click", handleSignIn);
    signUpBtn?.addEventListener("click", handleSignUp);

    if (window.location.hash === "#signup") {
        setMessage("Create an account with email and password.", false);
    }

    if (!isFirebaseConfigured()) {
        setMessage("Firebase not configured", true);
    }

    onAuthChanged((user) => {
        const status = document.getElementById("auth-current-user");
        if (!status) return;
        status.textContent = user?.email ? `Signed in as ${user.email}` : "Signed out";
    });
});
