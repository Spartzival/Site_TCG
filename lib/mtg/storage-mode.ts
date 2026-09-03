export type MtgStorageMode = "guest" | "cloud";

const STORAGE_MODE_KEY = "card-projects:mtg-storage-mode";

export function getStorageMode(): MtgStorageMode | null {
  if (typeof window === "undefined") return null;

  const value = window.localStorage.getItem(STORAGE_MODE_KEY);
  return value === "guest" || value === "cloud" ? value : null;
}

export function setStorageMode(mode: MtgStorageMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_MODE_KEY, mode);
}

export function clearStorageMode() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_MODE_KEY);
}

export function isGuestMode() {
  return getStorageMode() === "guest";
}
