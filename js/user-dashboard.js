import { API_ENDPOINTS, createAuthApiClient, extractApiError } from "./services/api-client.js";
import {
  configureTeamModule,
  setTeamUserContext,
  ensureIncomingInvitationsLoaded,
  initializeDashboardTeamsSection,
  setupTeamsPageInteractions,
} from "./user-teams.js";
import {
  configureTournamentHistoryModule,
  initializeTournamentHistoryUI,
  initializeDashboardTournamentHistorySection,
} from "./user-tournaments_history.js";

const apiClient = createAuthApiClient();

const state = {
  currentUserId: null,
  currentUsername: "",
  currentUserEmail: "",
  currentUserProfile: {},
  cachedTeamsCount: 0,
  cachedTournamentsCount: 0,
};

const DEFAULT_AVATAR_SRC = "../img/profile.jpg";
const LEGACY_PROFILE_ENDPOINTS = [
  API_ENDPOINTS.users.me,
  "/api/auth/users/me/",
  "/api/auth/me/",
  "/api/auth/user/",
];
const PROFILE_BIO_KEYS = ["bio", "about", "description"];

function getProfileUpdateEndpoints() {
  const endpoints = [API_ENDPOINTS.auth.profile];
  if (state.currentUserId) {
    endpoints.push(API_ENDPOINTS.users.detail(state.currentUserId));
  }
  endpoints.push(...LEGACY_PROFILE_ENDPOINTS);
  return Array.from(new Set(endpoints));
}

function formatDate(dateString) {
  if (!dateString || dateString === "-") return "-";
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleDateString("fa-IR");
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
}

function setElementText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function setFieldValue(id, value) {
  const field = document.getElementById(id);
  if (field) {
    field.value = value === null || typeof value === "undefined" ? "" : String(value);
  }
}

function buildFullName(user = {}) {
  if (!user) return "";
  if (user.full_name) return String(user.full_name);
  const parts = [user.first_name, user.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (user.name) return String(user.name);
  return "";
}

function getPhoneNumber(user = {}) {
  return user.phone_number || user.phone || user.mobile || user.contact_number || "";
}

function translateUserStatus(status) {
  const normalized = (status || "").toString().toLowerCase();
  switch (normalized) {
    case "active":
    case "verified":
    case "approved":
    case "confirmed":
      return "فعال";
    case "pending":
    case "awaiting":
    case "processing":
    case "in_review":
      return "در انتظار بررسی";
    case "suspended":
    case "blocked":
    case "inactive":
      return "غیرفعال";
    default:
      return status || "نامشخص";
  }
}

function resolveUserStatus(user = {}) {
  const statusCandidates = [
    user.status,
    user.account_status,
    user.profile_status,
    user.verification_status,
    user.state,
  ].filter(Boolean);

  if (statusCandidates.length) {
    return translateUserStatus(statusCandidates[0]);
  }
  return "نامشخص";
}

function resolveJoinDate(user = {}) {
  const fields = ["date_joined", "created_at", "created", "joined_at", "registered_at"];
  for (const field of fields) {
    if (user[field]) {
      return user[field];
    }
  }
  return null;
}

function updateHeaderUserInfoFromLocalStorage() {
  const username = localStorage.getItem("username") || "کاربر";
  const profilePicture = localStorage.getItem("profile_picture") || DEFAULT_AVATAR_SRC;

  const headerUserName = document.getElementById("header_user_name");
  if (headerUserName) {
    headerUserName.textContent = username;
  }

  const mobileUserName = document.querySelector(".user_info_name");
  if (mobileUserName) {
    mobileUserName.textContent = username;
  }

  const headerUserAvatar = document.getElementById("header_user_avatar");
  if (headerUserAvatar) {
    headerUserAvatar.src = profilePicture;
  }

  const mobileUserAvatar = document.querySelector(".user_profile img");
  if (mobileUserAvatar) {
    mobileUserAvatar.src = profilePicture;
  }
}

const modalState = {
  activeModal: null,
};

function resolveModalElement(idOrElement) {
  if (!idOrElement) return null;
  if (typeof idOrElement === "string") {
    return document.getElementById(idOrElement);
  }
  if (idOrElement instanceof Element) {
    return idOrElement;
  }
  return null;
}

function openModal(idOrElement) {
  const modal = resolveModalElement(idOrElement);
  if (!modal) return null;
  modal.classList.add("modal--open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal_open");
  modalState.activeModal = modal;
  return modal;
}

function closeModal(idOrElement) {
  const modal = resolveModalElement(idOrElement || modalState.activeModal);
  if (!modal) return;
  modal.classList.remove("modal--open");
  modal.setAttribute("aria-hidden", "true");
  if (modalState.activeModal === modal) {
    modalState.activeModal = null;
  }
  if (!document.querySelector(".modal.modal--open")) {
    document.body.classList.remove("modal_open");
  }
}

function setupModalEvents() {
  document.addEventListener("click", (event) => {
    const closeTrigger = event.target.closest("[data-close-modal]");
    if (closeTrigger) {
      const modal = closeTrigger.closest(".modal");
      closeModal(modal);
      return;
    }

    const modal = event.target.closest(".modal");
    if (modal && event.target === modal) {
      closeModal(modal);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modalState.activeModal) {
      closeModal(modalState.activeModal);
    }
  });
}

function setupToken() {
  let token = apiClient.getAccessToken();

  if (!token && typeof localStorage !== "undefined") {
    const storedToken = localStorage.getItem("token") || localStorage.getItem("access_token");
    if (storedToken) {
      apiClient.setAccessToken(storedToken);
      token = storedToken;
    }
  }

  if (!token) {
    showError("ابتدا وارد حساب کاربری شوید");
    window.location.href = "../register/login.html";
    return null;
  }

  return token;
}

async function fetchWithAuth(url, options = {}, retry = true) {
  const token = apiClient.getAccessToken() || setupToken();
  if (!token) {
    throw new Error("برای انجام این عملیات ابتدا وارد حساب کاربری شوید.");
  }

  try {
    return await apiClient.fetch(url, { ...options, retry });
  } catch (error) {
    if (error && error.code === "AUTH_REQUIRED") {
      throw new Error("برای انجام این عملیات ابتدا وارد حساب کاربری شوید.");
    }
    throw error;
  }
}

function flattenErrorDetail(detail) {
  if (!detail) return "";
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => flattenErrorDetail(item))
      .filter(Boolean)
      .join(" | ");
  }
  if (typeof detail === "object") {
    return Object.values(detail)
      .map((value) => flattenErrorDetail(value))
      .filter(Boolean)
      .join(" | ");
  }
  return String(detail);
}

async function resolveErrorMessage(errorOrResponse) {
  if (!errorOrResponse) {
    return "خطای ناشناخته رخ داد.";
  }

  const isResponseLike =
    typeof errorOrResponse === "object" &&
    typeof errorOrResponse.headers === "object" &&
    typeof errorOrResponse.text === "function";

  if (isResponseLike) {
    return extractApiError(errorOrResponse);
  }

  if (typeof errorOrResponse === "string") {
    return errorOrResponse;
  }

  if (typeof errorOrResponse === "object") {
    const detailCandidates = [errorOrResponse.detail, errorOrResponse.error];
    for (const candidate of detailCandidates) {
      const detailMessage = flattenErrorDetail(candidate);
      if (detailMessage) {
        return detailMessage;
      }
    }

    if (errorOrResponse instanceof Error) {
      if (errorOrResponse.message && errorOrResponse.message !== "REQUEST_FAILED") {
        return errorOrResponse.message;
      }
    } else if (
      typeof errorOrResponse.message === "string" &&
      errorOrResponse.message !== "REQUEST_FAILED"
    ) {
      return errorOrResponse.message;
    }
  }

  if (errorOrResponse instanceof Error && errorOrResponse.message && errorOrResponse.message !== "REQUEST_FAILED") {
    return errorOrResponse.message;
  }

  return "خطای ناشناخته رخ داد.";
}

function updateEditUserAvatarPreview(src) {
  const preview = document.getElementById("edit_user_avatar_preview");
  if (preview) {
    preview.src = src || DEFAULT_AVATAR_SRC;
  }
}

function handleEditAvatarChange(event) {
  const input = event?.target;
  if (!input) return;

  const file = input.files && input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      updateEditUserAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);
  } else {
    updateEditUserAvatarPreview(getProfileAvatarSrc(state.currentUserProfile));
  }
}

function buildProfileUpdatePayload({
  username,
  email,
  firstName,
  lastName,
  phoneNumber,
  bio,
  includeBio,
}) {
  const payload = {
    username,
    email,
    first_name: typeof firstName === "string" ? firstName : "",
    last_name: typeof lastName === "string" ? lastName : "",
    phone_number: typeof phoneNumber === "string" ? phoneNumber : "",
  };

  if (includeBio) {
    payload.bio = typeof bio === "string" ? bio : "";
  }

  return payload;
}

function createProfileFormData(payload, avatarFile) {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (typeof value !== "undefined" && value !== null) {
      formData.append(key, value);
    }
  });

  if (avatarFile && typeof avatarFile === "object" && Number(avatarFile.size) > 0) {
    formData.append("profile_picture", avatarFile);
  }

  return formData;
}

async function submitProfileUpdate(bodyFactory, isMultipart = false) {
  let lastError = null;
  const endpoints = getProfileUpdateEndpoints();

  for (const endpointPath of endpoints) {
    const endpoint = endpointPath;
    try {
      const headers = new Headers();

      if (!isMultipart) {
        headers.set("Content-Type", "application/json");
      }
      headers.set("Accept", "application/json");

      const response = await fetchWithAuth(endpoint, {
        method: "PATCH",
        body: bodyFactory(),
        headers,
      });

      if (!response.ok) {
        const message = await resolveErrorMessage(response);
        throw new Error(message || `خطا در بروزرسانی پروفایل (${response.status})`);
      }

      return response;
    } catch (error) {
      lastError = error;
      console.warn(`Profile update failed via ${endpoint}:`, error);
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error("خطا در بروزرسانی پروفایل");
}

function toggleButtonLoading(button, isLoading, loadingText = "لطفاً صبر کنید...") {
  if (!button) return;
  if (isLoading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }
    button.disabled = true;
    button.textContent = loadingText;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

function setPageTitle() {
  const path = window.location.pathname;
  let title = "داشبورد";

  const titleMap = [
    { keyword: "tickets", value: "تیکت‌ها" },
    { keyword: "wallet", value: "کیف پول" },
    { keyword: "profile", value: "پروفایل" },
    { keyword: "teams", value: "تیم‌ها" },
    { keyword: "tournaments", value: "تورنومنت‌ها" },
    { keyword: "verification", value: "احراز هویت" },
    { keyword: "chat", value: "پیام‌ها" },
    { keyword: "games", value: "بازی‌ها" },
    { keyword: "lobby", value: "لابی" },
  ];

  for (const item of titleMap) {
    if (path.includes(item.keyword)) {
      title = item.value;
      break;
    }
  }

  if (document.getElementById("page_title_text")) {
    document.getElementById("page_title_text").textContent = title;
  }
}

function getProfileAvatarSrc(profile) {
  if (!profile || typeof profile !== "object") {
    return DEFAULT_AVATAR_SRC;
  }
  return profile.profile_picture || profile.avatar || DEFAULT_AVATAR_SRC;
}

function persistProfileLocally(profile) {
  try {
    if (profile && typeof profile === "object") {
      localStorage.setItem("user_data", JSON.stringify(profile));
    }
  } catch (error) {
    console.warn("Failed to persist profile in localStorage", error);
  }
}

function updateCachedProfile(profile, teamsCount, tournamentsCount) {
  state.currentUserProfile = profile || {};
  if (typeof profile?.id !== "undefined") {
    state.currentUserId = profile.id;
  }
  state.currentUsername = profile?.username || profile?.user_name || "";
  state.currentUserEmail = profile?.email || "";
  state.cachedTeamsCount = Number.isFinite(Number(teamsCount)) ? Number(teamsCount) : 0;
  state.cachedTournamentsCount = Number.isFinite(Number(tournamentsCount))
    ? Number(tournamentsCount)
    : 0;

  setTeamUserContext({
    id: state.currentUserId,
    username: state.currentUsername,
    email: state.currentUserEmail,
  });
}

function displayUserProfile(profile, teamsCount, tournamentsCount) {
  if (!profile) return;

  updateCachedProfile(profile, teamsCount, tournamentsCount);

  const username = state.currentUsername || "کاربر";
  localStorage.setItem("username", username);
  persistProfileLocally(profile);

  setElementText("header_user_name", username);
  setElementText("user_name", username);
  setElementText("user_username", username);

  const email = state.currentUserEmail || "-";
  setElementText("user_email_primary", email);
  setElementText("user_email_detail", email);

  const rank = profile.rank || profile.level || "-";
  setElementText("user_rank", rank || "-");

  const statusLabel = resolveUserStatus(profile);
  setElementText("user_status", statusLabel);

  const fullName = buildFullName(profile) || "-";
  setElementText("user_full_name", fullName);

  const phoneNumber = getPhoneNumber(profile) || "ثبت نشده";
  setElementText("user_phone", phoneNumber);

  const joinDateRaw = resolveJoinDate(profile);
  const joinDateText = joinDateRaw ? formatDate(joinDateRaw) : "-";
  setElementText("user_add_date", joinDateText);

  const numberFormatter = new Intl.NumberFormat("fa-IR");
  const rawScore =
    typeof profile.score === "number" || typeof profile.score === "string"
      ? Number(profile.score)
      : Number(profile.points);
  const scoreValue = Number.isFinite(rawScore) ? rawScore : 0;
  setElementText("user_score", numberFormatter.format(scoreValue));
  setElementText(
    "user_tournaments_played",
    numberFormatter.format(state.cachedTournamentsCount)
  );

  const avatarSrc = getProfileAvatarSrc(profile);
  localStorage.setItem("profile_picture", avatarSrc);
  const headerAvatar = document.getElementById("header_user_avatar");
  if (headerAvatar) {
    headerAvatar.src = avatarSrc;
  }
  const profileAvatar = document.getElementById("user_avatar");
  if (profileAvatar) {
    profileAvatar.src = avatarSrc;
  }

  updateHeaderUserInfoFromLocalStorage();
}

async function fetchDashboardData() {
  try {
    const response = await fetchWithAuth(API_ENDPOINTS.users.dashboard, {
      method: "GET",
    });

    if (!response.ok) {
      const message = await resolveErrorMessage(response);
      throw new Error(message || `خطای HTTP: ${response.status}`);
    }

    const raw = await response.text();
    if (!raw) {
      console.warn("Dashboard API returned an empty response.");
      return {};
    }

    try {
      return JSON.parse(raw);
    } catch (parseError) {
      console.error("خطا در parse داده‌های داشبورد:", parseError);
      throw new Error("داده‌های نامعتبر از سرور دریافت شد.");
    }
  } catch (error) {
    console.error("خطا در دریافت داده‌های داشبورد:", error);
    const message = await resolveErrorMessage(error);
    throw new Error(message || "خطا در دریافت داده‌های داشبورد.");
  }
}

async function loadDashboardData() {
  const token = setupToken();
  if (!token) return;

  try {
    setPageTitle();

    const dashboardData = await fetchDashboardData();

    const teamsResult = await initializeDashboardTeamsSection({
      dashboardData,
    });

    const userId = dashboardData?.user_profile?.id ?? state.currentUserId;
    const tournamentsResult =
      await initializeDashboardTournamentHistorySection({
        dashboardData,
        userId,
      });

    const teamsCount = Number.isFinite(Number(teamsResult?.count))
      ? Number(teamsResult.count)
      : Array.isArray(teamsResult?.teams)
      ? teamsResult.teams.length
      : 0;

    const tournamentsCount = Number.isFinite(Number(tournamentsResult?.count))
      ? Number(tournamentsResult.count)
      : Array.isArray(tournamentsResult?.matches)
      ? tournamentsResult.matches.length
      : 0;

    state.cachedTeamsCount = teamsCount;
    state.cachedTournamentsCount = tournamentsCount;

    if (dashboardData?.user_profile) {
      displayUserProfile(
        dashboardData.user_profile,
        teamsCount,
        tournamentsCount
      );
    }
  } catch (error) {
    console.error("خطا در لود کردن اطلاعات داشبورد:", error);

    await ensureIncomingInvitationsLoaded({ force: true });

    const storedUserData = localStorage.getItem("user_data");
    if (storedUserData) {
      try {
        const parsed = JSON.parse(storedUserData);
        const profile = Array.isArray(parsed) ? parsed[0] : parsed;
        if (profile && typeof profile === "object") {
          displayUserProfile(profile, state.cachedTeamsCount, state.cachedTournamentsCount);
          return;
        }
      } catch (parseError) {
        console.error("خطا در پردازش اطلاعات ذخیره‌شده کاربر:", parseError);
      }
    }

    const message = await resolveErrorMessage(error);
    showError(message || "خطا در دریافت اطلاعات. لطفا دوباره وارد شوید.");
    localStorage.clear();
    window.location.href = "../register/login.html";
  }
}

function clearEditUserMessage() {
  const messageEl = document.getElementById("edit_user_message");
  if (messageEl) {
    messageEl.textContent = "";
    messageEl.classList.remove("is-error", "is-success");
  }
}

function setEditUserMessage(type, message) {
  const messageEl = document.getElementById("edit_user_message");
  if (!messageEl) return;
  messageEl.textContent = message || "";
  messageEl.classList.remove("is-error", "is-success");
  if (type === "error") {
    messageEl.classList.add("is-error");
  } else if (type === "success") {
    messageEl.classList.add("is-success");
  }
}

function openEditUserModal() {
  const form = document.getElementById("edit_user_form");
  if (!form) return;

  clearEditUserMessage();

  const profile = state.currentUserProfile || {};
  setFieldValue("edit_user_username", profile.username || profile.user_name || "");
  setFieldValue("edit_user_first_name", profile.first_name || "");
  setFieldValue("edit_user_last_name", profile.last_name || "");
  setFieldValue("edit_user_email", profile.email || "");
  setFieldValue("edit_user_phone", getPhoneNumber(profile) || "");
  setFieldValue(
    "edit_user_bio",
    profile.bio || profile.about || profile.description || ""
  );

  const avatarInput = document.getElementById("edit_user_avatar");
  if (avatarInput) {
    avatarInput.value = "";
  }
  updateEditUserAvatarPreview(getProfileAvatarSrc(profile));

  openModal("edit_user_modal");
}

async function handleEditUserSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  const username = (formData.get("username") || "").toString().trim();
  const email = (formData.get("email") || "").toString().trim();
  const firstName = (formData.get("first_name") || "").toString().trim();
  const lastName = (formData.get("last_name") || "").toString().trim();
  const phoneNumber = (formData.get("phone_number") || "").toString().trim();
  const bio = (formData.get("bio") || "").toString().trim();

  if (!username) {
    setEditUserMessage("error", "نام کاربری را وارد کنید.");
    return;
  }

  if (!email) {
    setEditUserMessage("error", "ایمیل را وارد کنید.");
    return;
  }

  const avatarFile = formData.get("profile_picture");
  const isFileObject = avatarFile && typeof avatarFile === "object" &&
    (typeof File === "undefined" || avatarFile instanceof File);
  const hasAvatar = Boolean(isFileObject && Number(avatarFile.size) > 0);

  const existingProfile = state.currentUserProfile || {};
  const shouldIncludeBioField = PROFILE_BIO_KEYS.some(
    (key) => typeof existingProfile[key] !== "undefined"
  );
  const includeBio = shouldIncludeBioField || Boolean(bio);

  const profilePayload = buildProfileUpdatePayload({
    username,
    email,
    firstName,
    lastName,
    phoneNumber,
    bio,
    includeBio,
  });
  const localProfileUpdates = { ...profilePayload };
  if (includeBio && shouldIncludeBioField) {
    PROFILE_BIO_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(existingProfile, key)) {
        localProfileUpdates[key] = bio;
      }
    });
  }

  const submitButton = form.querySelector('button[type="submit"]');
  toggleButtonLoading(submitButton, true, "در حال ذخیره...");
  clearEditUserMessage();

  try {
    let bodyFactory;
    if (hasAvatar) {
      bodyFactory = () => createProfileFormData(profilePayload, avatarFile);
    } else {
      const jsonString = JSON.stringify(profilePayload);
      bodyFactory = () => jsonString;
    }

    const response = await submitProfileUpdate(bodyFactory, hasAvatar);

    if (!response.ok) {
      const message = await resolveErrorMessage(response);
      throw new Error(message);
    }

    let updatedProfile = null;
    try {
      updatedProfile = await response.json();
    } catch (jsonError) {
      updatedProfile = null;
    }

    showSuccess("پروفایل با موفقیت به‌روزرسانی شد.");
    closeModal("edit_user_modal");

    if (updatedProfile && Object.keys(updatedProfile).length) {
      state.currentUserProfile = { ...state.currentUserProfile, ...updatedProfile };
      displayUserProfile(
        state.currentUserProfile,
        state.cachedTeamsCount,
        state.cachedTournamentsCount
      );
    } else {
      state.currentUserProfile = { ...state.currentUserProfile, ...localProfileUpdates };
      displayUserProfile(
        state.currentUserProfile,
        state.cachedTeamsCount,
        state.cachedTournamentsCount
      );
      if (hasAvatar) {
        await loadDashboardData();
      }
    }
  } catch (error) {
    console.error("خطا در بروزرسانی پروفایل:", error);
    setEditUserMessage("error", error.message || "خطا در بروزرسانی پروفایل");
    showError(error.message || "خطا در بروزرسانی پروفایل");
  } finally {
    toggleButtonLoading(submitButton, false);
  }
}

configureTeamModule({
  fetchWithAuth,
  extractErrorMessage: resolveErrorMessage,
  toggleButtonLoading,
  showError,
  showSuccess,
  openModal,
  closeModal,
  formatDate,
  onTeamsUpdated: async () => {
    await loadDashboardData();
  },
});

configureTournamentHistoryModule({
  fetchWithAuth,
  extractErrorMessage: resolveErrorMessage,
  showError,
});

document.addEventListener("DOMContentLoaded", () => {
  setupModalEvents();
  setupTeamsPageInteractions();
  initializeTournamentHistoryUI();

  const headerContainer = document.getElementById("dashboard_header");
  if (headerContainer) {
    const observer = new MutationObserver((mutationsList, obs) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          updateHeaderUserInfoFromLocalStorage();
          setPageTitle();
          obs.disconnect();
          break;
        }
      }
    });
    observer.observe(headerContainer, { childList: true });
  } else {
    updateHeaderUserInfoFromLocalStorage();
    setPageTitle();
  }

  loadDashboardData().then(() => {
    setPageTitle();
  });

  const editUserButton = document.querySelector('[data-action="edit-user"]');
  if (editUserButton) {
    editUserButton.addEventListener("click", openEditUserModal);
  }

  const editUserForm = document.getElementById("edit_user_form");
  if (editUserForm) {
    editUserForm.addEventListener("submit", handleEditUserSubmit);
  }

  const editUserAvatarInput = document.getElementById("edit_user_avatar");
  if (editUserAvatarInput) {
    editUserAvatarInput.addEventListener("change", handleEditAvatarChange);
  }

  const editUserAvatarPreview = document.querySelector(".modal_avatar_preview");
  if (editUserAvatarPreview) {
    editUserAvatarPreview.addEventListener("click", () => {
      document.getElementById("edit_user_avatar")?.click();
    });
  }
});
