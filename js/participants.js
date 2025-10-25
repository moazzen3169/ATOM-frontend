/**
 * Participants management and rendering
 */

import { buildApiUrl, API_ENDPOINTS } from "/js/services/api-client.js";
import { normaliseId, resolveAvatar, resolveGameId } from "./utils.js";
import { getDomElement, updateText, toggleDisplay, toggleHidden } from "./dom.js";
import { apiFetch, notify } from "./api.js";
import { tournamentState } from "./tournament.js";

const PARTICIPANT_PAGE_SIZE = 24;
const PARTICIPANT_RENDER_BATCH = 16;

let state = {
  participants: [],
  participantIds: new Set(),
  participantNextUrl: null,
  participantLoading: false,
  participantRenderedCount: 0,
  participantTotalCount: null,
  participantsInitialised: false,
  participantError: null,
};

export function normaliseParticipantKey(participant) {
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

export function mergeParticipants(participants, { replace = false } = {}) {
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
    }
  });
}

export function createPlayerSlot(player) {
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

export function renderTeamSlot(team) {
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

export function createEmptyButton(label, handler) {
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

export function getKnownParticipantCount(tournament) {
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

export function parseSpotsLeftValue(tournament) {
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

export function describeSpotsLeft(tournament) {
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

export function getParticipantsSection() {
  const section = getDomElement("participants_section");
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

export function resetParticipantsSection(tournament) {
  const section = getDomElement("participants_section");
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

export function updateParticipantsMeta(tournament) {
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

export function updateJoinCta(tournament) {
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

export function updateParticipantsLoadMoreButton() {
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

export function handleParticipantsLoadMore() {
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

export function renderParticipantBatch() {
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
    const node = tournamentState.tournament?.type === "team"
      ? renderTeamSlot(item)
      : createPlayerSlot(item);
    fragment.appendChild(node);
  }

  refs.list.appendChild(fragment);
  state.participantRenderedCount = nextTarget;
  updateJoinCta(tournamentState.tournament);
  updateParticipantsLoadMoreButton();
}

export function normaliseParticipantPage(payload) {
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

export function buildParticipantsRequestUrl(rawUrl) {
  if (rawUrl) {
    try {
      return new URL(rawUrl, window.location.origin);
    } catch (error) {
      console.warn("Failed to parse participant next URL", error);
    }
  }

  if (!tournamentState.tournamentId) {
    return null;
  }

  const basePath = API_ENDPOINTS.tournaments.detail(tournamentState.tournamentId);
  const normalisedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const url = buildApiUrl(`${normalisedBase}participants/`);
  url.searchParams.set("page_size", PARTICIPANT_PAGE_SIZE);
  return url;
}

export async function fetchParticipantsPage(rawUrl) {
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
    if (!state.participants.length && Array.isArray(tournamentState.tournament?.participants)) {
      mergeParticipants(tournamentState.tournament.participants, { replace: true });
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
    updateParticipantsMeta(tournamentState.tournament);
  }
}

export function renderParticipants(tournament, options = {}) {
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

export function applyTournamentPayload(tournament, options = {}) {
  if (!tournament) {
    return;
  }

  tournamentState.tournament = { ...(tournamentState.tournament || {}), ...tournament };

  // TODO: Integrate with teams module for tournament team cache
  // markTournamentTeamsCache(mergedTournament);

  renderTournamentSummary(tournament);
  renderAdminInfo(tournament);

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

  renderParticipants(tournamentState.tournament, participantOptions);

  if (options.fetchParticipants) {
    if (!state.participants.length) {
      fetchParticipantsPage();
    } else {
      updateParticipantsLoadMoreButton();
    }
  }
}

// Import functions that will be defined in main file
let openTeamJoinModal, openIndividualJoinModal;

export function setJoinModalHandlers(teamHandler, individualHandler) {
  openTeamJoinModal = teamHandler;
  openIndividualJoinModal = individualHandler;
}

export { state as participantState };
