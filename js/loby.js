import { API_BASE_URL } from "/js/config.js";

const state = {
  tournamentId: null,
  selectedTeamId: "",
  teamRequestInFlight: false,
};

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

  const response = await fetch(url, config);

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
    throw new Error(message);
  }

  return payload;
}

function hidePreloader() {
  const loader = document.getElementById("preloader");
  if (loader) loader.style.display = "none";
}

function showLoginRequired() {
  const loginBox = document.getElementById("login_required");
  const lobbyPage = document.getElementById("lobby_page");
  if (loginBox) loginBox.style.display = "flex";
  if (lobbyPage) lobbyPage.style.display = "none";
  hidePreloader();
}

function showLobbyPage() {
  const loginBox = document.getElementById("login_required");
  const lobbyPage = document.getElementById("lobby_page");
  if (loginBox) loginBox.style.display = "none";
  if (lobbyPage) lobbyPage.style.display = "grid";
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
  const usernameEl = document.getElementById("adminUsername");
  const fullnameEl = document.getElementById("adminFullName");
  const avatarEl = document.getElementById("adminProfilePicture");

  const creator = tournament?.creator || {};
  const firstName = creator.first_name || "";
  const lastName = creator.last_name || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  if (usernameEl) {
    usernameEl.textContent = `نام کاربری: ${creator.username || "---"}`;
  }

  if (fullnameEl) {
    fullnameEl.textContent = `نام: ${fullName || "---"}`;
  }

  if (avatarEl) {
    avatarEl.src = creator.profile_picture || "img/profile.jpg";
    avatarEl.alt = creator.username || "ادمین";
  }
}

function renderTournamentSummary(tournament) {
  const signupTime = document.getElementById("signup_time");
  const startTime = document.getElementById("start_time");
  const endTime = document.getElementById("end_time");
  const tournamentMode = document.getElementById("tournament_mode");
  const banner = document.getElementById("tournament_banner");
  const prizePool = document.getElementById("prize_pool");
  const title = document.getElementById("tournament_title");
  const pageTitle = document.getElementById("tournaments-title");
  const statusEl = document.getElementById("tournament_status");

  if (signupTime) signupTime.textContent = formatDateTime(tournament.start_date);
  if (startTime) startTime.textContent = formatDateTime(tournament.start_date);
  if (endTime) endTime.textContent = formatDateTime(tournament.end_date);
  if (tournamentMode) {
    tournamentMode.textContent =
      tournament.type === "team"
        ? `تیمی (حداکثر ${tournament.team_size || 0} نفر)`
        : "انفرادی";
  }
  if (banner) {
    banner.src = tournament.image?.image || "/img/tournaments-defalt-banner.jpg";
    banner.alt = tournament.image?.alt || tournament.name || "بنر";
  }
  if (prizePool) {
    const prize = Number(tournament.prize_pool || 0);
    prizePool.textContent = prize
      ? `${prize.toLocaleString("fa-IR")} تومان`
      : "---";
  }
  if (title) title.textContent = tournament.name || "";
  if (pageTitle) pageTitle.textContent = tournament.name || "";

  if (statusEl) {
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

    statusEl.textContent = status;
  }
}

function createPlayerSlot(player) {
  const slot = document.createElement("div");
  slot.className = "team_detail";
  slot.innerHTML = `
    <div class="team_name">${player.username || player.name || "کاربر"}</div>
    <div class="team_players">
      <div class="player">
        <img src="${player.avatar || player.profile_picture || "img/profile.jpg"}" alt="player">
      </div>
    </div>
  `;
  return slot;
}

function renderTeamSlot(team) {
  const slot = document.createElement("div");
  slot.className = "team_detail";
  const members = Array.isArray(team.members)
    ? team.members
    : Array.isArray(team.players)
    ? team.players
    : Array.isArray(team.users)
    ? team.users
    : [];

  const membersMarkup = members
    .map(
      (member) => `
        <div class="player">
          <img src="${member.avatar || member.profile_picture || "img/profile.jpg"}" alt="member">
        </div>
      `,
    )
    .join("");

  slot.innerHTML = `
    <div class="team_name">${team.name || "تیم"}</div>
    <div class="team_players">${membersMarkup}</div>
  `;

  return slot;
}

function createEmptyButton(label, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "team_detail team_empty";
  button.innerHTML = `
    ${label}
    <i><img src="img/icons/plus.svg" alt="plus"></i>
  `;
  button.addEventListener("click", handler);
  return button;
}

function renderParticipants(tournament) {
  const section = document.getElementById("participants_section");
  if (!section) return;

  section.innerHTML = "";

  const container = document.createElement("div");
  container.className = tournament.type === "team" ? "teams_grid" : "players_grid";

  const maxSlots = Number(tournament.max_participants) || 0;

  if (tournament.type === "team") {
    const teams = Array.isArray(tournament.teams) ? tournament.teams : [];

    teams.forEach((team) => {
      container.appendChild(renderTeamSlot(team));
    });

    const remaining = Math.max(maxSlots - teams.length, 0);
    for (let i = 0; i < remaining; i += 1) {
      container.appendChild(
        createEmptyButton("همین الان تیمت رو اضافه کن", openTeamJoinModal),
      );
    }
  } else {
    const players = Array.isArray(tournament.participants) ? tournament.participants : [];

    players.forEach((player) => {
      container.appendChild(createPlayerSlot(player));
    });

    const remaining = Math.max(maxSlots - players.length, 0);
    for (let i = 0; i < remaining; i += 1) {
      container.appendChild(createEmptyButton("همین الان اضافه شو!", openIndividualJoinModal));
    }
  }

  section.appendChild(container);
}

function showMessage(type, message) {
  const stackId = "alert_stack";
  let stack = document.getElementById(stackId);
  if (!stack) {
    stack = document.createElement("div");
    stack.id = stackId;
    stack.className = "alert_stack";
    document.body.appendChild(stack);
  }

  const box = document.createElement("div");
  box.className = `alert alert-${type}`;
  box.innerHTML = `
    <button class="alert_close" aria-label="بستن">&times;</button>
    <div class="alert_msg">${message}</div>
  `;

  box.querySelector(".alert_close").addEventListener("click", () => box.remove());
  stack.appendChild(box);
  setTimeout(() => box.remove(), 6000);
}

function showError(message) {
  showMessage("error", message);
}

function showSuccess(message) {
  showMessage("success", message);
}

async function loadTournament() {
  if (!state.tournamentId) return;

  try {
    const url = `${API_BASE_URL}/api/tournaments/tournaments/${state.tournamentId}/`;
    const tournament = await apiFetch(url);

    renderTournamentSummary(tournament);
    renderAdminInfo(tournament);
    renderParticipants(tournament);
    showLobbyPage();
  } catch (error) {
    console.error("Failed to load tournament", error);
    showError(error.message || "امکان دریافت اطلاعات تورنومنت وجود ندارد.");
  } finally {
    hidePreloader();
  }
}

function resetTeamSelection() {
  state.selectedTeamId = "";
  const confirmBtn = document.getElementById("teamJoinConfirmButton");
  if (confirmBtn) confirmBtn.disabled = true;

  const list = document.getElementById("teamModalList");
  if (list) {
    list.querySelectorAll(".team-option").forEach((btn) => {
      btn.classList.remove("selected");
      btn.setAttribute("aria-pressed", "false");
    });
  }
}

function selectTeam(teamId) {
  state.selectedTeamId = teamId;

  const confirmBtn = document.getElementById("teamJoinConfirmButton");
  if (confirmBtn) confirmBtn.disabled = !teamId;

  const list = document.getElementById("teamModalList");
  if (!list) return;

  list.querySelectorAll(".team-option").forEach((btn) => {
    const isSelected = String(btn.dataset.teamId) === String(teamId);
    btn.classList.toggle("selected", isSelected);
    btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });

  const selectEl = document.getElementById("teamSelect");
  if (selectEl) selectEl.value = teamId || "";
}

function renderTeamOptions(teams, meta = {}) {
  const list = document.getElementById("teamModalList");
  const selectEl = document.getElementById("teamSelect");
  const emptyState = document.getElementById("teamModalEmptyState");
  const emptyTitle = emptyState?.querySelector("p");
  const emptySubtitle = emptyState?.querySelector("span");

  if (list) list.innerHTML = "";
  if (selectEl) selectEl.innerHTML = '<option value="">انتخاب تیم</option>';

  if (!teams.length) {
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

  teams.forEach((team) => {
    const metaText =
      team.meta ??
      team.members_count ??
      team.member_count ??
      (Array.isArray(team.members) ? `${team.members.length} عضو` : "");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "team-option";
    button.dataset.teamId = team.id;
    button.innerHTML = `
      <div class="team-option__info">
        <span class="team-option__name">${team.name}</span>
        <span class="team-option__meta">${metaText || ""}</span>
      </div>
    `;
    button.addEventListener("click", () => selectTeam(team.id));
    list?.appendChild(button);

    if (selectEl) {
      const option = document.createElement("option");
      option.value = team.id;
      option.textContent = team.name;
      selectEl.appendChild(option);
    }
  });

  resetTeamSelection();
}

async function fetchTeamOptions(searchTerm = "") {
  if (state.teamRequestInFlight) return;
  state.teamRequestInFlight = true;

  const loading = document.getElementById("teamModalLoading");
  if (loading) loading.classList.remove("is-hidden");

  try {
    const url = new URL(`${API_BASE_URL}/api/users/teams/`);
    url.searchParams.set("for_registration", state.tournamentId);
    if (searchTerm) {
      url.searchParams.set("search", searchTerm);
    }

    const result = await apiFetch(url.toString());

    const metaEl = document.getElementById("teamModalMeta");
    const hintEl = document.getElementById("teamModalHint");
    if (metaEl) {
      const description =
        result?.meta?.description ||
        result?.meta?.message ||
        "یکی از تیم‌هایی که کاپیتان آن هستید را برای ثبت‌نام انتخاب کنید.";
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
    console.error("Failed to load teams", error);
    showError(error.message || "امکان دریافت تیم‌ها وجود ندارد.");
  } finally {
    state.teamRequestInFlight = false;
    if (loading) loading.classList.add("is-hidden");
  }
}

async function openIndividualJoinModal() {
  if (!isAuthenticated()) {
    showLoginRequired();
    return;
  }

  const modal = document.getElementById("individualJoinModal");
  if (modal) modal.style.display = "flex";
}

async function openTeamJoinModal() {
  if (!isAuthenticated()) {
    showLoginRequired();
    return;
  }

  const modal = document.getElementById("teamJoinModal");
  if (!modal) return;

  modal.style.display = "flex";
  await fetchTeamOptions();
}

function closeIndividualJoinModal() {
  const modal = document.getElementById("individualJoinModal");
  if (modal) modal.style.display = "none";
}

function closeTeamJoinModal() {
  const modal = document.getElementById("teamJoinModal");
  if (modal) modal.style.display = "none";
}

async function joinIndividualTournament() {
  if (!state.tournamentId) return;

  try {
    await apiFetch(
      `${API_BASE_URL}/api/tournaments/tournaments/${state.tournamentId}/join/`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );

    showSuccess("ثبت‌نام با موفقیت انجام شد.");
    closeIndividualJoinModal();
    await loadTournament();
  } catch (error) {
    console.error("Failed to join tournament", error);
    showError(error.message || "امکان ثبت‌نام وجود ندارد.");
  }
}

async function joinTeamTournament() {
  if (!state.tournamentId) return;
  if (!state.selectedTeamId) {
    showError("لطفاً یک تیم انتخاب کنید.");
    return;
  }

  const confirmBtn = document.getElementById("teamJoinConfirmButton");
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    await apiFetch(
      `${API_BASE_URL}/api/tournaments/tournaments/${state.tournamentId}/join/`,
      {
        method: "POST",
        body: JSON.stringify({ team_id: state.selectedTeamId }),
      },
    );

    showSuccess("تیم با موفقیت ثبت‌نام شد.");
    closeTeamJoinModal();
    await loadTournament();
  } catch (error) {
    console.error("Failed to join team tournament", error);
    showError(error.message || "امکان ثبت‌نام تیم وجود ندارد.");
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

function setupModalDismiss() {
  const individualModal = document.getElementById("individualJoinModal");
  if (individualModal) {
    individualModal.addEventListener("click", (event) => {
      if (event.target === individualModal) {
        closeIndividualJoinModal();
      }
    });
  }

  const teamModal = document.getElementById("teamJoinModal");
  if (teamModal) {
    teamModal.addEventListener("click", (event) => {
      if (event.target === teamModal) {
        closeTeamJoinModal();
      }
    });
  }
}

function setupTeamSearch() {
  const searchInput = document.getElementById("teamModalSearch");
  if (!searchInput) return;

  searchInput.addEventListener("input", (event) => {
    const value = event.target.value?.trim() || "";
    fetchTeamOptions(value);
  });
}

function initialise() {
  const params = new URLSearchParams(window.location.search);
  state.tournamentId = params.get("id");

  if (!state.tournamentId) {
    showError("شناسه تورنومنت در آدرس وجود ندارد.");
    hidePreloader();
    return;
  }

  if (!isAuthenticated()) {
    showLoginRequired();
  } else {
    showLobbyPage();
    loadTournament();
  }

  setupModalDismiss();
  setupTeamSearch();
}

document.addEventListener("DOMContentLoaded", initialise);

window.openIndividualJoinModal = openIndividualJoinModal;
window.openTeamJoinModal = openTeamJoinModal;
window.closeIndividualJoinModal = closeIndividualJoinModal;
window.closeTeamJoinModal = closeTeamJoinModal;
window.joinIndividualTournament = joinIndividualTournament;
window.joinTeamTournament = joinTeamTournament;
