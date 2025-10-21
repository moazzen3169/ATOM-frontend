import { API_BASE_URL } from "../config.js";

function isAbsoluteUrl(path) {
  return typeof path === "string" && /^https?:\/\//i.test(path);
}

function buildQuery(query) {
  if (!query || typeof query !== "object") {
    return "";
  }

  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === undefined || item === null || item === "") {
          return;
        }
        params.append(key, item);
      });
      return;
    }

    params.append(key, value);
  });

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export const API_ENDPOINTS = {
  auth: {
    refresh: "/auth/jwt/refresh/",
    profile: "/api/users/users/me/",
  },
  users: {
    dashboard: "/api/users/dashboard/",
    verification: "/api/users/verification/",
    me: "/api/users/users/me/",
    detail: (userId) => `/api/users/users/${encodeURIComponent(String(userId))}/`,
    notifications: "/api/users/notifications/",
    teams: "/api/users/teams/",
    team: (teamId) => `/api/users/teams/${encodeURIComponent(String(teamId))}/`,
    teamInvitations: "/api/users/teams/invitations/",
    respondTeamInvitation: "/api/users/teams/respond-invitation/",
    teamAddMember: (teamId) => `/api/users/teams/${encodeURIComponent(String(teamId))}/add-member/`,
    teamLeave: (teamId) => `/api/users/teams/${encodeURIComponent(String(teamId))}/leave_team/`,
    userMatchHistory: (userId) => `/api/users/users/${encodeURIComponent(String(userId))}/match-history/`,
    teamMatchHistory: (teamId) => `/api/users/teams/${encodeURIComponent(String(teamId))}/match-history/`,
    search: "/api/users/users/",
  },
  wallet: {
    list: "/api/wallet/wallets/",
  },
  tournaments: {
    myTournaments: "/api/tournaments/my-tournaments/",
    list: "/api/tournaments/tournaments/",
    detail: (tournamentId) =>
      `/api/tournaments/tournaments/${encodeURIComponent(String(tournamentId))}/`,
    join: (tournamentId) =>
      `/api/tournaments/tournaments/${encodeURIComponent(String(tournamentId))}/join/`,
  },
};

export function buildApiUrl(path = "") {
  if (path instanceof URL) {
    return new URL(path.toString());
  }

  const normalizedPath = typeof path === "string" && path.trim().length
    ? path.trim()
    : "/";

  if (isAbsoluteUrl(normalizedPath)) {
    return new URL(normalizedPath);
  }

  const prefixedPath = normalizedPath.startsWith("/")
    ? normalizedPath
    : `/${normalizedPath}`;

  return new URL(prefixedPath, API_BASE_URL);
}

async function safeParseJson(response) {
  try {
    return await response.clone().json();
  } catch (error) {
    try {
      const text = await response.clone().text();
      return text || null;
    } catch (_err) {
      return null;
    }
  }
}

export function createAuthApiClient({ storage } = {}) {
  const defaultStorage =
    storage || (typeof window !== "undefined" ? window.localStorage : null);
  const backingStore = defaultStorage;
  let accessTokenCache = null;
  let refreshPromise = null;

  function getAccessToken() {
    if (accessTokenCache) {
      return accessTokenCache;
    }
    if (!backingStore) {
      return null;
    }
    const token =
      backingStore.getItem("token") || backingStore.getItem("access_token");
    accessTokenCache = token || null;
    return accessTokenCache;
  }

  function setAccessToken(token) {
    accessTokenCache = token || null;
    if (!backingStore) {
      return;
    }
    if (!token) {
      backingStore.removeItem("token");
      backingStore.removeItem("access_token");
      return;
    }
    backingStore.setItem("token", token);
    backingStore.setItem("access_token", token);
  }

  function clearTokens() {
    accessTokenCache = null;
    if (!backingStore) {
      return;
    }
    backingStore.removeItem("token");
    backingStore.removeItem("access_token");
    backingStore.removeItem("refresh_token");
  }

  function getRefreshToken() {
    if (!backingStore) {
      return null;
    }
    return backingStore.getItem("refresh_token");
  }

  async function refreshAccessToken() {
    if (refreshPromise) {
      return refreshPromise;
    }

    const refresh = getRefreshToken();
    if (!refresh) {
      clearTokens();
      const error = new Error("REFRESH_TOKEN_NOT_FOUND");
      error.code = "REFRESH_TOKEN_NOT_FOUND";
      throw error;
    }

    const url = buildApiUrl(API_ENDPOINTS.auth.refresh);
    refreshPromise = fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    })
      .then(async (response) => {
        if (!response.ok) {
          clearTokens();
          const detail = await safeParseJson(response);
          const error = new Error("TOKEN_REFRESH_FAILED");
          error.status = response.status;
          error.detail = detail;
          throw error;
        }
        const data = await response.json();
        if (!data?.access) {
          clearTokens();
          const error = new Error("TOKEN_REFRESH_FAILED");
          error.status = response.status;
          throw error;
        }
        setAccessToken(data.access);
        return data.access;
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  function withQuery(url, query) {
    if (!query || typeof query !== "object") {
      return url;
    }
    const queryString = buildQuery(query);
    if (!queryString) {
      return url;
    }
    if (url.search) {
      url.search += `&${queryString.slice(1)}`;
    } else {
      url.search = queryString;
    }
    return url;
  }

  function normalizeBody(body, headers) {
    if (body === undefined || body === null) {
      return undefined;
    }
    if (body instanceof FormData || body instanceof Blob) {
      return body;
    }
    if (typeof body === "string") {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      return body;
    }
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    try {
      return JSON.stringify(body);
    } catch (error) {
      console.warn("Failed to serialize request body", error);
      return JSON.stringify({});
    }
  }

  async function authorizedFetch(path, options = {}) {
    const {
      query,
      retry = true,
      skipAuth = false,
      headers: providedHeaders,
      body: providedBody,
      ...fetchOptions
    } = options;

    const url = withQuery(buildApiUrl(path), query);
    const headers = new Headers(providedHeaders || {});

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    const body = normalizeBody(providedBody, headers);
    if (body !== undefined) {
      fetchOptions.body = body;
    }

    if (!skipAuth) {
      const token = getAccessToken();
      if (!token) {
        const error = new Error("AUTH_REQUIRED");
        error.code = "AUTH_REQUIRED";
        throw error;
      }
      headers.set("Authorization", `Bearer ${token}`);
    }

    const requestInit = {
      ...fetchOptions,
      headers,
    };

    let response = await fetch(url, requestInit);

    if (response.status === 401 && retry && !skipAuth) {
      await refreshAccessToken();
      const refreshedToken = getAccessToken();
      if (!refreshedToken) {
        return response;
      }
      headers.set("Authorization", `Bearer ${refreshedToken}`);
      response = await fetch(url, {
        ...fetchOptions,
        headers,
      });
    }

    return response;
  }

  async function fetchJson(path, options = {}) {
    const response = await authorizedFetch(path, options);
    const text = await response.text();

    if (!text) {
      if (!response.ok) {
        const error = new Error(response.statusText || "REQUEST_FAILED");
        error.status = response.status;
        throw error;
      }
      return null;
    }

    try {
      const data = JSON.parse(text);
      if (!response.ok) {
        const error = new Error(response.statusText || "REQUEST_FAILED");
        error.status = response.status;
        error.detail = data;
        throw error;
      }
      return data;
    } catch (error) {
      error.status = response.status;
      throw error;
    }
  }

  return {
    fetch: authorizedFetch,
    fetchJson,
    refreshAccessToken,
    getAccessToken,
    setAccessToken,
    clearTokens,
    buildUrl: (path, query) => withQuery(buildApiUrl(path), query).toString(),
  };
}

export async function extractApiError(response) {
  if (!response) {
    return "خطای ناشناخته رخ داد.";
  }

  try {
    const data = await safeParseJson(response);
    if (!data) {
      return response.statusText || "خطای ناشناخته رخ داد.";
    }

    if (typeof data === "string") {
      return data;
    }

    if (data.detail) {
      if (typeof data.detail === "string") {
        return data.detail;
      }
      if (Array.isArray(data.detail)) {
        return data.detail.join(" | ");
      }
    }

    if (Array.isArray(data)) {
      return data.join(" | ");
    }

    const messages = [];
    Object.entries(data).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        messages.push(value.join(" "));
        return;
      }
      if (value && typeof value === "object") {
        Object.values(value).forEach((nested) => {
          if (Array.isArray(nested)) {
            messages.push(nested.join(" "));
          } else if (nested) {
            messages.push(String(nested));
          }
        });
        return;
      }
      if (value) {
        messages.push(String(value));
      }
    });

    return messages.length
      ? messages.join(" | ")
      : response.statusText || "خطای ناشناخته رخ داد.";
  } catch (error) {
    console.warn("Failed to extract API error", error);
    return response.statusText || "خطای ناشناخته رخ داد.";
  }
}
