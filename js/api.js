/**
 * API utilities and authentication
 */

import { buildApiUrl, API_ENDPOINTS } from "/js/services/api-client.js";
import { normaliseId, decodeJwtPayload, extractUserIdFromPayload } from "./utils.js";
import { showFeedbackModal } from "./modals.js";

const STORAGE_KEYS = {
  inGameIds: "atom_in_game_ids",
  userId: "atom_cached_user_id",
};

const MAX_SAVED_INGAME_IDS = 10;

export function cacheUserId(identifier) {
  const normalised = normaliseId(identifier);
  if (!normalised) {
    return;
  }

  const storages = [];
  if (typeof sessionStorage !== "undefined") {
    storages.push(sessionStorage);
  }
  if (typeof localStorage !== "undefined") {
    storages.push(localStorage);
  }

  storages.forEach((storage) => {
    try {
      storage.setItem(STORAGE_KEYS.userId, normalised);
    } catch (error) {
      console.warn("Failed to persist user id", error);
    }
  });
}

export function restoreCachedUserId() {
  const storages = [];
  if (typeof sessionStorage !== "undefined") {
    storages.push(sessionStorage);
  }
  if (typeof localStorage !== "undefined") {
    storages.push(localStorage);
  }

  for (const storage of storages) {
    try {
      const stored = storage.getItem(STORAGE_KEYS.userId);
      const identifier = normaliseId(stored);
      if (identifier) {
        return identifier;
      }
    } catch (error) {
      console.warn("Failed to read cached user id", error);
    }
  }

  return null;
}

export function getAuthToken() {
  return (
    localStorage.getItem("authToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    null
  );
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}

export function getAuthHeaders() {
  const token = getAuthToken();
  return token
    ? {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }
    : { "Content-Type": "application/json" };
}

export async function apiFetch(url, options = {}) {
  const config = {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  };

  if (config.body instanceof FormData) {
    if (config.headers && "Content-Type" in config.headers) {
      delete config.headers["Content-Type"];
    }
    if (config.headers && "content-type" in config.headers) {
      delete config.headers["content-type"];
    }
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }
    const networkError = new Error("برقراری ارتباط با سرور ممکن نشد. لطفاً اتصال اینترنت خود را بررسی کنید.");
    networkError.cause = error;
    throw networkError;
  }

  if (response.status === 204) {
    return null;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      payload?.detail ||
      payload?.message ||
      (typeof payload === "string" && payload) ||
      "درخواست با خطا روبه‌رو شد.";
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    error.response = response;
    throw error;
  }

  return payload;
}

export async function resolveUserIdFromProfile() {
  try {
    const url = buildApiUrl(API_ENDPOINTS.users.me);
    const profile = await apiFetch(url.toString());
    const identifier =
      normaliseId(profile?.id) ||
      normaliseId(profile?.user_id) ||
      normaliseId(profile?.pk) ||
      null;

    if (!identifier) {
      throw new Error("شناسه کاربر در حساب کاربری یافت نشد.");
    }

    return identifier;
  } catch (error) {
    console.error("Failed to load user profile", error);
    throw error;
  }
}

export async function ensureUserId() {
  if (state.userId) {
    return state.userId;
  }

  if (state.userIdPromise) {
    return state.userIdPromise;
  }

  const cachedIdentifier = restoreCachedUserId();
  if (cachedIdentifier) {
    state.userId = cachedIdentifier;
    return cachedIdentifier;
  }

  const token = getAuthToken();
  const payload = decodeJwtPayload(token);
  const decodedId = extractUserIdFromPayload(payload);

  if (decodedId) {
    state.userId = decodedId;
    cacheUserId(decodedId);
    return decodedId;
  }

  state.userIdPromise = resolveUserIdFromProfile()
    .then((identifier) => {
      state.userId = identifier;
      cacheUserId(identifier);
      return identifier;
    })
    .finally(() => {
      state.userIdPromise = null;
    });

  return state.userIdPromise;
}

export function notify(key, fallbackMessage, type = "info", overrides = {}) {
  const payload = { ...overrides };
  if (fallbackMessage) {
    payload.message = fallbackMessage;
  }
  if (window.AppNotifier?.showAppNotification) {
    window.AppNotifier.showAppNotification(key, payload);
    return;
  }
  const fallbackType = type === "success" ? "success" : type === "error" ? "error" : "info";
  const fallbackText = payload.message || "";
  if (fallbackType === "success" && typeof window.showSuccess === "function") {
    window.showSuccess(fallbackText);
  } else if (fallbackType === "error" && typeof window.showError === "function") {
    window.showError(fallbackText);
  } else if (typeof window.showInfo === "function") {
    window.showInfo(fallbackText);
  }

  if (fallbackText) {
    showFeedbackModal({
      title:
        fallbackType === "success"
          ? "موفقیت"
          : fallbackType === "error"
          ? "خطا"
          : "اطلاع‌رسانی",
      message: fallbackText,
      type: fallbackType,
      action: payload.action,
    });
  }
}

// In-game ID management
export function getStoredInGameIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.inGameIds);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0);
  } catch (error) {
    console.warn("Failed to parse stored in-game IDs", error);
    return [];
  }
}

export function storeInGameIds(values) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.inGameIds,
      JSON.stringify(values.slice(0, MAX_SAVED_INGAME_IDS)),
    );
  } catch (error) {
    console.warn("Failed to store in-game IDs", error);
  }
}

export function rememberInGameId(value) {
  const trimmed = value.trim();
  if (!trimmed) return;

  const saved = getStoredInGameIds();
  const filtered = saved.filter((item) => item !== trimmed);
  filtered.unshift(trimmed);
  storeInGameIds(filtered);
  state.lastUsedInGameId = trimmed;
}

// State management (will be moved to main file)
let state = {
  userId: null,
  userIdPromise: null,
  lastUsedInGameId: "",
};

export { state };
