import { API_ENDPOINTS, buildApiUrl } from "/js/services/api-client.js";

const STORAGE_KEYS = {
  inGameIds: "atom_in_game_ids",
  userId: "atom_cached_user_id",
};

const MAX_SAVED_INGAME_IDS = 10;

const TEAM_SEARCH_DEBOUNCE_MS = 400;

const domCache = new Map();

function getDomElement(id) {
  if (!id) return null;
  if (domCache.has(id)) return domCache.get(id);
  const element = document.getElementById(id);
  domCache.set(id, element || null);
  return element || null;
}

function updateText(id, value) {
  const element = typeof id === "string" ? getDomElement(id) : id;
  if (!element) return;
  element.textContent = value ?? "";
}

function toggleHidden(id, hidden) {
  const element = typeof id === "string" ? getDomElement(id) : id;
  if (!element) return;
  element.classList.toggle("is-hidden", Boolean(hidden));
}

function toggleDisplay(id, show, displayValue = "block") {
  const element = typeof id === "string" ? getDomElement(id) : id;
  if (!element) return;
  element.style.display = show ? displayValue : "none";
}

function updateImage(id, { src, alt, fallbackSrc }) {
  const element = typeof id === "string" ? getDomElement(id) : id;
  if (!element) return;
  if (src) {
    element.src = src;
  } else if (fallbackSrc) {
    element.src = fallbackSrc;
  }
  if (alt) {
    element.alt = alt;
  }
}

function createModalController(modalId, { onOpen, onClose } = {}) {
  const modalElement = () => getDomElement(modalId);

  function open() {
    const element = modalElement();
    if (!element) return;
    element.setAttribute("aria-hidden", "false");
    toggleDisplay(element, true, "flex");
    onOpen?.();
  }

  function close() {
    const element = modalElement();
    if (!element) return;
    element.setAttribute("aria-hidden", "true");
    toggleDisplay(element, false);
    onClose?.();
  }

  function bindDismiss() {
    const element = modalElement();
    if (!element) return;
    element.addEventListener("click", (event) => {
      if (event.target === element) {
        close();
      }
    });
  }

  return { modalId, open, close, bindDismiss };
}

const modalRegistry = new Map();

function registerModal(id, options) {
  if (!id || modalRegistry.has(id)) {
    return modalRegistry.get(id);
  }
  const controller = createModalController(id, options);
  modalRegistry.set(id, controller);
  return controller;
}

function getModal(id) {
  return modalRegistry.get(id) || registerModal(id);
}

function showModal(id) {
  getModal(id)?.open();
}

function hideModal(id) {
  getModal(id)?.close();
}

function ensureFeedbackModal() {
  let modal = getDomElement("globalFeedbackModal");
  if (modal) {
    return modal;
  }

  if (!document.body) {
    return null;
  }

  modal = document.createElement("div");
  modal.id = "globalFeedbackModal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-hidden", "true");
  modal.style.cssText =
    "display:none;position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,0.8);" +
    "align-items:center;justify-content:center;padding:24px;";

  modal.innerHTML = `
    <div class="atom-modal__dialog" style="max-width:420px;width:100%;background:#0f172a;color:#fff;border-radius:16px;padding:24px;box-shadow:0 24px 48px rgba(8,15,31,0.4);border:1px solid rgba(148,163,184,0.2);position:relative;">
      <button type="button" id="globalFeedbackModalClose" aria-label="بستن" style="position:absolute;top:12px;left:12px;background:transparent;border:none;color:inherit;font-size:20px;cursor:pointer;">&times;</button>
      <h3 id="globalFeedbackModalTitle" style="font-size:1.25rem;margin-bottom:12px;"></h3>
      <p id="globalFeedbackModalMessage" style="line-height:1.8;margin-bottom:16px;"></p>
      <div id="globalFeedbackModalAction" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end;"></div>
    </div>
  `;

  document.body.appendChild(modal);
  domCache.set("globalFeedbackModal", modal);

  const closeBtn = modal.querySelector("#globalFeedbackModalClose");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => hideModal("globalFeedbackModal"));
  }

  registerModal("globalFeedbackModal", {
    onClose: () => {
      const action = modal.querySelector("#globalFeedbackModalAction");
      if (action) {
        action.innerHTML = "";
      }
    },
  }).bindDismiss();

  return modal;
}

function showFeedbackModal({
  title,
  message,
  type = "info",
  action,
} = {}) {
  const modal = ensureFeedbackModal();
  if (!modal) {
    if (message) {
      window.alert?.(message);
    }
    return;
  }

  const accent =
    type === "success" ? "#22c55e" : type === "error" ? "#ef4444" : "#38bdf8";
  const dialog = modal.querySelector(".atom-modal__dialog");
  if (dialog) {
    dialog.style.borderColor = accent;
  }

  updateText("globalFeedbackModalTitle", title || "پیام سیستم");
  updateText("globalFeedbackModalMessage", message || "");

  domCache.set("globalFeedbackModalTitle", modal.querySelector("#globalFeedbackModalTitle"));
  domCache.set("globalFeedbackModalMessage", modal.querySelector("#globalFeedbackModalMessage"));

  const actionContainer = modal.querySelector("#globalFeedbackModalAction");
  if (actionContainer) {
    actionContainer.innerHTML = "";
    if (action?.label && action?.href) {
      const link = document.createElement("a");
      link.href = action.href;
      link.textContent = action.label;
      link.target = action.external ? "_blank" : "_self";
      link.rel = action.external ? "noopener" : "";
      link.style.cssText =
        `background:${accent};color:#0f172a;font-weight:600;padding:10px 18px;border-radius:999px;text-decoration:none;`;
      actionContainer.appendChild(link);
    }
  }

  showModal("globalFeedbackModal");
}
const TEAM_VALIDATION_NOTIFICATION_KEYS = {
  TEAM_NOT_FOUND: "teamNotFound",
  NOT_CAPTAIN: "teamJoinUnauthorized",
  ALREADY_REGISTERED: "teamAlreadyRegistered",
  MEMBERS_MISSING: "teamMembersMissing",
  TEAM_TOO_SMALL: "teamTooSmall",
  TEAM_TOO_LARGE: "teamTooLarge",
  TEAM_SIZE_UNKNOWN: "teamSizeUnknown",
};

const PARTICIPANT_PAGE_SIZE = 24;
const PARTICIPANT_RENDER_BATCH = 16;

const state = {
  tournamentId: null,
  tournament: null,
  selectedTeamId: null,
  teamRequestInFlight: false,
  lastUsedInGameId: "",
  userId: null,
  userIdPromise: null,
  teamsById: new Map(),
  teamDetailPromises: new Map(),
  tournamentTeamIds: new Set(),
  teamAbortController: null,
  participants: [],
  participantIds: new Set(),
  participantNextUrl: null,
  participantLoading: false,
  participantRenderedCount: 0,
  participantTotalCount: null,
  participantsInitialised: false,
  participantError: null,
  loginPromptShown: false,
};

function cacheUserId(identifier) {
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

function restoreCachedUserId() {
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

function normaliseId(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "object") {
    const candidates = [value.id, value.user_id, value.pk, value.uuid, value.slug];
    for (const candidate of candidates) {
      const resolved = normaliseId(candidate);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }

  const stringValue = String(value).trim();
  return stringValue.length ? stringValue : null;
}

function stableStringify(value) {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(",")}}`;
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const segments = token.split(".");
  if (segments.length < 2) {
    return null;
  }

  const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  try {
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch (error) {
    console.warn("Failed to decode JWT payload", error);
    return null;
  }
}

function extractUserIdFromPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const directCandidates = [
    payload.user_id,
    payload.userId,
    payload.sub,
    payload.id,
    payload.pk,
    payload.uuid,
    payload.uid,
  ];

  for (const candidate of directCandidates) {
    const resolved = normaliseId(candidate);
    if (resolved) {
      return resolved;
    }
  }

  const nestedCandidates = [
    payload.user,
    payload.profile,
    payload.account,
    payload.member,
    payload.owner,
    payload.identity,
    payload.details,
  ];

  for (const candidate of nestedCandidates) {
    const resolved = normaliseId(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

async function resolveUserIdFromProfile() {
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

async function ensureUserId() {
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

function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

function getTeamMembersList(team) {
  if (!team || typeof team !== "object") {
    return [];
  }

  const candidates = [team.members, team.players, team.users, team.members_list];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function getTeamMemberCount(team) {
  if (!team || typeof team !== "object") {
    return null;
  }

  const numericCandidates = [
    team.member_count,
    team.members_count,
    team.memberCount,
    team.count,
  ];

  for (const candidate of numericCandidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string" && candidate.trim().length) {
      const parsed = Number.parseInt(candidate, 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  const members = getTeamMembersList(team);
  return members.length || null;
}

function markTournamentTeamsCache(tournament) {
  state.tournamentTeamIds = new Set();

  if (!tournament) {
    return;
  }

  const teams = Array.isArray(tournament.teams)
    ? tournament.teams
    : state.tournament?.type === "team" && Array.isArray(state.participants)
    ? state.participants
    : [];
  teams.forEach((team) => {
    const identifier = resolveTeamId(team);
    if (identifier) {
      state.tournamentTeamIds.add(String(identifier));
    }
  });

  state.teamsById.forEach((team, key) => {
    state.teamsById.set(String(key), {
      ...team,
      alreadyRegistered: isTeamAlreadyRegistered(key),
    });
  });

  updateTeamOptionElements();
}

function isTeamAlreadyRegistered(teamId) {
  if (!teamId) {
    return false;
  }
  return state.tournamentTeamIds.has(String(teamId));
}

function normaliseTeamRecord(team) {
  const identifier = resolveTeamId(team);
  if (!identifier) {
    return null;
  }

  const memberList = getTeamMembersList(team);
  const memberCount = getTeamMemberCount({ ...team, members: memberList });

  const captainId = normaliseId(team?.captain);
  const isCaptain = (() => {
    const currentUserId = normaliseId(state.userId);
    if (!currentUserId) {
      return Boolean(team?.is_captain);
    }

    const directCaptain = normaliseId(team?.captain);
    if (directCaptain) {
      return directCaptain === currentUserId;
    }

    if (team?.captain && typeof team.captain === "object") {
      const nestedCandidates = [
        team.captain.id,
        team.captain.user_id,
        team.captain.pk,
      ];
      for (const candidate of nestedCandidates) {
        const resolved = normaliseId(candidate);
        if (resolved) {
          return resolved === currentUserId;
        }
      }
    }

    if (Array.isArray(memberList)) {
      return memberList.some((member) => {
        if (!member || typeof member !== "object") {
          return false;
        }
        const roles = [member.role, member.position];
        if (roles.some((role) => typeof role === "string" && role.toLowerCase() === "captain")) {
          const memberId = normaliseId(member.id || member.user_id || member.pk);
          return memberId === currentUserId;
        }
        return false;
      });
    }

    return Boolean(team?.is_captain);
  })();

  return {
    ...team,
    identifier: String(identifier),
    memberList,
    memberCount,
    captainId,
    isCaptain,
    alreadyRegistered: isTeamAlreadyRegistered(identifier),
    _hydrated:
      (Array.isArray(memberList) && memberList.length > 0) ||
      typeof memberCount === "number",
  };
}

function updateTeamCache(teams) {
  state.teamsById.clear();
  teams.forEach((team) => {
    const normalised = normaliseTeamRecord(team);
    if (normalised) {
      state.teamsById.set(normalised.identifier, normalised);
    }
  });
}

function mergeTeamRecord(teamId, updates) {
  const key = String(teamId);
  const existing = state.teamsById.get(key) || { identifier: key };
  const merged = normaliseTeamRecord({ ...existing, ...updates });
  if (merged) {
    state.teamsById.set(key, merged);
  }
  return merged;
}

function getCachedTeam(teamId) {
  if (!teamId) {
    return null;
  }
  return state.teamsById.get(String(teamId)) || null;
}

function hasTeamMemberData(team) {
  return Array.isArray(team?.memberList) && team.memberList.length > 0;
}

function getRequiredTeamSize() {
  const size = Number(state.tournament?.team_size);
  if (Number.isFinite(size) && size > 0) {
    return size;
  }
  return null;
}

function createTeamSizeValidation(team) {
  const requiredSize = getRequiredTeamSize();
  if (!requiredSize) {
    return { valid: true };
  }

  const actualCount = typeof team?.memberCount === "number" ? team.memberCount : null;
  if (actualCount === null) {
    return {
      valid: false,
      code: "TEAM_SIZE_UNKNOWN",
      message: "تعداد اعضای تیم مشخص نیست. لطفاً اعضای تیم را بررسی کنید.",
    };
  }

  if (actualCount < requiredSize) {
    return {
      valid: false,
      code: "TEAM_TOO_SMALL",
      message: `این تورنومنت به تیمی با ${requiredSize} عضو نیاز دارد؛ تیم شما ${actualCount} عضو دارد.`,
    };
  }

  if (actualCount > requiredSize) {
    return {
      valid: false,
      code: "TEAM_TOO_LARGE",
      message: `حداکثر تعداد مجاز اعضای تیم در این تورنومنت ${requiredSize} نفر است؛ تیم شما ${actualCount} عضو دارد.`,
    };
  }

  return { valid: true };
}

function validateTeamEligibility(team, { includeRegistrationCheck = true } = {}) {
  if (!team) {
    return {
      valid: false,
      code: "TEAM_NOT_FOUND",
      message: "اطلاعات تیم انتخاب‌شده یافت نشد.",
    };
  }

  if (!team.isCaptain) {
    return {
      valid: false,
      code: "NOT_CAPTAIN",
      message: "برای ثبت‌نام تیم باید کاپیتان آن باشید.",
    };
  }

  if (includeRegistrationCheck && team.alreadyRegistered) {
    return {
      valid: false,
      code: "ALREADY_REGISTERED",
      message: "این تیم قبلاً در تورنومنت ثبت شده است.",
    };
  }

  const resolvedMemberCount =
    typeof team.memberCount === "number"
      ? team.memberCount
      : Array.isArray(team.memberList)
      ? team.memberList.length
      : null;

  if (resolvedMemberCount === null) {
    return {
      valid: false,
      code: "TEAM_SIZE_UNKNOWN",
      message: "تعداد اعضای تیم مشخص نیست. لطفاً اطلاعات تیم را به‌روزرسانی کنید.",
    };
  }

  if (resolvedMemberCount <= 0) {
    return {
      valid: false,
      code: "MEMBERS_MISSING",
      message: "تیمی بدون عضو قابل ثبت‌نام نیست. لطفاً ابتدا اعضای تیم را اضافه کنید.",
    };
  }

  const sizeValidation = createTeamSizeValidation({
    ...team,
    memberCount: resolvedMemberCount,
  });
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  return { valid: true };
}

function describeTeamMeta(team) {
  if (!team) {
    return "";
  }

  const fragments = [];

  if (typeof team.memberCount === "number") {
    fragments.push(`${team.memberCount} عضو`);
  }

  if (team.alreadyRegistered) {
    fragments.push("ثبت شده در تورنومنت");
  }

  if (!team.isCaptain) {
    fragments.push("کاپیتان تیم نیستید");
  }

  const sizeValidation = createTeamSizeValidation(team);
  if (!sizeValidation.valid) {
    if (sizeValidation.code === "TEAM_TOO_SMALL") {
      fragments.push("کمتر از حد مجاز");
    } else if (sizeValidation.code === "TEAM_TOO_LARGE") {
      fragments.push("بیشتر از حد مجاز");
    }
  }

  return fragments.join(" • ");
}

function teamRequiresHydration(team) {
  if (!team) {
    return false;
  }

  if (typeof team.memberCount === "number") {
    return false;
  }

  if (team._hydrated) {
    return false;
  }

  return !hasTeamMemberData(team);
}

function notifyTeamValidationError(result) {
  if (!result || result.valid) {
    return;
  }

  const key =
    (result.code && TEAM_VALIDATION_NOTIFICATION_KEYS[result.code]) ||
    "teamJoinValidationFailed";
  notify(key, result.message, "error");
}

async function hydrateTeamIfNeeded(teamId) {
  const key = normaliseId(teamId);
  if (!key) {
    return null;
  }

  const existing = getCachedTeam(key);
  if (existing && !teamRequiresHydration(existing)) {
    return existing;
  }

  if (state.teamDetailPromises.has(key)) {
    try {
      return await state.teamDetailPromises.get(key);
    } catch (error) {
      return existing || null;
    }
  }

  const controllerUrl = buildApiUrl(API_ENDPOINTS.users.team(key));

  const detailPromise = apiFetch(controllerUrl.toString())
    .then((details) => {
      const merged = mergeTeamRecord(key, details);
      updateTeamOptionElements();
      return merged;
    })
    .catch((error) => {
      console.error("Failed to hydrate team details", error);
      const message =
        error?.message || "امکان دریافت اطلاعات کامل تیم وجود ندارد.";
      notify("teamDetailsFetchFailed", message, "error");
      showModalError("teamJoinError", message);
      throw error;
    })
    .finally(() => {
      state.teamDetailPromises.delete(key);
    });

  state.teamDetailPromises.set(key, detailPromise);

  try {
    return await detailPromise;
  } catch (error) {
    return existing || null;
  }
}

function getAuthToken() {
  return (
    localStorage.getItem("authToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    null
  );
}

function isAuthenticated() {
  return Boolean(getAuthToken());
}

function getAuthHeaders() {
  const token = getAuthToken();
  return token
    ? {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }
    : { "Content-Type": "application/json" };
}

async function apiFetch(url, options = {}) {
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

function hidePreloader() {
  toggleDisplay("preloader", false);
}

function showLoginRequired() {
  toggleDisplay("login_required", true, "flex");
  toggleDisplay("lobby_page", false);
  hidePreloader();

  if (!state.loginPromptShown) {
    state.loginPromptShown = true;
    showFeedbackModal({
      title: "برای ادامه وارد شوید",
      message:
        "برای ثبت‌نام یا مشاهده جزئیات تورنومنت باید وارد حساب کاربری خود شوید.",
      type: "info",
      action: {
        label: "ورود به حساب",
        href: "/register/login.html",
      },
    });
  }
}

function showLobbyPage() {
  toggleDisplay("login_required", false);
  toggleDisplay("lobby_page", true, "grid");
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderAdminInfo(tournament) {
  const creator = tournament?.creator || {};
  const firstName = creator.first_name || "";
  const lastName = creator.last_name || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  updateText("adminUsername", `نام کاربری: ${creator.username || "---"}`);
  updateText("adminFullName", `نام: ${fullName || "---"}`);
  updateImage("adminProfilePicture", {
    src: creator.profile_picture,
    fallbackSrc: "img/profile.jpg",
    alt: creator.username || "ادمین",
  });
}

function renderTournamentSummary(tournament) {
  const recruitmentStart =
    tournament.countdown_start_time ||
    tournament.registration_start ||
    tournament.start_date;

  updateText("signup_time", formatDateTime(recruitmentStart));
  updateText("start_time", formatDateTime(tournament.start_date));
  updateText("end_time", formatDateTime(tournament.end_date));
  updateText(
    "tournament_mode",
    tournament.type === "team"
      ? `تیمی (حداکثر ${tournament.team_size || 0} نفر)`
      : "انفرادی",
  );
  updateImage("tournament_banner", {
    src: tournament.image?.image,
    fallbackSrc: "/img/tournaments-defalt-banner.jpg",
    alt: tournament.image?.alt || tournament.name || "بنر",
  });

  const prize = Number(tournament.prize_pool || 0);
  updateText("prize_pool", prize ? `${prize.toLocaleString("fa-IR")} تومان` : "---");
  updateText("tournament_title", tournament.name || "");
  updateText("tournaments-title", tournament.name || "");

  const serverStatus = [
    tournament.status_label,
    tournament.status_display,
    tournament.status,
  ].find((value) => typeof value === "string" && value.trim());

  if (serverStatus) {
    updateText("tournament_status", serverStatus.trim());
  } else {
    const now = new Date();
    const start = tournament.start_date ? new Date(tournament.start_date) : null;
    const end = tournament.end_date ? new Date(tournament.end_date) : null;
    let status = "";

    if (start && now < start) {
      status = "فعال (شروع نشده)";
    } else if (end && now <= end) {
      status = "در حال برگزاری";
    } else {
      status = "تمام شده";
    }

    updateText("tournament_status", status);
  }
}

function resolveGameId(player) {
  if (!player || typeof player !== "object") {
    return "";
  }

  const id =
    player.game_id ||
    player.gameId ||
    player.in_game_id ||
    player.inGameId ||
    player.ingame_id ||
    player.identifier ||
    "";

  return typeof id === "string" || typeof id === "number" ? String(id).trim() : "";
}

function resolveAvatar(entity) {
  if (!entity || typeof entity !== "object") {
    return "img/profile.jpg";
  }

  const direct =
    entity.avatar ||
    entity.profile_picture ||
    entity.profilePicture ||
    entity.picture ||
    entity.image ||
    entity.photo ||
    null;

  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  if (direct && typeof direct === "object") {
    const nested = direct.url || direct.src || direct.image || direct.path;
    if (typeof nested === "string" && nested.trim()) {
      return nested;
    }
  }

  const nestedImage =
    entity?.profile?.picture ||
    entity?.profile?.image ||
    entity?.user?.avatar ||
    entity?.user?.profile_picture ||
    null;

  if (typeof nestedImage === "string" && nestedImage.trim()) {
    return nestedImage;
  }

  return "img/profile.jpg";
}

function createPlayerSlot(player) {
  const slot = document.createElement("div");
  slot.className = "participant_card participant_card--player";

  const username = player?.username || player?.name || "کاربر";
  const gameId = resolveGameId(player);
  const avatar = resolveAvatar(player);

  slot.innerHTML = `
    <div class="participant_card__info">
      <span class="participant_card__name">${username}</span>
      ${gameId ? `<span class="participant_card__meta">${gameId}</span>` : ""}
    </div>
    <div class="participant_card__avatar">
      <img src="${avatar}" alt="${username}" loading="lazy">
    </div>
  `;

  return slot;
}

function renderTeamSlot(team) {
  const slot = document.createElement("div");
  slot.className = "participant_card participant_card--team";

  const members = Array.isArray(team?.members)
    ? team.members
    : Array.isArray(team?.players)
    ? team.players
    : Array.isArray(team?.users)
    ? team.users
    : [];

  const displayedMembers = members.slice(0, 5);
  const extraCount = members.length - displayedMembers.length;

  const membersMarkup = displayedMembers
    .map((member) => {
      const name = member?.username || member?.name || "";
      const avatar = resolveAvatar(member);
      return `
        <div class="participant_team-avatar" title="${name}">
          <img src="${avatar}" alt="${name}" loading="lazy">
        </div>
      `;
    })
    .join("");

  const extraMarkup =
    extraCount > 0
      ? `<div class="participant_team-avatar participant_team-extra">+${extraCount}</div>`
      : "";

  const teamTag = team?.tag || team?.code || team?.identifier || "";
  const headerTag = teamTag
    ? `<span class="participant_team-tag">${teamTag}</span>`
    : "";

  slot.innerHTML = `
    <div class="participant_team-header">
      <span class="participant_team-name">${team?.name || "تیم"}</span>
      ${headerTag}
    </div>
    <div class="participant_team-avatars">
      ${membersMarkup}${extraMarkup}
    </div>
  `;

  return slot;
}

function createEmptyButton(label, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "participants_cta";
  button.innerHTML = `
    <span>${label}</span>
    <span class="participants_cta-icon"><img src="img/icons/plus.svg" alt="plus"></span>
  `;
  button.addEventListener("click", handler);
  return button;
}

function getKnownParticipantCount(tournament) {
  const countCandidates = [
    state.participantTotalCount,
    state.participants?.length,
    tournament?.current_participants,
    tournament?.registration?.current_participants,
    tournament?.registration?.currentParticipants,
    tournament?.participants?.length,
    tournament?.teams?.length,
  ];

  for (const candidate of countCandidates) {
    if (candidate === undefined || candidate === null) {
      continue;
    }

    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }

    if (typeof candidate === "string") {
      const parsed = Number.parseInt(candidate.replace(/[^\d-]/g, ""), 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function parseSpotsLeftValue(tournament) {
  if (!tournament) {
    return null;
  }

  const rawValue = tournament.spots_left;
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === "string") {
    const match = rawValue.match(/-?\d+/);
    if (match) {
      const parsed = Number.parseInt(match[0], 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  const maxSlots = Number(tournament.max_participants);
  if (!Number.isFinite(maxSlots)) {
    return null;
  }

  const currentCount = getKnownParticipantCount(tournament);
  if (!Number.isFinite(currentCount)) {
    return null;
  }

  return Math.max(maxSlots - currentCount, 0);
}

function describeSpotsLeft(tournament) {
  if (!tournament) {
    return "";
  }

  if (typeof tournament.spots_left === "string" && tournament.spots_left.trim()) {
    return tournament.spots_left.trim();
  }

  const remaining = parseSpotsLeftValue(tournament);
  if (remaining === null) {
    return "";
  }

  if (remaining <= 0) {
    return "ظرفیت این تورنومنت تکمیل شده است.";
  }

  return tournament.type === "team"
    ? `${remaining} تیم ظرفیت باقی مانده است.`
    : `${remaining} جای خالی باقی مانده است.`;
}

function getParticipantsSection() {
  const section = document.getElementById("participants_section");
  if (!section) {
    return null;
  }

  let list = section.querySelector("[data-participants-list]");
  let loadMore = section.querySelector("[data-participants-load-more]");
  let meta = section.querySelector("[data-participants-meta]");

  if (!list) {
    list = document.createElement("div");
    list.dataset.participantsList = "true";
    section.appendChild(list);
  }

  if (!loadMore) {
    loadMore = document.createElement("button");
    loadMore.type = "button";
    loadMore.dataset.participantsLoadMore = "true";
    loadMore.className = "participants_load_more";
    loadMore.addEventListener("click", handleParticipantsLoadMore);
    section.appendChild(loadMore);
  }

  if (!meta) {
    meta = document.createElement("div");
    meta.dataset.participantsMeta = "true";
    meta.className = "participants_meta";
    section.appendChild(meta);
  }

  return { section, list, loadMore, meta };
}

function resetParticipantsSection(tournament) {
  const section = document.getElementById("participants_section");
  if (!section) {
    return null;
  }

  section.innerHTML = "";
  const refs = getParticipantsSection();
  if (!refs) {
    return null;
  }

  refs.list.innerHTML = "";
  refs.list.className =
    tournament.type === "team"
      ? "participants_grid teams_grid"
      : "participants_grid players_grid";

  refs.loadMore.textContent = "";
  refs.loadMore.disabled = true;
  refs.loadMore.hidden = true;

  refs.meta.textContent = "";
  refs.meta.classList.add("is-hidden");

  state.participants = [];
  state.participantIds.clear();
  state.participantRenderedCount = 0;
  state.participantNextUrl = null;
  state.participantLoading = false;
  state.participantError = null;
  state.participantsInitialised = true;

  return refs;
}

function updateParticipantsMeta(tournament) {
  const refs = getParticipantsSection();
  if (!refs) {
    return;
  }

  const message = describeSpotsLeft(tournament);
  if (message) {
    refs.meta.textContent = message;
    refs.meta.classList.remove("is-hidden");
  } else {
    refs.meta.textContent = "";
    refs.meta.classList.add("is-hidden");
  }
}

function updateJoinCta(tournament) {
  const refs = getParticipantsSection();
  if (!refs) {
    return;
  }

  const existing = refs.list.querySelector(".participants_cta");
  if (existing) {
    existing.remove();
  }

  const availableSpots = parseSpotsLeftValue(tournament);
  const hasCapacity = availableSpots === null ? true : availableSpots > 0;
  if (!hasCapacity) {
    return;
  }

  const ctaLabel =
    tournament.type === "team"
      ? "همین الان تیمت رو اضافه کن"
      : "همین الان اضافه شو!";
  const handler = tournament.type === "team" ? openTeamJoinModal : openIndividualJoinModal;
  const cta = createEmptyButton(ctaLabel, handler);
  refs.list.prepend(cta);
}

function updateParticipantsLoadMoreButton() {
  const refs = getParticipantsSection();
  if (!refs) {
    return;
  }

  const hasBuffered = state.participantRenderedCount < state.participants.length;
  const canFetchMore = Boolean(state.participantNextUrl);
  const loading = state.participantLoading;

  if (!hasBuffered && !canFetchMore) {
    refs.loadMore.hidden = true;
    refs.loadMore.disabled = true;
    return;
  }

  refs.loadMore.hidden = false;
  refs.loadMore.disabled = loading;
  refs.loadMore.textContent = loading
    ? "در حال بارگیری..."
    : hasBuffered
    ? "نمایش بیشتر"
    : "بارگیری بیشتر";
}

function handleParticipantsLoadMore() {
  if (state.participantLoading) {
    return;
  }

  if (state.participantRenderedCount < state.participants.length) {
    renderParticipantBatch();
    return;
  }

  if (state.participantNextUrl) {
    fetchParticipantsPage(state.participantNextUrl);
  }
}

function normaliseParticipantKey(participant) {
  if (participant === null || participant === undefined) {
    return null;
  }

  if (typeof participant !== "object") {
    return String(participant);
  }

  const directCandidates = [
    participant.identifier,
    participant.id,
    participant.user_id,
    participant.userId,
    participant.pk,
    participant.uuid,
    participant.slug,
    participant.team_id,
    participant.teamId,
    participant.username,
    participant.name,
  ];

  for (const candidate of directCandidates) {
    const resolved = normaliseId(candidate);
    if (resolved) {
      return resolved;
    }
  }

  const nestedCandidates = [participant.user, participant.profile, participant.account];
  for (const nested of nestedCandidates) {
    const resolved = normaliseId(nested?.id) || normaliseId(nested?.username);
    if (resolved) {
      return resolved;
    }
  }

  return stableStringify(participant);
}

function mergeParticipants(participants, { replace = false } = {}) {
  if (!Array.isArray(participants) || !participants.length) {
    return;
  }

  if (replace) {
    state.participants = [];
    state.participantIds.clear();
    state.participantRenderedCount = 0;
  }

  participants.forEach((participant) => {
    const key = normaliseParticipantKey(participant);
    if (key && state.participantIds.has(key)) {
      return;
    }
    state.participants.push(participant);
    if (key) {
      state.participantIds.add(key);
      if (state.tournament?.type === "team") {
        state.tournamentTeamIds.add(String(key));
      }
    }
  });
}

function renderParticipantBatch() {
  const refs = getParticipantsSection();
  if (!refs) {
    return;
  }

  const startIndex = state.participantRenderedCount;
  const nextTarget = Math.min(
    state.participants.length,
    state.participantRenderedCount + PARTICIPANT_RENDER_BATCH,
  );

  if (nextTarget <= startIndex) {
    updateParticipantsLoadMoreButton();
    return;
  }

  const existingCta = refs.list.querySelector(".participants_cta");
  if (existingCta) {
    existingCta.remove();
  }

  const fragment = document.createDocumentFragment();
  for (let index = startIndex; index < nextTarget; index += 1) {
    const item = state.participants[index];
    const node = state.tournament?.type === "team"
      ? renderTeamSlot(item)
      : createPlayerSlot(item);
    fragment.appendChild(node);
  }

  refs.list.appendChild(fragment);
  state.participantRenderedCount = nextTarget;
  updateJoinCta(state.tournament);
  updateParticipantsLoadMoreButton();
}

function normaliseParticipantPage(payload) {
  if (Array.isArray(payload)) {
    return { results: payload, next: null, count: payload.length };
  }

  if (payload && typeof payload === "object") {
    const results = Array.isArray(payload.results)
      ? payload.results
      : Array.isArray(payload.items)
      ? payload.items
      : [];
    const count =
      typeof payload.count === "number"
        ? payload.count
        : typeof payload.total === "number"
        ? payload.total
        : null;
    const next = payload.next || payload.next_page || null;
    return { results, next, count };
  }

  return { results: [], next: null, count: null };
}

function buildParticipantsRequestUrl(rawUrl) {
  if (rawUrl) {
    try {
      return new URL(rawUrl, window.location.origin);
    } catch (error) {
      console.warn("Failed to parse participant next URL", error);
    }
  }

  if (!state.tournamentId) {
    return null;
  }

  const basePath = API_ENDPOINTS.tournaments.detail(state.tournamentId);
  const normalisedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const url = buildApiUrl(`${normalisedBase}participants/`);
  url.searchParams.set("page_size", PARTICIPANT_PAGE_SIZE);
  return url;
}

async function fetchParticipantsPage(rawUrl) {
  if (state.participantLoading) {
    return;
  }

  const requestUrl = buildParticipantsRequestUrl(rawUrl);
  if (!requestUrl) {
    return;
  }

  state.participantLoading = true;
  updateParticipantsLoadMoreButton();

  try {
    const payload = await apiFetch(requestUrl.toString());
    const page = normaliseParticipantPage(payload);
    if (typeof page.count === "number") {
      state.participantTotalCount = page.count;
    }
    state.participantNextUrl = page.next || null;
    mergeParticipants(page.results);
    renderParticipantBatch();
  } catch (error) {
    console.warn("Failed to load tournament participants", error);
    state.participantNextUrl = null;
    state.participantError = error;
    if (!state.participants.length && Array.isArray(state.tournament?.participants)) {
      mergeParticipants(state.tournament.participants, { replace: true });
      renderParticipantBatch();
    } else if (!state.participants.length) {
      const refs = getParticipantsSection();
      if (refs) {
        refs.meta.textContent = "امکان دریافت لیست شرکت‌کنندگان وجود ندارد.";
        refs.meta.classList.remove("is-hidden");
      }
    }
  } finally {
    state.participantLoading = false;
    updateParticipantsLoadMoreButton();
    updateParticipantsMeta(state.tournament);
  }
}

function renderParticipants(tournament, options = {}) {
  const refs = resetParticipantsSection(tournament);
  if (!refs) {
    return;
  }

  const initialParticipants = Array.isArray(options.participants)
    ? options.participants
    : Array.isArray(tournament.participants)
    ? tournament.participants
    : [];

  if (typeof options.totalCount === "number") {
    state.participantTotalCount = options.totalCount;
  } else if (typeof tournament.participants_count === "number") {
    state.participantTotalCount = tournament.participants_count;
  }

  state.participantNextUrl = options.nextUrl || null;

  if (initialParticipants.length) {
    mergeParticipants(initialParticipants, { replace: true });
    renderParticipantBatch();
  } else {
    updateJoinCta(tournament);
    updateParticipantsLoadMoreButton();
  }

  updateParticipantsMeta(tournament);
}

function applyTournamentPayload(tournament, options = {}) {
  if (!tournament) {
    return;
  }

  const mergedTournament = { ...(state.tournament || {}), ...tournament };
  state.tournament = mergedTournament;

  markTournamentTeamsCache(mergedTournament);
  renderTournamentSummary(mergedTournament);
  renderAdminInfo(mergedTournament);

  const participantOptions = {};
  if (options.participants !== undefined) {
    participantOptions.participants = options.participants;
  } else if (Array.isArray(tournament.participants)) {
    participantOptions.participants = tournament.participants;
  }

  if (options.participantsNext !== undefined) {
    participantOptions.nextUrl = options.participantsNext;
  }

  if (options.participantsTotal !== undefined) {
    participantOptions.totalCount = options.participantsTotal;
  } else if (typeof tournament.participants_count === "number") {
    participantOptions.totalCount = tournament.participants_count;
  }

  renderParticipants(mergedTournament, participantOptions);

  if (options.fetchParticipants) {
    if (!state.participants.length) {
      fetchParticipantsPage();
    } else {
      updateParticipantsLoadMoreButton();
    }
  }
}

function notify(key, fallbackMessage, type = "info", overrides = {}) {
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

function showModalError(elementId, message) {
  const element = getDomElement(elementId);
  if (!element) return;

  const text = message?.toString().trim() || "";
  updateText(element, text);
  element.classList.toggle("is-hidden", !text);
}

function clearModalError(elementId) {
  showModalError(elementId, "");
}

function openJoinSuccessModal(message) {
  updateText(
    "joinSuccessModalMessage",
    message || "جزئیات تورنومنت به ایمیل شما ارسال شد. لطفاً ایمیل خود را بررسی کنید.",
  );
  showModal("joinSuccessModal");
}

function closeJoinSuccessModal() {
  hideModal("joinSuccessModal");
}

function showJoinSuccessFeedback({ isTeam } = {}) {
  const message = isTeam
    ? "جزئیات تورنومنت به ایمیل کاپیتان تیم ارسال شد. لطفاً ایمیل را بررسی کنید."
    : "جزئیات تورنومنت به ایمیل شما ارسال شد. لطفاً ایمیل خود را بررسی کنید.";

  openJoinSuccessModal(message);
}

function getStoredInGameIds() {
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

function storeInGameIds(values) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.inGameIds,
      JSON.stringify(values.slice(0, MAX_SAVED_INGAME_IDS)),
    );
  } catch (error) {
    console.warn("Failed to store in-game IDs", error);
  }
}

function populateInGameIdOptions(selectedValue = "") {
  const select = getDomElement("inGameIdSelect");
  const wrapper = getDomElement("inGameIdSavedWrapper");
  if (!select || !wrapper) return;

  const saved = getStoredInGameIds();
  select.innerHTML = '<option value="">یکی از نام‌های قبلی را انتخاب کنید</option>';

  if (!saved.length) {
    toggleHidden(wrapper, true);
    return;
  }

  toggleHidden(wrapper, false);

  saved.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    if (selectedValue && item === selectedValue) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

function setInGameIdInputValue(value) {
  const input = document.getElementById("inGameIdInput");
  if (!input) return;
  input.value = value || "";
}

function rememberInGameId(value) {
  const trimmed = value.trim();
  if (!trimmed) return;

  const saved = getStoredInGameIds();
  const filtered = saved.filter((item) => item !== trimmed);
  filtered.unshift(trimmed);
  storeInGameIds(filtered);
  state.lastUsedInGameId = trimmed;
  populateInGameIdOptions(trimmed);
}

function useSavedInGameId() {
  const select = document.getElementById("inGameIdSelect");
  if (!select) return;

  const chosen = select.value?.trim();
  if (!chosen) {
    showModalError(
      "individualJoinError",
      "لطفاً یک نام ذخیره‌شده را انتخاب کنید یا نام جدیدی وارد نمایید.",
    );
    return;
  }

  clearModalError("individualJoinError");
  setInGameIdInputValue(chosen);
}

function resetIndividualJoinModal() {
  const form = document.querySelector("#individualJoinModal form");
  if (form) {
    form.reset();
  }

  const defaultValue = state.lastUsedInGameId || getStoredInGameIds()[0] || "";
  setInGameIdInputValue(defaultValue);
  populateInGameIdOptions(defaultValue);
  clearModalError("individualJoinError");
}

async function loadTournament() {
  if (!state.tournamentId) return;

  try {
    const detailUrl = buildApiUrl(
      API_ENDPOINTS.tournaments.detail(state.tournamentId),
    );
    const detailFields = [
      "id",
      "name",
      "description",
      "image",
      "color",
      "game",
      "start_date",
      "end_date",
      "countdown_start_time",
      "type",
      "mode",
      "max_participants",
      "team_size",
      "prize_pool",
      "spots_left",
      "creator",
      "status",
      "status_display",
      "status_label",
      "team_join_field",
      "join_payload_template",
      "join_payload",
      "registration_payload_template",
      "registration_payload",
      "registration",
      "registration_settings",
    ];
    detailUrl.searchParams.set("fields", detailFields.join(","));
    detailUrl.searchParams.set("expand", "creator,image");

    const tournament = await apiFetch(detailUrl.toString());

    applyTournamentPayload(tournament, { fetchParticipants: true });
    showLobbyPage();
  } catch (error) {
    console.error("Failed to load tournament", error);
    const message =
      error.message || "امکان دریافت اطلاعات تورنومنت وجود ندارد. لطفاً بعداً دوباره تلاش کنید.";
    notify("tournamentFetchFailed", message, "error");
  } finally {
    hidePreloader();
  }
}

function hasTeamSelectionValue(value) {
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
}

function resetTeamSelection() {
  state.selectedTeamId = null;
  const confirmBtn = document.getElementById("teamJoinConfirmButton");
  if (confirmBtn) confirmBtn.disabled = true;

  const list = document.getElementById("teamModalList");
  if (list) {
    list.querySelectorAll(".team-option").forEach((btn) => {
      btn.classList.remove("selected");
      btn.setAttribute("aria-pressed", "false");
    });
  }

  clearModalError("teamJoinError");
}

function applyTeamValidationResult(result) {
  const confirmBtn = document.getElementById("teamJoinConfirmButton");
  if (result?.valid) {
    if (confirmBtn) confirmBtn.disabled = false;
    clearModalError("teamJoinError");
    return;
  }

  if (confirmBtn) confirmBtn.disabled = true;
  if (result?.message) {
    showModalError("teamJoinError", result.message);
  }
}

function markSelectedTeamButton(teamId) {
  const list = document.getElementById("teamModalList");
  if (!list) {
    return;
  }

  list.querySelectorAll(".team-option").forEach((btn) => {
    const isSelected = String(btn.dataset.teamId) === String(teamId);
    btn.classList.toggle("selected", isSelected);
    btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });
}

function selectTeam(teamId) {
  const normalisedValue = hasTeamSelectionValue(teamId)
    ? String(teamId).trim()
    : null;

  state.selectedTeamId = normalisedValue;
  markSelectedTeamButton(normalisedValue);

  const selectEl = document.getElementById("teamSelect");
  if (selectEl) {
    selectEl.value = hasTeamSelectionValue(normalisedValue) ? normalisedValue : "";
  }

  if (!hasTeamSelectionValue(normalisedValue)) {
    applyTeamValidationResult({ valid: false, message: "لطفاً یک تیم انتخاب کنید." });
    return;
  }

  const cachedTeam = getCachedTeam(normalisedValue);
  if (!cachedTeam) {
    applyTeamValidationResult({
      valid: false,
      message: "اطلاعات تیم انتخاب‌شده یافت نشد.",
    });
    return;
  }

  if (teamRequiresHydration(cachedTeam)) {
    applyTeamValidationResult({
      valid: false,
      message: "در حال بررسی شرایط تیم...",
    });

    hydrateTeamIfNeeded(normalisedValue)
      .then((updatedTeam) => {
        if (state.selectedTeamId !== normalisedValue) {
          return;
        }
        const validation = validateTeamEligibility(updatedTeam);
        applyTeamValidationResult(validation);
      })
      .catch(() => {
        if (state.selectedTeamId === normalisedValue) {
          applyTeamValidationResult({
            valid: false,
            message: "امکان بررسی شرایط تیم وجود ندارد.",
          });
        }
      });

    return;
  }

  const validation = validateTeamEligibility(cachedTeam);
  applyTeamValidationResult(validation);
}

function resolveTeamId(team) {
  if (!team || typeof team !== "object") return null;

  const candidates = [
    team.identifier,
    team.id,
    team.pk,
    team.team_id,
    team.teamId,
    team.team,
    team.uuid,
    team.slug,
  ];

  for (const value of candidates) {
    const resolved = normaliseId(value);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function resolveTeamJoinPayloadIdentifier(teamId) {
  if (!hasTeamSelectionValue(teamId)) {
    return null;
  }

  const stringValue = String(teamId).trim();
  if (!stringValue) {
    return null;
  }

  if (/^\d+$/.test(stringValue)) {
    const numeric = Number.parseInt(stringValue, 10);
    return Number.isNaN(numeric) ? null : numeric;
  }

  return stringValue;
}

function getPreferredTeamJoinField() {
  const modal = document.getElementById("teamJoinModal");
  const modalField = modal?.dataset?.teamJoinField;
  if (typeof modalField === "string" && modalField.trim().length) {
    return modalField.trim();
  }

  const bodyField = document.body?.dataset?.teamJoinField;
  if (typeof bodyField === "string" && bodyField.trim().length) {
    return bodyField.trim();
  }

  const tournamentFieldCandidates = [
    state.tournament?.team_join_field,
    state.tournament?.teamJoinField,
    state.tournament?.registration?.team_field,
    state.tournament?.registration?.teamField,
    state.tournament?.registration_settings?.team_field,
    state.tournament?.registration_settings?.teamField,
  ];

  for (const candidate of tournamentFieldCandidates) {
    if (typeof candidate === "string" && candidate.trim().length) {
      return candidate.trim();
    }
  }

  return null;
}

function createTeamJoinPayloadCandidates(team, identifier) {
  const candidates = [];
  const seen = new Set();

  const addCandidate = (payload) => {
    if (!payload || typeof payload !== "object") {
      return;
    }
    const serialized = JSON.stringify(payload);
    if (seen.has(serialized)) {
      return;
    }
    seen.add(serialized);
    candidates.push(payload);
  };

  const preferredField = getPreferredTeamJoinField();
  if (preferredField) {
    addCandidate({ [preferredField]: identifier });
  }

  const knownIdentifiers = new Set();
  if (hasTeamSelectionValue(identifier)) {
    knownIdentifiers.add(identifier);
  }

  if (team && typeof team === "object") {
    const identifierFields = [
      team.identifier,
      team.id,
      team.team_id,
      team.teamId,
      team.slug,
      team.uuid,
    ];
    identifierFields.forEach((value) => {
      const normalised = normaliseId(value);
      if (normalised) {
        knownIdentifiers.add(normalised);
      }
    });
  }

  knownIdentifiers.forEach((value) => {
    addCandidate({ team: value });

    const numericId =
      typeof value === "number"
        ? value
        : /^\d+$/.test(String(value))
        ? Number.parseInt(String(value), 10)
        : null;

    if (numericId !== null && !Number.isNaN(numericId)) {
      addCandidate({ team_id: numericId });
      addCandidate({ teamId: numericId });
    } else if (typeof value === "string" && value.trim().length) {
      addCandidate({ team_slug: value });
      addCandidate({ teamSlug: value });
    }
  });

  const templateSources = [
    state.tournament?.registration_payload_template,
    state.tournament?.registration_payload,
    state.tournament?.join_payload_template,
    state.tournament?.join_payload,
  ];

  templateSources.forEach((template) => {
    if (!template || typeof template !== "object") {
      return;
    }
    const cloned = { ...template };
    const hasTeamKey = Object.keys(cloned).some((key) =>
      typeof key === "string" && key.toLowerCase().startsWith("team"),
    );
    if (!hasTeamKey) {
      cloned.team = identifier;
    }
    addCandidate(cloned);
  });

  if (!candidates.length) {
    addCandidate({ team: identifier });
  }

  return candidates;
}

function shouldRetryTeamJoinRequest(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  if (![400, 422].includes(error.status)) {
    return false;
  }

  const messages = [];

  if (error.payload) {
    const stack = [error.payload];
    while (stack.length) {
      const value = stack.pop();
      if (value === null || value === undefined) {
        continue;
      }
      if (typeof value === "string" || typeof value === "number") {
        messages.push(String(value));
        continue;
      }
      if (Array.isArray(value)) {
        stack.push(...value);
        continue;
      }
      if (typeof value === "object") {
        stack.push(...Object.values(value));
      }
    }
  }

  if (typeof error.message === "string") {
    messages.push(error.message);
  }

  const combined = messages.map((text) => text.toLowerCase()).join(" ");

  const stopKeywords = [
    "captain",
    "کاپیتان",
    "already",
    "قبلا",
    "ثبت",
    "member",
    "عضو",
    "اعضا",
    "ظرفیت",
    "full",
    "size",
    "limit",
    "حداکثر",
    "حداقل",
    "تعداد",
  ];

  if (combined && stopKeywords.some((keyword) => combined.includes(keyword))) {
    return false;
  }

  const retryKeywords = [
    "field",
    "payload",
    "body",
    "json",
    "required",
    "missing",
    "invalid",
    "team_id",
    "team id",
    "team",
    "شناسه",
    "اجباری",
    "الزامی",
  ];

  if (!combined) {
    return true;
  }

  return retryKeywords.some((keyword) => combined.includes(keyword));
}

async function submitTeamJoinRequest(joinUrl, team, identifier) {
  const payloadCandidates = createTeamJoinPayloadCandidates(team, identifier);
  let lastError = null;

  for (const payload of payloadCandidates) {
    try {
      const response = await apiFetch(joinUrl, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return response;
    } catch (error) {
      if (!shouldRetryTeamJoinRequest(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("ارسال اطلاعات ثبت‌نام تیم با خطا مواجه شد.");
}

function renderTeamOptions(teams, meta = {}) {
  const list = document.getElementById("teamModalList");
  const selectEl = document.getElementById("teamSelect");
  const emptyState = document.getElementById("teamModalEmptyState");
  const emptyTitle = emptyState?.querySelector("p");
  const emptySubtitle = emptyState?.querySelector("span");

  if (list) list.innerHTML = "";
  if (selectEl) selectEl.innerHTML = '<option value="">انتخاب تیم</option>';

  if (selectEl && !selectEl.dataset.listenerAttached) {
    selectEl.addEventListener("change", (event) => {
      const { value } = event.target;
      selectTeam(value);
    });
    selectEl.dataset.listenerAttached = "true";
  }

  updateTeamCache(Array.isArray(teams) ? teams : []);
  const processedTeams = Array.from(state.teamsById.values());

  if (!processedTeams.length) {
    if (emptyState) emptyState.classList.remove("is-hidden");
    if (emptyTitle) {
      emptyTitle.textContent =
        meta.empty_title || "هیچ تیم واجد شرایطی برای این تورنومنت پیدا نشد.";
    }
    if (emptySubtitle) {
      emptySubtitle.textContent =
        meta.empty_subtitle ||
        "برای ثبت‌نام، تیمی که کاپیتان آن هستید باید توسط سرور تایید شود.";
    }
    resetTeamSelection();
    return;
  }

  if (emptyState) emptyState.classList.add("is-hidden");

  const fragment = document.createDocumentFragment();

  processedTeams.forEach((team) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "team-option";
    button.dataset.teamId = team.identifier;

    const infoWrapper = document.createElement("div");
    infoWrapper.className = "team-option__info";

    const nameSpan = document.createElement("span");
    nameSpan.className = "team-option__name";
    nameSpan.textContent = team.name || "تیم";

    const metaSpan = document.createElement("span");
    metaSpan.className = "team-option__meta";
    metaSpan.textContent = describeTeamMeta(team);

    infoWrapper.appendChild(nameSpan);
    infoWrapper.appendChild(metaSpan);
    button.appendChild(infoWrapper);

    const tooltipParts = [team.name || "تیم"];
    if (metaSpan.textContent) {
      tooltipParts.push(metaSpan.textContent);
    }
    button.title = tooltipParts.filter(Boolean).join(" - ");

    const previewValidation = validateTeamEligibility(team, {
      includeRegistrationCheck: false,
    });
    if (!previewValidation.valid || team.alreadyRegistered) {
      button.classList.add("team-option--warning");
      button.title = previewValidation.message || "";
    }

    button.addEventListener("click", () => selectTeam(team.identifier));
    fragment.appendChild(button);

    if (selectEl) {
      const option = document.createElement("option");
      option.value = team.identifier;
      option.textContent = team.name || "تیم";
      selectEl.appendChild(option);
    }
  });

  list?.appendChild(fragment);

  const previousSelection = state.selectedTeamId;
  if (previousSelection && state.teamsById.has(String(previousSelection))) {
    selectTeam(previousSelection);
  } else {
    resetTeamSelection();
  }
}

//

function updateTeamOptionElements() {
  const list = document.getElementById("teamModalList");
  if (!list) {
    return;
  }

  list.querySelectorAll(".team-option").forEach((button) => {
    const teamId = button.dataset.teamId;
    const team = getCachedTeam(teamId);
    if (!team) {
      return;
    }

    const metaSpan = button.querySelector(".team-option__meta");
    if (metaSpan) {
      metaSpan.textContent = describeTeamMeta(team);
    }

    const tooltipParts = [team.name || "تیم"];
    if (metaSpan?.textContent) {
      tooltipParts.push(metaSpan.textContent);
    }
    button.title = tooltipParts.filter(Boolean).join(" - ");

    const previewValidation = validateTeamEligibility(team, {
      includeRegistrationCheck: false,
    });

    if (!previewValidation.valid || team.alreadyRegistered) {
      button.classList.add("team-option--warning");
    } else {
      button.classList.remove("team-option--warning");
    }
  });
}

//

async function fetchTeamOptions(searchTerm = "") {
  const trimmedSearch = searchTerm?.toString().trim() || "";

  if (state.teamRequestInFlight && state.teamAbortController) {
    state.teamAbortController.abort();
  }

  const controller = new AbortController();
  state.teamAbortController = controller;
  state.teamRequestInFlight = true;

  const loading = document.getElementById("teamModalLoading");
  if (loading) loading.classList.remove("is-hidden");
  clearModalError("teamJoinError");

  try {
    const userId = await ensureUserId();
    if (!userId) {
      const message = "شناسه کاربر یافت نشد. لطفاً دوباره وارد شوید.";
      notify("loginRequired", message, "error", {
        action: {
          label: "ورود به حساب",
          href: "/register/login.html",
        },
      });
      showModalError("teamJoinError", message);
      renderTeamOptions([], {});
      return;
    }

    const url = buildApiUrl(API_ENDPOINTS.users.teams);
    url.searchParams.set("captain", userId);
    if (trimmedSearch) {
      url.searchParams.set("name", trimmedSearch);
      url.searchParams.set("search", trimmedSearch);
    }

    const result = await apiFetch(url.toString(), {
      signal: controller.signal,
    });

    const metaEl = document.getElementById("teamModalMeta");
    const hintEl = document.getElementById("teamModalHint");
    if (metaEl) {
      const description =
        result?.meta?.description ||
        result?.meta?.message ||
        "تیم‌هایی که کاپیتان آن‌ها هستید برای ثبت‌نام در اینجا نمایش داده می‌شوند.";
      metaEl.textContent = description;
    }
    if (hintEl) {
      hintEl.textContent = result?.meta?.hint || "";
    }

    const teams = Array.isArray(result?.results)
      ? result.results
      : Array.isArray(result)
      ? result
      : [];

    renderTeamOptions(teams, result?.meta || {});
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }
    console.error("Failed to load teams", error);
    const message =
      error?.message || "امکان دریافت تیم‌ها وجود ندارد. لطفاً بعداً دوباره تلاش کنید.";
    notify("tournamentFetchFailed", message, "error");
    showModalError("teamJoinError", message);
    renderTeamOptions([], {});
  } finally {
    state.teamRequestInFlight = false;
    if (state.teamAbortController === controller) {
      state.teamAbortController = null;
    }
    if (loading) loading.classList.add("is-hidden");
  }
}
  

async function openIndividualJoinModal() {
  if (!isAuthenticated()) {
    showLoginRequired();
    return;
  }

  resetIndividualJoinModal();
  showModal("individualJoinModal");
}

async function openTeamJoinModal() {
  if (!isAuthenticated()) {
    showLoginRequired();
    return;
  }

  clearModalError("teamJoinError");
  showModal("teamJoinModal");
  await fetchTeamOptions();
}

function closeIndividualJoinModal() {
  hideModal("individualJoinModal");
  resetIndividualJoinModal();
}

function closeTeamJoinModal() {
  hideModal("teamJoinModal");
  clearModalError("teamJoinError");
  resetTeamSelection();
}

async function joinIndividualTournament(event) {
  if (event?.preventDefault) {
    event.preventDefault();
  }

  if (!state.tournamentId) return;

  clearModalError("individualJoinError");

  const input = document.getElementById("inGameIdInput");
  const select = document.getElementById("inGameIdSelect");
  const submitBtn = document.querySelector("#individualJoinModal button[type='submit']");

  let inGameId = input?.value?.trim() || "";
  if (!inGameId && select) {
    inGameId = select.value?.trim() || "";
  }

  if (!inGameId) {
    showModalError("individualJoinError", "لطفاً نام کاربری خود در بازی را وارد کنید.");
    input?.focus();
    return;
  }

  if (inGameId.length < 3) {
    showModalError("individualJoinError", "نام وارد شده باید حداقل ۳ کاراکتر باشد.");
    input?.focus();
    return;
  }

  if (submitBtn) submitBtn.disabled = true;

  try {
    const payload = { in_game_id: inGameId };

    const joinUrl = buildApiUrl(
      API_ENDPOINTS.tournaments.join(state.tournamentId),
    );
    const updatedTournament = await apiFetch(joinUrl.toString(), {
      method: "POST",
      body: JSON.stringify(payload),
    });

    notify("tournamentJoinSuccess", null, "success");
    rememberInGameId(inGameId);
    closeIndividualJoinModal();
    showJoinSuccessFeedback({ isTeam: false });
    applyTournamentPayload(updatedTournament, {
      participants: Array.isArray(updatedTournament?.participants)
        ? updatedTournament.participants
        : undefined,
      participantsNext:
        updatedTournament?.participants_next || updatedTournament?.participantsNext || null,
      participantsTotal:
        typeof updatedTournament?.participants_count === "number"
          ? updatedTournament.participants_count
          : Array.isArray(updatedTournament?.participants)
          ? updatedTournament.participants.length
          : undefined,
    });
  } catch (error) {
    console.error("Failed to join tournament", error);
    const message =
      error.message || "امکان ثبت‌نام وجود ندارد. لطفاً بعداً دوباره تلاش کنید.";
    notify("tournamentJoinFailed", message, "error");
    showModalError("individualJoinError", message);
  }

  if (submitBtn) submitBtn.disabled = false;
}

function interpretTeamJoinError(error) {
  const defaultMessage = "امکان ثبت‌نام تیم وجود ندارد. لطفاً دوباره تلاش کنید.";

  if (!error) {
    return { message: defaultMessage, key: "tournamentJoinFailed" };
  }

  const textSources = [];
  if (error.message) textSources.push(error.message);

  if (error.payload) {
    if (typeof error.payload === "string") {
      textSources.push(error.payload);
    } else if (typeof error.payload === "object") {
      const detailCandidates = [
        error.payload.detail,
        error.payload.message,
        error.payload.error,
        error.payload.non_field_errors,
      ];
      detailCandidates.forEach((candidate) => {
        if (!candidate) return;
        if (Array.isArray(candidate)) {
          candidate.forEach((item) => {
            if (item) {
              textSources.push(String(item));
            }
          });
        } else {
          textSources.push(String(candidate));
        }
      });
    }
  }

  const combined = textSources
    .map((text) => String(text).toLowerCase())
    .join(" ");

  if (
    error.status === 403 ||
    combined.includes("permission") ||
    combined.includes("forbidden") ||
    combined.includes("not allowed") ||
    combined.includes("captain") ||
    combined.includes("کاپیتان")
  ) {
    return {
      message: "برای ثبت‌نام این تیم دسترسی ندارید. تنها کاپیتان تیم می‌تواند اقدام کند.",
      key: "teamJoinUnauthorized",
    };
  }

  if (
    error.status === 409 ||
    combined.includes("already") ||
    combined.includes("exists") ||
    combined.includes("duplicat") ||
    combined.includes("قبلا") ||
    combined.includes("ثبت شده")
  ) {
    return {
      message: "این تیم قبلاً در تورنومنت ثبت شده است.",
      key: "teamAlreadyRegistered",
    };
  }

  if (
    combined.includes("member") ||
    combined.includes("size") ||
    combined.includes("capacity") ||
    combined.includes("حداکثر") ||
    combined.includes("حداقل") ||
    combined.includes("full") ||
    combined.includes("limit")
  ) {
    return {
      message: "تعداد اعضای تیم با شرایط تورنومنت مطابقت ندارد.",
      key: "teamTooLarge",
    };
  }

  if (error.status === 404 || combined.includes("not found")) {
    return {
      message: "تیم انتخاب‌شده روی سرور پیدا نشد. لطفاً دوباره تلاش کنید.",
      key: "tournamentJoinFailed",
    };
  }

  const fallbackMessage = textSources.length ? textSources[0] : defaultMessage;
  return {
    message: fallbackMessage,
    key: "tournamentJoinFailed",
  };
}

async function joinTeamTournament() {
  if (!state.tournamentId) return;
  if (!hasTeamSelectionValue(state.selectedTeamId)) {
    const message = "لطفاً یک تیم انتخاب کنید.";
    notify("teamSelectionRequired", message);
    showModalError("teamJoinError", message);
    return;
  }

  const confirmBtn = document.getElementById("teamJoinConfirmButton");
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const hydratedTeam = await hydrateTeamIfNeeded(state.selectedTeamId);
    const validation = validateTeamEligibility(hydratedTeam);

    if (!validation.valid) {
      notifyTeamValidationError(validation);
      applyTeamValidationResult(validation);
      return;
    }

    const payloadIdentifier = resolveTeamJoinPayloadIdentifier(
      hydratedTeam?.identifier || state.selectedTeamId,
    );

    if (payloadIdentifier === null) {
      const error = new Error(
        "شناسه تیم انتخاب‌شده نامعتبر است. لطفاً دوباره تلاش کنید.",
      );
      error.code = "INVALID_TEAM_ID";
      throw error;
    }

    clearModalError("teamJoinError");

    const joinUrl = buildApiUrl(
      API_ENDPOINTS.tournaments.join(state.tournamentId),
    );

    const updatedTournament = await submitTeamJoinRequest(
      joinUrl.toString(),
      hydratedTeam,
      payloadIdentifier,
    );

    notify("teamJoinSuccess", null, "success");
    closeTeamJoinModal();
    showJoinSuccessFeedback({ isTeam: true });
    applyTournamentPayload(updatedTournament, {
      participants: Array.isArray(updatedTournament?.teams)
        ? updatedTournament.teams
        : Array.isArray(updatedTournament?.participants)
        ? updatedTournament.participants
        : undefined,
      participantsNext:
        updatedTournament?.participants_next ||
        updatedTournament?.participantsNext ||
        updatedTournament?.teams_next ||
        null,
      participantsTotal:
        typeof updatedTournament?.participants_count === "number"
          ? updatedTournament.participants_count
          : typeof updatedTournament?.teams_count === "number"
          ? updatedTournament.teams_count
          : Array.isArray(updatedTournament?.teams)
          ? updatedTournament.teams.length
          : Array.isArray(updatedTournament?.participants)
          ? updatedTournament.participants.length
          : undefined,
    });
  } catch (error) {
    console.error("Failed to join team tournament:", error);

    if (error?.name === "AbortError") {
      return;
    }

    const { message, key } = interpretTeamJoinError(error);
    notify(key || "tournamentJoinFailed", message, "error");
    showModalError("teamJoinError", message);
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
  }
}


function setupModalDismiss() {
  registerModal("individualJoinModal", { onClose: resetIndividualJoinModal }).bindDismiss();
  registerModal("teamJoinModal", {
    onClose: () => {
      clearModalError("teamJoinError");
      resetTeamSelection();
    },
  }).bindDismiss();
  registerModal("joinSuccessModal").bindDismiss();
}

function setupTeamSearch() {
  const searchInput = document.getElementById("teamModalSearch");
  if (!searchInput) return;

  const debouncedSearch = debounce((value) => {
    fetchTeamOptions(value);
  }, TEAM_SEARCH_DEBOUNCE_MS);

  searchInput.addEventListener("input", (event) => {
    const value = event.target.value?.trim() || "";
    debouncedSearch(value);
  });
}

function setupInGameIdHandlers() {
  const input = document.getElementById("inGameIdInput");
  const select = document.getElementById("inGameIdSelect");

  if (input) {
    input.addEventListener("input", () => {
      clearModalError("individualJoinError");
    });
  }

  if (select) {
    select.addEventListener("change", () => {
      const value = select.value?.trim() || "";
      if (value) {
        setInGameIdInputValue(value);
        clearModalError("individualJoinError");
      }
    });
  }
}

function initialise() {
  const params = new URLSearchParams(window.location.search);
  state.tournamentId = params.get("id");

  if (!state.tournamentId) {
    notify("tournamentIdMissing", "شناسه تورنومنت در آدرس وجود ندارد.", "error", {
      action: {
        label: "مشاهده لیست تورنومنت‌ها",
        href: "/tournaments.html",
      },
    });
    hidePreloader();
    return;
  }

  const authenticated = isAuthenticated();
  if (authenticated) {
    ensureUserId().catch(() => {});
  }

  if (!authenticated) {
    showLoginRequired();
  } else {
    showLobbyPage();
    loadTournament();
  }

  setupModalDismiss();
  setupTeamSearch();
  setupInGameIdHandlers();
  populateInGameIdOptions();
}

document.addEventListener("DOMContentLoaded", initialise);

window.openIndividualJoinModal = openIndividualJoinModal;
window.openTeamJoinModal = openTeamJoinModal;
window.closeIndividualJoinModal = closeIndividualJoinModal;
window.closeTeamJoinModal = closeTeamJoinModal;
window.closeJoinSuccessModal = closeJoinSuccessModal;
window.joinIndividualTournament = joinIndividualTournament;
window.joinTeamTournament = joinTeamTournament;
window.useSavedInGameId = useSavedInGameId;
