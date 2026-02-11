import { signUpWithEmail } from "../firebase/firebaseAuth.js";

export async function signUp(email, password) {
    return signUpWithEmail(email, password);
}

