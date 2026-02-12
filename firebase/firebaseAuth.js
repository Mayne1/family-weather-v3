import { onAuthChanged as onLocalAuthChanged, signInLocal, signOut, signUpLocal } from "../js/fw-store.js";

function toUserShape(user) {
  if (!user) return null;
  return {
    email: user.email,
    displayName: user.username || user.email,
    metadata: { creationTime: user.createdAt || null }
  };
}

export async function signInWithEmail(email, password) {
  const user = signInLocal(email, password);
  return { user: toUserShape(user) };
}

export async function signUpWithEmail(email, password, username) {
  const user = signUpLocal(email, username || email.split("@")[0], password);
  return { user: toUserShape(user) };
}

export async function signOutUser() {
  signOut();
}

export function onAuthChanged(callback) {
  return onLocalAuthChanged((user) => callback(toUserShape(user)));
}

export function getAuthErrorMessage(error) {
  const code = error && error.code ? error.code : "";
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/invalid-username":
      return "Please enter a username.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/email-already-in-use":
      return "That email is already in use.";
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    default:
      return (error && error.message) || "Authentication failed.";
  }
}
