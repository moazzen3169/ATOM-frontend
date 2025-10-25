/**
 * Team management and validation
 */

import { buildApiUrl, API_ENDPOINTS } from "/js/services/api-client.js";
import { normaliseId, debounce, cloneValue, sanitizePayload, ensureField, mergePayloadTemplatesList, deepEqual } from "./utils.js";
import { getDomElement, updateText, toggleHidden } from "./dom.js";
import { apiFetch, notify, ensureUserId, state as apiState } from "./api.js";
import { showModalError, clearModalError } from "./modals.js";
import { getTournamentIdentifier, getTournamentGameId, tournamentState } from "./tournament.js";

const TEAM_SEARCH_DEBOUNCE_MS = 400;

let state = {
  selectedTeamId: null,
  teamRequestInFlight: false,
  teamsById: new Map(),
  teamDetailPromises: new Map(),
  teamAbortController: null,
};

export function getTeamMembersList(team) {
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

export function getTeamMemberCount(team) {
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

export function resolveTeamId(team) {
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

export function normaliseTeamRecord(team) {
  const identifier = resolveTeamId(team);
  if (!identifier) {
    return null;
  }

  const memberList = getTeamMembersList(team);
  const memberCount = getTeamMemberCount({ ...team, members: memberList });

  const captainId = normaliseId(team?.captain);
  const isCaptain = (() => {
    const currentUserId = normaliseId(apiState.userId);
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
    alreadyRegistered: false, // Will be set by tournament logic
    _hydrated:
      (Array.isArray(memberList) && memberList.length > 0) ||
      typeof memberCount === "number",
  };
}

export function updateTeamCache(teams) {
  state.teamsById.clear();
  teams.forEach((team) => {
    const normalised = normaliseTeamRecord(team);
    if (normalised) {
      state.teamsById.set(normalised.identifier, normalised);
    }
  });
}

export function mergeTeamRecord(teamId, updates) {
  const key = String(teamId);
  const existing = state.teamsById.get(key) || { identifier: key };
  const merged = normaliseTeamRecord({ ...existing, ...updates });
  if (merged) {
    state.teamsById.set(key, merged);
  }
  return merged;
}

export function getCachedTeam(teamId) {
  if (!teamId) {
    return null;
  }
  return state.teamsById.get(String(teamId)) || null;
}

export function hasTeamMemberData(team) {
  return Array.isArray(team?.memberList) && team.memberList.length > 0;
}

export function getRequiredTeamSize() {
  const size = Number(tournamentState.tournament?.team_size);
  if (Number.isFinite(size) && size > 0) {
    return size;
  }
  return null;
}

export function createTeamSizeValidation(team) {
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

export function validateTeamEligibility(team, { includeRegistrationCheck = true } = {}) {
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

export function describeTeamMeta(team) {
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

export function teamRequiresHydration(team) {
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

export function notifyTeamValidationError(result) {
  if (!result || result.valid) {
    return;
  }

  const key =
    (result.code && TEAM_VALIDATION_NOTIFICATION_KEYS[result.code]) ||
    "teamJoinValidationFailed";
  notify(key, result.message, "error");
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

export async function hydrateTeamIfNeeded(teamId) {
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
      return merged;
    })
    .catch((error) => {
      console.error("Failed to hydrate team details", error);
      const message =
        error?.message || "امکان دریافت اطلاعات کامل تیم وجود ندارد.";
      notify("teamDetailsFetchFailed", message, "error");
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

export function hasTeamSelectionValue(value) {
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
}

export function resetTeamSelection() {
  state.selectedTeamId = null;
  const confirmBtn = getDomElement("teamJoinConfirmButton");
  if (confirmBtn) confirmBtn.disabled = true;

  const list = getDomElement("teamModalList");
  if (list) {
    list.querySelectorAll(".team-option").forEach((btn) => {
      btn.classList.remove("selected");
      btn.setAttribute("aria-pressed", "false");
    });
  }

  clearModalError("teamJoinError");
}

export function applyTeamValidationResult(result) {
  const confirmBtn = getDomElement("teamJoinConfirmButton");
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

export function markSelectedTeamButton(teamId) {
  const list = getDomElement("teamModalList");
  if (!list) {
    return;
  }

  list.querySelectorAll(".team-option").forEach((btn) => {
    const isSelected = String(btn.dataset.teamId) === String(teamId);
    btn.classList.toggle("selected", isSelected);
    btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });
}

export function selectTeam(teamId) {
  const normalisedValue = hasTeamSelectionValue(teamId)
    ? String(teamId).trim()
    : null;

  state.selectedTeamId = normalisedValue;
  markSelectedTeamButton(normalisedValue);

  const selectEl = getDomElement("teamSelect");
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

export function getPreferredTeamJoinField() {
  const modal = getDomElement("teamJoinModal");
  const modalField = modal?.dataset?.teamJoinField;
  if (typeof modalField === "string" && modalField.trim().length) {
    return modalField.trim();
  }

  const bodyField = document.body?.dataset?.teamJoinField;
  if (typeof bodyField === "string" && bodyField.trim().length) {
    return bodyField.trim();
  }

  const tournamentFieldCandidates = [
    tournamentState.tournament?.team_join_field,
    tournamentState.tournament?.teamJoinField,
    tournamentState.tournament?.registration?.team_field,
    tournamentState.tournament?.registration?.teamField,
    tournamentState.tournament?.registration_settings?.team_field,
    tournamentState.tournament?.registration_settings?.teamField,
  ];

  for (const candidate of tournamentFieldCandidates) {
    if (typeof candidate === "string" && candidate.trim().length) {
      return candidate.trim();
    }
  }

  return null;
}

export function resolveTeamJoinPayloadIdentifier(teamId) {
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

export function createTeamJoinPayloadCandidates(team, identifier) {
  const candidates = [];
  const seen = new Set();
  const tournamentId = getTournamentIdentifier();
  const gameId = getTournamentGameId();

  const addCandidate = (payload, teamValue = identifier) => {
    if (!payload || typeof payload !== "object") {
      return;
    }

    const candidate = cloneValue(payload);
    ensureField(candidate, teamValue, "team", "team_id", "teamId", "team_slug", "teamSlug");
    ensureField(candidate, tournamentId, "tournament", "tournament_id", "tournamentId");
    ensureField(candidate, gameId, "game", "game_id", "gameId");

    const sanitized = sanitizePayload(candidate);
    if (!sanitized || typeof sanitized !== "object" || !Object.keys(sanitized).length) {
      return;
    }

    const serialized = stableStringify(sanitized);
    if (seen.has(serialized)) {
      return;
    }

    seen.add(serialized);
    candidates.push(sanitized);
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
    addCandidate({ team: value }, value);

    const numericId =
      typeof value === "number"
        ? value
        : /^\d+$/.test(String(value))
        ? Number.parseInt(String(value), 10)
        : null;

    if (numericId !== null && !Number.isNaN(numericId)) {
      addCandidate({ team_id: numericId }, numericId);
      addCandidate({ teamId: numericId }, numericId);
    } else if (typeof value === "string" && value.trim().length) {
      addCandidate({ team_slug: value }, value);
      addCandidate({ teamSlug: value }, value);
    }
  });

  const templateSources = [
    tournamentState.tournament?.registration_payload_template,
    tournamentState.tournament?.registration_payload,
    tournamentState.tournament?.join_payload_template,
    tournamentState.tournament?.join_payload,
  ];

  templateSources.forEach((template) => {
    if (!template || typeof template !== "object") {
      return;
    }
    const cloned = mergePayloadTemplatesList([template]);
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

  // Remove duplicates using deepEqual
  const uniqueCandidates = [];
  const seenObjects = new Set();
  for (const candidate of candidates) {
    const serialized = stableStringify(candidate);
    if (!seenObjects.has(serialized)) {
      seenObjects.add(serialized);
      uniqueCandidates.push(candidate);
    }
  }

  return uniqueCandidates;
}

export function shouldRetryTeamJoinRequest(error) {
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

export async function submitTeamJoinRequest(joinUrl, team, identifier) {
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

export function renderTeamOptions(teams, meta = {}) {
  const list = getDomElement("teamModalList");
  const selectEl = getDomElement("teamSelect");
  const emptyState = getDomElement("teamModalEmptyState");
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

export function updateTeamOptionElements() {
  const list = getDomElement("teamModalList");
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

export async function fetchTeamOptions(searchTerm = "") {
  const trimmedSearch = searchTerm?.toString().trim() || "";

  if (state.teamRequestInFlight && state.teamAbortController) {
    state.teamAbortController.abort();
  }

  const controller = new AbortController();
  state.teamAbortController = controller;
  state.teamRequestInFlight = true;

  const loading = getDomElement("teamModalLoading");
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

    const metaEl = getDomElement("teamModalMeta");
    const hintEl = getDomElement("teamModalHint");
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

export { state as teamState };
