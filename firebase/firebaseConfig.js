const runtimeConfig =
  typeof window !== "undefined" && window.firebaseConfig && typeof window.firebaseConfig === "object"
    ? window.firebaseConfig
    : {};

export const firebaseConfig = runtimeConfig;
