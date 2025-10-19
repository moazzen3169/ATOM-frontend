import {
  API_ENDPOINTS,
  createAuthApiClient,
  extractApiError,
} from "./services/api-client.js";

const DEFAULT_AVATAR_SRC = "../img/profile.jpg";
const DEFAULT_TEAM_AVATAR = "../img/logo.png";

const MEMBERSHIP_PENDING_KEYWORDS = [
  "pending",
  "invite",
  "invited",
  "request",
  "requested",
  "waiting",
  "awaiting",
  "approv",
  "declin",
  "reject",
  "cancel",
];

const MEMBERSHIP_ACCEPTED_KEYWORDS = [
  "accept",
  "approved",
  "active",
  "confirm",
  "member",
  "joined",
  "captain",
  "owner",
  "leader",
];

const TEAM_LIST_LIMIT = 6;

const helperDefaults = {
  fetchWithAuth: async () => {
    throw new Error("fetchWithAuth helper is not configured.");
  },
  extractErrorMessage: extractApiError,
  toggleButtonLoading: () => {},
  showError: (message) => {
    const handler = window.showError || console.error;
    handler(message);
  },
  showSuccess: (message) => {
    const handler = window.showSuccess || console.log;
    handler(message);
  },
  openModal: (id) => defaultOpenModal(id),
  closeModal: (id) => defaultCloseModal(id),
  onTeamsUpdated: async () => {},
};

let helpers = { ...helperDefaults };
let userContext = { id: null, username: null, email: null };
let userContextLoadPromise = null;
let teamsState = [];
let invitationsState = { incoming: [], outgoing: [], requests: [] };
let activeTeamsRequest = null;
let autoBootstrapCompleted = false;
let activeConfirmation = null;

const fallbackClient = createAuthApiClient();

function normalizeIdentityValue(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized.length ? normalized : null;
}

function normalizeEmailValue(value) {
  const normalized = normalizeIdentityValue(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function configureTeamModule(config = {}) {
  helpers = { ...helperDefaults, ...config };
}

export function setTeamUserContext({ id, username, email } = {}) {
  if (typeof id !== "undefined") {
    userContext.id = normalizeIdentityValue(id);
  }
  if (typeof username !== "undefined") {
    userContext.username = normalizeIdentityValue(username);
  }
  if (typeof email !== "undefined") {
    userContext.email = normalizeEmailValue(email);
  }
}

export async function initializeDashboardTeamsSection({
  dashboardData = {},
} = {}) {
  const initialTeams = filterUserTeams(extractTeamArray(dashboardData.teams));
  if (initialTeams.length) {
    teamsState = initialTeams.slice();
    renderTeams(initialTeams);
  }

  await refreshTeamsData();

  return {
    teams: teamsState.slice(),
    count: teamsState.length,
  };
}

export function setupTeamsPageInteractions() {
  attachTeamEventHandlers();
}

async function refreshTeamsData({ includeInvitations } = {}) {
  showTeamsLoadingState();

  if (activeTeamsRequest) {
    activeTeamsRequest.abort();
  }

  const controller = new AbortController();
  activeTeamsRequest = controller;

  const shouldIncludeInvitations =
    typeof includeInvitations === "boolean"
      ? includeInvitations
      : shouldFetchInvitations();

  try {
    await ensureUserContext();
  } catch (error) {
    console.error("Failed to resolve user identity for teams:", error);
    helpers.showError("برای مشاهده تیم‌ها ابتدا وارد حساب کاربری خود شوید.");
    renderTeams([]);
    if (shouldIncludeInvitations) {
      renderInvitations({ incoming: [], outgoing: [], requests: [] });
    }
    activeTeamsRequest = null;
    return;
  }

  if (!hasUserIdentity()) {
    console.warn("User identity could not be determined; skipping team fetch.");
    renderTeams([]);
    if (shouldIncludeInvitations) {
      renderInvitations({ incoming: [], outgoing: [], requests: [] });
    }
    activeTeamsRequest = null;
    return;
  }

  try {
    const fetchPromises = [requestTeams({ signal: controller.signal })];
    if (shouldIncludeInvitations) {
      fetchPromises.push(requestInvitations({ signal: controller.signal }));
    }

    const [teamsResult, invitationsResult] = await Promise.allSettled(
      fetchPromises,
    );

    if (teamsResult.status === "fulfilled") {
      teamsState = filterUserTeams(teamsResult.value.items);
      renderTeams(teamsState);
    } else if (teamsResult.status === "rejected") {
      console.error("Failed to load teams:", teamsResult.reason);
      helpers.showError("خطا در دریافت تیم‌ها.");
      renderTeams([]);
    }

    if (shouldIncludeInvitations && invitationsResult) {
      if (invitationsResult.status === "fulfilled") {
        invitationsState = invitationsResult.value;
        renderInvitations(invitationsState);
      } else {
        console.error(
          "Failed to load team invitations:",
          invitationsResult.reason,
        );
        renderInvitations({ incoming: [], outgoing: [], requests: [] });
      }
    }
  } finally {
    if (activeTeamsRequest === controller) {
      activeTeamsRequest = null;
    }
  }
}

function getFetchWithAuth() {
  if (helpers.fetchWithAuth !== helperDefaults.fetchWithAuth) {
    return helpers.fetchWithAuth;
  }
  return fallbackClient.fetch.bind(fallbackClient);
}

function getToggleButtonHelper() {
  if (helpers.toggleButtonLoading !== helperDefaults.toggleButtonLoading) {
    return helpers.toggleButtonLoading;
  }
  return defaultToggleButtonLoading;
}

function getOpenModalHelper() {
  if (helpers.openModal !== helperDefaults.openModal) {
    return helpers.openModal;
  }
  return defaultOpenModal;
}

function getCloseModalHelper() {
  if (helpers.closeModal !== helperDefaults.closeModal) {
    return helpers.closeModal;
  }
  return defaultCloseModal;
}

function normalizeTeamIdentifier(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized.length ? normalized : null;
}

function findTeamInState(teamId) {
  const normalizedId = normalizeTeamIdentifier(teamId);
  if (!normalizedId) {
    return null;
  }

  return (
    teamsState.find((item) => {
      const candidateId =
        item && normalizeTeamIdentifier(item.id ?? item.team_id ?? item.slug);
      return candidateId === normalizedId;
    }) || null
  );
}

function mergeTeamIntoState(team) {
  if (!team || typeof team !== "object") {
    return;
  }

  const normalizedId = normalizeTeamIdentifier(
    team.id ?? team.team_id ?? team.slug,
  );

  if (!normalizedId) {
    return;
  }

  const index = teamsState.findIndex((item) => {
    const candidateId =
      item && normalizeTeamIdentifier(item.id ?? item.team_id ?? item.slug);
    return candidateId === normalizedId;
  });

  if (index >= 0) {
    teamsState[index] = { ...teamsState[index], ...team };
  } else {
    teamsState.push(team);
  }
}

async function sendTeamRequest(url, { method = "GET", body, headers, signal } = {}) {
  const fetch = getFetchWithAuth();
  const options = { method, signal };

  if (headers) {
    options.headers = headers;
  }

  if (body !== undefined) {
    options.body = body;
  }

  return fetch(url, options);
}

function extractTeamArray(payload) {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload.filter(Boolean);
  }
  if (Array.isArray(payload.results)) {
    return payload.results.filter(Boolean);
  }
  if (Array.isArray(payload.items)) {
    return payload.items.filter(Boolean);
  }
  if (Array.isArray(payload.data)) {
    return payload.data.filter(Boolean);
  }
  return [];
}

function renderTeams(teams) {
  const container = document.getElementById("teams_container");
  if (!container) {
    return;
  }

  if (!Array.isArray(teams) || teams.length === 0) {
    container.innerHTML =
      '<div class="empty_state">هیچ تیمی برای نمایش وجود ندارد.</div>';
    updateTeamsCounter(0);
    updateTeamsOverflowHint(0, 0);
    return;
  }

  const isListLayout = container.classList.contains("teams_container--list");
  const visibleTeams =
    isListLayout && teams.length > TEAM_LIST_LIMIT
      ? teams.slice(0, TEAM_LIST_LIMIT)
      : teams;

  const markup = isListLayout
    ? visibleTeams.map(createTeamListItemMarkup).join("")
    : visibleTeams.map(createTeamCardMarkup).join("");

  container.innerHTML = markup;
  updateTeamsCounter(teams.length);
  if (isListLayout) {
    updateTeamsOverflowHint(teams.length, visibleTeams.length);
  } else {
    updateTeamsOverflowHint(0, 0);
  }
}

function createTeamCardMarkup(team = {}) {
  const teamId = team.id ?? team.team_id ?? team.slug ?? "";
  const name = team.name ?? team.title ?? "بدون نام";
  const captain = extractCaptainName(team);
  const members = getConfirmedTeamMembers(team);
  const memberCount = team.members_count ?? team.member_count ?? members.length;
  const joinedAt = team.created_at ?? team.joined_at ?? "";
  const teamPicture = resolveImageUrl(
    team.team_picture ?? team.picture ?? team.logo,
    DEFAULT_TEAM_AVATAR,
  );

  const membersPreview = createMembersPreviewMarkup(members);
  const actionsMarkup = createTeamActionButtons(team);
  const actionsSection = actionsMarkup
    ? `<footer class="team_card__actions">${actionsMarkup}</footer>`
    : "";

  return `
    <article class="team_card" data-team-id="${escapeHtml(teamId)}">
      <header class="team_card__header">
        <div class="team_avatar">
          <img src="${escapeHtml(teamPicture)}" alt="${escapeHtml(name)}" loading="lazy">
        </div>
        <div class="team_card__title">
          <h3>${escapeHtml(name)}</h3>
          <p>کاپیتان: ${escapeHtml(captain)}</p>
        </div>
        <span class="team_badge">${escapeHtml(memberCount ?? "0")} عضو</span>
      </header>
      <div class="team_card__body">
        <section class="team_card__summary team_card__summary--inline">
          ${createTeamStatMarkup("تعداد اعضا", memberCount ?? "0")}
          ${createTeamStatMarkup("تاریخ ایجاد", joinedAt || "نامشخص")}
        </section>
        <section class="team_members_preview">
          ${membersPreview}
        </section>
        ${actionsSection}
      </div>
    </article>
  `;
}

function createTeamActionButtons(team = {}) {
  const identity = buildUserIdentity();
  const isCaptain = isUserTeamCaptain(team, identity);
  const isMember = !isCaptain && isUserTeamConfirmedMember(team, identity);

  if (isCaptain) {
    const teamId = team.id ?? team.team_id ?? team.slug ?? "";
    return `
      <button type="button" class="btn btn--ghost" data-team-action="invite" data-team-id="${escapeHtml(
        teamId,
      )}">دعوت عضو</button>
      <button type="button" class="btn btn--ghost" data-team-action="edit" data-team-id="${escapeHtml(
        teamId,
      )}">ویرایش</button>
      <button type="button" class="btn btn--danger" data-team-action="delete" data-team-id="${escapeHtml(
        teamId,
      )}">حذف</button>
    `;
  }

  if (isMember) {
    const teamId = team.id ?? team.team_id ?? team.slug ?? "";
    return `
      <button type="button" class="btn btn--danger" data-team-action="leave" data-team-id="${escapeHtml(
        teamId,
      )}">خروج از گروه</button>
    `;
  }

  return "";
}

function createTeamStatMarkup(label, value) {
  return `
    <div class="team_stat">
      <span class="team_stat__label">${escapeHtml(label)}</span>
      <span class="team_stat__value">${escapeHtml(value ?? "-")}</span>
    </div>
  `;
}

function createMembersPreviewMarkup(members) {
  if (!Array.isArray(members) || members.length === 0) {
    return '<div class="empty_state">عضوی ثبت نشده است.</div>';
  }

  return members
    .slice(0, 6)
    .map((member) => {
      const username = resolveMemberUsername(member) || "کاربر";
      const avatar = resolveImageUrl(
        member.profile_picture ?? member.avatar,
        DEFAULT_AVATAR_SRC,
      );
      const isCaptain = isMemberCaptain(member);
      return `
        <div class="team_member${isCaptain ? " team_member--captain" : ""}">
          <div class="team_member_avatar">
            <img src="${escapeHtml(avatar)}" alt="${escapeHtml(username)}" loading="lazy">
          </div>
          <span class="team_member_name">${escapeHtml(username)}</span>
        </div>
      `;
    })
    .join("");
}

function createTeamListItemMarkup(team = {}) {
  const teamId = team.id ?? team.team_id ?? team.slug ?? "";
  const name = team.name ?? team.title ?? "بدون نام";
  const teamPicture = resolveImageUrl(
    team.team_picture ?? team.picture ?? team.logo,
    DEFAULT_TEAM_AVATAR,
  );
  const members = getConfirmedTeamMembers(team);
  const memberCount = team.members_count ?? team.member_count ?? members.length;
  const rosterMarkup = createTeamRosterMarkup(members, team);

  return `
    <article class="team_list_item" data-team-id="${escapeHtml(teamId)}">
      <div class="team_list_item__overview">
        <div class="team_list_item__identity">
          <div class="team_list_item__logo">
            <img src="${escapeHtml(teamPicture)}" alt="${escapeHtml(name)}" loading="lazy">
          </div>
          <div class="team_list_item__info">
            <h3 class="team_list_item__name">${escapeHtml(name)}</h3>
            <span class="team_list_item__members_count">${escapeHtml(
              memberCount ?? "0",
            )} عضو</span>
          </div>
        </div>
      </div>
      <div class="team_roster" role="list">
        ${rosterMarkup}
      </div>
    </article>
  `;
}

function createTeamRosterMarkup(members, team) {
  if (!Array.isArray(members) || members.length === 0) {
    return '<p class="team_roster_empty">عضوی برای نمایش وجود ندارد.</p>';
  }

  return members
    .map((member) => ({
      member,
      isCaptain: isMemberCaptain(member) || isMemberTeamCaptain(member, team),
    }))
    .sort((a, b) => Number(b.isCaptain) - Number(a.isCaptain))
    .map(({ member, isCaptain }) => createTeamRosterMemberMarkup(member, isCaptain))
    .join("");
}

function createTeamRosterMemberMarkup(member, isCaptain) {
  const username = resolveMemberUsername(member) || "کاربر";
  const avatar = resolveImageUrl(
    member.profile_picture ?? member.avatar,
    DEFAULT_AVATAR_SRC,
  );
  const roleLabel = isCaptain ? "کاپیتان" : "عضو تیم";

  return `
    <div class="team_roster_member${isCaptain ? " team_roster_member--captain" : ""}" role="listitem">
      <div class="team_roster_member_avatar">
        <img src="${escapeHtml(avatar)}" alt="${escapeHtml(username)}" loading="lazy">
      </div>
      <div class="team_roster_member_info">
        <span class="team_roster_member_name">${escapeHtml(username)}</span>
        <span class="team_roster_member_role">${escapeHtml(roleLabel)}</span>
      </div>
    </div>
  `;
}

function extractCaptainName(team) {
  if (team.captain && typeof team.captain === "object") {
    return (
      team.captain.username ||
      team.captain.name ||
      team.captain.full_name ||
      "نامشخص"
    );
  }

  const captainId = resolveMemberId(team.captain ?? team.captain_id ?? team.owner_id);

  if (Array.isArray(team.members)) {
    const captain = team.members.find((member) => {
      const memberId = resolveMemberId(member);
      if (captainId && memberId && captainId === memberId) {
        return true;
      }
      return isMemberCaptain(member);
    });

    if (captain) {
      return (
        captain.display_name ||
        captain.full_name ||
        captain.username ||
        captain.name ||
        "نامشخص"
      );
    }
  }

  return (
    team.captain_name ||
    team.captain_username ||
    team.owner_name ||
    team.owner_username ||
    (captainId ? `#${captainId}` : "نامشخص")
  );
}

function updateTeamsCounter(count) {
  const counter = document.getElementById("teams_counter");
  if (!counter) return;
  const label = count === 0 ? "بدون تیم" : `${count} تیم`;
  counter.textContent = label;
}

function updateTeamsOverflowHint(totalCount, displayedCount) {
  const hint = document.getElementById("teams_overflow_hint");
  if (!hint) return;

  if (totalCount > displayedCount && displayedCount > 0) {
    const remaining = totalCount - displayedCount;
    hint.innerHTML = `برای مشاهده ${escapeHtml(remaining)} تیم دیگر به <a href="teams.html">صفحه مدیریت تیم‌ها</a> مراجعه کنید.`;
  } else {
    hint.textContent = "";
  }
}

function showTeamsLoadingState() {
  const container = document.getElementById("teams_container");
  if (!container) return;
  container.innerHTML =
    '<div class="empty_state">در حال بارگذاری اطلاعات تیم...</div>';
  updateTeamsOverflowHint(0, 0);
}

async function requestTeams({ signal } = {}) {
  const fetch = getFetchWithAuth();
  const params = new URLSearchParams({ page_size: "24" });
  const identity = buildUserIdentity();

  if (identity.id) {
    params.set("captain", identity.id);
    params.set("member", identity.id);
  }

  const url = `${API_ENDPOINTS.users.teams}?${params.toString()}`;
  const response = await fetch(url, { method: "GET", signal });

  if (!response.ok) {
    const message = await helpers.extractErrorMessage(response);
    throw new Error(message || "خطا در دریافت تیم‌ها.");
  }

  const data = await safeJson(response);
  return { items: extractTeamArray(data), raw: data };
}

async function requestInvitations({ signal } = {}) {
  const fetch = getFetchWithAuth();
  const response = await fetch(API_ENDPOINTS.users.teamInvitations, {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    const message = await helpers.extractErrorMessage(response);
    throw new Error(message || "خطا در دریافت دعوت‌نامه‌ها.");
  }

  const data = await safeJson(response);
  return {
    incoming: extractArrayCandidate(data, [
      "incoming",
      "received",
      "invitations",
      "incoming_invitations",
      "results",
    ]),
    outgoing: extractArrayCandidate(data, [
      "outgoing",
      "sent",
      "outgoing_invitations",
      "requests_sent",
    ]),
    requests: extractArrayCandidate(data, [
      "requests",
      "pending",
      "join_requests",
      "pending_requests",
    ]),
    raw: data,
  };
}

function extractArrayCandidate(source, keys) {
  if (!source || typeof source !== "object") {
    return [];
  }

  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      return value.filter(Boolean);
    }
    if (value && typeof value === "object" && Array.isArray(value.results)) {
      return value.results.filter(Boolean);
    }
  }

  return [];
}

function filterUserTeams(teams = []) {
  if (!Array.isArray(teams)) {
    return [];
  }

  const identity = buildUserIdentity();
  return teams.filter((team) => isTeamRelevantForUser(team, identity));
}

function buildUserIdentity() {
  const normalizedId =
    userContext.id !== null && userContext.id !== undefined
      ? String(userContext.id)
      : null;
  const normalizedUsername =
    typeof userContext.username === "string"
      ? userContext.username.trim().toLowerCase()
      : null;
  const normalizedEmail =
    typeof userContext.email === "string"
      ? userContext.email.trim().toLowerCase()
      : null;

  return {
    id: normalizedId && normalizedId.length ? normalizedId : null,
    username:
      normalizedUsername && normalizedUsername.length ? normalizedUsername : null,
    email: normalizedEmail && normalizedEmail.length ? normalizedEmail : null,
  };
}

function hasUserIdentity() {
  if (userContext.id && String(userContext.id).trim().length) {
    return true;
  }
  if (
    typeof userContext.username === "string" &&
    userContext.username.trim().length
  ) {
    return true;
  }
  if (
    typeof userContext.email === "string" &&
    userContext.email.trim().length
  ) {
    return true;
  }
  return false;
}

async function ensureUserContext() {
  if (hasUserIdentity()) {
    return userContext;
  }

  if (userContextLoadPromise) {
    return userContextLoadPromise;
  }

  const storedIdentity = loadUserIdentityFromStorage();
  if (storedIdentity) {
    setTeamUserContext(storedIdentity);
    if (hasUserIdentity()) {
      return userContext;
    }
  }

  const fetch = getFetchWithAuth();

  userContextLoadPromise = (async () => {
    try {
      const profile = await fetchCurrentUserProfile(fetch);
      if (profile) {
        const resolved = resolveIdentityFromProfile(profile);
        if (resolved) {
          setTeamUserContext(resolved);
        }
      }
    } catch (error) {
      if (error && error.code === "AUTH_REQUIRED") {
        throw error;
      }
      console.error("Failed to load user profile for teams module:", error);
    } finally {
      userContextLoadPromise = null;
    }

    return userContext;
  })();

  return userContextLoadPromise;
}

async function fetchCurrentUserProfile(fetch) {
  const endpoints = Array.from(
    new Set(
      [API_ENDPOINTS.users?.me, API_ENDPOINTS.auth?.profile].filter(
        (endpoint) => typeof endpoint === "string" && endpoint.length,
      ),
    ),
  );

  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { method: "GET" });
      if (response.status === 401 || response.status === 403) {
        const authError = new Error("AUTH_REQUIRED");
        authError.code = "AUTH_REQUIRED";
        throw authError;
      }
      if (!response.ok) {
        lastError = new Error(
          `Request to ${endpoint} failed with status ${response.status}`,
        );
        continue;
      }

      const data = await safeJson(response);
      if (data && typeof data === "object") {
        return data;
      }
    } catch (error) {
      if (error && error.code === "AUTH_REQUIRED") {
        throw error;
      }
      lastError = error;
    }
  }

  if (lastError) {
    console.warn("Unable to fetch user context for teams:", lastError);
  }

  return null;
}

function resolveIdentityFromProfile(profile) {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const nestedSources = [profile.user, profile.profile, profile.account, profile.data];

  const id = pickFirstNonEmpty([
    profile.id,
    profile.pk,
    profile.user_id,
    profile.uuid,
    profile.member_id,
    profile.account_id,
    ...nestedSources.map((item) => item && item.id),
    ...nestedSources.map((item) => item && item.pk),
    ...nestedSources.map((item) => item && item.user_id),
  ]);

  const username = pickFirstNonEmpty([
    profile.username,
    profile.name,
    profile.full_name,
    profile.user_name,
    profile.user?.username,
    profile.profile?.username,
    profile.account?.username,
    profile.data?.username,
  ]);

  const email = pickFirstNonEmpty([
    profile.email,
    profile.user?.email,
    profile.profile?.email,
    profile.account?.email,
    profile.data?.email,
  ]);

  if (!id && !username && !email) {
    return null;
  }

  return { id, username, email };
}

function pickFirstNonEmpty(candidates = []) {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) {
      continue;
    }
    const normalized = String(candidate).trim();
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function loadUserIdentityFromStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const stored = window.localStorage.getItem("user_data");
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored);
    return resolveIdentityFromProfile(parsed);
  } catch (error) {
    console.warn("Failed to read user identity from localStorage:", error);
    return null;
  }
}

function isTeamRelevantForUser(team, identity) {
  if (!team || typeof team !== "object") {
    return false;
  }

  if (isUserTeamCaptain(team, identity)) {
    return true;
  }

  if (isUserTeamConfirmedMember(team, identity)) {
    return true;
  }

  return false;
}

function isUserTeamCaptain(team, identity) {
  if (!team || typeof team !== "object") return false;

  if (hasTruthyFlag(team, ["is_captain", "is_owner", "is_leader"])) {
    return true;
  }

  if (stringIndicatesCaptain(team.role) || stringIndicatesCaptain(team.user_role)) {
    return true;
  }

  const idMatches = (value) =>
    identity.id && value !== undefined && String(value) === identity.id;

  if (
    idMatches(team.captain_id) ||
    idMatches(team.owner_id) ||
    idMatches(team.captain)
  ) {
    return true;
  }

  if (
    (team.captain && matchesUserRecord(team.captain, identity)) ||
    (team.owner && matchesUserRecord(team.owner, identity)) ||
    (team.created_by && matchesUserRecord(team.created_by, identity))
  ) {
    return true;
  }

  const members = getConfirmedTeamMembers(team);
  return members.some(
    (member) => matchesUserRecord(member, identity) && isMemberCaptain(member),
  );
}

function isUserTeamConfirmedMember(team, identity) {
  if (!team || typeof team !== "object") return false;

  const membershipStatus = resolveMembershipStatus(team);
  if (membershipStatus && isPendingStatus(membershipStatus)) {
    return false;
  }

  if (
    hasTruthyFlag(team, [
      "is_member",
      "has_joined",
      "joined",
      "approved",
      "accepted",
      "confirmed",
      "is_confirmed",
      "active",
      "is_active",
    ])
  ) {
    return true;
  }

  const memberships = collectMembershipCandidates(team);
  for (const membership of memberships) {
    if (matchesUserRecord(membership, identity)) {
      if (isMembershipEntryConfirmed(membership)) {
        return true;
      }
      return false;
    }
    if (membership.user && matchesUserRecord(membership.user, identity)) {
      return isMembershipEntryConfirmed(membership);
    }
    if (membership.member && matchesUserRecord(membership.member, identity)) {
      return isMembershipEntryConfirmed(membership);
    }
  }

  const members = getConfirmedTeamMembers(team);
  return members.some((member) => matchesUserRecord(member, identity));
}

function collectMembershipCandidates(team) {
  const candidates = [];

  const directCandidates = [
    team.membership,
    team.user_membership,
    team.current_membership,
    team.my_membership,
    team.member,
  ];
  for (const candidate of directCandidates) {
    if (candidate && typeof candidate === "object") {
      candidates.push(candidate);
    }
  }

  if (Array.isArray(team.memberships)) {
    candidates.push(...team.memberships.filter((item) => item && typeof item === "object"));
  }

  if (Array.isArray(team.members)) {
    candidates.push(...team.members.filter((item) => item && typeof item === "object"));
  }

  return candidates;
}

function matchesUserRecord(record, identity) {
  if (!record || typeof record !== "object") {
    return false;
  }

  if (identity.id) {
    const idKeys = [
      "id",
      "user_id",
      "member_id",
      "membership_id",
      "profile_id",
      "account_id",
      "owner_id",
      "pk",
    ];
    for (const key of idKeys) {
      const value = record[key];
      if (value !== undefined && String(value) === identity.id) {
        return true;
      }
    }
  }

  if (
    (record.user && matchesUserRecord(record.user, identity)) ||
    (record.member && matchesUserRecord(record.member, identity)) ||
    (record.profile && matchesUserRecord(record.profile, identity)) ||
    (record.account && matchesUserRecord(record.account, identity))
  ) {
    return true;
  }

  const username = resolveMemberUsername(record);
  if (identity.username && username && username === identity.username) {
    return true;
  }

  const email = resolveMemberEmail(record);
  if (identity.email && email && email === identity.email) {
    return true;
  }

  return false;
}

function resolveMembershipStatus(source) {
  const status = extractStatusCandidate(source);
  return typeof status === "string" ? status : "";
}

function extractStatusCandidate(candidate) {
  if (!candidate) {
    return "";
  }

  if (typeof candidate === "string") {
    return candidate;
  }

  if (typeof candidate !== "object") {
    return "";
  }

  const statusKeys = [
    "membership_status",
    "status",
    "state",
    "join_status",
    "request_status",
    "approval_status",
    "invitation_status",
    "member_status",
    "participation_status",
  ];

  for (const key of statusKeys) {
    const value = candidate[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }

  const nestedKeys = [
    "membership",
    "user_membership",
    "invite",
    "invitation",
    "request",
  ];

  for (const nestedKey of nestedKeys) {
    const nested = candidate[nestedKey];
    const nestedStatus = extractStatusCandidate(nested);
    if (nestedStatus) {
      return nestedStatus;
    }
  }

  return "";
}

function isPendingStatus(status) {
  if (!status) return false;
  const normalized = status.toString().toLowerCase();
  return MEMBERSHIP_PENDING_KEYWORDS.some((keyword) =>
    normalized.includes(keyword),
  );
}

function isAcceptedStatus(status) {
  if (!status) return false;
  const normalized = status.toString().toLowerCase();
  return MEMBERSHIP_ACCEPTED_KEYWORDS.some((keyword) =>
    normalized.includes(keyword),
  );
}

function isMembershipEntryConfirmed(entry) {
  if (!entry || typeof entry !== "object") {
    return false;
  }

  if (
    hasTruthyFlag(entry, [
      "is_confirmed",
      "confirmed",
      "approved",
      "accepted",
      "active",
      "is_active",
      "has_joined",
      "joined",
    ])
  ) {
    return true;
  }

  const status = resolveMembershipStatus(entry);
  if (!status) {
    return true;
  }

  if (isPendingStatus(status)) {
    return false;
  }

  if (isAcceptedStatus(status)) {
    return true;
  }

  return !isPendingStatus(status);
}

function hasTruthyFlag(source, keys) {
  return keys.some((key) => {
    const value = source?.[key];
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (!normalized) return false;
      return ["true", "1", "yes", "active", "accepted", "approved"].includes(
        normalized,
      );
    }
    return value === true || value === 1;
  });
}

function stringIndicatesCaptain(value) {
  if (!value) return false;
  const normalized = value.toString().toLowerCase();
  return (
    normalized.includes("captain") ||
    normalized.includes("owner") ||
    normalized.includes("leader")
  );
}

function getConfirmedTeamMembers(team) {
  const members = [];
  if (Array.isArray(team.members)) {
    members.push(...team.members.filter((item) => item && typeof item === "object"));
  }
  if (team.captain && typeof team.captain === "object") {
    members.push(team.captain);
  }

  const uniqueMembers = dedupeMembers(members);
  return uniqueMembers.filter((member) => isMembershipEntryConfirmed(member));
}

function dedupeMembers(members) {
  const results = [];
  const seenKeys = new Set();
  const seenRefs = new Set();

  for (const member of members) {
    if (!member || typeof member !== "object") continue;

    const key = getMemberKey(member);
    if (key) {
      if (seenKeys.has(key)) {
        continue;
      }
      seenKeys.add(key);
    } else if (seenRefs.has(member)) {
      continue;
    } else {
      seenRefs.add(member);
    }

    results.push(member);
  }

  return results;
}

function getMemberKey(member) {
  const id = resolveMemberId(member);
  if (id) {
    return `id:${id}`;
  }
  const username = resolveMemberUsername(member);
  if (username) {
    return `username:${username}`;
  }
  const email = resolveMemberEmail(member);
  if (email) {
    return `email:${email}`;
  }
  return null;
}

function resolveMemberId(member) {
  if (member === null || member === undefined) {
    return null;
  }

  if (typeof member === "number" || typeof member === "bigint") {
    return member.toString();
  }

  if (typeof member === "string") {
    const normalizedValue = member.trim();
    return normalizedValue.length ? normalizedValue : null;
  }

  const idKeys = [
    "id",
    "user_id",
    "member_id",
    "membership_id",
    "profile_id",
    "account_id",
    "owner_id",
    "pk",
  ];

  for (const key of idKeys) {
    const value = member?.[key];
    if (value !== undefined && value !== null) {
      const normalized = String(value).trim();
      if (normalized) {
        return normalized;
      }
    }
  }

  if (member?.user) {
    return resolveMemberId(member.user);
  }

  if (member?.member) {
    return resolveMemberId(member.member);
  }

  if (member?.profile) {
    return resolveMemberId(member.profile);
  }

  return null;
}

function resolveMemberUsername(member) {
  const usernameKeys = [
    "username",
    "user_name",
    "name",
    "nickname",
    "nick",
  ];

  for (const key of usernameKeys) {
    const value = member?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().toLowerCase();
    }
  }

  if (member?.user) {
    return resolveMemberUsername(member.user);
  }

  if (member?.member) {
    return resolveMemberUsername(member.member);
  }

  if (member?.profile) {
    return resolveMemberUsername(member.profile);
  }

  return null;
}

function resolveMemberEmail(member) {
  const emailKeys = ["email", "user_email"];
  for (const key of emailKeys) {
    const value = member?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().toLowerCase();
    }
  }

  if (member?.user) {
    return resolveMemberEmail(member.user);
  }

  if (member?.member) {
    return resolveMemberEmail(member.member);
  }

  if (member?.profile) {
    return resolveMemberEmail(member.profile);
  }

  return null;
}

function isMemberCaptain(member) {
  if (!member || typeof member !== "object") return false;

  if (hasTruthyFlag(member, ["is_captain", "is_owner", "captain", "leader"])) {
    return true;
  }

  return stringIndicatesCaptain(member.role || member.position || member.title);
}

function isMemberTeamCaptain(member, team) {
  if (!team || typeof team !== "object") return false;

  if (team.captain && matchesUserRecord(member, buildIdentityFromMember(team.captain))) {
    return true;
  }

  const captainId = resolveMemberId(team.captain ?? team.captain_id ?? team.owner_id);
  if (captainId) {
    const memberId = resolveMemberId(member);
    if (memberId && memberId === captainId) {
      return true;
    }
  }

  return false;
}

function buildIdentityFromMember(member) {
  return {
    id: resolveMemberId(member),
    username: resolveMemberUsername(member),
    email: resolveMemberEmail(member),
  };
}

function shouldFetchInvitations() {
  return Boolean(
    document.getElementById("incoming_invitations_container") ||
      document.getElementById("team_join_requests_container") ||
      document.getElementById("outgoing_invitations_container"),
  );
}

function renderInvitations({ incoming = [], outgoing = [], requests = [] }) {
  const incomingContainer = document.getElementById(
    "incoming_invitations_container",
  );
  const requestsContainer = document.getElementById(
    "team_join_requests_container",
  );
  const outgoingContainer = document.getElementById(
    "outgoing_invitations_container",
  );

  if (incomingContainer) {
    renderInvitationList(
      incomingContainer,
      incoming,
      "incoming",
      "دعوت‌نامه فعالی وجود ندارد.",
    );
  }

  if (requestsContainer) {
    renderInvitationList(
      requestsContainer,
      requests,
      "request",
      "درخواستی ثبت نشده است.",
    );
  }

  if (outgoingContainer) {
    renderInvitationList(
      outgoingContainer,
      outgoing,
      "outgoing",
      "تا کنون دعوتی ارسال نشده است.",
    );
  }
}

function renderInvitationList(container, items, type, emptyMessage) {
  if (!container) return;

  if (!Array.isArray(items) || items.length === 0) {
    container.innerHTML = `<div class="empty_state">${escapeHtml(
      emptyMessage,
    )}</div>`;
    return;
  }

  container.innerHTML = items
    .map((item) => createInvitationMarkup(item, type))
    .join("");
}

function createInvitationMarkup(invitation = {}, type) {
  const id = invitation.id ?? invitation.invitation_id ?? "";
  const teamName =
    invitation.team?.name ||
    invitation.team_name ||
    invitation.team ||
    "تیم نامشخص";
  const sender =
    invitation.sender?.username ||
    invitation.sender_username ||
    invitation.from_user ||
    "نامشخص";
  const createdAt = invitation.created_at || invitation.sent_at || "";
  const status = invitation.status || invitation.state || "pending";

  let actions = "";
  if (type === "incoming") {
    actions = `
      <div class="invitation_actions">
        <button type="button" class="btn btn--primary" data-invite-action="accept" data-invite-id="${escapeHtml(
          id,
        )}">قبول</button>
        <button type="button" class="btn btn--ghost" data-invite-action="reject" data-invite-id="${escapeHtml(
          id,
        )}">رد</button>
      </div>
    `;
  }

  return `
    <article class="invitation_card" data-invitation-id="${escapeHtml(id)}">
      <div class="invitation_card__header">
        <h4>${escapeHtml(teamName)}</h4>
        <span class="invitation_status">${escapeHtml(status)}</span>
      </div>
      <p class="invitation_meta">ارسال توسط ${escapeHtml(sender)}</p>
      <p class="invitation_meta">${escapeHtml(createdAt)}</p>
      ${actions}
    </article>
  `;
}

async function handleCreateTeam(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const name = (formData.get("name") || "").toString().trim();

  if (!name) {
    helpers.showError("نام تیم را وارد کنید.");
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  getToggleButtonHelper()(button, true, "در حال ایجاد...");

  try {
    const fetch = getFetchWithAuth();
    const response = await fetch(API_ENDPOINTS.users.teams, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const message = await helpers.extractErrorMessage(response);
      throw new Error(message || "خطا در ایجاد تیم.");
    }

    helpers.showSuccess("تیم با موفقیت ایجاد شد.");
    getCloseModalHelper()("create_team_modal");
    form.reset();
    await refreshTeamsData({ includeInvitations: true });
    await helpers.onTeamsUpdated();
  } catch (error) {
    console.error("Failed to create team:", error);
    helpers.showError(error.message || "خطا در ایجاد تیم.");
  } finally {
    getToggleButtonHelper()(button, false);
  }
}

async function handleEditTeam(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const teamId = formData.get("team_id") || formData.get("id");
  const name = (formData.get("name") || "").toString().trim();

  if (!teamId) {
    helpers.showError("تیم معتبر نیست.");
    return;
  }

  if (!name) {
    helpers.showError("نام تیم را وارد کنید.");
    return;
  }

  await ensureUserContext().catch(() => {});
  const team = findTeamInState(teamId);
  const identity = buildUserIdentity();
  if (team && !isUserTeamCaptain(team, identity)) {
    helpers.showError("تنها کاپیتان تیم می‌تواند این عملیات را انجام دهد.");
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  getToggleButtonHelper()(button, true, "در حال ذخیره...");

  try {
    const payload = new FormData();
    payload.append("name", name);
    const picture = formData.get("team_picture");
    if (picture instanceof File && picture.size > 0) {
      payload.append("team_picture", picture);
    }

    const response = await sendTeamRequest(API_ENDPOINTS.users.team(teamId), {
      method: "PATCH",
      body: payload,
    });

    if (!response.ok) {
      const message = await helpers.extractErrorMessage(response);
      throw new Error(message || "خطا در بروزرسانی تیم.");
    }

    const updatedTeam = await safeJson(response);
    if (
      updatedTeam &&
      typeof updatedTeam === "object" &&
      isTeamRelevantForUser(updatedTeam, identity)
    ) {
      mergeTeamIntoState(updatedTeam);
    }

    helpers.showSuccess("تیم با موفقیت بروزرسانی شد.");
    getCloseModalHelper()("edit_team_modal");
    form.reset();
    await refreshTeamsData({ includeInvitations: true });
    await helpers.onTeamsUpdated();
  } catch (error) {
    console.error("Failed to update team:", error);
    helpers.showError(error.message || "خطا در بروزرسانی تیم.");
  } finally {
    getToggleButtonHelper()(button, false);
  }
}

async function handleInviteMember(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const teamId = formData.get("team_id") || formData.get("team");
  const username = (formData.get("username") || "").toString().trim();

  if (!teamId) {
    helpers.showError("تیم معتبر نیست.");
    return;
  }

  if (!username) {
    helpers.showError("نام کاربری را وارد کنید.");
    return;
  }

  await ensureUserContext().catch(() => {});
  const team = findTeamInState(teamId);
  const identity = buildUserIdentity();
  if (team && !isUserTeamCaptain(team, identity)) {
    helpers.showError("تنها کاپیتان می‌تواند عضو جدید دعوت کند.");
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  getToggleButtonHelper()(button, true, "در حال ارسال...");

  try {
    const fetch = getFetchWithAuth();
    const payload = { username };
    const response = await fetch(API_ENDPOINTS.users.teamAddMember(teamId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const message = await helpers.extractErrorMessage(response);
      throw new Error(message || "خطا در ارسال دعوت.");
    }

    helpers.showSuccess("دعوت با موفقیت ارسال شد.");
    getCloseModalHelper()("invite_member_modal");
    form.reset();
    await refreshTeamsData({ includeInvitations: true });
    await helpers.onTeamsUpdated();
  } catch (error) {
    console.error("Failed to invite member:", error);
    helpers.showError(error.message || "خطا در ارسال دعوت.");
  } finally {
    getToggleButtonHelper()(button, false);
  }
}

async function handleDeleteTeam(teamId, triggerButton) {
  if (!teamId) {
    helpers.showError("تیم معتبر نیست.");
    return;
  }

  await ensureUserContext().catch(() => {});
  let team = findTeamInState(teamId);
  let identity = buildUserIdentity();

  if (!team) {
    try {
      const fetchedTeam = await fetchTeamDetails(teamId);
      if (fetchedTeam && typeof fetchedTeam === "object") {
        if (isTeamRelevantForUser(fetchedTeam, identity)) {
          mergeTeamIntoState(fetchedTeam);
          team = findTeamInState(teamId) || fetchedTeam;
        } else {
          team = fetchedTeam;
        }
      }
    } catch (error) {
      console.error("Failed to fetch team before deletion:", error);
      helpers.showError(error.message || "خطا در دریافت اطلاعات تیم.");
      return;
    }
  }

  identity = buildUserIdentity();
  if (team && !isUserTeamCaptain(team, identity)) {
    helpers.showError("فقط کاپیتان تیم می‌تواند تیم را حذف کند.");
    return;
  }

  const teamName = team?.name ?? team?.title ?? "تیم";
  const confirmed = await showConfirmationModal({
    message: `آیا از حذف تیم «${teamName}» اطمینان دارید؟`,
    confirmLabel: "حذف تیم",
    confirmVariant: "btn--danger",
  });

  if (!confirmed) {
    return;
  }

  if (triggerButton) {
    getToggleButtonHelper()(triggerButton, true, "در حال حذف...");
  }

  try {
    const response = await sendTeamRequest(API_ENDPOINTS.users.team(teamId), {
      method: "DELETE",
    });

    if (!response.ok && response.status !== 204) {
      const message = await helpers.extractErrorMessage(response);
      throw new Error(message || "خطا در حذف تیم.");
    }

    helpers.showSuccess("تیم با موفقیت حذف شد.");
    await refreshTeamsData({ includeInvitations: true });
    await helpers.onTeamsUpdated();
  } catch (error) {
    console.error("Failed to delete team:", error);
    helpers.showError(error.message || "خطا در حذف تیم.");
  } finally {
    if (triggerButton) {
      getToggleButtonHelper()(triggerButton, false);
    }
  }
}

async function handleLeaveTeam(teamId, triggerButton) {
  if (!teamId) {
    helpers.showError("تیم معتبر نیست.");
    return;
  }

  await ensureUserContext().catch(() => {});
  const team = findTeamInState(teamId);
  const teamName = team?.name ?? team?.title ?? "تیم";

  const confirmed = await showConfirmationModal({
    message: `آیا از خروج از تیم «${teamName}» مطمئن هستید؟`,
    confirmLabel: "خروج",
    confirmVariant: "btn--danger",
  });

  if (!confirmed) {
    return;
  }

  if (triggerButton) {
    getToggleButtonHelper()(triggerButton, true, "در حال خروج...");
  }

  try {
    const response = await sendTeamRequest(API_ENDPOINTS.users.teamLeave(teamId), {
      method: "POST",
      body: {},
    });

    if (!response.ok) {
      const message = await helpers.extractErrorMessage(response);
      throw new Error(message || "خطا در خروج از تیم.");
    }

    helpers.showSuccess("از تیم خارج شدید.");
    await refreshTeamsData({ includeInvitations: true });
    await helpers.onTeamsUpdated();
  } catch (error) {
    console.error("Failed to leave team:", error);
    helpers.showError(error.message || "خطا در خروج از تیم.");
  } finally {
    if (triggerButton) {
      getToggleButtonHelper()(triggerButton, false);
    }
  }
}

async function respondToInvitation(inviteId, action) {
  if (!inviteId) {
    helpers.showError("دعوت‌نامه معتبر نیست.");
    return;
  }

  const status = action === "accept" ? "accepted" : "declined";

  try {
    const fetch = getFetchWithAuth();
    const response = await fetch(API_ENDPOINTS.users.respondTeamInvitation, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitation_id: inviteId, status }),
    });

    if (!response.ok) {
      const message = await helpers.extractErrorMessage(response);
      throw new Error(message || "خطا در بروزرسانی دعوت‌نامه.");
    }

    helpers.showSuccess(
      action === "accept"
        ? "دعوت‌نامه پذیرفته شد."
        : "دعوت‌نامه رد شد.",
    );

    await refreshTeamsData({ includeInvitations: true });
    await helpers.onTeamsUpdated();
  } catch (error) {
    console.error("Failed to respond to invitation:", error);
    helpers.showError(error.message || "خطا در بروزرسانی دعوت‌نامه.");
  }
}

function attachTeamEventHandlers() {
  const teamsContainer = document.getElementById("teams_container");
  if (teamsContainer) {
    teamsContainer.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-team-action]");
      if (!actionButton) return;
      const action = actionButton.getAttribute("data-team-action");
      const teamId = actionButton.getAttribute("data-team-id");
      if (!action || !teamId) return;

      switch (action) {
        case "invite":
          openInviteMemberModal(teamId);
          break;
        case "edit":
          openEditTeamModal(teamId);
          break;
        case "delete":
          handleDeleteTeam(teamId, actionButton);
          break;
        case "leave":
          handleLeaveTeam(teamId, actionButton);
          break;
        default:
          break;
      }
    });
  }

  document.addEventListener("click", (event) => {
    const inviteAction = event.target.closest("[data-invite-action]");
    if (!inviteAction) return;
    const action = inviteAction.getAttribute("data-invite-action");
    const inviteId = inviteAction.getAttribute("data-invite-id");
    if (!action || !inviteId) return;
    respondToInvitation(inviteId, action);
  });

  const createForm = document.getElementById("create_team_form");
  if (createForm) {
    createForm.addEventListener("submit", handleCreateTeam);
  }

  const editForm = document.getElementById("edit_team_form");
  if (editForm) {
    editForm.addEventListener("submit", handleEditTeam);
  }

  const inviteForm = document.getElementById("invite_member_form");
  if (inviteForm) {
    inviteForm.addEventListener("submit", handleInviteMember);
  }

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      const modal = button.closest(".modal");
      if (modal?.id) {
        getCloseModalHelper()(modal.id);
      }
    });
  });

  const createLinks = document.querySelectorAll(".creat_team_link");
  createLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const isTeamsPage = document.querySelector(".user_teams_page");
      if (isTeamsPage) {
        event.preventDefault();
        getOpenModalHelper()("create_team_modal");
      }
    });
  });
}

async function openEditTeamModal(teamId) {
  const modal = document.getElementById("edit_team_modal");
  if (!modal) return;

  if (!teamId) {
    helpers.showError("تیم یافت نشد.");
    return;
  }

  await ensureUserContext().catch(() => {});
  const identity = buildUserIdentity();
  let team = findTeamInState(teamId);

  if (!team) {
    try {
      const fetchedTeam = await fetchTeamDetails(teamId);
      if (fetchedTeam && typeof fetchedTeam === "object") {
        if (isTeamRelevantForUser(fetchedTeam, identity)) {
          mergeTeamIntoState(fetchedTeam);
          team = findTeamInState(teamId) || fetchedTeam;
        } else {
          team = fetchedTeam;
        }
      }
    } catch (error) {
      console.error("Failed to load team details:", error);
      helpers.showError(error.message || "خطا در دریافت اطلاعات تیم.");
      return;
    }
  }

  if (!team) {
    helpers.showError("تیم یافت نشد.");
    return;
  }

  if (!isUserTeamCaptain(team, identity)) {
    helpers.showError("تنها کاپیتان تیم می‌تواند این عملیات را انجام دهد.");
    return;
  }

  const idInput = document.getElementById("edit_team_id");
  const nameInput = document.getElementById("edit_team_name");
  const hint = document.getElementById("edit_team_picture_hint");

  if (idInput) idInput.value = team.id ?? team.team_id ?? "";
  if (nameInput) nameInput.value = team.name ?? team.title ?? "";
  if (hint) {
    hint.textContent = `تصویر فعلی: ${resolveImageUrl(
      team.team_picture ?? team.picture ?? team.logo,
      DEFAULT_TEAM_AVATAR,
    )}`;
  }

  getOpenModalHelper()("edit_team_modal");
}

async function openInviteMemberModal(teamId) {
  if (!teamId) {
    helpers.showError("تیم یافت نشد.");
    return;
  }

  await ensureUserContext().catch(() => {});
  const identity = buildUserIdentity();
  let team = findTeamInState(teamId);

  if (!team) {
    try {
      const fetchedTeam = await fetchTeamDetails(teamId);
      if (fetchedTeam && typeof fetchedTeam === "object") {
        if (isTeamRelevantForUser(fetchedTeam, identity)) {
          mergeTeamIntoState(fetchedTeam);
          team = findTeamInState(teamId) || fetchedTeam;
        } else {
          team = fetchedTeam;
        }
      }
    } catch (error) {
      console.error("Failed to load team details for invite modal:", error);
      helpers.showError(error.message || "خطا در دریافت اطلاعات تیم.");
      return;
    }
  }

  if (!team) {
    helpers.showError("تیم یافت نشد.");
    return;
  }

  if (!isUserTeamCaptain(team, identity)) {
    helpers.showError("تنها کاپیتان می‌تواند عضو جدید دعوت کند.");
    return;
  }

  const form = document.getElementById("invite_member_form");
  if (form) {
    const teamIdInput = form.querySelector('[name="team_id"]');
    if (teamIdInput) {
      teamIdInput.value = team.id ?? team.team_id ?? "";
    }
  }

  getOpenModalHelper()("invite_member_modal");
}

function showConfirmationModal({ message, confirmLabel = "تایید", confirmVariant = "btn--primary" } = {}) {
  const modal = document.getElementById("confirm_modal");
  const messageElement = document.getElementById("confirm_modal_message");
  const confirmButton = document.getElementById("confirm_modal_confirm");

  if (!modal || !messageElement || !confirmButton) {
    return Promise.resolve(window.confirm(message || "آیا مطمئن هستید؟"));
  }

  if (activeConfirmation && typeof activeConfirmation.cancel === "function") {
    activeConfirmation.cancel();
  }

  return new Promise((resolve) => {
    const cancelButtons = Array.from(modal.querySelectorAll("[data-close-modal]"));
    const previousLabel = confirmButton.textContent;
    const previousClassName = confirmButton.className;

    const cleanup = (result) => {
      confirmButton.removeEventListener("click", onConfirm);
      cancelButtons.forEach((btn) => btn.removeEventListener("click", onCancel));
      modal.removeEventListener("click", onBackdropClick);
      document.removeEventListener("keydown", onKeydown);
      confirmButton.className = previousClassName;
      confirmButton.textContent = previousLabel;
      activeConfirmation = null;
      resolve(result);
    };

    const closeModal = () => {
      getCloseModalHelper()("confirm_modal");
    };

    const onConfirm = () => {
      closeModal();
      cleanup(true);
    };

    const onCancel = () => {
      closeModal();
      cleanup(false);
    };

    const onBackdropClick = (event) => {
      if (event.target === modal) {
        onCancel();
      }
    };

    const onKeydown = (event) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    activeConfirmation = {
      cancel: () => {
        closeModal();
        cleanup(false);
      },
    };

    messageElement.textContent = message || "آیا از انجام این عملیات اطمینان دارید؟";
    confirmButton.textContent = confirmLabel || "تایید";
    confirmButton.className = `btn ${confirmVariant || "btn--primary"}`;

    confirmButton.addEventListener("click", onConfirm, { once: true });
    cancelButtons.forEach((btn) => btn.addEventListener("click", onCancel, { once: true }));
    modal.addEventListener("click", onBackdropClick);
    document.addEventListener("keydown", onKeydown);

    getOpenModalHelper()("confirm_modal");
  });
}

async function safeJson(response) {
  try {
    return await response.clone().json();
  } catch (error) {
    console.warn("Failed to parse JSON response:", error);
    return null;
  }
}

async function fetchTeamDetails(teamId, { signal } = {}) {
  const normalizedId = normalizeTeamIdentifier(teamId);
  if (!normalizedId) {
    throw new Error("تیم معتبر نیست.");
  }

  const response = await sendTeamRequest(
    API_ENDPOINTS.users.team(normalizedId),
    { method: "GET", signal },
  );

  if (!response.ok) {
    const message = await helpers.extractErrorMessage(response);
    throw new Error(message || "خطا در دریافت اطلاعات تیم.");
  }

  const data = await safeJson(response);
  if (data && typeof data === "object") {
    return data;
  }

  return null;
}

function resolveImageUrl(source, fallback) {
  if (!source) {
    return fallback;
  }
  if (typeof source === "object") {
    return (
      source.url ||
      source.src ||
      source.href ||
      source.default ||
      fallback ||
      DEFAULT_AVATAR_SRC
    );
  }
  return String(source);
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function defaultToggleButtonLoading(button, isLoading, loadingLabel = "در حال انجام...") {
  if (!button) return;
  if (isLoading) {
    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.textContent || "";
    }
    button.disabled = true;
    button.textContent = loadingLabel;
    button.classList.add("is-loading");
  } else {
    if (button.dataset.originalLabel) {
      button.textContent = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }
    button.disabled = false;
    button.classList.remove("is-loading");
  }
}

function defaultOpenModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("modal--open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal_open");

  const focusTarget =
    modal.querySelector("[data-autofocus]") ||
    modal.querySelector(
      'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
    );

  if (focusTarget && typeof focusTarget.focus === "function") {
    const focusHandler = () => focusTarget.focus();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(focusHandler);
    } else {
      setTimeout(focusHandler, 0);
    }
  }
}

function defaultCloseModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("modal--open");
  modal.setAttribute("aria-hidden", "true");
  if (!document.querySelector(".modal.modal--open")) {
    document.body.classList.remove("modal_open");
  }
}

function bootstrapTeamsPage() {
  if (autoBootstrapCompleted) {
    return;
  }
  const teamsPage = document.querySelector(".user_teams_page");
  if (!teamsPage) {
    return;
  }
  autoBootstrapCompleted = true;
  setupTeamsPageInteractions();
  refreshTeamsData({ includeInvitations: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapTeamsPage);
} else {
  bootstrapTeamsPage();
}
