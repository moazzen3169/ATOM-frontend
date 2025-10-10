import { API_BASE_URL } from "../config.js";
import { ensureAdminAccess, handleUnauthorizedAccess } from "./admin-auth.js";

const CONFIGURED_API_BASE_URL = normalizeBaseUrl(CONFIG_API_BASE_URL);
const META_API_BASE_URL = normalizeBaseUrl(getMetaContent("api-base-url"));
const API_BASE_URL = META_API_BASE_URL || CONFIGURED_API_BASE_URL;
const TICKETS_ENDPOINT = resolveTicketsEndpoint();
const REQUEST_TIMEOUT = 12000;
const DEFAULT_TICKETS_PATH = "api/support/tickets/";

const state = {
  adminUser: null,
  tickets: [],
  filteredTickets: [],
  filters: {
    search: "",
    status: "all",
    priority: "all",
    channel: "all",
    from: null,
    to: null,
    quick: "all",
  },
  activeTicketId: null,
  replyMode: "reply",
  isLoading: true,
  error: null,
  lastFetch: null,
};

const statusDictionary = {
  new: { label: "جدید", badge: "status-badge--new" },
  waiting: { label: "در انتظار پاسخ", badge: "status-badge--waiting" },
  answered: { label: "پاسخ داده شده", badge: "status-badge--answered" },
  resolved: { label: "حل شده", badge: "status-badge--resolved" },
  closed: { label: "بسته شده", badge: "status-badge--closed" },
};

const priorityDictionary = {
  urgent: "فوری",
  high: "بالا",
  medium: "متوسط",
  low: "پایین",
};

const channelDictionary = {
  website: "وب‌سایت",
  tournament: "تورنمنت",
  payment: "پرداخت",
  account: "حساب کاربری",
};

const elements = {
  list: document.querySelector("[data-ticket-list]"),
  detail: document.querySelector("[data-ticket-detail]"),
  feedback: document.querySelector("[data-feedback]"),
  stats: {
    total: document.querySelector("[data-stat=total]"),
    waiting: document.querySelector("[data-stat=waiting]"),
    overdue: document.querySelector("[data-stat=overdue]"),
    csat: document.querySelector("[data-stat=csat]"),
  },
  searchInput: document.querySelector("[data-action=search]"),
  statusFilter: document.querySelector("[data-filter=status]"),
  priorityFilter: document.querySelector("[data-filter=priority]"),
  channelFilter: document.querySelector("[data-filter=channel]"),
  fromFilter: document.querySelector("[data-filter=from]"),
  toFilter: document.querySelector("[data-filter=to]"),
  quickButtons: document.querySelectorAll("[data-quick]"),
  refreshButtons: document.querySelectorAll("[data-action=refresh]"),
  resetFiltersButtons: document.querySelectorAll("[data-action=reset-filters]"),
  exportButton: document.querySelector("[data-action=export]"),
};

const adminReady = ensureAdminAccess()
  .then((adminUser) => {
    state.adminUser = adminUser;
    return adminUser;
  })
  .catch((error) => {
    console.error("Admin verification failed", error);
    return null;
  });

function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

function getMetaContent(name) {
  return document.querySelector(`meta[name="${name}"]`)?.content?.trim() || "";
}

function normalizeBaseUrl(base) {
  if (!base) return "";
  return base.replace(/\/+$/, "");
}

function resolveTicketsEndpoint() {
  const directEndpoint = getMetaContent("tickets-endpoint");
  if (directEndpoint) {
    return toAbsoluteUrl(directEndpoint);
  }
  return toAbsoluteUrl(DEFAULT_TICKETS_PATH);
}

function joinUrlSegments(base, path) {
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  if (!normalizedBase) {
    return `/${normalizedPath}`;
  }
  if (!normalizedPath) {
    return normalizedBase;
  }
  return `${normalizedBase}/${normalizedPath}`;
}

function toAbsoluteUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const base = API_BASE_URL || CONFIGURED_API_BASE_URL || "";
  return joinUrlSegments(base || "", path);
}

function showFeedback(message, type = "success") {
  if (!elements.feedback) return;
  elements.feedback.innerHTML = `<div class="feedback feedback--${type}">${message}</div>`;
  window.setTimeout(() => {
    if (elements.feedback) {
      elements.feedback.innerHTML = "";
    }
  }, 3600);
}

function formatRelativeTime(dateLike) {
  if (!dateLike) return "نامشخص";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "نامشخص";
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);
  const units = [
    { limit: 60, divisor: 1, unit: "second" },
    { limit: 3600, divisor: 60, unit: "minute" },
    { limit: 86400, divisor: 3600, unit: "hour" },
    { limit: 604800, divisor: 86400, unit: "day" },
    { limit: 2419200, divisor: 604800, unit: "week" },
    { limit: 29030400, divisor: 2419200, unit: "month" },
  ];
  const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
  for (const { limit, divisor, unit } of units) {
    if (absSec < limit) {
      const value = Math.round(diffSec / divisor);
      return rtf.format(value, unit);
    }
  }
  const years = Math.round(diffSec / 29030400);
  return rtf.format(years, "year");
}

function formatDateTime(dateLike) {
  if (!dateLike) return "نامشخص";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "نامشخص";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatTimeRemaining(ticket) {
  if (!ticket.slaDue) return "-";
  const due = new Date(ticket.slaDue);
  if (Number.isNaN(due.getTime())) return "-";
  const now = new Date();
  if (due < now) {
    return "منقضی شده";
  }
  const diffMs = due.getTime() - now.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}ساعت و ${minutes}دقیقه`;
}

function isOverdue(ticket) {
  if (!ticket.slaDue) return false;
  const due = new Date(ticket.slaDue);
  if (Number.isNaN(due.getTime())) return false;
  return due < new Date();
}

function extractTickets(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload?.results && Array.isArray(payload.results)) {
    return payload.results;
  }
  if (payload?.data && Array.isArray(payload.data)) {
    return payload.data;
  }
  if (payload?.tickets && Array.isArray(payload.tickets)) {
    return payload.tickets;
  }
  return [];
}

function normalizeTicket(raw = {}) {
  const messages = Array.isArray(raw.messages)
    ? raw.messages.map((message) => ({
        author: message.author || "user",
        authorName: message.authorName || raw.user?.name || "کاربر",
        timestamp: message.timestamp || raw.updatedAt || raw.createdAt || new Date().toISOString(),
        content: message.content || "",
        attachments: Array.isArray(message.attachments)
          ? message.attachments.map((file) => ({
              name: file.name || "بدون نام",
              size: file.size || "",
            }))
          : [],
      }))
    : [];

  const metrics = raw.metrics || {};
  const tags = Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : [];
  const watchers = Array.isArray(raw.watchers) ? raw.watchers.filter(Boolean) : [];

  return {
    id: String(raw.id ?? ""),
    subject: raw.subject || "بدون عنوان",
    status: raw.status || "new",
    priority: raw.priority || "medium",
    channel: raw.channel || "website",
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
    slaDue: raw.slaDue || null,
    unread: Boolean(raw.unread),
    csat:
      typeof raw.csat === "number"
        ? raw.csat
        : raw.csat == null
        ? null
        : Number.parseInt(raw.csat, 10) || null,
    assignedTo: raw.assignedTo || null,
    watchers,
    user: raw.user ? { ...raw.user } : null,
    tags,
    metrics: {
      totalMessages: metrics.totalMessages ?? messages.length,
      firstResponseAt: metrics.firstResponseAt || null,
      lastPublicReply: metrics.lastPublicReply || null,
    },
    messages,
  };
}

function ensureActiveTicket(tickets) {
  if (!tickets.length) {
    state.activeTicketId = null;
    return;
  }
  if (!state.activeTicketId || !tickets.some((ticket) => ticket.id === state.activeTicketId)) {
    state.activeTicketId = tickets[0].id;
  }
}

function applyFilters() {
  const { search, status, priority, channel, from, to, quick } = state.filters;
  const term = search.trim().toLowerCase();

  return state.tickets
    .filter((ticket) => {
      const created = new Date(ticket.createdAt);
      const tagsText = Array.isArray(ticket.tags) ? ticket.tags.join(" ") : "";
      const matchesSearch =
        term.length === 0 ||
        [ticket.id, ticket.subject, ticket.user?.name, ticket.user?.gamerTag, tagsText]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);

      if (!matchesSearch) return false;
      if (status !== "all" && ticket.status !== status) return false;
      if (priority !== "all" && ticket.priority !== priority) return false;
      if (channel !== "all" && ticket.channel !== channel) return false;

      if (from) {
        const fromDate = new Date(from);
        if (!Number.isNaN(fromDate.getTime()) && created < fromDate) {
          return false;
        }
      }

      if (to) {
        const toDate = new Date(to);
        if (!Number.isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999);
          if (created > toDate) {
            return false;
          }
        }
      }

      switch (quick) {
        case "waiting":
          return ticket.status === "waiting" || ticket.status === "new";
        case "high":
          return ticket.priority === "high" || ticket.priority === "urgent";
        case "overdue":
          return isOverdue(ticket);
        case "unassigned":
          return !ticket.assignedTo;
        default:
          return true;
      }
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function findTicketById(id) {
  return state.tickets.find((ticket) => ticket.id === id) || null;
}

function markTicketAsRead(ticketId) {
  const ticket = findTicketById(ticketId);
  if (ticket) {
    ticket.unread = false;
  }
}

function renderLoadingState() {
  if (!elements.list) return;
  elements.list.innerHTML = `
    <div class="tickets-list__state" role="status">
      <span class="tickets-list__spinner" aria-hidden="true"></span>
      <span>در حال بارگذاری تیکت‌ها...</span>
    </div>
  `;
  renderTicketDetail(null, "loading");
}

function renderErrorState() {
  if (!elements.list) return;
  elements.list.innerHTML = `
    <div class="tickets-list__state is-error">
      <span>امکان دریافت فهرست تیکت‌ها وجود ندارد.</span>
      <button type="button" class="tickets-list__retry" data-action="retry-fetch">تلاش مجدد</button>
    </div>
  `;
  elements.list
    .querySelector("[data-action=retry-fetch]")
    ?.addEventListener("click", () => {
      void loadTickets({ showLoader: true });
    });
  renderTicketDetail(null, "error");
}

function renderEmptyState() {
  if (!elements.list) return;
  elements.list.innerHTML = `
    <div class="tickets-list__state">
      <span>هیچ تیکتی با فیلترهای انتخابی یافت نشد.</span>
    </div>
  `;
  renderTicketDetail(null);
  updateStatistics();
}

function renderTicketItem(ticket) {
  const statusInfo = statusDictionary[ticket.status] || statusDictionary.new;
  const badgeClass = statusInfo?.badge || "";
  const unreadDot = ticket.unread ? '<span class="unread-dot" aria-hidden="true"></span>' : "";
  const priorityTag = `tag-chip tag-chip--priority-${ticket.priority}`;
  const channelTag = `tag-chip tag-chip--channel-${ticket.channel}`;

  return `
    <button class="ticket-item ${
      ticket.id === state.activeTicketId ? "is-active" : ""
    }" data-ticket-id="${ticket.id}" role="listitem">
      <span class="ticket-avatar" aria-hidden="true">${getInitials(ticket.user?.name)}</span>
      <div class="ticket-item__header">
        <span class="ticket-subject">${ticket.subject}</span>
        <span class="status-badge ${badgeClass}">${statusInfo.label}</span>
      </div>
      <div class="ticket-item__meta">
        <span>${ticket.user?.name || "کاربر"}</span>
        <span>${ticket.id}</span>
        <span>${formatRelativeTime(ticket.updatedAt)}</span>
        ${unreadDot}
      </div>
      <div class="ticket-item__tags">
        <span class="${priorityTag}">${priorityDictionary[ticket.priority] || ticket.priority}</span>
        <span class="${channelTag}">${channelDictionary[ticket.channel] || ticket.channel}</span>
        ${(ticket.tags || [])
          .map((tag) => `<span class="tag-chip">${tag}</span>`)
          .join("")}
      </div>
    </button>
  `;
}

function renderTicketsList(tickets) {
  if (!elements.list) return;
  state.replyMode = "reply";

  const items = tickets.map(renderTicketItem).join("");

  elements.list.innerHTML = `
    <div class="tickets-list__header">
      ${tickets.length} تیکت پیدا شد
    </div>
    <div class="ticket-items" role="list">
      ${items}
    </div>
  `;

  elements.list.querySelectorAll("[data-ticket-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTicketId = button.dataset.ticketId;
      markTicketAsRead(state.activeTicketId);
      renderTicketList();
    });
  });

  renderTicketDetail(findTicketById(state.activeTicketId));
  updateStatistics();
}

function renderTicketList() {
  if (!elements.list) return;

  if (state.isLoading) {
    renderLoadingState();
    return;
  }

  if (state.error) {
    renderErrorState();
    return;
  }

  const tickets = applyFilters();
  state.filteredTickets = tickets;
  ensureActiveTicket(tickets);

  if (!tickets.length) {
    renderEmptyState();
    return;
  }

  renderTicketsList(tickets);
}

function renderDetailLoading() {
  if (!elements.detail) return;
  elements.detail.innerHTML = `
    <div class="ticket-placeholder ticket-placeholder--loading">
      <span class="ticket-placeholder__spinner" aria-hidden="true"></span>
      <p>در حال آماده‌سازی جزئیات تیکت...</p>
    </div>
  `;
}

function renderDetailError() {
  if (!elements.detail) return;
  elements.detail.innerHTML = `
    <div class="ticket-placeholder ticket-placeholder--error">
      <h3>خطا در دریافت تیکت</h3>
      <p>برای تلاش مجدد از فهرست تیکت‌ها دکمه «تلاش مجدد» را انتخاب کنید.</p>
    </div>
  `;
}

function renderDetailPlaceholder() {
  if (!elements.detail) return;
  elements.detail.innerHTML = `
    <div class="ticket-placeholder">
      <h3>یک تیکت را انتخاب کنید</h3>
      <p>برای مشاهده جزئیات گفتگو، پاسخ‌دهی و مدیریت وضعیت، از فهرست سمت راست یک تیکت را انتخاب کنید.</p>
      <ul>
        <li>نمایش تاریخچه کامل پیام‌ها</li>
        <li>به‌روزرسانی سریع وضعیت و اولویت</li>
        <li>ثبت پاسخ عمومی یا یادداشت داخلی</li>
      </ul>
    </div>
  `;
}

function renderDetailContent(ticket) {
  if (!elements.detail) return;

  const statusOptions = Object.entries(statusDictionary)
    .map(
      ([value, info]) =>
        `<option value="${value}" ${value === ticket.status ? "selected" : ""}>${info.label}</option>`
    )
    .join("");

  const priorityOptions = Object.entries(priorityDictionary)
    .map(
      ([value, label]) =>
        `<option value="${value}" ${value === ticket.priority ? "selected" : ""}>${label}</option>`
    )
    .join("");

  const watchers = Array.isArray(ticket.watchers) ? ticket.watchers : [];
  const handlers = watchers.length
    ? watchers.map((watcher) => `<span>${watcher}</span>`).join("")
    : '<span>بدون ناظر</span>';

  const tags = Array.isArray(ticket.tags) ? ticket.tags : [];

  elements.detail.innerHTML = `
    <header class="ticket-detail__header">
      <div class="ticket-detail__title">
        <h2>${ticket.subject}</h2>
        <div class="ticket-detail__meta">
          <span>شناسه: ${ticket.id}</span>
          <span>کاربر: ${ticket.user?.name || "نامشخص"}</span>
          <span>آخرین بروزرسانی: ${formatRelativeTime(ticket.updatedAt)}</span>
        </div>
      </div>
      <div class="ticket-detail__controls">
        <label class="sr-only" for="ticket-status">وضعیت تیکت</label>
        <select id="ticket-status" data-ticket-status>
          ${statusOptions}
        </select>
        <label class="sr-only" for="ticket-priority">اولویت</label>
        <select id="ticket-priority" data-ticket-priority>
          ${priorityOptions}
        </select>
        <button type="button" class="primary-action" data-action="mark-resolved">علامت‌گذاری به‌عنوان حل شده</button>
        <button type="button" data-action="reopen">بازگشایی</button>
        <button type="button" data-action="escalate">ارجاع به سطح بالاتر</button>
      </div>
    </header>
    <div class="ticket-metrics">
      <div class="metric-card">
        <span>ایجاد شده</span>
        <strong>${formatDateTime(ticket.createdAt)}</strong>
      </div>
      <div class="metric-card">
        <span>زمان باقیمانده SLA</span>
        <strong>${formatTimeRemaining(ticket)}</strong>
      </div>
      <div class="metric-card">
        <span>پاسخ اول</span>
        <strong>${
          ticket.metrics.firstResponseAt
            ? formatRelativeTime(ticket.metrics.firstResponseAt)
            : "در انتظار"
        }</strong>
      </div>
      <div class="metric-card">
        <span>آخرین پیام عمومی</span>
        <strong>${
          ticket.metrics.lastPublicReply
            ? formatRelativeTime(ticket.metrics.lastPublicReply)
            : "هنوز ارسال نشده"
        }</strong>
      </div>
    </div>
    <div class="ticket-tags">
      <span class="tag-chip tag-chip--priority-${ticket.priority}">${
        priorityDictionary[ticket.priority] || ticket.priority
      }</span>
      <span class="tag-chip tag-chip--channel-${ticket.channel}">${
        channelDictionary[ticket.channel] || ticket.channel
      }</span>
      ${tags.map((tag) => `<span class="tag-chip">${tag}</span>`).join("")}
    </div>
    <div class="ticket-watchers">
      <span>ناظران:</span>
      ${handlers}
    </div>
    <section class="ticket-thread" data-ticket-thread>
      ${ticket.messages.map(renderMessage).join("")}
    </section>
    <form class="ticket-reply" data-ticket-reply>
      <div class="reply-tabs">
        <button type="button" class="reply-tab is-active" data-reply-mode="reply">پاسخ</button>
        <button type="button" class="reply-tab" data-reply-mode="note">یادداشت داخلی</button>
      </div>
      <div class="reply-toolbar">
        <label>
          <span class="sr-only">انتخاب قالب پاسخ</span>
          <select data-reply-template>
            <option value="">بدون قالب</option>
            <option value="template-welcome">پاسخ اولیه</option>
            <option value="template-delay">نیاز به زمان بیشتر</option>
            <option value="template-closed">بستن تیکت</option>
          </select>
        </label>
        <button type="button" data-action="insert-summary">افزودن خلاصه</button>
      </div>
      <label class="sr-only" for="reply-text">متن پاسخ</label>
      <textarea id="reply-text" data-reply-text rows="6" placeholder="پاسخ خود را بنویسید..."></textarea>
      <div class="reply-actions">
        <label class="reply-option">
          <input type="checkbox" data-close-after-send>
          <span>پس از ارسال تیکت بسته شود</span>
        </label>
        <div class="reply-buttons">
          <button type="submit" class="primary-action">ارسال</button>
          <button type="button" data-action="escalate">ارجاع</button>
        </div>
      </div>
    </form>
  `;

  bindDetailEvents(ticket);
}

function renderTicketDetail(ticket, mode = "default") {
  if (!elements.detail) return;

  if (mode === "loading") {
    renderDetailLoading();
    return;
  }

  if (mode === "error") {
    renderDetailError();
    return;
  }

  if (!ticket) {
    renderDetailPlaceholder();
    return;
  }

  renderDetailContent(ticket);
}

function renderMessage(message) {
  const classes = {
    user: "message message--user",
    admin: "message message--admin",
    note: "message message--note",
  };
  const roleLabel =
    message.author === "note"
      ? "یادداشت داخلی"
      : message.author === "admin"
      ? "پاسخ پشتیبانی"
      : "پیام کاربر";
  const attachments = Array.isArray(message.attachments)
    ? message.attachments
        .map(
          (file) =>
            `<span class="message-attachment">📎 ${file.name}<small> (${file.size})</small></span>`
        )
        .join("")
    : "";

  return `
    <article class="${classes[message.author] || classes.user}">
      <header class="message__header">
        <span>${roleLabel} • ${message.authorName}</span>
        <time>${formatDateTime(message.timestamp)}</time>
      </header>
      <div class="message__body">${message.content}</div>
      ${attachments ? `<div class="message-attachments">${attachments}</div>` : ""}
    </article>
  `;
}

function bindDetailEvents(ticket) {
  const statusSelect = elements.detail.querySelector("[data-ticket-status]");
  const prioritySelect = elements.detail.querySelector("[data-ticket-priority]");
  const replyTabs = elements.detail.querySelectorAll("[data-reply-mode]");
  const replyTemplate = elements.detail.querySelector("[data-reply-template]");
  const replyTextarea = elements.detail.querySelector("[data-reply-text]");
  const replyForm = elements.detail.querySelector("[data-ticket-reply]");
  const closeAfterSend = elements.detail.querySelector("[data-close-after-send]");

  statusSelect?.addEventListener("change", (event) => {
    updateTicketStatus(ticket.id, event.target.value);
    showFeedback("وضعیت تیکت به‌روزرسانی شد.");
    renderTicketList();
  });

  prioritySelect?.addEventListener("change", (event) => {
    ticket.priority = event.target.value;
    ticket.updatedAt = new Date().toISOString();
    showFeedback("اولویت تیکت تغییر کرد.");
    renderTicketList();
  });

  elements.detail
    .querySelector("[data-action=mark-resolved]")
    ?.addEventListener("click", () => {
      updateTicketStatus(ticket.id, "resolved");
      showFeedback("تیکت در وضعیت حل شده قرار گرفت.");
      renderTicketList();
    });

  elements.detail
    .querySelector("[data-action=reopen]")
    ?.addEventListener("click", () => {
      updateTicketStatus(ticket.id, "waiting");
      showFeedback("تیکت مجدداً برای پیگیری باز شد.", "warning");
      renderTicketList();
    });

  elements.detail
    .querySelectorAll("[data-action=escalate]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        showFeedback("تیکت برای تیم سطح بالاتر ارجاع شد.", "warning");
      });
    });

  elements.detail
    .querySelector("[data-action=insert-summary]")
    ?.addEventListener("click", () => {
      if (!replyTextarea) return;
      const summary = buildAutoSummary(ticket);
      replyTextarea.value = summary;
      showFeedback("خلاصه گفتگو به متن اضافه شد.");
    });

  replyTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.replyMode = tab.dataset.replyMode;
      replyTabs.forEach((other) => other.classList.toggle("is-active", other === tab));
      if (state.replyMode === "note") {
        if (closeAfterSend) {
          closeAfterSend.checked = false;
          closeAfterSend.disabled = true;
        }
      } else if (closeAfterSend) {
        closeAfterSend.disabled = false;
      }
    });
  });

  replyTemplate?.addEventListener("change", (event) => {
    if (!replyTextarea) return;
    const templateText = getTemplateText(event.target.value, ticket);
    if (templateText) {
      replyTextarea.value = templateText;
    }
  });

  replyForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const messageText = replyTextarea?.value.trim();
    if (!messageText) {
      showFeedback("متن پیام نمی‌تواند خالی باشد.", "error");
      return;
    }

    const newMessage = {
      author: state.replyMode === "note" ? "note" : "admin",
      authorName: "مدیر سامانه",
      timestamp: new Date().toISOString(),
      content: messageText,
    };

    ticket.messages.push(newMessage);
    ticket.updatedAt = newMessage.timestamp;

    const metrics = ticket.metrics || (ticket.metrics = {});
    metrics.totalMessages = ticket.messages.length;
    if (state.replyMode !== "note") {
      metrics.lastPublicReply = newMessage.timestamp;
      if (!metrics.firstResponseAt) {
        metrics.firstResponseAt = newMessage.timestamp;
      }
    }

    if (state.replyMode !== "note") {
      const shouldClose = closeAfterSend?.checked ?? false;
      ticket.status = shouldClose ? "resolved" : "answered";
    }

    if (replyTextarea) {
      replyTextarea.value = "";
    }
    if (closeAfterSend) {
      closeAfterSend.checked = false;
    }

    const threadContainer = elements.detail.querySelector("[data-ticket-thread]");
    if (threadContainer) {
      threadContainer.innerHTML = ticket.messages.map(renderMessage).join("");
    }

    showFeedback("پیام با موفقیت ثبت شد.");
    renderTicketList();
  });
}

function buildAutoSummary(ticket) {
  const lastMessage = ticket.messages[ticket.messages.length - 1];
  const summaryLines = [
    `شناسه: ${ticket.id}`,
    `موضوع: ${ticket.subject}`,
    `آخرین وضعیت: ${(statusDictionary[ticket.status] || {}).label || ticket.status}`,
  ];
  if (lastMessage) {
    summaryLines.push(`آخرین پیام از ${lastMessage.authorName}: ${lastMessage.content.slice(0, 120)}...`);
  }
  return summaryLines.join("\n");
}

function getTemplateText(templateId, ticket) {
  switch (templateId) {
    case "template-welcome":
      return `سلام ${ticket.user?.name || "کاربر عزیز"}،\nاز ارتباط شما با پشتیبانی اتم ممنونیم. درخواست شما در حال بررسی است و به محض تکمیل به اطلاع شما می‌رسد.`;
    case "template-delay":
      return `کاربر گرامی،\nپرونده شما برای بررسی بیشتر به تیم مربوطه ارجاع شد. نتیجه نهایی حداکثر تا ۲۴ ساعت آینده اعلام خواهد شد.`;
    case "template-closed":
      return `سلام ${ticket.user?.name || "دوست عزیز"}،\nمسئله مطرح شده برطرف شد و تیکت شما در وضعیت بسته قرار گرفت. در صورت نیاز می‌توانید مجدداً با ما در ارتباط باشید.`;
    default:
      return "";
  }
}

function updateTicketStatus(ticketId, status) {
  if (!statusDictionary[status]) return;
  const ticket = findTicketById(ticketId);
  if (!ticket) return;
  ticket.status = status;
  ticket.updatedAt = new Date().toISOString();
}

function updateStatistics() {
  if (!elements.stats.total) return;
  const dataset = state.tickets;
  const total = dataset.length;
  const waiting = dataset.filter((ticket) => ticket.status === "waiting" || ticket.status === "new").length;
  const overdue = dataset.filter(isOverdue).length;
  const csatValues = dataset
    .map((ticket) => ticket.csat)
    .filter((value) => typeof value === "number" && !Number.isNaN(value));
  const csatAverage = csatValues.length
    ? Math.round(csatValues.reduce((sum, value) => sum + value, 0) / csatValues.length)
    : 0;

  elements.stats.total.textContent = total;
  elements.stats.waiting.textContent = waiting;
  elements.stats.overdue.textContent = overdue;
  elements.stats.csat.textContent = `${csatAverage}%`;
}

function bindFilters() {
  const debouncedSearch = debounce((value) => {
    state.filters.search = value;
    renderTicketList();
  }, 300);

  elements.searchInput?.addEventListener("input", (event) => {
    debouncedSearch(event.target.value);
  });

  [elements.statusFilter, elements.priorityFilter, elements.channelFilter, elements.fromFilter, elements.toFilter].forEach((element) => {
    if (element) {
      element.addEventListener("change", () => {
        const filterName = element.dataset.filter;
        state.filters[filterName] = element.value || null;
        renderTicketList();
      });
    }
  });

  elements.quickButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.quick = button.dataset.quick;
      elements.quickButtons.forEach((btn) => btn.classList.toggle("is-active", btn === button));
      renderTicketList();
    });
  });

  elements.refreshButtons.forEach((button) => {
    button.addEventListener("click", () => {
      void loadTickets({ showLoader: true, showSuccess: true });
    });
  });

  elements.resetFiltersButtons.forEach((button) => {
    button.addEventListener("click", () => {
      resetFilters();
      showFeedback("فیلترها بازنشانی شدند.");
    });
  });

  elements.exportButton?.addEventListener("click", () => {
    showFeedback("گزارش وضعیت تیکت‌ها آماده و برای دانلود در دسترس قرار گرفت.");
  });
}

function resetFilters() {
  state.filters.search = "";
  state.filters.status = "all";
  state.filters.priority = "all";
  state.filters.channel = "all";
  state.filters.from = null;
  state.filters.to = null;
  state.filters.quick = "all";

  if (elements.searchInput) {
    elements.searchInput.value = "";
  }

  [elements.statusFilter, elements.priorityFilter, elements.channelFilter, elements.fromFilter, elements.toFilter].forEach((element) => {
    if (element) {
      const filterName = element.dataset.filter;
      if (filterName === "from" || filterName === "to") {
        element.value = "";
      } else {
        element.value = "all";
      }
    }
  });

  elements.quickButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.quick === "all");
  });

  renderTicketList();
}

async function loadTickets({ showLoader = false, showSuccess = false } = {}) {
  const adminUser = await adminReady;
  if (!adminUser) {
    state.isLoading = false;
    state.error = "برای مشاهده تیکت‌ها نیاز به حساب ادمین دارید.";
    renderTicketList();
    return;
  }

  if (showLoader) {
    state.isLoading = true;
    state.error = null;
    renderTicketList();
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const headers = { Accept: "application/json" };
    const token = localStorage.getItem("access_token");
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(TICKETS_ENDPOINT, {
      headers,
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      handleUnauthorizedAccess("نشست شما منقضی شده است. لطفا دوباره وارد شوید.");
      return;
    }
    if (!response.ok) {
      let errorMsg = `وضعیت پاسخ نامعتبر بود (${response.status})`;
      if (response.status === 404) {
        errorMsg = "فهرست تیکت‌ها یافت نشد.";
      } else if (response.status >= 500) {
        errorMsg = "خطای سرور رخ داده است. لطفاً بعداً تلاش کنید.";
      } else if (response.status >= 400 && response.status < 500) {
        errorMsg = "درخواست نامعتبر است. تنظیمات را بررسی کنید.";
      }
      throw new Error(errorMsg);
    }

    let payload;
    try {
      payload = await response.json();
    } catch (parseError) {
      throw new Error("پاسخ سرور نامعتبر است. لطفاً دوباره تلاش کنید.");
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error("داده‌های دریافتی نامعتبر است.");
    }

    const rawTickets = extractTickets(payload);
    if (!Array.isArray(rawTickets)) {
      throw new Error("فرمت داده‌های تیکت‌ها نامعتبر است.");
    }

    const normalizedTickets = rawTickets.map(normalizeTicket);
    state.tickets = normalizedTickets;
    state.error = null;
    ensureActiveTicket(state.tickets);
    if (showSuccess) {
      showFeedback("فهرست تیکت‌ها به‌روزرسانی شد.");
    }
  } catch (error) {
    console.error("خطا در دریافت تیکت‌ها:", error);
    state.error = error.message || "خطای نامشخص در دریافت اطلاعات.";

    if (error.name === "TypeError" && error.message.includes("Failed to fetch")) {
      showFeedback("خطای شبکه. لطفاً اتصال اینترنت خود را بررسی کنید.", "error");
    } else if (error.name === "AbortError") {
      showFeedback("درخواست زمان‌بر شد. لطفاً دوباره تلاش کنید.", "warning");
    } else if (!state.tickets.length) {
      showFeedback(`${state.error} بارگذاری با خطا مواجه شد.`, "error");
    } else {
      showFeedback("خطایی رخ داد. داده‌های فعلی نمایش داده می‌شود.", "warning");
    }
  } finally {
    window.clearTimeout(timeoutId);
    state.isLoading = false;
    renderTicketList();
    updateStatistics();
  }
}

function init() {
  if (!elements.list || !elements.detail) {
    return;
  }
  bindFilters();
  renderTicketList();
  void loadTickets({ showLoader: true });
}

function getInitials(name) {
  if (!name) return "؟";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2);
  }
  return (parts[0][0] || "") + (parts[parts.length - 1][0] || "");
}

async function bootstrapTicketsModule() {
  const adminUser = await adminReady;
  if (!adminUser) {
    return;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init();
    });
  } else {
    init();
  }
}

void bootstrapTicketsModule();
