import { API_BASE_URL } from "/js/config.js";

const STORAGE_KEYS = {
  inGameIds: "atom_in_game_ids",
};

const MAX_SAVED_INGAME_IDS = 10;

const state = {
  tournamentId: null,
  tournament: null,
  selectedTeamId: "",
  teamRequestInFlight: false,
  lastUsedInGameId: "",
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
        <img src="${
          player.avatar || player.profile_picture || "img/profile.jpg"
        }" alt="player" loading="lazy">
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
          <img src="${
            member.avatar || member.profile_picture || "img/profile.jpg"
          }" alt="member" loading="lazy">
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
}

function showModalError(elementId, message) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const text = message?.toString().trim() || "";
  element.textContent = text;
  element.classList.toggle("is-hidden", !text);
}

function clearModalError(elementId) {
  showModalError(elementId, "");
}

function openJoinSuccessModal(message) {
  const modal = document.getElementById("joinSuccessModal");
  const description = document.getElementById("joinSuccessModalMessage");

  if (description) {
    description.textContent =
      message || "جزئیات تورنومنت به ایمیل شما ارسال شد. لطفاً ایمیل خود را بررسی کنید.";
  }

  if (modal) {
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  }
}

function closeJoinSuccessModal() {
  const modal = document.getElementById("joinSuccessModal");
  if (modal) {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }
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
  const select = document.getElementById("inGameIdSelect");
  const wrapper = document.getElementById("inGameIdSavedWrapper");
  if (!select || !wrapper) return;

  const saved = getStoredInGameIds();
  select.innerHTML = '<option value="">یکی از نام‌های قبلی را انتخاب کنید</option>';

  if (!saved.length) {
    wrapper.classList.add("is-hidden");
    return;
  }

  wrapper.classList.remove("is-hidden");

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
    const url = `${API_BASE_URL}/api/tournaments/tournaments/${state.tournamentId}/`;
    const tournament = await apiFetch(url);

    state.tournament = tournament;
    renderTournamentSummary(tournament);
    renderAdminInfo(tournament);
    renderParticipants(tournament);
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

// 

async function fetchTeamOptions(searchTerm = "") {
  if (state.teamRequestInFlight) return;
  state.teamRequestInFlight = true;

  const loading = document.getElementById("teamModalLoading");
  if (loading) loading.classList.remove("is-hidden");
  clearModalError("teamJoinError");

  try {
    // ✅ استخراج شناسه کاربر از توکن JWT
    const token = getAuthToken();
    let userId = null;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        userId = payload.user_id || payload.id || payload.sub || null;
      } catch (e) {
        console.warn("توکن معتبر نیست یا ساختار JWT ندارد");
      }
    }

    if (!userId) {
      const message = "شناسه کاربر یافت نشد. لطفاً دوباره وارد شوید.";
      notify("loginRequired", message);
      showModalError("teamJoinError", message);
      return;
    }

    // ✅ ساخت URL با فیلتر رسمی API
    const url = new URL(`${API_BASE_URL}/api/users/teams/`);
    url.searchParams.set("for_registration", state.tournamentId);
    url.searchParams.set("captain", userId); // 👈 فیلتر فقط برای تیم‌های کاپیتان‌شده توسط کاربر
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
        "تیم‌هایی که کاپیتان آن‌ها هستید برای ثبت‌نام در اینجا نمایش داده می‌شوند.";
      metaEl.textContent = description;
    }
    if (hintEl) {
      hintEl.textContent = result?.meta?.hint || "";
    }

    // ✅ واکشی تیم‌ها از پاسخ
    const teams = Array.isArray(result?.results)
      ? result.results
      : Array.isArray(result)
      ? result
      : [];

    renderTeamOptions(teams, result?.meta || {});
  } catch (error) {
    console.error("Failed to load teams", error);
    const message =
      error.message || "امکان دریافت تیم‌ها وجود ندارد. لطفاً بعداً دوباره تلاش کنید.";
    notify("tournamentFetchFailed", message, "error");
    showModalError("teamJoinError", message);
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
  if (!modal) return;

  resetIndividualJoinModal();
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}

async function openTeamJoinModal() {
  if (!isAuthenticated()) {
    showLoginRequired();
    return;
  }

  const modal = document.getElementById("teamJoinModal");
  if (!modal) return;

  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
  clearModalError("teamJoinError");
  await fetchTeamOptions();
}

function closeIndividualJoinModal() {
  const modal = document.getElementById("individualJoinModal");
  if (!modal) return;
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  resetIndividualJoinModal();
}

function closeTeamJoinModal() {
  const modal = document.getElementById("teamJoinModal");
  if (!modal) return;
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
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

    await apiFetch(
      `${API_BASE_URL}/api/tournaments/tournaments/${state.tournamentId}/join/`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    notify("tournamentJoinSuccess", null, "success");
    rememberInGameId(inGameId);
    closeIndividualJoinModal();
    showJoinSuccessFeedback({ isTeam: false });
    await loadTournament();
  } catch (error) {
    console.error("Failed to join tournament", error);
    const message =
      error.message || "امکان ثبت‌نام وجود ندارد. لطفاً بعداً دوباره تلاش کنید.";
    notify("tournamentJoinFailed", message, "error");
    showModalError("individualJoinError", message);
  }

  if (submitBtn) submitBtn.disabled = false;
}

async function joinTeamTournament() {
  if (!state.tournamentId) return;
  if (!state.selectedTeamId) {
    const message = "لطفاً یک تیم انتخاب کنید.";
    notify("teamSelectionRequired", message);
    showModalError("teamJoinError", message);
    return;
  }

  clearModalError("teamJoinError");

  const confirmBtn = document.getElementById("teamJoinConfirmButton");
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const payload = { team: Number(state.selectedTeamId) };
    const url = `${API_BASE_URL}/api/tournaments/tournaments/${state.tournamentId}/join/`;

    await apiFetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    notify("teamJoinSuccess", null, "success");
    closeTeamJoinModal();
    showJoinSuccessFeedback({ isTeam: true });
    await loadTournament();
  } catch (error) {
    console.error("Failed to join team tournament:", error);

    const msg = (error.message || "").toLowerCase();
    let errorMessage = "امکان ثبت‌نام تیم وجود ندارد. لطفاً دوباره تلاش کنید.";

    // 🎯 فیلتر انواع خطاهای محتمل از سمت سرور
    if (
      msg.includes("member") ||
      msg.includes("limit") ||
      msg.includes("full") ||
      msg.includes("capacity") ||
      msg.includes("maximum") ||
      msg.includes("بیش از حد") ||
      msg.includes("max")
    ) {
      errorMessage = "تعداد اعضای تیم بیشتر از حد مجاز برای این تورنومنت است.";
      notify("teamTooLarge", errorMessage, "error");
    } else if (msg.includes("already") || msg.includes("exists")) {
      errorMessage = "این تیم قبلاً در تورنومنت ثبت‌نام کرده است.";
      notify("teamAlreadyRegistered", errorMessage);
    } else if (msg.includes("permission") || msg.includes("not allowed")) {
      errorMessage = "شما مجاز به ثبت‌نام این تیم در تورنومنت نیستید.";
      notify("teamJoinUnauthorized", errorMessage, "error");
    } else {
      notify("tournamentJoinFailed", errorMessage, "error");
    }

    showModalError("teamJoinError", errorMessage);
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

  const successModal = document.getElementById("joinSuccessModal");
  if (successModal) {
    successModal.addEventListener("click", (event) => {
      if (event.target === successModal) {
        closeJoinSuccessModal();
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
    notify("tournamentIdMissing", "شناسه تورنومنت در آدرس وجود ندارد.");
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
