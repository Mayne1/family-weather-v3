import { signOutUser } from "../firebase/firebaseAuth.js";

export async function logoutAndRedirect(redirectUrl = "index.html") {
    await signOutUser();
    window.location.href = redirectUrl;
}

