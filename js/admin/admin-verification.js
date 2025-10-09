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
      alert("نشست شما منقضی شده است. لطفا مجددا وارد شوید.");
      window.location.href = "/register/login.html";
      return;
    }
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
    const result = await postAction(id, "approve", {});
    updateState(id, result || {}, "approved");
    alert("درخواست با موفقیت تایید شد.");
  } catch (error) {
    console.error("Approve verification failed", error);
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
