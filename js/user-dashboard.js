import { API_BASE_URL } from "../js/config.js";

const DASHBOARD_SECTIONS_ENDPOINT = `${API_BASE_URL}/api/users/dashboard/sections/`;
const DASHBOARD_ACTIONS_ENDPOINT = `${API_BASE_URL}/api/users/dashboard/actions/`;

let authTokenCache = null;

function emitNotification(type, message) {
  const handlerName = type === "success" ? "showSuccess" : type === "info" ? "showInfo" : "showError";
  const handler = typeof window !== "undefined" ? window[handlerName] : undefined;
  if (typeof handler === "function") {
    handler(message);
    return;
  }
  if (type === "error") {
    console.error(message);
  } else {
    console.log(message);
  }
}

function ensureToken() {
  if (authTokenCache) {
    return authTokenCache;
  }
  const savedToken = localStorage.getItem("token") || localStorage.getItem("access_token");
  if (!savedToken) {
    emitNotification("error", "ابتدا وارد حساب کاربری شوید");
    window.location.href = "../register/login.html";
    return null;
  }
  authTokenCache = savedToken;
  return authTokenCache;
}

async function refreshToken() {
  const refreshValue = localStorage.getItem("refresh_token");
  if (!refreshValue) {
    throw new Error("Refresh token not found");
  }
  const response = await fetch(`${API_BASE_URL}/auth/jwt/refresh/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh: refreshValue })
  });
  if (!response.ok) {
    throw new Error("Failed to refresh token");
  }
  const data = await response.json();
  if (data?.access) {
    localStorage.setItem("token", data.access);
    localStorage.setItem("access_token", data.access);
    authTokenCache = data.access;
  }
}

async function fetchWithAuth(url, options = {}, retry = true) {
  const token = ensureToken();
  if (!token) {
    throw new Error("برای انجام این عملیات ابتدا وارد حساب کاربری شوید.");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (!(options.body instanceof FormData)) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 && retry) {
    try {
      await refreshToken();
      return fetchWithAuth(url, options, false);
    } catch (error) {
      localStorage.clear();
      window.location.href = "../register/login.html";
      throw error;
    }
  }

  return response;
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => {
        query.append(key, item);
      });
    } else {
      query.append(key, value);
    }
  });
  return query.toString();
}

async function requestJson(url, options = {}) {
  const response = await fetchWithAuth(url, options);
  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message || `درخواست با خطا مواجه شد (${response.status})`);
  }
  if (response.status === 204) {
    return {};
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const raw = await response.text();
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn("Unable to parse server response", error);
      return {};
    }
  }
  return response.json();
}

async function extractErrorMessage(response) {
  if (!response) {
    return "خطای ناشناخته رخ داد.";
  }
  try {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      if (typeof data === "string") {
        return data;
      }
      if (data?.detail) {
        return data.detail;
      }
      const messages = [];
      Object.values(data || {}).forEach((value) => {
        if (Array.isArray(value)) {
          value.forEach((item) => messages.push(String(item)));
        } else if (value && typeof value === "object") {
          Object.values(value).forEach((nested) => {
            if (Array.isArray(nested)) {
              nested.forEach((item) => messages.push(String(item)));
            } else if (nested) {
              messages.push(String(nested));
            }
          });
        } else if (value) {
          messages.push(String(value));
        }
      });
      if (messages.length) {
        return messages.join(" | ");
      }
    } else {
      const text = await response.text();
      if (text) {
        return text;
      }
    }
  } catch (error) {
    console.warn("Error parsing response", error);
  }
  return response.statusText || "خطای ناشناخته رخ داد.";
}

function resolveElement(target) {
  if (!target) {
    return null;
  }
  if (typeof target === "string") {
    if (target.startsWith("#")) {
      return document.getElementById(target.slice(1));
    }
    return document.querySelector(target);
  }
  if (target.target) {
    return resolveElement(target.target);
  }
  if (target.id) {
    return document.getElementById(target.id);
  }
  if (target.selector) {
    return document.querySelector(target.selector);
  }
  return null;
}

function applySectionInstruction(instruction) {
  const element = resolveElement(instruction);
  if (!element) {
    return;
  }

  if (instruction.replace) {
    element.outerHTML = instruction.replace;
    return;
  }

  if (instruction.html !== undefined) {
    element.innerHTML = instruction.html;
  }

  if (instruction.text !== undefined) {
    element.textContent = instruction.text;
  }

  if (instruction.value !== undefined) {
    element.value = instruction.value;
  }

  if (instruction.attributes) {
    Object.entries(instruction.attributes).forEach(([name, value]) => {
      if (value === null || value === undefined) {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, value);
      }
    });
  }

  if (instruction.dataset) {
    Object.entries(instruction.dataset).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        delete element.dataset[key];
      } else {
        element.dataset[key] = value;
      }
    });
  }

  if (instruction.append) {
    element.insertAdjacentHTML("beforeend", instruction.append);
  }

  if (instruction.prepend) {
    element.insertAdjacentHTML("afterbegin", instruction.prepend);
  }
}

function applyFieldValues(fields = {}) {
  Object.entries(fields).forEach(([selector, value]) => {
    const element = resolveElement(selector);
    if (!element) {
      return;
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      element.value = value ?? "";
    } else {
      element.textContent = value ?? "";
    }
  });
}

function applyStorageUpdates(storage = {}) {
  Object.entries(storage).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  });
}

function focusElement(target) {
  const element = resolveElement(target);
  if (element && typeof element.focus === "function") {
    element.focus();
  }
}

function toggleModal(modalTarget, open) {
  const modal = resolveElement(modalTarget);
  if (!modal) {
    return;
  }
  const shouldOpen = Boolean(open);
  modal.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
  modal.classList.toggle("is-open", shouldOpen);
  if (shouldOpen) {
    document.body.classList.add("modal-open");
  } else {
    const anyOpen = Array.from(document.querySelectorAll(".modal"))
      .some((item) => item.classList.contains("is-open"));
    if (!anyOpen) {
      document.body.classList.remove("modal-open");
    }
  }
}

function applyModalInstructions(modalInstructions = {}) {
  if (Array.isArray(modalInstructions.open)) {
    modalInstructions.open.forEach((target) => toggleModal(target, true));
  } else if (modalInstructions.open) {
    toggleModal(modalInstructions.open, true);
  }

  if (Array.isArray(modalInstructions.close)) {
    modalInstructions.close.forEach((target) => toggleModal(target, false));
  } else if (modalInstructions.close) {
    toggleModal(modalInstructions.close, false);
  }
}

function applyClassesInstructions(classes = []) {
  classes.forEach((instruction) => {
    const element = resolveElement(instruction);
    if (!element || !instruction.classes) {
      return;
    }
    const { add = [], remove = [] } = instruction.classes;
    add.forEach((className) => element.classList.add(className));
    remove.forEach((className) => element.classList.remove(className));
  });
}

function applyServerResponse(payload = {}) {
  if (Array.isArray(payload.sections)) {
    payload.sections.forEach((instruction) => applySectionInstruction(instruction));
  }

  if (payload.fields) {
    applyFieldValues(payload.fields);
  }

  if (payload.storage) {
    applyStorageUpdates(payload.storage);
  }

  if (payload.focus) {
    focusElement(payload.focus);
  }

  if (payload.modal) {
    applyModalInstructions(payload.modal);
  }

  if (Array.isArray(payload.classes)) {
    applyClassesInstructions(payload.classes);
  }

  if (payload.toast?.success) {
    emitNotification("success", payload.toast.success);
  }

  if (payload.toast?.error) {
    emitNotification("error", payload.toast.error);
  }

  if (payload.toast?.info) {
    emitNotification("info", payload.toast.info);
  }

  if (payload.redirect) {
    window.location.href = payload.redirect;
  }
}

function collectDatasetArguments(element, prefix) {
  const data = {};
  Array.from(element.attributes).forEach((attribute) => {
    if (!attribute.name.startsWith(prefix)) {
      return;
    }
    const key = attribute.name.replace(prefix, "").replace(/-(.)/g, (_, char) => char.toUpperCase());
    data[key] = attribute.value;
  });
  return data;
}

async function callDashboardAction(action, { method = "POST", body = null, query = {}, formData = null } = {}) {
  const normalizedMethod = method.toUpperCase();
  const actionQuery = { action, ...query };

  if (normalizedMethod === "GET" && formData instanceof FormData) {
    formData.forEach((value, key) => {
      actionQuery[key] = value;
    });
  }

  const queryString = buildQuery(actionQuery);
  const url = `${DASHBOARD_ACTIONS_ENDPOINT}?${queryString}`;
  const options = { method: normalizedMethod };

  if (normalizedMethod !== "GET") {
    if (formData instanceof FormData) {
      options.body = formData;
    } else if (body) {
      options.body = JSON.stringify(body);
      options.headers = { "Content-Type": "application/json" };
    }
  }

  return requestJson(url, options);
}

async function handleActionElement(element) {
  const action = element.dataset.dashboardAction || element.dataset.action;
  if (!action) {
    return;
  }

  const method = (element.dataset.method || "POST").toUpperCase();
  const query = collectDatasetArguments(element, "data-query-");
  const payload = collectDatasetArguments(element, "data-payload-");

  try {
    const response = await callDashboardAction(action, { method, body: payload, query });
    applyServerResponse(response);
  } catch (error) {
    emitNotification("error", error.message || "خطایی رخ داد");
  }
}

async function handleFormSubmit(form) {
  const action = form.dataset.dashboardAction || form.dataset.action;
  if (!action) {
    return;
  }

  const method = (form.method || form.dataset.method || "POST").toUpperCase();
  const query = collectDatasetArguments(form, "data-query-");
  const formData = new FormData(form);

  try {
    const response = await callDashboardAction(action, { method, query, formData });
    applyServerResponse(response);
  } catch (error) {
    emitNotification("error", error.message || "خطایی رخ داد");
  }
}

async function loadInitialSections() {
  const token = ensureToken();
  if (!token) {
    return;
  }

  const query = buildQuery({
    path: window.location.pathname,
    search: window.location.search
  });
  const url = `${DASHBOARD_SECTIONS_ENDPOINT}?${query}`;

  try {
    const payload = await requestJson(url, { method: "GET" });
    applyServerResponse(payload);
  } catch (error) {
    emitNotification("error", error.message || "خطا در بارگذاری داشبورد");
  }
}

function setupEventListeners() {
  document.addEventListener("click", (event) => {
    const closeTrigger = event.target.closest("[data-close-modal]");
    if (closeTrigger) {
      event.preventDefault();
      toggleModal(closeTrigger.closest(".modal"), false);
      return;
    }

    const actionTrigger = event.target.closest("[data-dashboard-action], [data-action]");
    if (actionTrigger) {
      event.preventDefault();
      handleActionElement(actionTrigger);
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("form[data-dashboard-action], form[data-action]");
    if (!form) {
      return;
    }
    event.preventDefault();
    handleFormSubmit(form);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  loadInitialSections();
});
