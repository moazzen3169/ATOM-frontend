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
      },
      body,
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("access_token");
      alert("نشست شما منقضی شده است. لطفا دوباره وارد شوید.");
      window.location.href = "/register/login.html";
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
