import {
  fetchDashboard,
  normalizeDashboardPayload,
  fetchProfile,
  fetchTeams,
  fetchTournamentHistory,
  updateProfile
} from "./services/dashboard-service.js";
import { API_BASE_URL } from "./config.js";

const DEFAULT_AVATAR_SRC = "../img/profile.jpg";
const TOKEN_STORAGE_KEYS = ["access_token", "token", "authToken"];

let authTokenCache = null;
let currentDashboard = null;
let currentUserId = null;

function getStoredToken() {
  for (const key of TOKEN_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value) {
      return value;
    }
  }
  return null;
}

function setupToken() {
  const token = getStoredToken();
  if (token) {
    authTokenCache = token;
  }
  return token;
}

async function refreshToken() {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) {
    throw new Error("Refresh token not found");
  }

  const response = await fetch(`${API_BASE_URL}/auth/jwt/refresh/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refresh: refreshToken })
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.status}`);
  }

  const data = await response.json();
  if (data && data.access) {
    TOKEN_STORAGE_KEYS.forEach((key) => localStorage.setItem(key, data.access));
    authTokenCache = data.access;
  }

  return authTokenCache;
}

async function fetchWithAuth(url, options = {}, retry = true) {
  const token = authTokenCache || setupToken();
  if (!token) {
    throw new Error("برای مشاهده داشبورد ابتدا وارد حساب کاربری شوید.");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 && retry) {
    try {
      await refreshToken();
    } catch (error) {
      localStorage.clear();
      window.location.href = "../register/login.html";
      throw error;
    }
    return fetchWithAuth(url, options, false);
  }

  return response;
}

function escapeHTML(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function updateHeaderUserInfo(profile) {
  const username = profile?.username || "کاربر";
  const avatar = profile?.profile_picture || profile?.avatar || DEFAULT_AVATAR_SRC;
  localStorage.setItem("username", username);
  localStorage.setItem("profile_picture", avatar);

  const headerUserName = document.getElementById("header_user_name");
  if (headerUserName) {
    headerUserName.textContent = username;
  }

  const mobileUserName = document.querySelector(".user_info_name");
  if (mobileUserName) {
    mobileUserName.textContent = username;
  }

  const headerAvatar = document.getElementById("header_user_avatar");
  if (headerAvatar) {
    headerAvatar.src = avatar;
  }

  const mobileAvatar = document.querySelector(".user_profile img");
  if (mobileAvatar) {
    mobileAvatar.src = avatar;
  }
}

function updateProfileCard(profile, stats, counts) {
  const username = profile?.username || "کاربر";
  const email = profile?.email || "-";
  const phone = profile?.phone_number || "-";
  const fullName = profile?.full_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "-";
  const avatar = profile?.profile_picture || profile?.avatar || DEFAULT_AVATAR_SRC;
  const rank = profile?.verification_level ? `سطح ${profile.verification_level}` : "بدون احراز";
  const status = profile?.status || "فعال";
  const joinedDate = profile?.date_joined ? new Date(profile.date_joined).toLocaleDateString("fa-IR") : "-";

  currentUserId = profile?.id || null;

  const avatarEl = document.getElementById("user_avatar");
  if (avatarEl) {
    avatarEl.src = avatar;
  }

  const nameEl = document.getElementById("user_name");
  if (nameEl) {
    nameEl.textContent = username;
  }

  const emailPrimaryEl = document.getElementById("user_email_primary");
  if (emailPrimaryEl) {
    emailPrimaryEl.textContent = email;
  }

  const emailDetailEl = document.getElementById("user_email_detail");
  if (emailDetailEl) {
    emailDetailEl.textContent = email;
  }

  const usernameEl = document.getElementById("user_username");
  if (usernameEl) {
    usernameEl.textContent = username;
  }

  const fullNameEl = document.getElementById("user_full_name");
  if (fullNameEl) {
    fullNameEl.textContent = fullName;
  }

  const phoneEl = document.getElementById("user_phone");
  if (phoneEl) {
    phoneEl.textContent = phone || "-";
  }

  const joinedEl = document.getElementById("user_add_date");
  if (joinedEl) {
    joinedEl.textContent = joinedDate;
  }

  const rankEl = document.getElementById("user_rank");
  if (rankEl) {
    rankEl.textContent = rank;
  }

  const statusEl = document.getElementById("user_status");
  if (statusEl) {
    statusEl.textContent = status;
  }

  const scoreEl = document.getElementById("user_score");
  if (scoreEl) {
    scoreEl.textContent = stats?.score ?? 0;
  }

  const tournamentsPlayedEl = document.getElementById("user_tournaments_played");
  if (tournamentsPlayedEl) {
    tournamentsPlayedEl.textContent = counts?.tournaments ?? stats?.tournamentsPlayed ?? 0;
  }

  const teamsCounter = document.getElementById("teams_counter");
  if (teamsCounter) {
    const teamsCount = counts?.teams ?? 0;
    teamsCounter.textContent = `${teamsCount} تیم`;
  }

  updateHeaderUserInfo(profile);
}

function resolveTeamAvatar(team) {
  if (team?.avatar) return team.avatar;
  if (team?.team_avatar) return team.team_avatar;
  if (team?.logo) return team.logo;
  if (team?.image) return team.image;
  return DEFAULT_AVATAR_SRC;
}

function renderTeams(teams) {
  const container = document.getElementById("teams_container");
  if (!container) return;

  container.innerHTML = "";
  if (!teams?.length) {
    container.innerHTML = '<p class="teams_empty_state">شما هنوز عضوی از تیمی نیستید.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  teams.slice(0, 4).forEach((team) => {
    const card = document.createElement("article");
    card.className = "team_card";
    const title = escapeHTML(team?.name || team?.team_name || "تیم");
    const game = escapeHTML(team?.game?.name || team?.game || "-");
    const members = Array.isArray(team?.members) ? team.members.length : team?.member_count;
    const memberCount = members ?? (team?.players ? team.players.length : 0);
    const captain = escapeHTML(team?.captain?.username || team?.captain || "-");
    const status = escapeHTML(team?.status || team?.state || "فعال");
    const avatar = resolveTeamAvatar(team);
    card.innerHTML = `
      <div class="team_card__header">
        <div class="team_avatar">
          <img src="${escapeHTML(avatar)}" alt="${title}">
        </div>
        <div class="team_card__title">
          <h3>${title}</h3>
          <p>${game}</p>
        </div>
        <span class="team_badge">${memberCount ?? 0} عضو</span>
      </div>
      <div class="team_card__body">
        <div class="team_card__summary">
          <div class="team_stat">
            <span class="team_stat__label">کاپیتان</span>
            <span class="team_stat__value">${captain}</span>
          </div>
          <div class="team_stat">
            <span class="team_stat__label">وضعیت</span>
            <span class="team_stat__value">${status}</span>
          </div>
        </div>
      </div>
    `;
    fragment.appendChild(card);
  });

  container.appendChild(fragment);

  const hint = document.getElementById("teams_overflow_hint");
  if (hint) {
    if (teams.length > 4) {
      hint.textContent = `و ${teams.length - 4} تیم دیگر...`;
    } else {
      hint.textContent = "";
    }
  }
}

function renderTournamentHistory(matches) {
  const tbody = document.getElementById("tournaments_history_body");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (!matches?.length) {
    const row = tbody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 6;
    cell.textContent = "هیچ تاریخچه‌ای یافت نشد.";
    return;
  }

  matches.slice(0, 10).forEach((match) => {
    const row = tbody.insertRow();
    row.insertCell().textContent = match?.score ?? match?.points ?? "-";
    row.insertCell().textContent = match?.rank ?? match?.position ?? "-";
    const dateValue = match?.created_at || match?.date || match?.played_at;
    row.insertCell().textContent = dateValue ? new Date(dateValue).toLocaleDateString("fa-IR") : "-";
    row.insertCell().textContent = match?.team_name || match?.team?.name || "-";
    row.insertCell().textContent = match?.game_name || match?.game?.name || "-";
    row.insertCell().textContent = match?.tournament_name || match?.tournament?.name || "-";
  });
}

function fillEditUserForm(profile) {
  const usernameInput = document.getElementById("edit_user_username");
  if (usernameInput) usernameInput.value = profile?.username || "";

  const firstNameInput = document.getElementById("edit_user_first_name");
  if (firstNameInput) firstNameInput.value = profile?.first_name || "";

  const lastNameInput = document.getElementById("edit_user_last_name");
  if (lastNameInput) lastNameInput.value = profile?.last_name || "";

  const emailInput = document.getElementById("edit_user_email");
  if (emailInput) emailInput.value = profile?.email || "";

  const phoneInput = document.getElementById("edit_user_phone");
  if (phoneInput) phoneInput.value = profile?.phone_number || "";

  const avatarPreview = document.getElementById("edit_user_avatar_preview");
  if (avatarPreview) {
    avatarPreview.src = profile?.profile_picture || profile?.avatar || DEFAULT_AVATAR_SRC;
  }
}

function setFormMessage(message, type = "info") {
  const messageEl = document.getElementById("edit_user_message");
  if (!messageEl) return;
  messageEl.textContent = message || "";
  messageEl.dataset.state = type;
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("is-open");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("is-open");
  }
}

function setupModalEvents() {
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal");
      if (modal) {
        closeModal(modal.id);
      }
    });
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal(modal.id);
      }
    });
  });
}

function setPageTitle() {
  const path = window.location.pathname;
  const map = [
    { keyword: "tickets", title: "تیکت‌ها" },
    { keyword: "wallet", title: "کیف پول" },
    { keyword: "teams", title: "تیم‌ها" },
    { keyword: "tournaments", title: "تورنومنت‌ها" },
    { keyword: "verification", title: "احراز هویت" },
    { keyword: "chat", title: "پیام‌ها" }
  ];
  let title = "داشبورد";
  for (const item of map) {
    if (path.includes(item.keyword)) {
      title = item.title;
      break;
    }
  }
  const pageTitle = document.getElementById("page_title_text");
  if (pageTitle) {
    pageTitle.textContent = title;
  }
}

async function loadDashboardData() {
  const loadingClass = "is-loading";
  document.body.classList.add(loadingClass);
  try {
    let dashboard;
    try {
      const payload = await fetchDashboard(fetchWithAuth);
      dashboard = payload;
    } catch (error) {
      console.warn("Dashboard endpoint unavailable, using fallback", error);
      const profile = await fetchProfile(fetchWithAuth).catch(() => ({}));
      const teams = await fetchTeams(fetchWithAuth).catch(() => []);
      const tournaments = await fetchTournamentHistory(fetchWithAuth, profile?.id).catch(() => []);
      dashboard = normalizeDashboardPayload({
        profile,
        stats: {},
        teams,
        tournaments
      });
    }

    currentDashboard = dashboard;
    updateProfileCard(dashboard.profile, dashboard.stats, {
      teams: dashboard.teamsCount,
      tournaments: dashboard.tournamentsCount
    });
    renderTeams(dashboard.teams);
    renderTournamentHistory(dashboard.tournaments);
    fillEditUserForm(dashboard.profile);
  } catch (error) {
    console.error("Failed to load dashboard", error);
    setFormMessage("خطا در بارگذاری داشبورد. لطفاً دوباره تلاش کنید.", "error");
  } finally {
    document.body.classList.remove(loadingClass);
  }
}

function handleEditButtonClick() {
  if (!currentDashboard) {
    return;
  }
  fillEditUserForm(currentDashboard.profile);
  setFormMessage("");
  openModal("edit_user_modal");
}

function handleAvatarPreviewClick() {
  const fileInput = document.getElementById("edit_user_avatar");
  if (fileInput) {
    fileInput.click();
  }
}

function handleAvatarChange(event) {
  const file = event.target?.files?.[0];
  const preview = document.getElementById("edit_user_avatar_preview");
  if (!preview) return;
  if (!file) {
    preview.src = currentDashboard?.profile?.profile_picture || DEFAULT_AVATAR_SRC;
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    preview.src = reader.result;
  };
  reader.readAsDataURL(file);
}

async function handleEditUserSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("button[type='submit']");
  if (submitButton) {
    submitButton.disabled = true;
  }
  setFormMessage("در حال بروزرسانی پروفایل...", "info");

  try {
    const formData = new FormData(form);
    const hasFile = formData.get("profile_picture") instanceof File && formData.get("profile_picture").name;
    let body;
    if (hasFile) {
      body = formData;
    } else {
      body = JSON.stringify({
        username: formData.get("username"),
        first_name: formData.get("first_name"),
        last_name: formData.get("last_name"),
        email: formData.get("email"),
        phone_number: formData.get("phone_number")
      });
    }

    await updateProfile(fetchWithAuth, body, hasFile);
    setFormMessage("پروفایل با موفقیت بروزرسانی شد.", "success");
    await loadDashboardData();
    setTimeout(() => closeModal("edit_user_modal"), 600);
  } catch (error) {
    console.error("Profile update failed", error);
    const message = error?.message || "خطا در بروزرسانی پروفایل";
    setFormMessage(message, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupToken();
  setupModalEvents();
  setPageTitle();

  const editButton = document.querySelector("[data-action='edit-user']");
  if (editButton) {
    editButton.addEventListener("click", handleEditButtonClick);
  }

  const editForm = document.getElementById("edit_user_form");
  if (editForm) {
    editForm.addEventListener("submit", handleEditUserSubmit);
  }

  const avatarInput = document.getElementById("edit_user_avatar");
  if (avatarInput) {
    avatarInput.addEventListener("change", handleAvatarChange);
  }

  const avatarPreview = document.querySelector(".modal_avatar_preview");
  if (avatarPreview) {
    avatarPreview.addEventListener("click", handleAvatarPreviewClick);
  }

  loadDashboardData();
});
