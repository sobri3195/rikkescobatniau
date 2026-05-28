export const STORAGE_MODE = (import.meta.env.VITE_STORAGE_MODE || "local").toLowerCase();

export const isLocalMode = STORAGE_MODE === "local";
export const isRemoteStorageMode = STORAGE_MODE === "remote";
