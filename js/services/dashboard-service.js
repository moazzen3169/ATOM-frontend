import { API_BASE_URL } from "../config.js";

const DASHBOARD_ENDPOINT = "/api/users/dashboard/";
const PROFILE_ENDPOINTS = [
  "/api/users/users/me/",
  "/api/auth/users/me/",
  "/api/auth/me/",
  "/auth/users/me/"
];
const PROFILE_PATCH_ENDPOINTS = [
  "/api/users/users/me/",
  "/auth/users/me/"
];
const TOURNAMENT_HISTORY_ENDPOINT = (userId) => `/api/users/users/${userId}/match-history/`;
const TEAMS_ENDPOINT = "/api/users/teams/";
const NOTIFICATIONS_ENDPOINT = "/api/users/notifications/";

function withBase(path) {
  return `${API_BASE_URL}${path}`;
}

function toArray(candidate) {
  if (!candidate) return [];
  if (Array.isArray(candidate)) return candidate;
  if (candidate && Array.isArray(candidate.results)) return candidate.results;
  if (candidate && Array.isArray(candidate.items)) return candidate.items;
  if (candidate && Array.isArray(candidate.data)) return candidate.data;
  if (candidate && Array.isArray(candidate.entries)) return candidate.entries;
  return [];
}

function pickNumber(source, keys, fallback = 0) {
  if (!source) return fallback;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return fallback;
}

function pickString(source, keys, fallback = "") {
  if (!source) return fallback;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return fallback;
}

function resolveProfile(payload) {
  if (!payload) return {};
  if (payload.profile && typeof payload.profile === "object") {
    return payload.profile;
  }
  if (payload.user && typeof payload.user === "object") {
    return payload.user;
  }
  if (payload.account && typeof payload.account === "object") {
    return payload.account;
  }
  return payload;
}

function resolveStats(payload) {
  if (!payload) return {};
  if (payload.stats && typeof payload.stats === "object") {
    return payload.stats;
  }
  if (payload.statistics && typeof payload.statistics === "object") {
    return payload.statistics;
  }
  return payload;
}

function resolveTeams(payload) {
  if (!payload) return [];
  if (payload.teams && Array.isArray(payload.teams)) {
    return payload.teams;
  }
  if (payload.teams && typeof payload.teams === "object") {
    return toArray(payload.teams);
  }
  if (payload.user_teams) {
    return toArray(payload.user_teams);
  }
  return toArray(payload);
}

function resolveTournaments(payload) {
  if (!payload) return [];
  if (payload.tournaments && Array.isArray(payload.tournaments)) {
    return payload.tournaments;
  }
  if (payload.tournament_history) {
    return toArray(payload.tournament_history);
  }
  if (payload.matches) {
    return toArray(payload.matches);
  }
  return toArray(payload);
}

function resolveNotifications(payload) {
  if (!payload || typeof payload !== "object") {
    return { items: [], unread: 0 };
  }
  const items = toArray(payload.notifications || payload.items || payload.results || payload.data || payload);
  const unread = pickNumber(payload, ["unread", "unread_count", "unreadNotifications", "unread_notifications"], 0);
  return { items, unread };
}

function resolveInvitations(payload) {
  if (!payload || typeof payload !== "object") {
    return { incoming: [], outgoing: [], joinRequests: [] };
  }
  const source = payload.invitations || payload.team_invitations || payload.teamInvitations || payload;
  const incoming = toArray(source.incoming || source.received || source.incoming_invitations || source.received_invitations || source.pending || source);
  const outgoing = toArray(source.outgoing || source.sent || source.outgoing_invitations || source.sent_invitations);
  const joinRequests = toArray(source.join_requests || source.requests || source.pending_join_requests);
  return { incoming, outgoing, joinRequests };
}

export function normalizeDashboardPayload(payload = {}) {
  const profile = resolveProfile(payload.profile ?? payload.user ?? payload.account ?? payload);
  const statsSource = resolveStats(payload.stats ?? payload.statistics ?? payload);
  const teams = resolveTeams(payload.teams ?? payload.user_teams ?? payload.groups);
  const tournaments = resolveTournaments(payload.tournaments ?? payload.tournament_history ?? payload.matches);
  const notifications = resolveNotifications(payload.notifications ?? payload.user_notifications ?? payload.alerts);
  const invitations = resolveInvitations(payload.invitations ?? payload.team_invitations);

  const score = pickNumber(statsSource, ["score", "user_score", "total_score", "xp"], 0);
  const tournamentsPlayed = pickNumber(statsSource, ["tournaments_played", "tournament_count", "played"], tournaments.length);
  const verificationLevel = pickNumber(profile, ["verification_level", "verificationLevel", "level"], pickNumber(payload, ["verification_level"], 0));
  const fullName = pickString(profile, ["full_name", "fullName", "name"], `${pickString(profile, ["first_name", "firstName"], "")} ${pickString(profile, ["last_name", "lastName"], "")}`.trim());

  return {
    profile: {
      ...profile,
      verification_level: verificationLevel,
      full_name: fullName
    },
    stats: {
      score,
      tournamentsPlayed
    },
    teams,
    tournaments,
    notifications,
    invitations,
    teamsCount: pickNumber(payload, ["teams_count", "teamsCount"], teams.length),
    tournamentsCount: pickNumber(payload, ["tournaments_count", "tournamentsCount"], tournamentsPlayed),
    unreadNotifications: notifications.unread
  };
}

export async function fetchDashboard(fetchWithAuth) {
  const response = await fetchWithAuth(withBase(DASHBOARD_ENDPOINT), { method: "GET" });
  if (!response.ok) {
    const error = new Error(`Failed to fetch dashboard: ${response.status}`);
    error.response = response;
    throw error;
  }
  const text = await response.text();
  if (!text) {
    return normalizeDashboardPayload({});
  }
  try {
    const payload = JSON.parse(text);
    return normalizeDashboardPayload(payload);
  } catch (error) {
    console.warn("Failed to parse dashboard payload", error);
    throw error;
  }
}

export async function fetchProfile(fetchWithAuth) {
  for (const endpoint of PROFILE_ENDPOINTS) {
    const response = await fetchWithAuth(withBase(endpoint), { method: "GET" });
    if (!response.ok) {
      if (response.status === 404) {
        continue;
      }
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }
    const payload = await response.json();
    return payload;
  }
  throw new Error("Profile not found");
}

export async function updateProfile(fetchWithAuth, body, isMultipart = false) {
  let lastError;
  for (const endpoint of PROFILE_PATCH_ENDPOINTS) {
    try {
      const headers = new Headers();
      if (!isMultipart) {
        headers.set("Content-Type", "application/json");
      }
      headers.set("Accept", "application/json");

      const response = await fetchWithAuth(withBase(endpoint), {
        method: "PATCH",
        body,
        headers
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Profile update failed (${response.status})`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Profile update failed");
}

export async function fetchTeams(fetchWithAuth) {
  const response = await fetchWithAuth(withBase(TEAMS_ENDPOINT), { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to fetch teams: ${response.status}`);
  }
  const payload = await response.json();
  return resolveTeams(payload);
}

export async function fetchTournamentHistory(fetchWithAuth, userId) {
  if (!userId) {
    return [];
  }
  const response = await fetchWithAuth(withBase(TOURNAMENT_HISTORY_ENDPOINT(userId)), { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to fetch tournament history: ${response.status}`);
  }
  const payload = await response.json();
  return resolveTournaments(payload);
}

export async function fetchNotifications(fetchWithAuth) {
  const response = await fetchWithAuth(withBase(NOTIFICATIONS_ENDPOINT), { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to fetch notifications: ${response.status}`);
  }
  const payload = await response.json();
  return resolveNotifications(payload);
}

export async function fetchTeamInvitations(fetchWithAuth) {
  const response = await fetchWithAuth(withBase("/api/users/teams/invitations/received/"), { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to fetch invitations: ${response.status}`);
  }
  const payload = await response.json();
  return resolveInvitations(payload);
}
