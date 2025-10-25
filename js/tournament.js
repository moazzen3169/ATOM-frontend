/**
 * Tournament management and rendering
 */

import { buildApiUrl, API_ENDPOINTS } from "/js/services/api-client.js";
import { normaliseId, formatDateTime, ensureField, sanitizePayload, cloneValue, mergePayloadTemplatesList } from "./utils.js";
import { getDomElement, updateText, updateImage, toggleDisplay } from "./dom.js";
import { apiFetch, notify } from "./api.js";
import { showLoginRequired, showLobbyPage, hidePreloader } from "./dom.js";

let state = {
  tournamentId: null,
  tournament: null,
};

export function getTournamentIdentifier() {
  const directCandidates = [state.tournamentId, state.tournament?.id, state.tournament?.pk];

  for (const candidate of directCandidates) {
    const normalised = normaliseId(candidate);
    if (!normalised) {
      continue;
    }

    if (/^\d+$/.test(normalised)) {
      const numeric = Number.parseInt(normalised, 10);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }

    return normalised;
  }

  return null;
}

export function getTournamentGameId(tournament = state.tournament) {
  if (!tournament) {
    return null;
  }

  const candidates = [
    tournament.game_id,
    tournament.gameId,
    tournament.game,
    tournament?.game?.id,
    tournament?.game?.pk,
  ];

  for (const candidate of candidates) {
    const normalised = normaliseId(candidate);
    if (!normalised) {
      continue;
    }

    if (/^\d+$/.test(normalised)) {
      const numeric = Number.parseInt(normalised, 10);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }

    return normalised;
  }

  return null;
}

export function createIndividualJoinPayload(inGameId) {
  const baseTemplates = mergePayloadTemplatesList([
    state.tournament?.join_payload_template,
    state.tournament?.join_payload,
    state.tournament?.registration_payload_template,
    state.tournament?.registration_payload,
  ]);

  const payload = cloneValue(baseTemplates);
  const gameId = getTournamentGameId();
  const tournamentId = getTournamentIdentifier();

  ensureField(payload, inGameId, "in_game_id", "inGameId", "player_id", "playerId");
  ensureField(payload, tournamentId, "tournament", "tournament_id", "tournamentId");
  ensureField(payload, gameId, "game", "game_id", "gameId");

  let entries = Array.isArray(payload.in_game_ids)
    ? payload.in_game_ids.map((entry) => (entry && typeof entry === "object" ? cloneValue(entry) : {}))
    : [];

  if (!entries.length) {
    entries.push({});
  }

  entries = entries
    .map((entry, index) => {
      const item = entry && typeof entry === "object" ? entry : {};
      if (index === 0) {
        ensureField(item, inGameId, "player_id", "playerId", "in_game_id", "inGameId");
      }
      ensureField(item, gameId, "game", "game_id", "gameId");
      ensureField(item, tournamentId, "tournament", "tournament_id", "tournamentId");
      return sanitizePayload(item);
    })
    .filter((entry) => entry && Object.keys(entry).length);

  if (!entries.length) {
    const fallback = {};
    ensureField(fallback, inGameId, "player_id", "playerId", "in_game_id", "inGameId");
    ensureField(fallback, gameId, "game", "game_id", "gameId");
    ensureField(fallback, tournamentId, "tournament", "tournament_id", "tournamentId");
    entries = [sanitizePayload(fallback)];
  }

  payload.in_game_ids = entries;

  return sanitizePayload(payload);
}

export function renderAdminInfo(tournament) {
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

export function renderTournamentSummary(tournament) {
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

export async function loadTournament() {
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

    state.tournament = tournament;
    renderTournamentSummary(tournament);
    renderAdminInfo(tournament);

    // TODO: Integrate with participants module
    // applyTournamentPayload(tournament, { fetchParticipants: true });

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

export function initializeTournament(tournamentId) {
  state.tournamentId = tournamentId;
  state.tournament = null;
}

export { state as tournamentState };
