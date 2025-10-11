import { API_BASE_URL } from "../config.js";

const JSON_MIME = "application/json";

export function getAccessTokenOrRedirect() {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) {
      window.location.href = "/register/login.html";
      throw new Error("توکن ورود یافت نشد");
    }
    return token;
  } catch (error) {
    console.error("Failed to read access token", error);
    throw error;
  }
}

export function buildApiUrl(path = "") {
  if (!path) return API_BASE_URL;
  const normalizedPath = path.startsWith("http")
    ? path
    : `${API_BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  return normalizedPath;
}

export async function fetchWithAuth(path, options = {}) {
  const token = getAccessTokenOrRedirect();
  const url = buildApiUrl(path);

  const headers = new Headers(options.headers || {});
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", JSON_MIME);
  }

  const config = {
    method: options.method || "GET",
    headers,
    body:
      options.body &&
      options.body instanceof FormData
        ? options.body
        : options.body && typeof options.body === "object"
        ? JSON.stringify(options.body)
        : options.body,
    signal: options.signal,
    credentials: "include",
  };

  const response = await fetch(url, config);

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_data");
    window.location.href = "/register/login.html";
    throw new Error("دسترسی نامعتبر است");
  }

  const text = await response.text();
  const payload = parseJsonSafe(text);

  if (!response.ok) {
    const detail = extractErrorMessage(payload, text) || response.statusText;
    throw new Error(detail || "خطای ناشناخته سرور");
  }

  return payload;
}

export async function fetchJsonList(path, options = {}) {
  const data = await fetchWithAuth(path, options);
  return Array.isArray(data) ? data : data?.results || [];
}

export function parseJsonSafe(text = "") {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

export function extractErrorMessage(payload, fallback = "") {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) return payload.join(" | ");
  if (payload.detail) return payload.detail;
  if (payload.error) return payload.error;
  if (payload.message) return payload.message;
  const firstKey = Object.keys(payload)[0];
  if (firstKey) {
    const value = payload[firstKey];
    if (Array.isArray(value)) return value.join(" | ");
    if (typeof value === "string") return value;
  }
  return fallback;
}

export function formatNumber(value, locales = "fa-IR") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }
  try {
    return new Intl.NumberFormat(locales).format(Number(value));
  } catch (error) {
    return Number(value).toLocaleString();
  }
}

export function formatCurrency(value, locales = "fa-IR", currency = "IRR") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }
  try {
    return new Intl.NumberFormat(locales, {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch (error) {
    return `${Number(value).toLocaleString()} ریال`;
  }
}

export function normalizeDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value, locales = "fa-IR") {
  const date = normalizeDate(value);
  if (!date) return "نامشخص";
  try {
    return new Intl.DateTimeFormat(locales, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch (error) {
    return date.toLocaleString();
  }
}

export function toQueryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    query.set(key, value);
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export function applyModalState(modalEl, open) {
  if (!modalEl) return;
  if (open) {
    modalEl.classList.add("is-open");
    modalEl.removeAttribute("aria-hidden");
  } else {
    modalEl.classList.remove("is-open");
    modalEl.setAttribute("aria-hidden", "true");
  }
}
