import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged as firebaseOnAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

async function loadFirebaseConfig() {
    try {
        const local = await import("./firebaseConfig.local.js");
        if (local && local.firebaseConfig) {
            return local.firebaseConfig;
        }
    } catch (err) {
        // fall back to repo-safe config
    }

    const shared = await import("./firebaseConfig.js");
    return shared.firebaseConfig;
}

function isConfigured(config) {
    if (!config) return false;
    const required = ["apiKey", "authDomain", "projectId", "appId"];
    return required.every((key) => {
        const value = (config[key] || "").trim();
        return value && value !== "REPLACE_ME";
    });
}

const authReady = (async () => {
    const config = await loadFirebaseConfig();
    if (!isConfigured(config)) {
        throw new Error("Firebase Auth is not configured. Add firebase/firebaseConfig.local.js");
    }

    const app = getApps().length ? getApp() : initializeApp(config);
    return getAuth(app);
})();

export async function signInWithEmail(email, password) {
    const auth = await authReady;
    return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email, password) {
    const auth = await authReady;
    return createUserWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
    const auth = await authReady;
    return signOut(auth);
}

export function onAuthChanged(callback) {
    let unsubscribe = () => {};
    authReady
        .then((auth) => {
            unsubscribe = firebaseOnAuthStateChanged(auth, callback);
        })
        .catch(() => {
            callback(null);
        });
    return () => unsubscribe();
}

export function getAuthErrorMessage(error) {
    const code = error && error.code ? error.code : "";
    switch (code) {
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/missing-password":
            return "Please enter your password.";
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "Incorrect email or password.";
        case "auth/email-already-in-use":
            return "That email is already in use.";
        case "auth/weak-password":
            return "Password should be at least 6 characters.";
        default:
            return error && error.message ? error.message : "Authentication failed.";
    }
}

