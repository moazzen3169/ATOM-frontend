import {
  API_ENDPOINTS,
  createAuthApiClient,
  extractApiError,
} from "./services/api-client.js";
import {
  configureTeamModule,
  initializeDashboardTeamsSection,
  setTeamUserContext,
} from "./user-teams.js";
import {
  configureTournamentHistoryModule,
  initializeDashboardTournamentHistorySection,
  initializeTournamentHistoryUI,
  setTournamentHistoryUserContext,
} from "./user-tournaments_history.js";

const apiClient = createAuthApiClient();
const showError = window.showError ?? ((msg) => alert(msg));
const showSuccess = window.showSuccess ?? (() => {});
const LOGIN_REDIRECT = "../register/login.html";

let dashboardSnapshot = null;
let modulesConfigured = false;
let dashboardUserId = null;

function ensureAuthToken() {
  let token = apiClient.getAccessToken();
  if (token) return token;

  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("token") || localStorage.getItem("access_token");
    if (stored) {
      apiClient.setAccessToken(stored);
      return stored;
    }
  }

  showError("ابتدا وارد حساب کاربری شوید.");
  window.location.href = LOGIN_REDIRECT;
  return null;
}

function selectElement(selector) {
  if (!selector) return null;
  try {
    return document.querySelector(selector);
  } catch (err) {
    console.warn("Invalid selector:", selector, err);
    return null;
  }
}

function applyTextContent(map = {}) {
  Object.entries(map).forEach(([selector, value]) => {
    const el = selectElement(selector);
    if (el) el.textContent = value ?? "";
  });
}

function applyHtmlContent(map = {}) {
  Object.entries(map).forEach(([selector, value]) => {
    const el = selectElement(selector);
    if (el) el.innerHTML = value ?? "";
  });
}

function formatDateForDisplay(value) {
  if (!value) {
    return value ?? "";
  }
  try {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("fa-IR");
    }
    return value;
  } catch (error) {
    return value;
  }
}

function toggleButtonLoadingState(button, isLoading, loadingLabel = "در حال انجام...") {
  if (!button) {
    return;
  }

  if (isLoading) {
    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.textContent || "";
    }
    if (loadingLabel) {
      button.textContent = loadingLabel;
    }
    button.disabled = true;
    button.classList.add("is-loading");
    return;
  }

  if (button.dataset.originalLabel) {
    button.textContent = button.dataset.originalLabel;
    delete button.dataset.originalLabel;
  }
  button.disabled = false;
  button.classList.remove("is-loading");
}

function resolveUserIdValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object") {
    const candidates = [
      value.id,
      value.user_id,
      value.pk,
      value.uuid,
      value.slug,
    ];
    for (const candidate of candidates) {
      const resolved = resolveUserIdValue(candidate);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }
  const stringValue = String(value).trim();
  return stringValue ? stringValue : null;
}

function resolveUserUsername(user = {}) {
  if (!user || typeof user !== "object") {
    return "";
  }
  return (
    user.username ||
    user.user_name ||
    user.name ||
    user.full_name ||
    ""
  );
}

function resolveUserEmail(user = {}) {
  if (!user || typeof user !== "object") {
    return "";
  }
  return user.email || user.user_email || "";
}

function extractDashboardData(snapshot = {}) {
  const candidates = [
    snapshot.dashboardData,
    snapshot.dashboard,
    snapshot.data,
    snapshot.payload,
    snapshot.context,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      return candidate;
    }
  }
  return null;
}

function extractDashboardUser(snapshot, dashboardData) {
  const data = dashboardData || extractDashboardData(snapshot);
  if (data && typeof data === "object") {
    const candidates = [
      data.user,
      data.profile,
      data.account,
      data.owner,
      data.current_user,
      data.player,
    ];
    for (const candidate of candidates) {
      if (candidate && typeof candidate === "object") {
        return candidate;
      }
    }
  }

  const snapshotCandidates = [snapshot.user, snapshot.profile, snapshot.account];
  for (const candidate of snapshotCandidates) {
    if (candidate && typeof candidate === "object") {
      return candidate;
    }
  }

  return null;
}

function configureDashboardModules() {
  if (modulesConfigured) {
    return;
  }

  const authFetch = apiClient.fetch.bind(apiClient);

  configureTeamModule({
    fetchWithAuth: authFetch,
    extractErrorMessage: extractApiError,
    toggleButtonLoading: toggleButtonLoadingState,
    showError,
    showSuccess,
    openModal: openModalById,
    closeModal: (id) => toggleModal(document.getElementById(id), false),
    formatDate: formatDateForDisplay,
    onTeamsUpdated: async () => {
      await loadDashboard();
    },
  });

  modulesConfigured = true;
}

function handleDashboardDataSnapshot(snapshot) {
  const dashboardData = extractDashboardData(snapshot);
  if (!dashboardData) {
    return;
  }

  const dashboardUser = extractDashboardUser(snapshot, dashboardData);
  const resolvedUserId =
    resolveUserIdValue(dashboardUser) ||
    resolveUserIdValue(dashboardData.user_id) ||
    resolveUserIdValue(dashboardData.owner_id);

  if (resolvedUserId) {
    dashboardUserId = resolvedUserId;
  }

  configureDashboardModules();

  const authFetch = apiClient.fetch.bind(apiClient);

  if (dashboardUserId) {
    setTeamUserContext({
      id: dashboardUserId,
      username: resolveUserUsername(dashboardUser),
      email: resolveUserEmail(dashboardUser),
    });
    setTournamentHistoryUserContext(dashboardUserId);
  }

  configureTournamentHistoryModule({
    fetchWithAuth: authFetch,
    extractErrorMessage: extractApiError,
    showError,
    enableServerFiltering: true,
    userId: dashboardUserId,
  });

  initializeDashboardTeamsSection({ dashboardData }).catch((error) => {
    console.error("خطا در راه‌اندازی بخش تیم‌ها:", error);
  });

  initializeDashboardTournamentHistorySection({
    dashboardData,
    userId: dashboardUserId,
  })
    .then(() => {
      initializeTournamentHistoryUI();
    })
    .catch((error) => {
      console.error("خطا در راه‌اندازی تاریخچه تورنومنت‌ها:", error);
    });
}

function applySnapshot(snapshot = {}) {
  dashboardSnapshot = snapshot;

  if (snapshot.title) document.title = snapshot.title;
  applyTextContent(snapshot.text);
  applyHtmlContent(snapshot.html);

  const flash = snapshot.flash || {};
  if (flash.error) {
    showError(flash.error);
  }
  if (flash.success) {
    showSuccess(flash.success);
  }

  handleDashboardDataSnapshot(snapshot);
}

/* ------------------------- دریافت داده داشبورد ------------------------- */

async function requestDashboardSnapshot() {
  const response = await apiClient.fetch(API_ENDPOINTS.users.dashboard, { method: "GET" });

  if (!response.ok) {
    const msg = await extractApiError(response);
    const err = new Error(msg || "خطا در دریافت اطلاعات داشبورد.");
    err.status = response.status;
    throw err;
  }

  const data = await response.json();

  // فراخوانی اعضای تیم‌ها برای تکمیل داده‌ها
  const enrichedTeams = await enrichTeamsWithMembers(data.teams || []);
  data.teams = enrichedTeams;

  return buildDashboardSnapshot(data);
}

/* ------------------------- دریافت اعضای تیم ------------------------- */
async function enrichTeamsWithMembers(teams) {
  const results = [];

  for (const team of teams) {
    try {
      const res = await apiClient.fetch(API_ENDPOINTS.users.team(team.id), { method: "GET" });
      if (res.ok) {
        const json = await res.json();
        team.members = json.members || [];
      } else {
        team.members = [];
      }
    } catch (e) {
      console.warn("Failed to fetch team members:", e);
      team.members = [];
    }
    results.push(team);
  }

  return results;
}

/* ------------------------- ساخت Snapshot ------------------------- */

function buildDashboardSnapshot(data) {
  if (!data || typeof data !== "object") return {};

  const user = data.user_profile || {};
  const teams = data.teams || [];
  const tournaments = data.tournament_history || [];

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || "-";
  const joinDate = user.verification?.created_at
    ? new Date(user.verification.created_at).toLocaleDateString("fa-IR")
    : "-";

  // تاریخچه تورنومنت‌ها
  const tournamentsHTML = tournaments
    .map((item) => {
      const t = item.tournament || {};
      const game = t.game?.name || "-";
      const date = new Date(t.start_date).toLocaleDateString("fa-IR");
      return `
        <tr>
          <td>${user.score || 0}</td>
          <td>${item.rank ?? "-"}</td>
          <td>${date}</td>
          <td>${item.team?.name || "-"}</td>
          <td>${game}</td>
          <td>${t.name}</td>
        </tr>`;
    })
    .join("");

  // تیم‌ها با عکس اعضا
  const teamsHTML = teams
    .map((team) => {
      const members = team.members || [];
      const membersHTML = members
        .map((m) => {
          const isCaptain = m.is_captain || false;
          return `
            <img src="${m.profile_picture || "../img/profile.jpg"}"
                 alt="${m.username}"
                 title="${m.username}${isCaptain ? " (کاپیتان)" : ""}"
                 class="team_member_avatar ${isCaptain ? "team_member_avatar--captain" : ""}">
          `;
        })
        .join("");

      return `
        <div class="team_card">
          <div class="team_card_header">
            <img src="${team.team_picture || "../img/default-team.jpg"}" 
                 alt="${team.name}" 
                 class="team_img">
            <h3 class="team_name">${team.name}</h3>
          </div>
          <div class="team_members">
            ${membersHTML || "<p class='no_members'>اعضایی وجود ندارد</p>"}
          </div>
        </div>`;
    })
    .join("");

  return {
    title: "داشبورد کاربری",
    text: {
      "#user_name": user.username || "-",
      "#user_email_primary": user.email || "-",
      "#user_username": user.username || "-",
      "#user_full_name": fullName,
      "#user_email_detail": user.email || "-",
      "#user_phone": user.phone_number || "-",
      "#user_rank": user.rank?.toString() || "-",
      "#user_score": user.score?.toString() || "0",
      "#teams_counter": `${teams.length} تیم`,
      "#user_tournaments_played": tournaments.length.toString(),
      "#user_add_date": joinDate,
    },
    html: {
      "#user_avatar": `<img src="${user.profile_picture}" alt="avatar" class="profile_avatar">`,
      "#teams_container": teamsHTML,
      "#tournaments_history_body": tournamentsHTML,
    },
    flash: {
      success: "اطلاعات با موفقیت بارگذاری شد.",
    },
    data,
  };
}

/* ------------------------- مودال ویرایش ------------------------- */

function toggleModal(element, open) {
  if (!element) return;
  const isOpen = Boolean(open);
  element.classList.toggle("modal--open", isOpen);
  element.setAttribute("aria-hidden", isOpen ? "false" : "true");
  document.body.classList.toggle("modal_open", isOpen);
  activeModal = isOpen ? element : null;
}

function closeActiveModal() {
  if (activeModal) toggleModal(activeModal, false);
}

function registerModalInteractions() {
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-close-modal]");
    if (trigger) {
      e.preventDefault();
      closeActiveModal();
    }
    if (activeModal && e.target === activeModal) closeActiveModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeActiveModal();
  });
}

function openModalById(id) {
  const modal = document.getElementById(id);
  toggleModal(modal, true);
}

/* ------------------------- ویرایش پروفایل ------------------------- */

async function handleProfileSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  const endpoint = API_ENDPOINTS.auth.profile;
  const method = "POST";
  const formData = new FormData(form);

  try {
    const response = await apiClient.fetch(endpoint, { method, body: formData });
    if (!response.ok) {
      const msg = await extractApiError(response);
      throw new Error(msg || "خطا در ذخیره اطلاعات.");
    }

    await loadDashboard();
    closeActiveModal();
    showSuccess("تغییرات با موفقیت ذخیره شدند.");
  } catch (err) {
    console.error("Profile update failed:", err);
    showError(err.message || "خطا در ذخیره اطلاعات.");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

/* ------------------------- بارگذاری داشبورد ------------------------- */

async function loadDashboard() {
  const token = ensureAuthToken();
  if (!token) return;

  try {
    const snapshot = await requestDashboardSnapshot();
    applySnapshot(snapshot);
  } catch (error) {
    console.error("Dashboard loading failed:", error);
    showError(error.message || "خطا در دریافت اطلاعات داشبورد.");
    if (error.status === 401) {
      apiClient.clearTokens?.();
      window.location.href = LOGIN_REDIRECT;
    }
  }
}

/* ------------------------- رویدادهای اولیه ------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  registerModalInteractions();
  loadDashboard();

  const editButton = document.querySelector('[data-action="edit-user"]');
  if (editButton) {
    editButton.addEventListener("click", (e) => {
      e.preventDefault();
      const user = dashboardSnapshot?.data?.user_profile || {};
      document.getElementById("edit_user_username").value = user.username || "";
      document.getElementById("edit_user_first_name").value = user.first_name || "";
      document.getElementById("edit_user_last_name").value = user.last_name || "";
      document.getElementById("edit_user_email").value = user.email || "";
      document.getElementById("edit_user_phone").value = user.phone_number || "";
      document.getElementById("edit_user_avatar_preview").src =
        user.profile_picture || "../img/profile.jpg";
      openModalById("edit_user_modal");
    });
  }

  const profileForm = document.getElementById("edit_user_form");
  if (profileForm) {
    profileForm.addEventListener("submit", handleProfileSubmit);
  }
});
