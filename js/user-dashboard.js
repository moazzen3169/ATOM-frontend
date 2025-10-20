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
const DEFAULT_USER_AVATAR = "../img/profile.jpg";

let dashboardSnapshot = null;
let modulesConfigured = false;
let dashboardUserId = null;
let activeModal = null;

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

function applySnapshotToDom(snapshot = {}) {
  if (!snapshot || typeof snapshot !== "object") {
    return;
  }

  if (snapshot.title) {
    document.title = snapshot.title;
  }

  if (snapshot.text) {
    applyTextContent(snapshot.text);
  }

  if (snapshot.html) {
    applyHtmlContent(snapshot.html);
  }

  if (snapshot.images) {
    applyImageSources(snapshot.images);
  }
}

function applySnapshotMeta(meta = {}) {
  if (!meta || typeof meta !== "object") {
    return;
  }

  const headerAvatar = document.getElementById("header_user_avatar");
  if (headerAvatar && meta.headerAvatarAlt) {
    headerAvatar.setAttribute("alt", meta.headerAvatarAlt);
  }
}

function resolveImageUrl(source, fallback = DEFAULT_USER_AVATAR) {
  if (!source) {
    return fallback;
  }

  if (typeof source === "object") {
    if (typeof source.fallback === "string") {
      fallback = source.fallback;
    }
    if (typeof source.default === "string") {
      fallback = source.default;
    }
    if (typeof source.url === "string") {
      return resolveImageUrl(source.url, fallback);
    }
    if (typeof source.src === "string") {
      return resolveImageUrl(source.src, fallback);
    }
    if (typeof source.href === "string") {
      return resolveImageUrl(source.href, fallback);
    }
  }

  if (typeof source !== "string") {
    return fallback;
  }

  const trimmed = source.trim();
  if (!trimmed || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "undefined") {
    return fallback;
  }

  return trimmed;
}

function applyImageSources(map = {}) {
  if (!map || typeof map !== "object") {
    return;
  }

  Object.entries(map).forEach(([selector, value]) => {
    const el = selectElement(selector);
    if (!el) {
      return;
    }

    const fallback = el.dataset?.defaultSrc || DEFAULT_USER_AVATAR;
    const resolvedSrc = resolveImageUrl(value, fallback);
    el.setAttribute("src", resolvedSrc);
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
    button.setAttribute("aria-busy", "true");
    return;
  }

  if (button.dataset.originalLabel) {
    button.textContent = button.dataset.originalLabel;
    delete button.dataset.originalLabel;
  }
  button.disabled = false;
  button.classList.remove("is-loading");
  button.removeAttribute("aria-busy");
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

  applySnapshotToDom(snapshot);
  applySnapshotMeta(snapshot.meta);

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
  if (!Array.isArray(teams) || teams.length === 0) {
    return Array.isArray(teams) ? teams : [];
  }

  const fetchPromises = teams.map(async (team) => {
    if (!team || typeof team !== "object") {
      return team;
    }

    const normalizedTeam = { ...team };

    if (Array.isArray(team.members) && team.members.length) {
      normalizedTeam.members = team.members.slice();
      return normalizedTeam;
    }

    const teamId = team.id ?? team.team_id ?? team.slug;
    if (!teamId) {
      normalizedTeam.members = [];
      return normalizedTeam;
    }

    try {
      const res = await apiClient.fetch(API_ENDPOINTS.users.team(teamId), { method: "GET" });
      if (!res.ok) {
        normalizedTeam.members = [];
        return normalizedTeam;
      }

      let json = null;
      try {
        json = await res.clone().json();
      } catch (error) {
        console.warn("Failed to parse team members response:", error);
      }

      const membersPayload =
        json?.members ??
        json?.memberships ??
        json?.results ??
        json?.data ??
        json?.items ??
        json?.entries ??
        json?.players ??
        json?.team_members ??
        [];

      normalizedTeam.members = Array.isArray(membersPayload)
        ? membersPayload.filter(Boolean)
        : [];
    } catch (error) {
      console.warn("Failed to fetch team members:", error);
      normalizedTeam.members = [];
    }

    return normalizedTeam;
  });

  const enriched = await Promise.all(fetchPromises);
  return enriched;
}

/* ------------------------- ساخت Snapshot ------------------------- */

function buildDashboardSnapshot(data) {
  if (!data || typeof data !== "object") return {};

  const normalizedTeams = Array.isArray(data.teams) ? data.teams : [];
  const normalizedTournaments = Array.isArray(data.tournament_history)
    ? data.tournament_history
    : Array.isArray(data.tournaments)
    ? data.tournaments
    : [];

  const rawUser = data.user_profile || {};
  const normalizedUser = {
    ...rawUser,
    profile_picture: resolveImageUrl(rawUser.profile_picture, DEFAULT_USER_AVATAR),
  };

  const fullName = [normalizedUser.first_name, normalizedUser.last_name]
    .filter(Boolean)
    .join(" ")
    .trim()
    || "-";

  const joinDate = normalizedUser.verification?.created_at
    ? new Date(normalizedUser.verification.created_at).toLocaleDateString("fa-IR")
    : "-";

  const normalizedData = {
    ...data,
    user_profile: normalizedUser,
    teams: normalizedTeams,
    tournament_history: normalizedTournaments,
  };

  const displayNameCandidate = [normalizedUser.first_name, normalizedUser.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const displayName =
    displayNameCandidate ||
    normalizedUser.username ||
    normalizedUser.full_name ||
    normalizedUser.name ||
    normalizedUser.email ||
    "کاربر";

  const pageHeading = data.page_title || "داشبورد";
  const headerTitle = displayName ? `${pageHeading} — ${displayName}` : pageHeading;
  const documentTitle = displayName
    ? `داشبورد کاربری | ${displayName}`
    : "داشبورد کاربری";

  return {
    title: documentTitle,
    text: {
      "#page_title_text": headerTitle,
      "#header_user_name": displayName,
      "#user_name": normalizedUser.username || "-",
      "#user_email_primary": normalizedUser.email || "-",
      "#user_username": normalizedUser.username || "-",
      "#user_full_name": fullName,
      "#user_email_detail": normalizedUser.email || "-",
      "#user_phone": normalizedUser.phone_number || "-",
      "#user_rank": normalizedUser.rank?.toString() || "-",
      "#user_score": normalizedUser.score?.toString() || "0",
      "#teams_counter": `${normalizedTeams.length} تیم`,
      "#user_tournaments_played": normalizedTournaments.length.toString(),
      "#user_add_date": joinDate,
    },
    html: {},
    images: {
      "#user_avatar_image": {
        src: normalizedUser.profile_picture,
        fallback: DEFAULT_USER_AVATAR,
      },
      "#header_user_avatar": {
        src: normalizedUser.profile_picture,
        fallback: DEFAULT_USER_AVATAR,
      },
    },
    flash: {
      success: "اطلاعات با موفقیت بارگذاری شد.",
    },
    data: normalizedData,
    meta: {
      headerAvatarAlt: displayName ? `پروفایل ${displayName}` : "پروفایل کاربر",
    },
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

  toggleButtonLoadingState(submitButton, true, "در حال ذخیره...");

  const formData = new FormData(form);

  const resolvedUserId =
    dashboardUserId ||
    resolveUserIdValue(dashboardSnapshot?.data?.user_profile) ||
    resolveUserIdValue(formData.get("id"));

  const endpoint = resolvedUserId
    ? API_ENDPOINTS.users.detail(resolvedUserId)
    : API_ENDPOINTS.auth.profile;

  [
    "username",
    "first_name",
    "last_name",
    "email",
    "phone_number",
  ].forEach((field) => {
    const value = formData.get(field);
    if (typeof value === "string") {
      formData.set(field, value.trim());
    }
  });

  const avatarFile = formData.get("profile_picture");
  const hasFileConstructor = typeof File !== "undefined";
  const isFileObject = hasFileConstructor && avatarFile instanceof File;
  const hasValidAvatar = isFileObject && avatarFile.size > 0;

  if (!hasValidAvatar) {
    if (isFileObject || typeof avatarFile === "string") {
      formData.delete("profile_picture");
    }
  }

  try {
    const response = await apiClient.fetch(endpoint, { method: "PATCH", body: formData });
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
    toggleButtonLoadingState(submitButton, false);
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

  const headerContainer = document.getElementById("dashboard_header");
  if (headerContainer) {
    headerContainer.addEventListener("dashboardHeader:loaded", () => {
      if (!dashboardSnapshot) {
        return;
      }
      applySnapshotToDom(dashboardSnapshot);
      applySnapshotMeta(dashboardSnapshot.meta);
    });
  }

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
