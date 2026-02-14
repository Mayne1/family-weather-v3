const KEYS = {
  authUser: "fw_auth_user",
  profile: "fw_profile",
  events: "fw_events",
  invites: "fw_invites",
  rsvps: "fw_rsvps",
  authAccounts: "fw_auth_accounts",
  contacts: "fw_contacts",
  groups: "fw_groups"
};

const AUTH_EVENT = "fw-auth-changed";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_err) {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getNow() {
  return new Date().toISOString();
}

function emitAuthChanged() {
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

export { KEYS, readJson, writeJson, normalizeEmail, getNow };

export function getCurrentUser() {
  return readJson(KEYS.authUser, null);
}

export function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem(KEYS.authUser);
  } else {
    writeJson(KEYS.authUser, user);
  }
  emitAuthChanged();
}

export function signOut() {
  setCurrentUser(null);
}

export function getAccounts() {
  return readJson(KEYS.authAccounts, []);
}

export function signUpLocal(email, username, password) {
  const normalizedEmail = normalizeEmail(email);
  const cleanUsername = String(username || "").trim();
  const cleanPassword = String(password || "");

  if (!normalizedEmail) throw Object.assign(new Error("Email required"), { code: "auth/invalid-email" });
  if (!cleanUsername) throw Object.assign(new Error("Username required"), { code: "auth/invalid-username" });
  if (cleanPassword.length < 6) throw Object.assign(new Error("Password too short"), { code: "auth/weak-password" });

  const accounts = getAccounts();
  if (accounts.some((a) => a.email === normalizedEmail)) {
    throw Object.assign(new Error("Email already used"), { code: "auth/email-already-in-use" });
  }

  const createdAt = getNow();
  // MVP only: password is stored in localStorage until backend auth is added.
  accounts.push({ email: normalizedEmail, username: cleanUsername, password: cleanPassword, createdAt });
  writeJson(KEYS.authAccounts, accounts);

  const authUser = { email: normalizedEmail, username: cleanUsername, createdAt };
  setCurrentUser(authUser);
  return authUser;
}

export function signInLocal(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const cleanPassword = String(password || "");
  const account = getAccounts().find((a) => a.email === normalizedEmail && a.password === cleanPassword);
  if (!account) {
    throw Object.assign(new Error("Incorrect email or password"), { code: "auth/invalid-credential" });
  }
  const authUser = { email: account.email, username: account.username, createdAt: account.createdAt };
  setCurrentUser(authUser);
  return authUser;
}

export function onAuthChanged(callback) {
  const run = () => callback(getCurrentUser());
  run();
  const eventHandler = () => run();
  const storageHandler = (event) => {
    if (!event || event.key === KEYS.authUser) run();
  };
  window.addEventListener(AUTH_EVENT, eventHandler);
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(AUTH_EVENT, eventHandler);
    window.removeEventListener("storage", storageHandler);
  };
}

export function requireAuth(redirect = "auth.html") {
  const user = getCurrentUser();
  if (user && user.email) return user;
  const next = encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search);
  window.location.href = `${redirect}?next=${next}`;
  return null;
}

export function getProfile() {
  return readJson(KEYS.profile, null);
}

export function saveProfile(profile) {
  writeJson(KEYS.profile, profile);
}

export function getEvents() {
  return readJson(KEYS.events, []);
}

export function saveEvents(events) {
  writeJson(KEYS.events, events);
}

export function getInvites() {
  return readJson(KEYS.invites, []);
}

export function saveInvites(invites) {
  writeJson(KEYS.invites, invites);
}

export function getRsvps() {
  return readJson(KEYS.rsvps, []);
}

export function saveRsvps(rsvps) {
  writeJson(KEYS.rsvps, rsvps);
}

export function getContacts() {
  return readJson(KEYS.contacts, []);
}

export function saveContacts(contacts) {
  writeJson(KEYS.contacts, contacts);
}

export function getGroups() {
  return readJson(KEYS.groups, []);
}

export function saveGroups(groups) {
  writeJson(KEYS.groups, groups);
}

export function generateToken(length = 16) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
