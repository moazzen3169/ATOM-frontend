import { API_BASE_URL as CONFIG_API_BASE_URL } from "../config.js";

const DEFAULT_API_BASE_URL = normalizeBaseUrl(CONFIG_API_BASE_URL);
const PROFILE_ENDPOINT = "/api/auth/users/me";
let redirectInProgress = false;

const adminAccessPromise = (async () => {
  const token = getAccessToken();
  if (!token) {
    redirectToLogin("برای دسترسی به پنل ادمین ابتدا وارد شوید.");
    throw new Error("ACCESS_TOKEN_MISSING");
  }

  try {
    const profile = await fetchProfile(token);
    if (!hasAdminPrivileges(profile)) {
      redirectToHome(
        "حساب شما دسترسی لازم برای ورود به پنل مدیریت را ندارد."
      );
      throw new Error("ADMIN_PRIVILEGES_REQUIRED");
    }
    window.__ADMIN_CURRENT_USER__ = profile;
    return profile;
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
  return window.__ADMIN_CURRENT_USER__ || null;
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
  return localStorage.getItem("access_token");
}

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
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

  if (typeof profile.role === "string" && isAdminRole(profile.role)) return true;

  if (Array.isArray(profile.roles) && profile.roles.some(isAdminRole)) return true;

  if (Array.isArray(profile.groups) && profile.groups.some(isAdminRole)) return true;

  if (Array.isArray(profile.permissions)) {
    return profile.permissions.some((permission) =>
      isAdminRole(typeof permission === "string" ? permission : permission?.name)
    );
  }

  return false;
}

function isAdminRole(value) {
  if (!value) return false;
  const label = value.toString().toLowerCase();
  return (
    label.includes("admin") ||
    label.includes("superuser") ||
    label.includes("staff") ||
    label.includes("manager") ||
    label.includes("support")
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
    window.alert(message);
  }
  window.location.href = url;
}
