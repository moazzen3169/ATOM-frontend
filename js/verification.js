import { API_BASE_URL } from "../js/config.js";

const LEVEL_BENEFITS = {
  1: "دسترسی به امکانات عمومی",
  2: "افزایش سقف برداشت و امکانات مالی بیشتر",
  3: "دسترسی کامل به تمامی امکانات و برداشت‌های ویژه",
};

const SUMMARY_STATES = {
  success: {
    className: "status-success",
    icon: "https://unpkg.com/heroicons@2.0.18/24/solid/check.svg",
    alt: "وضعیت تایید شده",
  },
  pending: {
    className: "status-pending",
    icon: "https://unpkg.com/heroicons@2.0.18/24/solid/clock.svg",
    alt: "در حال بررسی",
  },
  info: {
    className: "status-info",
    icon: "https://unpkg.com/heroicons@2.0.18/24/solid/information-circle.svg",
    alt: "اطلاعات وضعیت",
  },
};

const BYTES_IN_MB = 1024 * 1024;

class VerificationPage {
  constructor() {
    this.dom = {
      overlay: document.querySelector(".overlay"),
      modals: {
        level2: document.querySelector(".level_2_modal"),
        level3: document.querySelector(".level_3_modal"),
        guide: document.querySelector(".nemuneh_modal"),
      },
      buttons: {
        level2: document.querySelector("#level-2-btn"),
        level3: document.querySelector("#level-3-btn"),
        guide: document.querySelector(".nemuneh"),
      },
      summary: {
        wrapper: document.querySelector(".your_level"),
        label: document.querySelector("[data-current-level-label]"),
        status: document.querySelector("[data-current-level-status]"),
        statusWrapper: document.querySelector("[data-current-level-status-wrapper]"),
        statusIcon: document.querySelector("[data-status-icon]"),
        benefits: document.querySelector("[data-current-level-benefits]"),
      },
      sections: {
        2: document.querySelector(".verification_level_2"),
        3: document.querySelector(".verification_level_3"),
      },
      sectionStatuses: {
        2: document
          .querySelector(".verification_level_2")
          ?.querySelector(".level_status"),
        3: document
          .querySelector(".verification_level_3")
          ?.querySelector(".level_status"),
      },
      forms: {
        level2: document.querySelector(".level_2_modal_form"),
        level3: document.querySelector(".level_3_modal_form"),
      },
      fileInfos: {
        level2Selfie: document.querySelector("#selfy_info"),
        level2IdCard: document.querySelector("#id_card_info"),
        level3Video: document.querySelector("#video_info"),
      },
      fileInputs: {
        level2Selfie: document.querySelector("#selfy_picture_level2"),
        level2IdCard: document.querySelector("#id_card"),
        level3Video: document.querySelector("#selfy_video_level3"),
      },
    };
const overlay = document.querySelector(".overlay");
const level2Modal = document.querySelector(".level_2_modal");
const level3Modal = document.querySelector(".level_3_modal");
const level2btn = document.querySelector("#level-2-btn");
const level3btn = document.querySelector("#level-3-btn");
const nemunehBtn = document.querySelector(".nemuneh");
const nemunehModal = document.querySelector(".nemuneh_modal");

const levelSummary = document.querySelector(".your_level");
const currentLevelLabel = document.querySelector("[data-current-level-label]");
const currentLevelStatus = document.querySelector("[data-current-level-status]");
const currentLevelStatusWrapper = document.querySelector("[data-current-level-status-wrapper]");
const currentLevelStatusIcon = document.querySelector("[data-status-icon]");
const currentLevelBenefits = document.querySelector("[data-current-level-benefits]");

const levelSections = {
  2: document.querySelector(".verification_level_2"),
  3: document.querySelector(".verification_level_3"),
};

const levelStatusElements = {
  2: levelSections[2]?.querySelector(".level_status"),
  3: levelSections[3]?.querySelector(".level_status"),
};

let userProfile = null;

const SUMMARY_STATE_CLASSES = ["status-success", "status-pending", "status-info"];
const SUMMARY_STATE_KEYS = ["success", "pending", "info"];
const SUMMARY_STATE_ICONS = {
  success: "https://unpkg.com/heroicons@2.0.18/24/solid/check.svg",
  pending: "https://unpkg.com/heroicons@2.0.18/24/solid/clock.svg",
  info: "https://unpkg.com/heroicons@2.0.18/24/solid/information-circle.svg",
};
const SUMMARY_STATE_ALT_TEXT = {
  success: "وضعیت تایید شده",
  pending: "وضعیت در حال بررسی",
  info: "اطلاعات سطح",
};
const LEVEL_BENEFITS = {
  1: "دسترسی به امکانات عمومی",
  2: "افزایش سقف برداشت و استفاده از امکانات مالی بیشتر",
  3: "دسترسی کامل به تمامی امکانات و برداشت‌های ویژه",
};

function openModal(modalElement, initializeFilesCallback) {
  if (overlay) {
    overlay.classList.remove("hidden");
  }
  if (modalElement) {
    modalElement.classList.remove("hidden");
  }
  if (typeof initializeFilesCallback === "function") {
    initializeFilesCallback();
  }
}

function closeAllModals() {
  [level2Modal, level3Modal, nemunehModal].forEach((modal) => {
    if (modal) {
      modal.classList.add("hidden");
    }
  });
  if (overlay) {
    overlay.classList.add("hidden");
  }
}

if (level2btn) {
  level2btn.addEventListener("click", () => {
    if (level2btn.disabled) return;
    openModal(level2Modal, initializeLevel2FileHandlers);
  });
}

if (level3btn) {
  level3btn.addEventListener("click", () => {
    if (level3btn.disabled) return;
    openModal(level3Modal, initializeLevel3FileHandlers);
  });
}

if (overlay) {
  overlay.addEventListener("click", closeAllModals);
}

if (nemunehBtn) {
  nemunehBtn.addEventListener("click", () => {
    openModal(nemunehModal);
  });
}

const level2Form = document.querySelector(".level_2_modal_form");
const level3Form = document.querySelector(".level_3_modal_form");

let level2HandlersInitialized = false;
let level3HandlersInitialized = false;
let authRedirectTriggered = false;

// نمایش سایز فایل انتخابی
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

    this.state = {
      token: null,
      profile: null,
      status: null,
    };
  }

  init() {
    if (!this.dom.summary.wrapper) {
      return;
    }

    this.state.token = this.ensureAuthenticated();
    if (!this.state.token) {
      return;
    }

    this.bindUI();
    this.bindForms();
    this.render();
    this.refresh();
  }

  ensureAuthenticated() {
    const token = localStorage.getItem("access_token");
    if (!token) {
      alert("برای دسترسی به احراز هویت ابتدا وارد حساب شوید.");
      window.location.href = "/register/login.html";
      return null;
    }
    return token;
  }

  bindUI() {
    const { overlay, modals, buttons } = this.dom;

    const openModal = (modal) => {
      if (!modal) return;
      overlay?.classList.remove("hidden");
      modal.classList.remove("hidden");
    };

    const closeAll = () => {
      overlay?.classList.add("hidden");
      Object.values(modals).forEach((modal) => modal?.classList.add("hidden"));
    };

    buttons.level2?.addEventListener("click", () => {
      if (!buttons.level2.disabled) {
        openModal(modals.level2);
      }
// مدیریت فایل‌های سطح 2
function initializeLevel2FileHandlers() {
  if (level2HandlersInitialized) return;

  const level2SelfieInput = document.querySelector("#selfy_picture_level2");
  const level2IdCardInput = document.querySelector("#id_card");
  const level2SelfieInfo = document.querySelector("#selfy_info");
  const level2IdCardInfo = document.querySelector("#id_card_info");

  if (level2SelfieInput) {
    level2SelfieInput.addEventListener("change", function () {
      handleFileSelection(this, level2SelfieInfo, 5);
    });

    buttons.level3?.addEventListener("click", () => {
      if (!buttons.level3.disabled) {
        openModal(modals.level3);
      }
    });

    buttons.guide?.addEventListener("click", () => openModal(modals.guide));

    overlay?.addEventListener("click", closeAll);

    document.querySelectorAll(".modal-close-btn").forEach((btn) => {
      btn.addEventListener("click", closeAll);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAll();
      }
    });

    this.closeAllModals = closeAll;
  }

  bindForms() {
    const { forms, fileInputs } = this.dom;

  level2HandlersInitialized = true;
}

// مدیریت فایل‌های سطح 3
function initializeLevel3FileHandlers() {
  if (level3HandlersInitialized) return;

  const level3VideoInput = document.querySelector("#selfy_video_level3");
  const level3VideoInfo = document.querySelector("#video_info");

    fileInputs.level2Selfie?.addEventListener("change", (event) => {
      this.updateFileInfo(event.target, this.dom.fileInfos.level2Selfie, 5);
    });

    fileInputs.level2IdCard?.addEventListener("change", (event) => {
      this.updateFileInfo(event.target, this.dom.fileInfos.level2IdCard, 5);
    });

    fileInputs.level3Video?.addEventListener("change", (event) => {
      this.updateFileInfo(event.target, this.dom.fileInfos.level3Video, 10);
    });

    forms.level2?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.submitLevel2(event.currentTarget);
    });

    forms.level3?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.submitLevel3(event.currentTarget);
    });
  }

  async refresh() {
    await this.loadProfile();
    await this.loadStatus();
    this.render();
  }

  async loadProfile() {
    const endpoints = [
      `${API_BASE_URL}/api/auth/users/me/`,
      `${API_BASE_URL}/api/auth/me/`,
      `${API_BASE_URL}/api/auth/user/`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.fetchJson(endpoint);
        if (response) {
          this.state.profile = response;
          return;
        }
      } catch (error) {
        console.warn("خطا در دریافت پروفایل", error);
      }
    }

    this.state.profile = null;
  }

  async loadStatus() {
    try {
      this.state.status = await this.fetchJson(
        `${API_BASE_URL}/api/verification/status/`
      );
    } catch (error) {
      console.error("خطا در دریافت وضعیت احراز هویت", error);
      this.state.status = null;
    }
  }

  async fetchJson(url, options = {}) {
    if (!this.state.token) return null;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.state.token}`,
        ...(options.headers || {}),
      },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("access_token");
      alert("نشست شما منقضی شده است. لطفا دوباره وارد شوید.");
      window.location.href = "/register/login.html";
      return null;
    }

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`خطای سرور (${response.status})`);
    }

    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error("امکان تجزیه JSON وجود ندارد", error);
      return null;
    }
  }

  render() {
    const verifiedLevel = this.getVerifiedLevel();
    this.updateSummary(verifiedLevel);
    this.updateSections(verifiedLevel);
  }

  getVerifiedLevel() {
    const rawLevel = this.state.profile?.verification_level;
    const parsed = Number(rawLevel);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 1;
    }
    return Math.min(parsed, 3);
  }

  updateSummary(verifiedLevel) {
    const { label, benefits, status, statusWrapper, statusIcon } =
      this.dom.summary;

    if (label) {
      label.textContent = this.state.profile
        ? `سطح ${verifiedLevel}`
        : "—";
    }

    if (benefits) {
      benefits.textContent = LEVEL_BENEFITS[verifiedLevel] || LEVEL_BENEFITS[1];
    }

    const summaryState = this.getSummaryState(verifiedLevel);

    if (statusWrapper) {
      statusWrapper.classList.remove(
        ...Object.values(SUMMARY_STATES).map((item) => item.className)
      );
      statusWrapper.classList.add(summaryState.className);
    }

  level3HandlersInitialized = true;
}

function ensureAuthenticated() {
  const token = localStorage.getItem("access_token");
  if (!token && !authRedirectTriggered) {
    authRedirectTriggered = true;
    alert("لطفا ابتدا وارد شوید.");
    window.location.href = "/register/login.html";
  }
  return token;
}

function handleUnauthorized() {
  if (authRedirectTriggered) return;
  authRedirectTriggered = true;
  localStorage.removeItem("access_token");
  alert("نشست شما منقضی شده است. لطفا مجددا وارد شوید.");
  window.location.href = "/register/login.html";
}

async function fetchJsonWithAuth(url, options = {}) {
  const token = ensureAuthenticated();
  if (!token) {
    return null;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (response.status === 401 || response.status === 403) {
    handleUnauthorized();
    return null;
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse JSON", error);
    return null;
  }
}

async function fetchUserProfile() {
  const endpoints = [
    `${API_BASE_URL}/api/auth/users/me/`,
    `${API_BASE_URL}/api/auth/me/`,
    `${API_BASE_URL}/api/auth/user/`,
  ];

  for (const endpoint of endpoints) {
    try {
      const data = await fetchJsonWithAuth(endpoint);
      if (data) {
        return data;
      }
    } catch (error) {
      console.warn(`Failed to fetch profile from ${endpoint}`, error);
    }
  }

  return null;
}

async function fetchVerificationStatus() {
  try {
    const data = await fetchJsonWithAuth(`${API_BASE_URL}/api/verification/status/`);
    updateUIBasedOnStatus(data || null);
  } catch (error) {
    console.error("Error while fetching verification status", error);
    if (currentLevelStatus) {
      currentLevelStatus.textContent = "خطا در دریافت وضعیت احراز هویت";
      setSummaryVisualState("info");
    }
  }
}

function normalizeLevel(levelValue) {
  const parsed = Number(levelValue);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(parsed, 3);
}

function setLevelStatus(level, state, text) {
  const statusElement = levelStatusElements[level];
  if (!statusElement) return;

  const classList = ["level_status", state].filter(Boolean).join(" ");
  statusElement.className = classList;
  statusElement.textContent = text;
}

function setSummaryVisualState(state) {
  if (!currentLevelStatusWrapper) return;

  SUMMARY_STATE_CLASSES.forEach((cls) => {
    currentLevelStatusWrapper.classList.remove(cls);
  });

  const normalizedState = SUMMARY_STATE_KEYS.includes(state) ? state : "info";

  currentLevelStatusWrapper.classList.add(`status-${normalizedState}`);

  if (currentLevelStatusIcon) {
    currentLevelStatusIcon.src =
      SUMMARY_STATE_ICONS[normalizedState] || SUMMARY_STATE_ICONS.info;
    currentLevelStatusIcon.alt =
      SUMMARY_STATE_ALT_TEXT[normalizedState] || SUMMARY_STATE_ALT_TEXT.info;
  }
}

function toggleSectionAvailability(level, options = {}) {
  const section = levelSections[level];
  const button = level === 2 ? level2btn : level3btn;
  if (!section || !button) return;

  const { disabled = false, hidden = false } = options;
  button.disabled = disabled || hidden;
  const ariaDisabled = hidden || disabled ? "true" : "false";
  button.setAttribute("aria-disabled", ariaDisabled);
  button.classList.toggle("hidden", hidden);
  section.classList.toggle("section-disabled", disabled && !hidden);
}

function updateCurrentLevelSummary(verifiedLevel, statusData) {
  if (!levelSummary) return;

  if (!userProfile) {
    if (currentLevelLabel) {
      currentLevelLabel.textContent = "—";
    }
    if (currentLevelBenefits) {
      currentLevelBenefits.textContent = LEVEL_BENEFITS[1];
    }
    if (currentLevelStatus) {
      currentLevelStatus.textContent = "برای مشاهده وضعیت لطفا دوباره تلاش کنید";
    }
    setSummaryVisualState("info");
    return;
  }

  if (currentLevelLabel) {
    currentLevelLabel.textContent = `سطح ${verifiedLevel}`;
  }

  if (currentLevelBenefits) {
    currentLevelBenefits.textContent =
      LEVEL_BENEFITS[verifiedLevel] || LEVEL_BENEFITS[1];
  }

  if (!currentLevelStatus) return;

  if (statusData && !statusData.is_verified && statusData.level) {
    currentLevelStatus.textContent = `در حال بررسی سطح ${statusData.level}`;
    setSummaryVisualState("pending");
  } else if (verifiedLevel >= 3) {
    currentLevelStatus.textContent = "تمامی سطوح تایید شده";
    setSummaryVisualState("success");
  } else {
    currentLevelStatus.textContent = "سطح فعلی تایید شده";
    setSummaryVisualState("success");
  }
}

function updateUIBasedOnStatus(statusData) {
  const verifiedLevel = normalizeLevel(userProfile?.verification_level ?? 1);

  const hasPendingLevel2 = statusData && statusData.level === 2 && !statusData.is_verified;
  const hasPendingLevel3 = statusData && statusData.level === 3 && !statusData.is_verified;

  setLevelStatus(2, "not_accepted", "تکمیل نشده");
  setLevelStatus(3, "not_accepted", "تکمیل نشده");

  if (verifiedLevel >= 2) {
    setLevelStatus(2, "accepted", "تایید شده");
  }

  if (verifiedLevel >= 3) {
    setLevelStatus(3, "accepted", "تایید شده");
  }

  if (statusData?.level === 2 && statusData.is_verified) {
    setLevelStatus(2, "accepted", "تایید شده");
  }

  if (statusData?.level === 3 && statusData.is_verified) {
    setLevelStatus(3, "accepted", "تایید شده");
  }

  if (hasPendingLevel2) {
    setLevelStatus(2, "pending", "در حال بررسی");
  }

  if (hasPendingLevel3) {
    setLevelStatus(3, "pending", "در حال بررسی");
  }

  updateCurrentLevelSummary(verifiedLevel, statusData);

  toggleSectionAvailability(2, { disabled: true, hidden: false });
  toggleSectionAvailability(3, { disabled: true, hidden: false });

  if (verifiedLevel === 1) {
    toggleSectionAvailability(2, { disabled: hasPendingLevel2 });
    toggleSectionAvailability(3, { disabled: hasPendingLevel3 });
  } else if (verifiedLevel === 2) {
    toggleSectionAvailability(3, { disabled: hasPendingLevel3 });
  } else if (verifiedLevel >= 3) {
    toggleSectionAvailability(2, { hidden: true });
    toggleSectionAvailability(3, { hidden: true });
  }
}

async function submitLevel2(formEvent) {
  formEvent.preventDefault();

  const idCardInput = document.querySelector("#id_card");
  const selfieInput = document.querySelector("#selfy_picture_level2");

    if (statusIcon) {
      statusIcon.src = summaryState.icon;
      statusIcon.alt = summaryState.alt;
    }

    if (status) {
      status.textContent = summaryState.text;
    }
  }

  getSummaryState(verifiedLevel) {
    const currentStatus = this.state.status;
    if (!this.state.profile) {
      return {
        ...SUMMARY_STATES.info,
        text: "خطا در دریافت اطلاعات کاربر",
      };
    }

    if (currentStatus && !currentStatus.is_verified && currentStatus.level) {
      return {
        ...SUMMARY_STATES.pending,
        text: `در حال بررسی سطح ${currentStatus.level}`,
      };
    }
  const idCardFile = idCardInput.files?.[0];
  const selfieFile = selfieInput.files?.[0];

    if (verifiedLevel >= 3) {
      return {
        ...SUMMARY_STATES.success,
        text: "تمامی سطوح تایید شده",
      };
    }

    return {
      ...SUMMARY_STATES.success,
      text: "سطح فعلی تایید شده",
    };
  }

  updateSections(verifiedLevel) {
    const pendingLevel =
      this.state.status && !this.state.status.is_verified
        ? Number(this.state.status.level)
        : null;

    this.updateSection(2, {
      verified: verifiedLevel >= 2,
      pending: pendingLevel === 2,
      canRequest:
        verifiedLevel === 1 && (pendingLevel === null || pendingLevel !== 2),
    });

    this.updateSection(3, {
      verified: verifiedLevel >= 3,
      pending: pendingLevel === 3,
      canRequest:
        verifiedLevel >= 2 && verifiedLevel < 3 && pendingLevel !== 3,
    });
  }

  updateSection(level, state) {
    const section = this.dom.sections[level];
    const statusElement = this.dom.sectionStatuses[level];
    const triggerButton =
      level === 2 ? this.dom.buttons.level2 : this.dom.buttons.level3;

    if (!section || !statusElement || !triggerButton) {
      return;
    }

    section.classList.remove("section-disabled");
    triggerButton.classList.remove("hidden");
    triggerButton.disabled = false;

    if (state.verified) {
      statusElement.className = "level_status accepted";
      statusElement.textContent = "تایید شده";
      triggerButton.classList.add("hidden");
      triggerButton.disabled = true;
      triggerButton.setAttribute("aria-disabled", "true");
      return;
    }

    if (state.pending) {
      statusElement.className = "level_status pending";
      statusElement.textContent = "در حال بررسی";
      triggerButton.disabled = true;
      triggerButton.setAttribute("aria-disabled", "true");
      section.classList.add("section-disabled");
      return;
    }

    if (state.canRequest) {
      statusElement.className = "level_status not_accepted";
      statusElement.textContent = "تکمیل نشده";
      triggerButton.disabled = false;
      triggerButton.setAttribute("aria-disabled", "false");
      return;
    }

    statusElement.className = "level_status not_accepted";
    statusElement.textContent = "غیر فعال";
    triggerButton.disabled = true;
    triggerButton.setAttribute("aria-disabled", "true");
    section.classList.add("section-disabled");
  }

  updateFileInfo(input, infoContainer, maxSizeMb) {
    if (!infoContainer || !(input instanceof HTMLInputElement)) {
      return;
    }

    const file = input.files?.[0];
    if (!file) {
      infoContainer.textContent = "";
      return;
    }

    const limitBytes = maxSizeMb * BYTES_IN_MB;
    if (file.size > limitBytes) {
      infoContainer.innerHTML = `<span style="color: red;">حجم فایل بیش از ${maxSizeMb} مگابایت است</span>`;
      input.value = "";
      return;
    }

    infoContainer.textContent = `حجم فایل: ${this.formatFileSize(
      file.size
    )} | ${file.name}`;
  }
  const submitButton = formEvent.submitter || formEvent.target.querySelector(".submit-btn");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.dataset.originalText = submitButton.textContent;
    submitButton.textContent = "در حال ارسال...";
  }

  const formData = new FormData();
  formData.append("id_card_image", idCardFile);
  formData.append("selfie_image", selfieFile);

  try {
    const token = ensureAuthenticated();
    if (!token) return;

    const response = await fetch(`${API_BASE_URL}/api/verification/submit_level2/`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
      },
      body: formData,
    });

    if (response.status === 401 || response.status === 403) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      throw new Error(`ارسال مدارک سطح 2 ناموفق بود (${response.status})`);
    }

    alert("مدارک سطح 2 ارسال شد. در حال بررسی...");
    closeAllModals();
    await fetchVerificationStatus();
  } catch (error) {
    console.error(error);
    alert("در ارسال مدارک سطح 2 خطایی رخ داد. لطفا دوباره تلاش کنید.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      if (submitButton.dataset.originalText) {
        submitButton.textContent = submitButton.dataset.originalText;
        delete submitButton.dataset.originalText;
      }
    }
  }
}

async function submitLevel3(formEvent) {
  formEvent.preventDefault();

  const videoInput = document.querySelector("#selfy_video_level3");

  formatFileSize(bytes) {
    if (!bytes) return "0 Bytes";
    const units = ["Bytes", "KB", "MB", "GB"];
    const index = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(2)} ${units[index]}`;
  }

  async submitLevel2(form) {
    const selfieInput = this.dom.fileInputs.level2Selfie;
    const idCardInput = this.dom.fileInputs.level2IdCard;

    if (!selfieInput || !idCardInput) {
      alert("خطا در دسترسی به فیلدها. لطفا صفحه را بازنشانی کنید.");
      return;
    }

    const selfie = selfieInput.files?.[0];
    const idCard = idCardInput.files?.[0];

    if (!selfie || !idCard) {
      alert("لطفا هر دو فایل را انتخاب کنید.");
      return;
    }

    const submitButton = form.querySelector(".submit-btn");
    this.setButtonLoading(submitButton, true);

    const formData = new FormData();
    formData.append("selfie_image", selfie);
    formData.append("id_card_image", idCard);

    try {
      await this.uploadDocuments(
        `${API_BASE_URL}/api/verification/submit_level2/`,
        formData
      );
      alert("مدارک سطح ۲ با موفقیت ارسال شد.");
      this.closeAllModals?.();
      selfieInput.value = "";
      idCardInput.value = "";
      this.dom.fileInfos.level2Selfie &&
        (this.dom.fileInfos.level2Selfie.textContent = "");
      this.dom.fileInfos.level2IdCard &&
        (this.dom.fileInfos.level2IdCard.textContent = "");
      await this.loadStatus();
      await this.loadProfile();
      this.render();
    } catch (error) {
      console.error("ارسال مدارک سطح ۲ ناموفق بود", error);
      alert("در ارسال مدارک سطح ۲ خطایی رخ داد. لطفا دوباره تلاش کنید.");
    } finally {
      this.setButtonLoading(submitButton, false);
    }
  }

  async submitLevel3(form) {
    const videoInput = this.dom.fileInputs.level3Video;

    if (!videoInput) {
      alert("خطا در دسترسی به فیلد ویدیو. لطفا صفحه را بازنشانی کنید.");
      return;
    }

    const video = videoInput.files?.[0];
    if (!video) {
      alert("لطفا ویدیو را انتخاب کنید.");
      return;
    }

    const submitButton = form.querySelector(".submit-btn");
    this.setButtonLoading(submitButton, true);

    const formData = new FormData();
    formData.append("video", video);

    try {
      await this.uploadDocuments(
        `${API_BASE_URL}/api/verification/submit_level3/`,
        formData
      );
      alert("مدارک سطح ۳ با موفقیت ارسال شد.");
      this.closeAllModals?.();
      videoInput.value = "";
      this.dom.fileInfos.level3Video &&
        (this.dom.fileInfos.level3Video.textContent = "");
      await this.loadStatus();
      await this.loadProfile();
      this.render();
    } catch (error) {
      console.error("ارسال مدارک سطح ۳ ناموفق بود", error);
      alert("در ارسال مدارک سطح ۳ خطایی رخ داد. لطفا دوباره تلاش کنید.");
    } finally {
      this.setButtonLoading(submitButton, false);
    }
  }

  async uploadDocuments(url, body) {
    if (!this.state.token) return;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.state.token}`,
  const videoFile = videoInput.files?.[0];
  if (!videoFile) {
    alert("لطفا ویدیو را انتخاب کنید.");
    return;
  }

  const submitButton = formEvent.submitter || formEvent.target.querySelector(".submit-btn");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.dataset.originalText = submitButton.textContent;
    submitButton.textContent = "در حال ارسال...";
  }

  const formData = new FormData();
  formData.append("video", videoFile);

  try {
    const token = ensureAuthenticated();
    if (!token) return;

    const response = await fetch(`${API_BASE_URL}/api/verification/submit_level3/`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
      },
      body,
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("access_token");
      alert("نشست شما منقضی شده است. لطفا دوباره وارد شوید.");
      window.location.href = "/register/login.html";
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      const message = await this.extractErrorMessage(response);
      throw new Error(message);
    }

    return response;
  }

  async extractErrorMessage(response) {
    const text = await response.text();
    if (!text) {
      return `خطای ناشناخته (${response.status})`;
    }

    try {
      const data = JSON.parse(text);
      return (
        data?.detail ||
        data?.message ||
        (typeof data === "string" ? data : `خطای ناشناخته (${response.status})`)
      );
    } catch (error) {
      return text;
    }
  }

  setButtonLoading(button, isLoading) {
    if (!button) return;
    if (isLoading) {
      button.disabled = true;
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent || "";
      }
      button.textContent = "در حال ارسال...";
    } else {
      button.disabled = false;
      if (button.dataset.originalText !== undefined) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }
}

new VerificationPage().init();
      throw new Error(`ارسال مدارک سطح 3 ناموفق بود (${response.status})`);
    }

    alert("مدارک سطح 3 ارسال شد. در حال بررسی...");
    closeAllModals();
    await fetchVerificationStatus();
  } catch (error) {
    console.error(error);
    alert("در ارسال مدارک سطح 3 خطایی رخ داد. لطفا دوباره تلاش کنید.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      if (submitButton.dataset.originalText) {
        submitButton.textContent = submitButton.dataset.originalText;
        delete submitButton.dataset.originalText;
      }
    }
  }
}

if (level2Form) {
  level2Form.addEventListener("submit", submitLevel2);
}

if (level3Form) {
  level3Form.addEventListener("submit", submitLevel3);
}

async function initializeVerificationPage() {
  setSummaryVisualState("info");
  userProfile = await fetchUserProfile();
  updateUIBasedOnStatus(null);
  await fetchVerificationStatus();
}

initializeVerificationPage();
