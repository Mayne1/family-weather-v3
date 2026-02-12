import { onAuthChanged, signOutUser } from "../firebase/firebaseAuth.js";
import { getProfile, saveProfile } from "./fw-store.js";

function setMessage(text, isError = false) {
  const el = document.getElementById("fw-profile-save-msg");
  if (!el) return;
  el.className = isError ? "small text-danger" : "small text-success";
  el.textContent = text;
}

function getInitial(username, email) {
  const source = (username || email || "U").trim();
  return source.charAt(0).toUpperCase() || "U";
}

function updateAvatar(username, email, avatarDataUrl) {
  const fallback = document.getElementById("fw-profile-avatar-fallback");
  const img = document.getElementById("fw-profile-avatar-img");
  if (!fallback || !img) return;
  fallback.textContent = getInitial(username, email);
  if (avatarDataUrl) {
    img.src = avatarDataUrl;
    img.classList.remove("d-none");
    fallback.classList.add("d-none");
  } else {
    img.removeAttribute("src");
    img.classList.add("d-none");
    fallback.classList.remove("d-none");
  }
}

function validateProfile(profile) {
  const username = String(profile.username || "").trim();
  const bio = String(profile.bio || "").trim();
  if (!username || username.length > 20 || !/^[A-Za-z0-9_]+$/.test(username)) {
    return "Username must be 1-20 chars and use only letters, numbers, or _.";
  }
  if (bio.length > 240) return "Bio must be 240 characters or less.";
  return "";
}

function bindAvatarUpload(current) {
  const input = document.getElementById("fw-profile-avatar-input");
  const usernameInput = document.getElementById("fw-profile-username");
  if (!input || !usernameInput) return;
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const profile = getProfile() || {};
      profile.avatarInitial = getInitial(usernameInput.value, current.email);
      profile.avatarDataUrl = typeof reader.result === "string" ? reader.result : "";
      profile.updatedAt = new Date().toISOString();
      saveProfile(profile);
      updateAvatar(usernameInput.value, current.email, profile.avatarDataUrl);
      setMessage("Saved");
    };
    reader.readAsDataURL(file);
  });
}

function renderSignedOut() {
  document.getElementById("fw-profile-gate")?.classList.remove("d-none");
  document.getElementById("fw-profile-content")?.classList.add("d-none");
}

function renderSignedIn(user) {
  const gate = document.getElementById("fw-profile-gate");
  const content = document.getElementById("fw-profile-content");
  const form = document.getElementById("fw-profile-form");
  const usernameInput = document.getElementById("fw-profile-username");
  const bioInput = document.getElementById("fw-profile-bio");
  const cityInput = document.getElementById("fw-profile-city");
  const emailInput = document.getElementById("fw-profile-email");
  const memberSince = document.getElementById("fw-profile-member-since");
  const signOutBtn = document.getElementById("fw-profile-signout");
  if (!content || !gate || !form || !usernameInput || !bioInput || !cityInput || !emailInput || !memberSince) return;

  gate.classList.add("d-none");
  content.classList.remove("d-none");

  const existing = getProfile() || {};
  const merged = {
    email: user.email,
    username: existing.username || user.displayName || user.email.split("@")[0],
    bio: existing.bio || "",
    homeZip: existing.homeZip || "",
    avatarInitial: existing.avatarInitial || getInitial(existing.username || user.displayName, user.email),
    avatarDataUrl: existing.avatarDataUrl || "",
    updatedAt: existing.updatedAt || user.metadata?.creationTime || new Date().toISOString()
  };

  usernameInput.value = merged.username;
  bioInput.value = merged.bio;
  cityInput.value = merged.homeZip;
  emailInput.value = merged.email;
  memberSince.value = user.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : "—";
  updateAvatar(merged.username, merged.email, merged.avatarDataUrl);
  bindAvatarUpload({ email: user.email });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextProfile = {
      email: user.email,
      username: usernameInput.value.trim(),
      bio: bioInput.value.trim(),
      homeZip: cityInput.value.trim(),
      avatarInitial: getInitial(usernameInput.value.trim(), user.email),
      avatarDataUrl: (getProfile() || {}).avatarDataUrl || "",
      updatedAt: new Date().toISOString()
    };
    const err = validateProfile(nextProfile);
    if (err) {
      setMessage(err, true);
      return;
    }
    saveProfile(nextProfile);
    updateAvatar(nextProfile.username, nextProfile.email, nextProfile.avatarDataUrl);
    setMessage("Saved");
  });

  signOutBtn?.addEventListener("click", async () => {
    await signOutUser();
    window.location.href = "index.html";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  onAuthChanged((user) => {
    if (!user || !user.email) {
      renderSignedOut();
      return;
    }
    renderSignedIn(user);
  });
});
