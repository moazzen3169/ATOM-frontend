import { API_BASE_URL } from "../config.js";

const verificationsList = document.getElementById("verifications-list");
const dateFilterSelect = document.getElementById("verification-date-filter");
const statusFilterSelect = document.getElementById("verification-status-filter");
const refreshButton = document.getElementById("verification-refresh");

const STATE = {
  all: [],
  filtered: [],
  filters: {
    date: dateFilterSelect?.value || "all",
    status: statusFilterSelect?.value || "all",
  },
  loading: false,
};

const DATE_FILTERS = {
  all: () => true,
  today: (date) => isSameDay(date, new Date()),
  last7: (date) => isWithinDays(date, 7),
  last30: (date) => isWithinDays(date, 30),
  last90: (date) => isWithinDays(date, 90),
};

const STATUS_MAP = {
  pending: {
    key: "pending",
    label: "در انتظار بررسی",
    className: "status-badge--pending",
  },
  approved: {
    key: "approved",
    label: "تایید شده",
    className: "status-badge--approved",
  },
  rejected: {
    key: "rejected",
    label: "رد شده",
    className: "status-badge--rejected",
  },
};

const SKIP_DETAIL_KEYS = new Set([
  "id",
  "pk",
  "uuid",
  "level",
  "status",
  "created_at",
  "createdAt",
  "updated_at",
  "updatedAt",
  "is_verified",
  "is_rejected",
  "user",
  "user_info",
  "userData",
  "documents",
  "files",
  "attachments",
  "reason",
  "rejection_reason",
  "reviewer_note",
  "admin_note",
  "notes",
]);

class AdminVerificationPage {
  constructor() {
    this.dom = {
      list: document.getElementById("verifications-list"),
      dateFilter: document.getElementById("verification-date-filter"),
      statusFilter: document.getElementById("verification-status-filter"),
      refreshButton: document.getElementById("verification-refresh"),
    };

    this.state = {
      token: null,
      requests: [],
      filtered: [],
      filters: {
        date: this.dom.dateFilter?.value || "all",
        status: this.dom.statusFilter?.value || "all",
      },
    };
  }

  init() {
    if (!this.dom.list) return;

    this.state.token = this.ensureAuthenticated();
    if (!this.state.token) return;

    this.bindUI();
    this.refresh();
  }

  ensureAuthenticated() {
    const token = localStorage.getItem("access_token");
    if (!token) {
      alert("برای مشاهده درخواست‌ها ابتدا وارد شوید.");
      window.location.href = "/register/login.html";
      return null;
    }
    return token;
  }

  bindUI() {
    this.dom.dateFilter?.addEventListener("change", (event) => {
      this.state.filters.date = event.target.value;
      this.applyFilters();
    });

    this.dom.statusFilter?.addEventListener("change", (event) => {
      this.state.filters.status = event.target.value;
      this.applyFilters();
    });

    this.dom.refreshButton?.addEventListener("click", () => {
      this.refresh();
    });

    this.dom.list.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.dataset.action;
      const id = target.dataset.id;
      if (!action || !id) return;
      if (action === "approve") {
        this.handleApprove(id, target);
      } else if (action === "reject") {
        this.handleReject(id, target);
      }
    });
  }

  async refresh() {
    this.setLoading("در حال بارگذاری درخواست‌ها...");
    try {
      const data = await this.fetchVerifications();
      this.state.requests = data.map((item) => this.normalizeRequest(item));
      this.applyFilters();
    } catch (error) {
      console.error("خطا در دریافت درخواست‌ها", error);
      this.showError("خطا در دریافت درخواست‌ها. لطفا دوباره تلاش کنید.");
    }
  }

  async fetchVerifications() {
    const response = await fetch(`${API_BASE_URL}/api/verification/list_all/`, {
      headers: {
        Authorization: `Bearer ${this.state.token}`,

const STATUS_METADATA = {
  pending: {
    label: "در انتظار بررسی",
    className: "status-badge--pending",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m3.75 0a8.25 8.25 0 11-16.5 0 8.25 8.25 0 0116.5 0z" /></svg>`,
  },
  approved: {
    label: "تایید شده",
    className: "status-badge--approved",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>`,
  },
  rejected: {
    label: "رد شده",
    className: "status-badge--rejected",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 9l-6 6m0-6l6 6" /></svg>`,
  },
};

const SKIP_DETAIL_KEYS = new Set([
  "id",
  "level",
  "status",
  "created_at",
  "updated_at",
  "is_verified",
  "is_rejected",
  "user",
  "user_info",
  "documents",
  "files",
  "attachments",
  "rejection_reason",
  "reviewer_note",
  "reviewed_at",
  "admin_note",
  "reason",
  "reason_message",
  "reason_text",
]);

function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isWithinDays(date, days) {
  if (!date) return false;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const threshold = days * 24 * 60 * 60 * 1000;
  return diff <= threshold && diff >= 0;
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "نامشخص";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch (error) {
    return date.toLocaleString("fa-IR");
  }
}

function formatLabel(label) {
  if (!label) return "";
  return label
    .toString()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getAccessToken() {
  const accessToken = localStorage.getItem("access_token");
  if (!accessToken) {
    alert("لطفا ابتدا وارد شوید.");
    window.location.href = "/register/login.html";
    return null;
  }
  return accessToken;
}

function setLoading(isLoading) {
  STATE.loading = isLoading;
  if (!verificationsList) return;
  if (isLoading) {
    verificationsList.innerHTML =
      '<div class="verifications-list__message">در حال بارگذاری درخواست‌ها...</div>';
  }
}

async function fetchAllVerifications() {
  if (!verificationsList) return;
  try {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    const response = await fetch(`${API_BASE_URL}/api/verification/list_all/`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("access_token");
      alert("نشست شما منقضی شده است. لطفا دوباره وارد شوید.");
      window.location.href = "/register/login.html";
      return [];
    }

    if (!response.ok) {
      const message = await this.extractErrorMessage(response);
      throw new Error(message);
    }

    const json = await response.json();
    return Array.isArray(json) ? json : [];
  }

  applyFilters() {
    const { date, status } = this.state.filters;
    this.state.filtered = this.state.requests.filter((request) => {
      const dateMatch = DATE_FILTERS[date]
        ? DATE_FILTERS[date](request.createdAt)
        : true;
      const statusMatch =
        status === "all" || !status
          ? true
          : request.status.key === status;
      return dateMatch && statusMatch;
    });
    this.render();
  }

  render() {
    if (!this.dom.list) return;

    if (!this.state.filtered.length) {
      this.dom.list.innerHTML =
        '<div class="verifications-list__message">درخواستی برای نمایش وجود ندارد.</div>';
      return;
    }

    this.dom.list.innerHTML = "";
    this.state.filtered.forEach((request) => {
      const article = document.createElement("article");
      article.className = "verification-card";
      article.innerHTML = this.buildCardMarkup(request);
      this.dom.list.appendChild(article);
    });
  }

  buildCardMarkup(request) {
    const statusBadge = `<span class="status-badge ${request.status.className}">${this.escapeHtml(
      request.status.label
    )}</span>`;

    const userSection = this.buildUserSection(request.user);
    const infoSection = this.buildInfoSection(request);
    const extraSection = this.buildExtraSection(request.extraFields);
    const documentsSection = this.buildDocumentsSection(request.documents);
    const notesSection = this.buildNotesSection(request.notes);
    const rawSection = this.buildRawDataSection(request.raw);

    const actions = this.buildActions(request);

    return `
      <header class="verification-card__header">
        <div>
          <h3 class="verification-card__title">درخواست سطح ${this.escapeHtml(
            request.level
          )}</h3>
          <p class="verification-card__subtitle">ارسال شده در ${this.escapeHtml(
            request.createdAtText
          )}</p>
        </div>
        ${statusBadge}
      </header>
      <div class="verification-card__body">
        ${userSection}
        ${infoSection}
        ${extraSection}
        ${documentsSection}
        ${notesSection}
        ${rawSection}
      </div>
      ${actions}
    `;
  }

  buildUserSection(user) {
    if (!user) return "";
    const fullName = user.fullName || "بدون نام";
    const username = user.username ? `@${user.username}` : "-";

    const contactItems = [
      user.email && `<li><span>ایمیل:</span><span>${this.escapeHtml(user.email)}</span></li>`,
      user.phone && `<li><span>شماره:</span><span>${this.escapeHtml(user.phone)}</span></li>`,
    ]
      .filter(Boolean)
      .join("");

    return `
      <section class="verification-card__section">
        <h3>اطلاعات کاربر</h3>
        <ul class="verification-card__list">
          <li><span>نام:</span><span>${this.escapeHtml(fullName)}</span></li>
          <li><span>نام کاربری:</span><span>${this.escapeHtml(username)}</span></li>
          ${contactItems}
        </ul>
      </section>
    `;
  }

  buildInfoSection(request) {
    const submittedAt = request.createdAtText || "نامشخص";
    const details = [
      `<li><span>سطح درخواستی:</span><span>${this.escapeHtml(
        request.level
      )}</span></li>`,
      `<li><span>وضعیت:</span><span>${this.escapeHtml(
        request.status.label
      )}</span></li>`,
      `<li><span>تاریخ ارسال:</span><span>${this.escapeHtml(
        submittedAt
      )}</span></li>`,
    ].join("");

    return `
      <section class="verification-card__section">
        <h3>جزئیات درخواست</h3>
        <ul class="verification-card__list">
          ${details}
        </ul>
      </section>
    `;
  }

  buildExtraSection(extraFields) {
    if (!extraFields.length) return "";
    const items = extraFields
      .map(
        (field) =>
          `<li><span>${this.escapeHtml(field.label)}:</span><span>${this.escapeHtml(
            field.value
          )}</span></li>`
      )
      .join("");

    return `
      <section class="verification-card__section">
        <h3>اطلاعات تکمیلی</h3>
        <ul class="verification-card__list">
          ${items}
        </ul>
      </section>
    `;
  }

  buildDocumentsSection(documents) {
    if (!documents.length) return "";

    const items = documents
      .map((doc, index) => {
        const thumbnail = doc.isImage
          ? `<img src="${this.escapeHtml(doc.url)}" alt="مدرک ${index + 1}" />`
          : "";
        const linkLabel = doc.isImage ? "مشاهده در اندازه کامل" : "دانلود";
        return `
          <div class="verification-card__document">
            <div class="verification-card__document-header">
              <span class="verification-card__document-title">${this.escapeHtml(
                doc.label
              )}</span>
              <a href="${this.escapeHtml(doc.url)}" target="_blank" rel="noopener" class="verification-card__document-link">${linkLabel}</a>
            </div>
            ${thumbnail}
          </div>
        `;
      })
      .join("");

    return `
      <section class="verification-card__section">
        <h3>مدارک ارسال شده</h3>
        <div class="verification-card__documents">${items}</div>
      </section>
    `;
  }

  buildNotesSection(notes) {
    const entries = [];
    if (notes.reviewerNote) {
      entries.push({ label: "یادداشت کارشناس", value: notes.reviewerNote });
    }
    if (notes.adminNote) {
      entries.push({ label: "یادداشت ادمین", value: notes.adminNote });
    }
    if (notes.rejectionReason) {
      entries.push({ label: "دلیل رد", value: notes.rejectionReason });
    }

    if (!entries.length) return "";

    const items = entries
      .map(
        (item) =>
          `<li><span>${this.escapeHtml(item.label)}:</span><span>${this.escapeHtml(
            item.value
          )}</span></li>`
      )
      .join("");

    return `
      <section class="verification-card__section">
        <h3>یادداشت‌ها</h3>
        <ul class="verification-card__list">
          ${items}
        </ul>
      </section>
    `;
  }

  buildRawDataSection(raw) {
    if (!raw || typeof raw !== "object") return "";
    return `
      <section class="verification-card__section">
        <details>
          <summary>جزئیات کامل (JSON)</summary>
          <pre class="verification-card__raw">${this.escapeHtml(
            JSON.stringify(raw, null, 2)
          )}</pre>
        </details>
      </section>
    `;
  }

  buildActions(request) {
    if (request.status.key !== "pending") {
      return "";
    }

    return `
      <div class="verification-card__actions">
        <button type="button" data-action="approve" data-id="${this.escapeHtml(
          request.id
        )}" class="approve-action">تایید</button>
        <button type="button" data-action="reject" data-id="${this.escapeHtml(
          request.id
        )}" class="reject-action">رد</button>
      </div>
    `;
  }

  async handleApprove(id, button) {
    if (!id) return;
    if (!confirm("آیا از تایید این درخواست مطمئن هستید؟")) return;

    this.setActionLoading(button, true);
    try {
      await this.postAction(id, "approve", {
        is_verified: true,
        status: "approved",
      });
      alert("درخواست با موفقیت تایید شد.");
      await this.refresh();
    } catch (error) {
      console.error("Approve verification failed", error);
      alert(`خطا در تایید درخواست: ${error.message}`);
    } finally {
      this.setActionLoading(button, false);
    }
  }

  async handleReject(id, button) {
    if (!id) return;
    const reason = prompt("دلیل رد درخواست را وارد کنید (اختیاری)", "");
    if (reason === null) return;

    this.setActionLoading(button, true);
    try {
      const payload = {
        is_verified: false,
        status: "rejected",
      };
      if (reason) {
        payload.reason = reason;
        payload.rejection_reason = reason;
      }
      await this.postAction(id, "reject", payload);
      alert("درخواست با موفقیت رد شد.");
      await this.refresh();
    } catch (error) {
      console.error("Reject verification failed", error);
      alert(`خطا در رد درخواست: ${error.message}`);
    } finally {
      this.setActionLoading(button, false);
    }
  }

  async postAction(id, action, payload) {
    const response = await fetch(
      `${API_BASE_URL}/api/verification/${id}/${action}/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.state.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

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
  }

  normalizeRequest(raw) {
    const createdAt = parseDate(
      raw?.created_at || raw?.createdAt || raw?.submitted_at || raw?.date
    );
    const status = this.normalizeStatus(raw);
    return {
      id: String(raw?.id ?? raw?.pk ?? raw?.uuid ?? ""),
      raw,
      level: raw?.level ?? raw?.requested_level ?? raw?.target_level ?? "-",
      createdAt,
      createdAtText: formatDate(createdAt),
      status,
      user: this.extractUser(raw?.user, raw?.user_info),
      documents: this.normalizeDocuments(raw),
      notes: {
        reviewerNote: raw?.reviewer_note || raw?.note || "",
        adminNote: raw?.admin_note || "",
        rejectionReason: raw?.rejection_reason || raw?.reason || "",
      },
      extraFields: this.collectExtraFields(raw),
    };
  }

  normalizeStatus(raw) {
    const rawStatus = (raw?.status || "").toString().toLowerCase();
    let key = "pending";

    if (["approved", "accept", "accepted", "verified"].includes(rawStatus)) {
      key = "approved";
    } else if (
      ["rejected", "declined", "failed", "denied"].includes(rawStatus)
    ) {
      key = "rejected";
    } else if (
      ["pending", "in_review", "processing", "under_review"].includes(
        rawStatus
      )
    ) {
      key = "pending";
    } else if (raw?.is_verified === true) {
      key = "approved";
    } else if (raw?.is_rejected === true) {
      key = "rejected";
    }

    return STATUS_MAP[key] || STATUS_MAP.pending;
  }

  extractUser(user, userInfo) {
    if (!user && !userInfo) return null;

    const primary = typeof userInfo === "object" && userInfo ? userInfo : {};
    const fallback = typeof user === "object" && user ? user : {};

    const firstName = primary.first_name || fallback.first_name || "";
    const lastName = primary.last_name || fallback.last_name || "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    return {
      fullName,
      username: primary.username || fallback.username || fallback.user?.username || "",
      email: primary.email || fallback.email || fallback.user?.email || "",
      phone:
        primary.phone ||
        primary.phone_number ||
        fallback.phone ||
        fallback.phone_number ||
        "",
    };
  }

  normalizeDocuments(raw) {
    const sources = [];
    if (Array.isArray(raw?.documents)) sources.push(...raw.documents);
    if (Array.isArray(raw?.files)) sources.push(...raw.files);
    if (Array.isArray(raw?.attachments)) sources.push(...raw.attachments);

    return sources
      .map((item, index) => {
        if (!item) return null;
        if (typeof item === "string") {
          return {
            label: `مدرک ${index + 1}`,
            url: item,
            isImage: isImageUrl(item),
          };
        }
        const url =
          item.url || item.file || item.path || item.document || item.link;
        if (!url) return null;
        return {
          label:
            item.document_type ||
            item.type ||
            item.label ||
            `مدرک ${index + 1}`,
          url,
          isImage: isImageUrl(url),
        };
      })
      .filter(Boolean);
  }

  collectExtraFields(raw) {
    if (!raw || typeof raw !== "object") return [];
    return Object.entries(raw)
      .filter(([key, value]) => {
        if (SKIP_DETAIL_KEYS.has(key)) return false;
        if (value === null || value === undefined) return false;
        if (typeof value === "object") return false;
        return true;
      })
      .map(([key, value]) => ({
        label: this.formatLabel(key),
        value: String(value),
      }));
  }

  formatLabel(label) {
    return label
      .toString()
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  setLoading(message) {
    if (!this.dom.list) return;
    this.dom.list.innerHTML = `<div class="verifications-list__message">${this.escapeHtml(
      message
    )}</div>`;
  }

  showError(message) {
    this.setLoading(message);
  }

  setActionLoading(button, isLoading) {
    if (!button) return;
    const card = button.closest(".verification-card");
    if (!card) return;
    card.querySelectorAll("button").forEach((btn) => {
      btn.disabled = isLoading;
      if (isLoading) {
        if (!btn.dataset.originalText) {
          btn.dataset.originalText = btn.textContent || "";
        }
        if (btn === button) {
          btn.textContent = "در حال ارسال...";
        }
      } else if (btn.dataset.originalText !== undefined) {
        btn.textContent = btn.dataset.originalText;
        delete btn.dataset.originalText;
      }
    });
  }

  async extractErrorMessage(response) {
    const text = await response.text();
    if (!text) return `خطای ناشناخته (${response.status})`;
    try {
      const parsed = JSON.parse(text);
      return parsed?.detail || parsed?.message || text;
    } catch (error) {
      return text;
    }
  }

  escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return value
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  if (!date) return "نامشخص";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch (error) {
    return date.toLocaleString("fa-IR");
  }
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isWithinDays(date, days) {
  if (!date) return false;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function isImageUrl(url) {
  if (!url) return false;
  return /\.(png|jpe?g|gif|bmp|svg|webp)$/i.test(url.split("?")[0]);
}

new AdminVerificationPage().init();
    if (!response.ok) throw new Error("خطا در دریافت درخواست‌ها");
    const data = await response.json();
    STATE.all = Array.isArray(data) ? data : [];
    applyFilters();
  } catch (error) {
    console.error("Failed to load verifications", error);
    renderMessage("خطا در بارگذاری درخواست‌ها. لطفا دوباره تلاش کنید.");
  } finally {
    setLoading(false);
  }
}

function renderMessage(message) {
  if (!verificationsList) return;
  verificationsList.innerHTML = `<div class="verifications-list__message">${escapeHtml(
    message
  )}</div>`;
}

function applyFilters() {
  if (!verificationsList) return;
  const { date, status } = STATE.filters;
  let items = [...STATE.all];
  items.sort((a, b) => {
    const dateA = toDate(a?.created_at)?.getTime() || 0;
    const dateB = toDate(b?.created_at)?.getTime() || 0;
    return dateB - dateA;
  });

  if (DATE_FILTERS[date]) {
    items = items.filter((item) => {
      const itemDate = toDate(item?.created_at);
      return DATE_FILTERS[date](itemDate);
    });
  }

  if (status && status !== "all") {
    items = items.filter((item) => getStatusKey(item) === status);
  }

  STATE.filtered = items;
  renderVerifications(items);
}

function getStatusKey(item) {
  const normalizedStatus = (item?.status || "").toString().toLowerCase();
  if (["approved", "accept", "accepted", "verified", "done"].includes(normalizedStatus)) {
    return "approved";
  }
  if (["rejected", "declined", "denied", "failed", "cancelled", "canceled"].includes(normalizedStatus)) {
    return "rejected";
  }
  if (normalizedStatus) {
    return "pending";
  }
  if (item?.is_rejected || item?.rejection_reason) {
    return "rejected";
  }
  if (item?.is_verified) {
    return "approved";
  }
  return "pending";
}

function formatStatusBadge(item) {
  const key = getStatusKey(item);
  const meta = STATUS_METADATA[key] || STATUS_METADATA.pending;
  return `<span class="status-badge ${meta.className}" data-status="${key}">
    ${meta.icon}
    <span>${meta.label}</span>
  </span>`;
}

function formatLevel(level) {
  const map = {
    1: "سطح ۱",
    2: "سطح ۲",
    3: "سطح ۳",
  };
  const normalized = Number(level);
  return map[normalized] || (level ? `سطح ${escapeHtml(level)}` : "نامشخص");
}

function getUserObject(item) {
  return item?.user || item?.user_info || item?.profile || item?.user_data || null;
}

function getUserDisplayName(item) {
  const user = getUserObject(item);
  if (!user) {
    const fallback = item?.user_name || item?.username || item?.display_name;
    return fallback || "کاربر ناشناس";
  }

  if (typeof user === "string") {
    return user;
  }

  const firstName = user.first_name || user.firstname || user.name;
  const lastName = user.last_name || user.lastname || user.family;
  const username = user.username || user.user_name;

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  if (fullName) {
    return fullName + (username ? ` (${username})` : "");
  }
  return username || fullName || user.email || "کاربر ناشناس";
}

function formatUserDetails(item) {
  const user = getUserObject(item);
  if (!user) {
    return "<p class=\"verification-card__note\">اطلاعات کاربر موجود نیست.</p>";
  }
  if (typeof user === "string") {
    return `<p class="verification-card__note">${escapeHtml(user)}</p>`;
  }

  const firstName = user.first_name || user.firstname || user.name;
  const lastName = user.last_name || user.lastname || user.family;
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const fields = [
    { label: "نام کاربری", value: user.username || user.user_name },
    { label: "نام کامل", value: fullName },
    { label: "ایمیل", value: user.email },
    { label: "شماره موبایل", value: user.phone_number || user.mobile || user.phone },
    { label: "کد ملی", value: user.national_code || user.national_id },
  ].filter((field) => field.value);

  if (!fields.length) {
    return `<div class="verification-card__note">${escapeHtml(
      JSON.stringify(user, null, 2)
    )}</div>`;
  }

  return `
    <div class="verification-details">
      ${fields
        .map(
          (field) => `
            <div class="verification-details__item">
              <span class="verification-details__label">${field.label}</span>
              <span class="verification-details__value">${escapeHtml(field.value)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function buildDetailsGrid(pairs) {
  const validPairs = pairs.filter((pair) => pair.value !== null && pair.value !== undefined && pair.value !== "");
  if (!validPairs.length) return "";
  return `
    <div class="verification-details">
      ${validPairs
        .map(
          (pair) => `
            <div class="verification-details__item">
              <span class="verification-details__label">${pair.label}</span>
              <span class="verification-details__value">${escapeHtml(pair.value)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function flattenObjectEntries(obj, prefix = "") {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return [];
  }
  return Object.entries(obj).flatMap(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return flattenObjectEntries(value, nextKey);
    }
    return [{ key: nextKey, value }];
  });
}

function formatAdditionalDetails(item) {
  const entries = Object.entries(item || {})
    .filter(([key, value]) => {
      if (SKIP_DETAIL_KEYS.has(key)) return false;
      if (value === null || value === undefined || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      if (typeof value === "object" && Object.keys(value).length === 0) return false;
      return true;
    })
    .flatMap(([key, value]) => {
      if (Array.isArray(value)) {
        const formatted = value
          .map((itemValue) => {
            if (itemValue === null || itemValue === undefined || itemValue === "") {
              return null;
            }
            if (typeof itemValue === "object") {
              return JSON.stringify(itemValue);
            }
            return itemValue;
          })
          .filter(Boolean)
          .map((val) => val.toString())
          .join("، ");
        return [{ label: formatLabel(key), value: formatted }];
      }
      if (value && typeof value === "object") {
        const flattened = flattenObjectEntries(value).map(({ key: nestedKey, value: nestedValue }) => {
          let normalizedValue = nestedValue;
          if (Array.isArray(nestedValue)) {
            normalizedValue = nestedValue
              .filter((v) => v !== null && v !== undefined && v !== "")
              .map((v) => (typeof v === "object" ? JSON.stringify(v) : v))
              .join("، ");
          } else if (nestedValue && typeof nestedValue === "object") {
            normalizedValue = JSON.stringify(nestedValue);
          }
          return {
            label: formatLabel(`${key}.${nestedKey}`),
            value: normalizedValue,
          };
        });
        return flattened;
      }
      return [{ label: formatLabel(key), value }];
    })
    .slice(0, 24);

  if (!entries.length) return "";
  return `
    <div class="verification-card__section">
      <h3>جزئیات فرم</h3>
      ${buildDetailsGrid(entries)}
    </div>
  `;
}

function isLikelyImage(url) {
  if (!url || typeof url !== "string") return false;
  return /(\.)(jpe?g|png|gif|bmp|webp|svg)(\?.*)?$/i.test(url);
}

function normalizeDocumentEntry(doc, index) {
  if (!doc) return null;
  if (typeof doc === "string") {
    return { url: doc, title: `فایل ${index + 1}` };
  }
  if (doc.url || doc.file || doc.file_url || doc.document_url || doc.path) {
    const url = doc.url || doc.file || doc.file_url || doc.document_url || doc.path;
    const title =
      doc.label ||
      doc.name ||
      doc.title ||
      doc.type ||
      doc.field ||
      doc.description ||
      `فایل ${index + 1}`;
    return { url, title };
  }
  return null;
}

function formatDocuments(item) {
  const documents = item?.documents || item?.files || item?.attachments;
  if (!documents) return "";

  const items = Array.isArray(documents)
    ? documents
    : Object.values(documents).filter(Boolean);

  if (!items.length) return "";

  const elements = items
    .map((doc, index) => normalizeDocumentEntry(doc, index))
    .filter(Boolean)
    .map((doc) => {
      const url = escapeHtml(doc.url);
      const title = escapeHtml(doc.title);
      if (isLikelyImage(doc.url)) {
        return `
          <li class="verification-documents__item">
            <figure>
              <img src="${url}" alt="${title}" loading="lazy" />
              <figcaption>${title}</figcaption>
            </figure>
          </li>
        `;
      }
      return `<li class="verification-documents__item"><a href="${url}" target="_blank" rel="noopener">${title}</a></li>`;
    });

  if (!elements.length) return "";

  return `
    <div class="verification-card__section">
      <h3>مدارک ارسال شده</h3>
      <ul class="verification-documents">
        ${elements.join("")}
      </ul>
    </div>
  `;
}

function formatNotes(item) {
  const rejection = item?.rejection_reason || item?.reason || item?.reason_message;
  const reviewer = item?.reviewer_note || item?.admin_note || item?.note;
  const sections = [];

  if (rejection) {
    sections.push(
      `<div class="verification-card__note verification-card__note--danger">${escapeHtml(
        rejection
      )}</div>`
    );
  }
  if (reviewer) {
    sections.push(
      `<div class="verification-card__note verification-card__note--warning">${escapeHtml(
        reviewer
      )}</div>`
    );
  }

  return sections.join("");
}

function createRawDataBlock(item) {
  try {
    const raw = escapeHtml(JSON.stringify(item, null, 2));
    return `
      <div class="verification-card__section">
        <details class="verification-card__raw">
          <summary>مشاهده داده کامل</summary>
          <pre>${raw}</pre>
        </details>
      </div>
    `;
  } catch (error) {
  } catch (error) {
    console.error("Failed to load verifications", error);
    renderMessage("خطا در بارگذاری درخواست‌ها. لطفا دوباره تلاش کنید.");
  } finally {
    setLoading(false);
  }
}

function renderMessage(message) {
  if (!verificationsList) return;
  verificationsList.innerHTML = `<div class="verifications-list__message">${escapeHtml(
    message
  )}</div>`;
}

function applyFilters() {
  if (!verificationsList) return;
  const { date, status } = STATE.filters;
  let items = [...STATE.all];
  items.sort((a, b) => {
    const dateA = toDate(a?.created_at)?.getTime() || 0;
    const dateB = toDate(b?.created_at)?.getTime() || 0;
    return dateB - dateA;
  });

  if (DATE_FILTERS[date]) {
    items = items.filter((item) => {
      const itemDate = toDate(item?.created_at);
      return DATE_FILTERS[date](itemDate);
    });
  }

  if (status && status !== "all") {
    items = items.filter((item) => getStatusKey(item) === status);
  }

  STATE.filtered = items;
  renderVerifications(items);
}

function getStatusKey(item) {
  const normalizedStatus = (item?.status || "").toString().toLowerCase();
  if (["approved", "accept", "accepted", "verified", "done"].includes(normalizedStatus)) {
    return "approved";
  }
  if (["rejected", "declined", "denied", "failed", "cancelled", "canceled"].includes(normalizedStatus)) {
    return "rejected";
  }
  if (normalizedStatus) {
    return "pending";
  }
  if (item?.is_rejected || item?.rejection_reason) {
    return "rejected";
  }
  if (item?.is_verified) {
    return "approved";
  }
  return "pending";
}

function formatStatusBadge(item) {
  const key = getStatusKey(item);
  const meta = STATUS_METADATA[key] || STATUS_METADATA.pending;
  return `<span class="status-badge ${meta.className}" data-status="${key}">
    ${meta.icon}
    <span>${meta.label}</span>
  </span>`;
}

function formatLevel(level) {
  const map = {
    1: "سطح ۱",
    2: "سطح ۲",
    3: "سطح ۳",
  };
  const normalized = Number(level);
  return map[normalized] || (level ? `سطح ${escapeHtml(level)}` : "نامشخص");
}

function formatUserDetails(item) {
  const user = item?.user || item?.user_info || item?.profile;
  if (!user) {
    return "<p class=\"verification-card__note\">اطلاعات کاربر موجود نیست.</p>";
  }
  if (typeof user === "string") {
    return `<p class="verification-card__note">${escapeHtml(user)}</p>`;
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const fields = [
    { label: "نام کاربری", value: user.username },
    { label: "نام کامل", value: fullName },
    { label: "ایمیل", value: user.email },
    { label: "شماره موبایل", value: user.phone_number || user.mobile || user.phone },
    { label: "کد ملی", value: user.national_code || user.national_id },
  ].filter((field) => field.value);

  if (!fields.length) {
    return `<div class="verification-card__note">${escapeHtml(
      JSON.stringify(user, null, 2)
    )}</div>`;
  }

  return `
    <div class="verification-details">
      ${fields
        .map(
          (field) => `
            <div class="verification-details__item">
              <span class="verification-details__label">${field.label}</span>
              <span class="verification-details__value">${escapeHtml(field.value)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function buildDetailsGrid(pairs) {
  const validPairs = pairs.filter((pair) => pair.value !== null && pair.value !== undefined && pair.value !== "");
  if (!validPairs.length) return "";
  return `
    <div class="verification-details">
      ${validPairs
        .map(
          (pair) => `
            <div class="verification-details__item">
              <span class="verification-details__label">${pair.label}</span>
              <span class="verification-details__value">${escapeHtml(pair.value)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function flattenObjectEntries(obj, prefix = "") {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return [];
  }
  return Object.entries(obj).flatMap(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return flattenObjectEntries(value, nextKey);
    }
    return [{ key: nextKey, value }];
  });
}

function formatAdditionalDetails(item) {
  const entries = Object.entries(item || {})
    .filter(([key, value]) => {
      if (SKIP_DETAIL_KEYS.has(key)) return false;
      if (value === null || value === undefined || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      if (typeof value === "object" && Object.keys(value).length === 0) return false;
      return true;
    })
    .flatMap(([key, value]) => {
      if (Array.isArray(value)) {
        const formatted = value
          .map((itemValue) => {
            if (itemValue === null || itemValue === undefined || itemValue === "") {
              return null;
            }
            if (typeof itemValue === "object") {
              return JSON.stringify(itemValue);
            }
            return itemValue;
          })
          .filter(Boolean)
          .map((val) => val.toString())
          .join("، ");
        return [{ label: formatLabel(key), value: formatted }];
      }
      if (value && typeof value === "object") {
        const flattened = flattenObjectEntries(value).map(({ key: nestedKey, value: nestedValue }) => {
          let normalizedValue = nestedValue;
          if (Array.isArray(nestedValue)) {
            normalizedValue = nestedValue
              .filter((v) => v !== null && v !== undefined && v !== "")
              .map((v) => (typeof v === "object" ? JSON.stringify(v) : v))
              .join("، ");
          } else if (nestedValue && typeof nestedValue === "object") {
            normalizedValue = JSON.stringify(nestedValue);
          }
          return {
            label: formatLabel(`${key}.${nestedKey}`),
            value: normalizedValue,
          };
        });
        return flattened;
      }
      return [{ label: formatLabel(key), value }];
    })
    .slice(0, 24);

  if (!entries.length) return "";
  return `
    <div class="verification-card__section">
      <h3>جزئیات فرم</h3>
      ${buildDetailsGrid(entries)}
    </div>
  `;
}

function formatDocuments(item) {
  const documents = item?.documents || item?.files || item?.attachments;
  if (!documents) return "";

  const items = Array.isArray(documents)
    ? documents
    : Object.values(documents).filter(Boolean);

  if (!items.length) return "";

  const links = items
    .map((doc, index) => {
      if (!doc) return "";
      const url = doc.url || doc.file || doc.file_url || doc.document_url || doc.path;
      if (!url) return "";
      const title =
        doc.label ||
        doc.name ||
        doc.type ||
        doc.field ||
        doc.description ||
        `فایل ${index + 1}`;
      return `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(title)}</a></li>`;
    })
    .filter(Boolean);

  if (!links.length) return "";

  return `
    <div class="verification-card__section">
      <h3>مدارک ارسال شده</h3>
      <ul class="verification-documents">
        ${links.join("")}
      </ul>
    </div>
  `;
}

function formatNotes(item) {
  const rejection = item?.rejection_reason || item?.reason || item?.reason_message;
  const reviewer = item?.reviewer_note || item?.admin_note || item?.note;
  const sections = [];

  if (rejection) {
    sections.push(
      `<div class="verification-card__note verification-card__note--danger">${escapeHtml(
        rejection
      )}</div>`
    );
  }
  if (reviewer) {
    sections.push(
      `<div class="verification-card__note verification-card__note--warning">${escapeHtml(
        reviewer
      )}</div>`
    );
  }

  return sections.join("");
}

function createRawDataBlock(item) {
  try {
    const raw = escapeHtml(JSON.stringify(item, null, 2));
    return `
      <div class="verification-card__section">
        <details class="verification-card__raw">
          <summary>مشاهده داده کامل</summary>
          <pre>${raw}</pre>
        </details>
      </div>
    `;
  } catch (error) {
    return "";
  }
}

function renderVerifications(verifications) {
  if (!verificationsList) return;
  if (!verifications || verifications.length === 0) {
    renderMessage("درخواستی برای احراز هویت وجود ندارد.");
    return;
  }

  verificationsList.innerHTML = "";

  verifications.forEach((item) => {
    const article = document.createElement("article");
    article.className = "verification-card";
    article.dataset.verificationId = item?.id;

    const statusBadge = formatStatusBadge(item);
    const statusKey = getStatusKey(item);
    const createdAt = formatDate(item?.created_at);
    const updatedAt = item?.updated_at ? formatDate(item.updated_at) : null;
    const reviewer = item?.reviewer || item?.reviewed_by;
    const reviewDate = item?.reviewed_at ? formatDate(item.reviewed_at) : null;

    const headerMeta = [
      createdAt ? `<span>ایجاد: ${escapeHtml(createdAt)}</span>` : "",
      updatedAt ? `<span>آخرین به‌روزرسانی: ${escapeHtml(updatedAt)}</span>` : "",
      reviewer ? `<span>بررسی توسط: ${escapeHtml(reviewer)}</span>` : "",
      reviewDate ? `<span>تاریخ بررسی: ${escapeHtml(reviewDate)}</span>` : "",
    ]
      .filter(Boolean)
      .join("");

    const userDetails = formatUserDetails(item);
    const levelDetails = buildDetailsGrid([
      { label: "شناسه درخواست", value: item?.id },
      { label: "سطح احراز", value: formatLevel(item?.level) },
      { label: "وضعیت", value: STATUS_METADATA[getStatusKey(item)]?.label || "" },
    ]);

    const extraDetails = formatAdditionalDetails(item);
    const documentsSection = formatDocuments(item);
    const notes = formatNotes(item);
    const rawDataSection = createRawDataBlock(item);
    const approveDisabledAttr =
      statusKey === "approved" ? "disabled data-static-disabled=\"true\"" : "";
    const rejectDisabledAttr =
      statusKey === "rejected" ? "disabled data-static-disabled=\"true\"" : "";

    const userDisplayName = getUserDisplayName(item);

    article.innerHTML = `
      <header class="verification-card__header">
        <div class="verification-card__title">
          <h3>${escapeHtml(userDisplayName)}</h3>
    article.innerHTML = `
      <header class="verification-card__header">
        <div class="verification-card__title">
          <h3>${escapeHtml(item?.user?.username || item?.user_name || item?.user || "کاربر ناشناس")}</h3>
          ${statusBadge}
        </div>
        <div class="verification-card__meta">
          ${headerMeta || ""}
        </div>
      </header>
      <div class="verification-card__body">
        <div class="verification-card__section">
          <h3>اطلاعات کاربر</h3>
          ${userDetails}
        </div>
        <div class="verification-card__section">
          <h3>اطلاعات درخواست</h3>
          ${levelDetails}
        </div>
        ${extraDetails}
        ${documentsSection}
        ${notes}
        ${rawDataSection}
      </div>
      <div class="verification-card__actions">
        <button type="button" class="approve-action" data-action="approve" data-id="${escapeHtml(
          item?.id
        )}" ${approveDisabledAttr}>تایید</button>
        <button type="button" class="reject-action" data-action="reject" data-id="${escapeHtml(
          item?.id
        )}" ${rejectDisabledAttr}>رد</button>
      </div>
    `;

    verificationsList.appendChild(article);
  });
}

async function postAction(id, action, payload = {}) {
  const token = getAccessToken();
  if (!token) return null;
  const response = await fetch(`${API_BASE_URL}/api/verification/${id}/${action}/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem("access_token");
    alert("نشست شما منقضی شده است. لطفا مجددا وارد شوید.");
    window.location.href = "/register/login.html";
    return null;
  }
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.detail || parsed?.message || text;
    } catch (error) {
      // ignore parse error
    }
    throw new Error(message || "خطا در ارسال درخواست");
  }
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

function updateState(id, data = {}, fallbackStatus) {
  STATE.all = STATE.all.map((item) => {
    if (String(item?.id) !== String(id)) return item;
    const nextItem = { ...item, ...data };
    if (fallbackStatus) {
      if (fallbackStatus === "approved") {
        nextItem.is_verified = true;
        nextItem.status = nextItem.status || "approved";
      }
      if (fallbackStatus === "rejected") {
        nextItem.is_verified = false;
        nextItem.status = nextItem.status || "rejected";
      }
    }
    return nextItem;
  });
  applyFilters();
}

  });
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem("access_token");
    alert("نشست شما منقضی شده است. لطفا مجددا وارد شوید.");
    window.location.href = "/register/login.html";
    return null;
  }
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "خطا در ارسال درخواست");
  }
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

function updateState(id, data = {}, fallbackStatus) {
  STATE.all = STATE.all.map((item) => {
    if (String(item?.id) !== String(id)) return item;
    const nextItem = { ...item, ...data };
    if (fallbackStatus) {
      if (fallbackStatus === "approved") {
        nextItem.is_verified = true;
        nextItem.status = nextItem.status || "approved";
      }
      if (fallbackStatus === "rejected") {
        nextItem.is_verified = false;
        nextItem.status = nextItem.status || "rejected";
      }
    }
    return nextItem;
  });
  applyFilters();
}

async function handleApprove(id, button) {
  if (!id) return;
  const confirmed = confirm("آیا از تایید این درخواست مطمئن هستید؟");
  if (!confirmed) return;
  setButtonsDisabled(button, true);
  try {
    const result = await postAction(id, "approve", {
      is_verified: true,
      status: "approved",
    });
    const result = await postAction(id, "approve", {});
    updateState(id, result || {}, "approved");
    alert("درخواست با موفقیت تایید شد.");
  } catch (error) {
    console.error("Approve verification failed", error);
    alert("خطا در تایید درخواست: " + (error.message || ""));
    alert("خطا در تایید درخواست: " + error.message);
  } finally {
    setButtonsDisabled(button, false);
  }
}

async function handleReject(id, button) {
  if (!id) return;
  const reason = prompt("دلیل رد درخواست را وارد کنید (اختیاری):", "");
  if (reason === null) return;
  setButtonsDisabled(button, true);
  try {
    const payload = {
      is_verified: false,
      status: "rejected",
    };
    if (reason) {
      payload.reason = reason;
      payload.rejection_reason = reason;
    }
    const payload = reason ? { reason } : {};
    const result = await postAction(id, "reject", payload);
    const updates = result || {};
    if (reason && !updates.rejection_reason) {
      updates.rejection_reason = reason;
    }
    updateState(id, updates, "rejected");
    alert("درخواست با موفقیت رد شد.");
  } catch (error) {
    console.error("Reject verification failed", error);
    alert("خطا در رد درخواست: " + error.message);
  } finally {
    setButtonsDisabled(button, false);
  }
}

function setButtonsDisabled(button, isDisabled) {
  const card = button?.closest?.(".verification-card");
  if (!card) return;
  card.querySelectorAll("button").forEach((btn) => {
    btn.disabled = isDisabled || btn.dataset.staticDisabled === "true";
  });
}

function registerEventListeners() {
  if (dateFilterSelect) {
    dateFilterSelect.addEventListener("change", (event) => {
      STATE.filters.date = event.target.value;
      applyFilters();
    });
  }
  if (statusFilterSelect) {
    statusFilterSelect.addEventListener("change", (event) => {
      STATE.filters.status = event.target.value;
      applyFilters();
    });
  }
  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      fetchAllVerifications();
    });
  }
  if (verificationsList) {
    verificationsList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.dataset.action;
      const id = target.dataset.id;
      if (!action || !id) return;
      if (action === "approve") {
        handleApprove(id, target);
      } else if (action === "reject") {
        handleReject(id, target);
      }
    });
  }
}

registerEventListeners();
fetchAllVerifications();
