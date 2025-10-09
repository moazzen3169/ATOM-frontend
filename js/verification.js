import { API_BASE_URL } from "../js/config.js";

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

function handleFileSelection(input, infoDiv, maxSizeMB) {
  const file = input.files[0];
  if (file) {
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      infoDiv.innerHTML = `<span style="color: red;">حجم فایل بیش از حد مجاز است (${maxSizeMB}MB)</span>`;
      input.value = "";
    } else {
      infoDiv.innerHTML = `حجم فایل: ${formatFileSize(file.size)} | ${file.name}`;
    }
  }
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
  }
  if (level2IdCardInput) {
    level2IdCardInput.addEventListener("change", function () {
      handleFileSelection(this, level2IdCardInfo, 5);
    });
  }

  level2HandlersInitialized = true;
}

// مدیریت فایل‌های سطح 3
function initializeLevel3FileHandlers() {
  if (level3HandlersInitialized) return;

  const level3VideoInput = document.querySelector("#selfy_video_level3");
  const level3VideoInfo = document.querySelector("#video_info");

  if (level3VideoInput) {
    level3VideoInput.addEventListener("change", function () {
      handleFileSelection(this, level3VideoInfo, 10);
    });
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

  if (!idCardInput || !selfieInput) {
    alert("خطا: عناصر فرم یافت نشد. لطفا صفحه را مجددا بارگذاری کنید.");
    return;
  }

  const idCardFile = idCardInput.files?.[0];
  const selfieFile = selfieInput.files?.[0];

  if (!idCardFile || !selfieFile) {
    alert("لطفا هر دو فایل را انتخاب کنید.");
    return;
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

  if (!videoInput) {
    alert("خطا: عنصر ویدیو یافت نشد. لطفا صفحه را مجددا بارگذاری کنید.");
    return;
  }

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
      body: formData,
    });

    if (response.status === 401 || response.status === 403) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
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
