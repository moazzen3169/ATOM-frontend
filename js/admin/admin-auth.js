import { API_BASE_URL as CONFIG_API_BASE_URL } from "../config.js";

const DEFAULT_API_BASE_URL = normalizeBaseUrl(CONFIG_API_BASE_URL);
const PROFILE_ENDPOINT = "/api/auth/users/me";
const ADMIN_USER_STORAGE_KEY = "user_data";
const ADMIN_PROFILE_PICTURE_KEY = "profile_picture";
const ADMIN_USER_CHANGE_EVENT = "atom:admin-user-changed";
const ADMIN_ROLE_KEYWORDS = [
  "admin",
  "superuser",
  "staff",
  "manager",
  "support",
  "moderator",
  "operator",
  "ادمین",
  "مدیر",
  "پشتیبان",
];
const ADMIN_CONTEXT_KEYWORDS = [
  "admin",
  "superuser",
  "staff",
  "manager",
  "support",
  "moderator",
  "operator",
  "permission",
  "permissions",
  "privilege",
  "privileges",
  "scope",
  "scopes",
  "access",
  "level",
  "panel",
  "dashboard",
  "control",
];
let redirectInProgress = false;
let cachedStoredUser;
let hasCachedStoredUser = false;

const adminAccessPromise = (async () => {
  const token = getAccessToken();
  if (!token) {
    redirectToLogin("برای دسترسی به پنل ادمین ابتدا وارد شوید.");
    throw new Error("ACCESS_TOKEN_MISSING");
  }

  const storedUser = getStoredAdminUser();
  if (storedUser) {
    window.__ADMIN_CURRENT_USER__ = storedUser;
    emitAdminUserChange(storedUser);
    return storedUser;
  }

  try {
    const profile = await fetchProfile(token);
    const normalizedProfile = mergeUsers(storedUser, profile);
    cacheAdminUser(normalizedProfile);
    return normalizedProfile;
  } catch (error) {
    console.error("Failed to verify admin access", error);
    throw error;
  }
})();

window.__adminAccessPromise = adminAccessPromise;

export function ensureAdminAccess() {
  return adminAccessPromise;
}

export function getAdminUser() {
  return window.__ADMIN_CURRENT_USER__ || getStoredAdminUser() || null;
}

export function onAdminUserChange(callback) {
  if (typeof window === "undefined" || typeof callback !== "function") {
    return () => {};
  }

  const handleEvent = (event) => {
    const user = event?.detail?.user ?? getStoredAdminUser();
    callback(user, event);
  };

  const handleStorage = (event) => {
    if (event.key && event.key !== ADMIN_USER_STORAGE_KEY) {
      return;
    }
    invalidateStoredUserCache();
    callback(getStoredAdminUser(), event);
  };

  window.addEventListener(ADMIN_USER_CHANGE_EVENT, handleEvent);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(ADMIN_USER_CHANGE_EVENT, handleEvent);
    window.removeEventListener("storage", handleStorage);
  };
}

export function buildApiUrl(path = "") {
  if (!path) return DEFAULT_API_BASE_URL;
  if (isAbsoluteUrl(path)) return path;
  const base = DEFAULT_API_BASE_URL || "";
  const sanitizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${sanitizedPath}`;
}

export function handleUnauthorizedAccess(message) {
  clearTokens();
  redirectToLogin(message || "نشست شما منقضی شده است. لطفا دوباره وارد شوید.");
  throw new Error("ADMIN_UNAUTHORIZED");
}

function normalizeBaseUrl(base) {
  if (!base) return "";
  return base.replace(/\/+$/, "");
}

function isAbsoluteUrl(path) {
  return /^https?:\/\//i.test(path);
}

function getAccessToken() {
  try {
    return localStorage.getItem("access_token");
  } catch (error) {
    console.warn("Cannot access localStorage for access token", error);
    return null;
  }
}

function getStoredAdminUser() {
  if (hasCachedStoredUser) {
    return cachedStoredUser || null;
  }

  const storedUser = readUserFromStorage();
  cachedStoredUser = storedUser;
  hasCachedStoredUser = true;
  return storedUser;
}

function readUserFromStorage() {
  try {
    const raw = localStorage.getItem(ADMIN_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      localStorage.removeItem(ADMIN_USER_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn("Failed to parse stored admin user", error);
    localStorage.removeItem(ADMIN_USER_STORAGE_KEY);
    return null;
  }
}

function invalidateStoredUserCache() {
  hasCachedStoredUser = false;
  cachedStoredUser = null;
}

function cacheAdminUser(user) {
  if (!user || typeof user !== "object") {
    return;
  }

  const sanitizedUser = sanitizeUser(user);

  try {
    localStorage.setItem(
      ADMIN_USER_STORAGE_KEY,
      JSON.stringify(sanitizedUser)
    );
  } catch (error) {
    console.warn("Failed to persist admin user in storage", error);
  }

  const avatar = getProfilePicture(sanitizedUser);
  if (avatar) {
    try {
      localStorage.setItem(ADMIN_PROFILE_PICTURE_KEY, avatar);
    } catch (error) {
      console.warn("Failed to persist admin avatar", error);
    }
  }

  window.__ADMIN_CURRENT_USER__ = sanitizedUser;
  cachedStoredUser = sanitizedUser;
  hasCachedStoredUser = true;
  emitAdminUserChange(sanitizedUser);
}

function emitAdminUserChange(user) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }

  const detailUser = user ? sanitizeUser(user) : null;
  try {
    const event = new CustomEvent(ADMIN_USER_CHANGE_EVENT, {
      detail: { user: detailUser },
    });
    window.dispatchEvent(event);
  } catch (error) {
    // Fallback for environments without CustomEvent constructor
    try {
      const fallbackEvent = document.createEvent("CustomEvent");
      fallbackEvent.initCustomEvent(
        ADMIN_USER_CHANGE_EVENT,
        false,
        false,
        { user: detailUser }
      );
      window.dispatchEvent(fallbackEvent);
    } catch (fallbackError) {
      console.warn("Failed to dispatch admin user change event", fallbackError);
    }
  }
}

function sanitizeUser(user) {
  if (!user || typeof user !== "object") {
    return null;
  }

  const clone = {};
  for (const [key, value] of Object.entries(user)) {
    if (typeof value === "function") continue;
    clone[key] = value;
  }
  return clone;
}

function mergeUsers(stored, fetched) {
  if (stored && fetched) {
    return sanitizeUser({ ...stored, ...fetched });
  }
  if (fetched) {
    return sanitizeUser(fetched);
  }
  if (stored) {
    return sanitizeUser(stored);
  }
  return null;
}

function clearTokens() {
  try {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem(ADMIN_USER_STORAGE_KEY);
    localStorage.removeItem(ADMIN_PROFILE_PICTURE_KEY);
  } catch (error) {
    console.warn("Failed to clear authentication storage", error);
  }
  invalidateStoredUserCache();
  emitAdminUserChange(null);
}

async function fetchProfile(token) {
  const endpoint = buildApiUrl(PROFILE_ENDPOINT);

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (response.status === 401 || response.status === 403) {
    handleUnauthorizedAccess("نشست شما منقضی شده است. لطفا دوباره وارد شوید.");
  }

  if (!response.ok) {
    throw new Error(`FAILED_TO_FETCH_PROFILE:${response.status}`);
  }

  return response.json();
}

function hasAdminPrivileges(profile) {
  if (!profile || typeof profile !== "object") return false;

  if (profile.is_admin || profile.is_superuser || profile.is_staff) return true;

  if (typeof profile.admin === "boolean" && profile.admin) return true;

  if (typeof profile.admin_level === "number" && profile.admin_level > 0) return true;

  if (typeof profile.admin_level === "string" && profile.admin_level.trim() !== "") {
    const parsedAdminLevel = Number.parseInt(profile.admin_level, 10);
    if (Number.isFinite(parsedAdminLevel) && parsedAdminLevel > 0) {
      return true;
    }
  }

  if (typeof profile.role === "string" && isAdminRole(profile.role)) return true;

  if (Array.isArray(profile.role) && profile.role.some(isAdminRole)) return true;

  if (isAdminRole(profile.role?.name)) return true;

  if (Array.isArray(profile.roles) && profile.roles.some(isAdminRole)) return true;

  if (Array.isArray(profile.groups) && profile.groups.some(isAdminRole)) return true;

  if (
    hasAnyAdminEntry(profile.permissions, { treatAnyTruthy: true }, "permissions")
  ) {
    return true;
  }

  const adminRelated = [
    ["admin_permissions", profile.admin_permissions],
    ["admin_roles", profile.admin_roles],
    ["admin_groups", profile.admin_groups],
    ["permissions_map", profile.permissions_map],
    ["privileges", profile.privileges],
    ["admin_privileges", profile.admin_privileges],
    ["scopes", profile.scopes],
    ["admin_scopes", profile.admin_scopes],
    ["admin_access", profile.admin_access],
  ];

  for (const [keyPath, value] of adminRelated) {
    if (hasAnyAdminEntry(value, { treatAnyTruthy: true }, keyPath)) {
      return true;
    }
  }

  const adminAccessCandidates = [
    ["access", profile.access],
    ["access_level", profile.access_level],
  ];

  for (const [keyPath, value] of adminAccessCandidates) {
    if (hasAnyAdminEntry(value, { treatAnyTruthy: false }, keyPath)) {
      return true;
    }
  }

  for (const [key, value] of Object.entries(profile)) {
    if (typeof value === "boolean") {
      if (
        value === true &&
        (key.startsWith("is_")
          ? ADMIN_ROLE_KEYWORDS.some((keyword) => key.toLowerCase().includes(keyword))
          : keyMatchesAdminContext(key))
      ) {
        return true;
      }
      continue;
    }

    if (hasAnyAdminEntry(value, { treatAnyTruthy: false }, key.toLowerCase())) {
      return true;
    }
  }

  return false;
}

function isAdminRole(value) {
  if (!value) return false;

  if (typeof value === "object") {
    const entries = [value.name, value.code, value.label, value.title];
    return entries.some((entry) => entry && entry !== value && isAdminRole(entry));
  }

  const label = value.toString().trim().toLowerCase();
  if (!label) return false;

  return ADMIN_ROLE_KEYWORDS.some((keyword) => label.includes(keyword));
}

function hasAnyAdminEntry(value, options = {}, keyPath = "") {
  if (!value) return false;

  const normalizedKeyPath = keyPath ? keyPath.toString().toLowerCase() : "";
  const contextTreatAnyTruthy =
    normalizedKeyPath && keyMatchesAdminContext(normalizedKeyPath);
  const treatAnyTruthy = options.treatAnyTruthy || contextTreatAnyTruthy;
  const treatAnyTruthyExplicit = Boolean(options.treatAnyTruthy);

  if (typeof value === "string") {
    const normalizedValue = value.toString().trim().toLowerCase();
    if (!normalizedValue) return false;

    const allowRoleMatch =
      treatAnyTruthyExplicit ||
      contextTreatAnyTruthy ||
      (normalizedKeyPath && /(role|group|type)/.test(normalizedKeyPath));

    if (allowRoleMatch && !isNameLikeKey(normalizedKeyPath) && isAdminRole(normalizedValue)) {
      return true;
    }

    if (!treatAnyTruthy) {
      return false;
    }

    if (!treatAnyTruthyExplicit && contextTreatAnyTruthy) {
      const numericCandidate = Number.parseFloat(normalizedValue);
      if (Number.isFinite(numericCandidate) && numericCandidate > 0) {
        return true;
      }

      return isAdminRole(normalizedValue);
    }

    if (
      normalizedValue === "0" ||
      normalizedValue === "false" ||
      normalizedValue === "no" ||
      normalizedValue === "none"
    ) {
      return false;
    }

    return true;
  }

  if (typeof value === "boolean") {
    return value === true && treatAnyTruthy;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 && treatAnyTruthy;
  }

  if (Array.isArray(value)) {
    if (!value.length) return false;
    return value.some((item) =>
      hasAnyAdminEntry(item, { treatAnyTruthy }, normalizedKeyPath)
    );
  }

  if (typeof value === "object") {
    return Object.entries(value).some(([childKey, childValue]) => {
      const nextKeyPath = normalizedKeyPath
        ? `${normalizedKeyPath}_${childKey}`.toLowerCase()
        : childKey.toLowerCase();
      return hasAnyAdminEntry(childValue, { treatAnyTruthy }, nextKeyPath);
    });
  }

  return false;
}

function keyMatchesAdminContext(key) {
  if (!key) return false;
  const normalized = key.toString().toLowerCase();
  return ADMIN_CONTEXT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isNameLikeKey(key) {
  if (!key) return false;
  if (key.includes("admin")) return false;
  return /(username|user_name|display_name|nickname|nick_name|full_name|first_name|last_name|family_name|given_name)/i.test(
    key
  );
}

function getProfilePicture(user) {
  if (!user || typeof user !== "object") return null;
  return (
    user.profile_picture ||
    user.avatar ||
    user.image ||
    user.photo ||
    user.photo_url ||
    user.picture ||
    null
  );
}

function redirectToLogin(message) {
  safeRedirect("/register/login.html", message);
}

function redirectToHome(message) {
  safeRedirect("/", message);
}

function safeRedirect(url, message) {
  if (redirectInProgress) return;
  redirectInProgress = true;
  if (message) {
    if (window.AppNotifier?.showAppNotification) {
      window.AppNotifier.showAppNotification("adminRedirectInfo", { message });
    } else {
      showInfo(message);
    }
  }
  window.location.href = url;
}

window.addEventListener?.("storage", (event) => {
  if (event.key && event.key !== ADMIN_USER_STORAGE_KEY) {
    return;
  }
  invalidateStoredUserCache();
});
