import { API_BASE_URL } from "../config.js";

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
