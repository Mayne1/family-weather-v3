import { onAuthChanged, signOutUser } from "../firebase/firebaseAuth.js";

const KEYS = {
    displayName: "fw_profile_displayName",
    username: "fw_profile_username",
    bio: "fw_profile_bio",
    city: "fw_profile_city",
    avatarDataUrl: "fw_profile_avatarDataUrl"
};

function getStored(key) {
    return localStorage.getItem(key) || "";
}

function setStored(key, value) {
    localStorage.setItem(key, value || "");
}

function setMessage(text, isError = false) {
    const el = document.getElementById("fw-profile-save-msg");
    if (!el) return;
    el.className = isError ? "small text-danger" : "small text-success";
    el.textContent = text;
}

function getInitial(displayName, email) {
    const source = (displayName || email || "U").trim();
    return source.charAt(0).toUpperCase() || "U";
}

function updateAvatarPreview(displayName, email, avatarDataUrl) {
    const fallback = document.getElementById("fw-profile-avatar-fallback");
    const img = document.getElementById("fw-profile-avatar-img");
    if (!fallback || !img) return;

    fallback.textContent = getInitial(displayName, email);
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

function validate(formData) {
    const displayName = formData.displayName.trim();
    const username = formData.username.trim();
    const bio = formData.bio.trim();
    if (displayName.length < 1 || displayName.length > 40) {
        return "Display name must be between 1 and 40 characters.";
    }
    if (bio.length > 240) {
        return "Bio must be 240 characters or less.";
    }
    if (username.length > 20 || !/^[A-Za-z0-9_]*$/.test(username)) {
        return "Username must be 0-20 chars and use only letters, numbers, or _.";
    }
    return "";
}

function bindAvatarUpload(userEmail) {
    const input = document.getElementById("fw-profile-avatar-input");
    const displayNameInput = document.getElementById("fw-profile-display-name");
    if (!input) return;

    input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const value = typeof reader.result === "string" ? reader.result : "";
            setStored(KEYS.avatarDataUrl, value);
            updateAvatarPreview(displayNameInput ? displayNameInput.value : "", userEmail, value);
        };
        reader.readAsDataURL(file);
    });
}

function initSignedInState(user) {
    const gate = document.getElementById("fw-profile-gate");
    const content = document.getElementById("fw-profile-content");
    const emailEl = document.getElementById("fw-profile-email");
    const memberSinceEl = document.getElementById("fw-profile-member-since");
    const signOutBtn = document.getElementById("fw-profile-signout");
    const form = document.getElementById("fw-profile-form");
    const displayNameInput = document.getElementById("fw-profile-display-name");
    const usernameInput = document.getElementById("fw-profile-username");
    const bioInput = document.getElementById("fw-profile-bio");
    const cityInput = document.getElementById("fw-profile-city");

    if (!content || !gate || !form || !displayNameInput || !usernameInput || !bioInput || !cityInput || !emailEl || !memberSinceEl) {
        return;
    }

    if (!user || !user.email) {
        gate.classList.remove("d-none");
        content.classList.add("d-none");
        return;
    }

    gate.classList.add("d-none");
    content.classList.remove("d-none");

    const storedDisplayName = getStored(KEYS.displayName);
    const storedUsername = getStored(KEYS.username);
    const storedBio = getStored(KEYS.bio);
    const storedCity = getStored(KEYS.city);
    const storedAvatar = getStored(KEYS.avatarDataUrl);

    displayNameInput.value = storedDisplayName || user.displayName || user.email;
    usernameInput.value = storedUsername;
    bioInput.value = storedBio;
    cityInput.value = storedCity;
    emailEl.value = user.email;
    memberSinceEl.value = user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : "\u2014";

    updateAvatarPreview(displayNameInput.value, user.email, storedAvatar);
    bindAvatarUpload(user.email);

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const payload = {
            displayName: displayNameInput.value || "",
            username: usernameInput.value || "",
            bio: bioInput.value || "",
            city: cityInput.value || "",
            avatarDataUrl: getStored(KEYS.avatarDataUrl)
        };
        const error = validate(payload);
        if (error) {
            setMessage(error, true);
            return;
        }
        setStored(KEYS.displayName, payload.displayName.trim());
        setStored(KEYS.username, payload.username.trim());
        setStored(KEYS.bio, payload.bio.trim());
        setStored(KEYS.city, payload.city.trim());
        setStored(KEYS.avatarDataUrl, payload.avatarDataUrl);
        updateAvatarPreview(payload.displayName, user.email, payload.avatarDataUrl);
        setMessage("Saved");
    });

    if (signOutBtn) {
        signOutBtn.addEventListener("click", async () => {
            try {
                await signOutUser();
                window.location.href = "login.html";
            } catch (err) {
                setMessage("Could not sign out. Please try again.", true);
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    onAuthChanged((user) => {
        initSignedInState(user);
    });
});


