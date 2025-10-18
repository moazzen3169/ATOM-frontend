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
const showError = window.showError ?? ((message) => alert(message));
const showSuccess = window.showSuccess ?? (() => {});
const LOGIN_REDIRECT = "../register/login.html";

let activeModal = null;
let dashboardSnapshot = null;
let modulesConfigured = false;
let dashboardUserId = null;

function ensureAuthToken() {
  let token = apiClient.getAccessToken();
  if (token) {
    return token;
  }

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
  if (!selector) {
    return null;
  }
  try {
    return document.querySelector(selector);
  } catch (error) {
    console.warn("Invalid selector provided by API:", selector, error);
    return null;
  }
}

function applyTextContent(textMap = {}) {
  Object.entries(textMap).forEach(([selector, value]) => {
    const element = selectElement(selector);
    if (element) {
      element.textContent = value ?? "";
    }
  });
}

function applyHtmlContent(htmlMap = {}) {
  Object.entries(htmlMap).forEach(([selector, value]) => {
    const element = selectElement(selector);
    if (element) {
      element.innerHTML = value ?? "";
    }
  });
}

function applyValues(valuesMap = {}) {
  Object.entries(valuesMap).forEach(([selector, value]) => {
    const element = selectElement(selector);
    if (!element) {
      return;
    }
    if ("value" in element) {
      element.value = value ?? "";
      return;
    }
    element.textContent = value ?? "";
  });
}

function applyAttributes(definitions = []) {
  definitions.forEach((definition) => {
    if (!definition || !definition.selector || !definition.name) {
      return;
    }
    const element = selectElement(definition.selector);
    if (!element) {
      return;
    }
    if (definition.remove) {
      element.removeAttribute(definition.name);
      return;
    }
    element.setAttribute(definition.name, definition.value ?? "");
  });
}

function applyClassChanges(entries = []) {
  entries.forEach((entry) => {
    if (!entry || !entry.selector) {
      return;
    }
    const element = selectElement(entry.selector);
    if (!element) {
      return;
    }
    (entry.remove || []).forEach((className) => {
      element.classList.remove(className);
    });
    (entry.add || []).forEach((className) => {
      element.classList.add(className);
    });
  });
}

function persistStorage(storageMap = {}) {
  if (typeof localStorage === "undefined") {
    return;
  }
  Object.entries(storageMap).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, value);
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

  if (snapshot.title) {
    document.title = snapshot.title;
  }

  applyTextContent(snapshot.text);
  applyHtmlContent(snapshot.html);
  applyValues(snapshot.values);
  applyAttributes(snapshot.attributes);
  applyClassChanges(snapshot.classes);
  persistStorage(snapshot.storage);

  if (snapshot.focus?.selector) {
    selectElement(snapshot.focus.selector)?.focus?.();
  }

  const flash = snapshot.flash || {};
  if (flash.error) {
    showError(flash.error);
  }
  if (flash.success) {
    showSuccess(flash.success);
  }

  handleDashboardDataSnapshot(snapshot);
}

async function requestDashboardSnapshot() {
  const response = await apiClient.fetch(API_ENDPOINTS.users.dashboard, {
    method: "GET",
  });

  if (!response.ok) {
    const message = await extractApiError(response);
    const error = new Error(message || "خطا در دریافت اطلاعات داشبورد.");
    error.status = response.status;
    throw error;
  }

  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("پاسخ نامعتبر از سرور دریافت شد.");
  }
}

async function loadDashboard() {
  const token = ensureAuthToken();
  if (!token) {
    return;
  }

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

function toggleModal(element, open) {
  if (!element) {
    return;
  }
  const isOpen = Boolean(open);
  element.classList.toggle("modal--open", isOpen);
  element.setAttribute("aria-hidden", isOpen ? "false" : "true");
  if (document.body) {
    document.body.classList.toggle("modal_open", isOpen);
  }
  activeModal = isOpen ? element : null;
}

function openModalById(id) {
  toggleModal(document.getElementById(id), true);
}

function closeActiveModal() {
  if (activeModal) {
    toggleModal(activeModal, false);
  }
}

function registerModalInteractions() {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-close-modal]");
    if (trigger) {
      event.preventDefault();
      closeActiveModal();
      return;
    }

    if (activeModal && event.target === activeModal) {
      closeActiveModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeActiveModal();
    }
  });
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
  }

  const endpoint = dashboardSnapshot?.profileUpdateEndpoint || API_ENDPOINTS.auth.profile;
  const method = dashboardSnapshot?.profileUpdateMethod || "PATCH";
  const formData = new FormData(form);

  try {
    const response = await apiClient.fetch(endpoint, {
      method,
      body: formData,
    });

    if (!response.ok) {
      const message = await extractApiError(response);
      throw new Error(message || "خطا در بروزرسانی پروفایل.");
    }

    const text = await response.text();
    if (text) {
      try {
        const snapshot = JSON.parse(text);
        applySnapshot(snapshot);
      } catch (error) {
        await loadDashboard();
      }
    } else {
      await loadDashboard();
    }

    closeActiveModal();
    if (!dashboardSnapshot?.flash?.success) {
      showSuccess("پروفایل با موفقیت به‌روزرسانی شد.");
    }
  } catch (error) {
    console.error("Profile update failed:", error);
    showError(error.message || "خطا در بروزرسانی پروفایل.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  registerModalInteractions();
  loadDashboard();

  const editButton = document.querySelector('[data-action="edit-user"]');
  if (editButton) {
    editButton.addEventListener("click", (event) => {
      event.preventDefault();
      openModalById("edit_user_modal");
    });
  }

  const profileForm = document.getElementById("edit_user_form");
  if (profileForm) {
    profileForm.addEventListener("submit", handleProfileSubmit);
  }
});
