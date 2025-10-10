const ticketsData = [
  {
    id: "TK-1092",
    subject: "عدم دریافت جایزه تورنمنت هفته قبل",
    status: "waiting",
    priority: "high",
    channel: "tournament",
    createdAt: "2024-09-15T08:20:00+03:30",
    updatedAt: "2024-09-17T10:35:00+03:30",
    slaDue: "2024-09-17T12:00:00+03:30",
    unread: true,
    csat: null,
    assignedTo: "علیرضا شریف",
    watchers: ["سارا فیاضی", "رضا عباسی"],
    user: {
      name: "محدثه محمدی",
      gamerTag: "MahdiMM",
    },
    tags: ["جایزه", "مالی"],
    metrics: {
      totalMessages: 4,
      firstResponseAt: "2024-09-15T09:10:00+03:30",
      lastPublicReply: "2024-09-16T16:30:00+03:30",
    },
    messages: [
      {
        author: "user",
        authorName: "محدثه محمدی",
        timestamp: "2024-09-15T08:20:00+03:30",
        content:
          "سلام. من در تورنمنت آخر قهرمان شدم ولی هنوز جم‌های جایزه به حسابم نیومده. لطفا پیگیری کنید.",
      },
      {
        author: "admin",
        authorName: "علیرضا شریف",
        timestamp: "2024-09-15T09:10:00+03:30",
        content:
          "سلام محدثه عزیز. جایزه شما در صف پرداخت قرار گرفته بود. وضعیت رو بررسی کردیم و برای تیم مالی ارجاع دادیم. در اسرع وقت اطلاع می‌دیم.",
      },
      {
        author: "note",
        authorName: "علیرضا شریف",
        timestamp: "2024-09-15T09:12:00+03:30",
        content: "ارجاع به مالی - اولویت بالا به دلیل بازیکن VIP.",
      },
      {
        author: "user",
        authorName: "محدثه محمدی",
        timestamp: "2024-09-17T10:30:00+03:30",
        content: "سلام مجدد. هنوز جایزه واریز نشده. لطفا سریع‌تر بررسی کنید.",
      },
    ],
  },
  {
    id: "TK-1054",
    subject: "خطای پرداخت هنگام خرید جم",
    status: "answered",
    priority: "urgent",
    channel: "payment",
    createdAt: "2024-09-14T12:05:00+03:30",
    updatedAt: "2024-09-14T18:42:00+03:30",
    slaDue: "2024-09-14T16:05:00+03:30",
    unread: false,
    csat: 88,
    assignedTo: "نسرین احمدی",
    watchers: ["هادی بنی اسد"],
    user: {
      name: "پارسا نادری",
      gamerTag: "ParsaLegend",
    },
    tags: ["پرداخت", "خطای بانکی"],
    metrics: {
      totalMessages: 5,
      firstResponseAt: "2024-09-14T12:20:00+03:30",
      lastPublicReply: "2024-09-14T18:40:00+03:30",
    },
    messages: [
      {
        author: "user",
        authorName: "پارسا نادری",
        timestamp: "2024-09-14T12:05:00+03:30",
        content:
          "سلام. موقع خرید جم خطای تراکنش می‌گیرم. مبلغ از حسابم کم می‌شه ولی جم اضافه نمی‌شه.",
      },
      {
        author: "admin",
        authorName: "نسرین احمدی",
        timestamp: "2024-09-14T12:20:00+03:30",
        content:
          "درود پارسا. لاگ تراکنش شما بررسی شد. مبلغ به‌صورت معلق در بانک باقی مونده و حداکثر تا ۷۲ ساعت برمی‌گرده. در صورت عدم بازگشت اطلاع دهید.",
        attachments: [
          {
            name: "TransactionLog-1054.pdf",
            size: "245KB",
          },
        ],
      },
      {
        author: "note",
        authorName: "نسرین احمدی",
        timestamp: "2024-09-14T12:32:00+03:30",
        content: "برای مانیتورینگ تراکنش در تسویه فردا یادآوری تنظیم شد.",
      },
      {
        author: "user",
        authorName: "پارسا نادری",
        timestamp: "2024-09-14T18:35:00+03:30",
        content: "مبلغ برگشت خورد. تشکر از پیگیری.",
      },
      {
        author: "admin",
        authorName: "نسرین احمدی",
        timestamp: "2024-09-14T18:40:00+03:30",
        content: "خوشحالیم که مشکل حل شد. اگر مورد دیگری بود اطلاع بدید.",
      },
    ],
  },
  {
    id: "TK-1120",
    subject: "عدم امکان ورود دو مرحله‌ای",
    status: "new",
    priority: "medium",
    channel: "account",
    createdAt: "2024-09-17T19:10:00+03:30",
    updatedAt: "2024-09-17T19:10:00+03:30",
    slaDue: "2024-09-18T19:10:00+03:30",
    unread: true,
    csat: null,
    assignedTo: null,
    watchers: [],
    user: {
      name: "یگانه نیازی",
      gamerTag: "YeganehNX",
    },
    tags: ["حساب کاربری", "امنیت"],
    metrics: {
      totalMessages: 1,
      firstResponseAt: null,
      lastPublicReply: null,
    },
    messages: [
      {
        author: "user",
        authorName: "یگانه نیازی",
        timestamp: "2024-09-17T19:10:00+03:30",
        content:
          "سلام. پیامک ورود دو مرحله‌ای برای من ارسال نمی‌شه و نمی‌تونم وارد حسابم بشم.",
      },
    ],
  },
  {
    id: "TK-1018",
    subject: "پیشنهاد برای بهبود سیستم کلن",
    status: "resolved",
    priority: "low",
    channel: "website",
    createdAt: "2024-09-10T09:00:00+03:30",
    updatedAt: "2024-09-13T17:40:00+03:30",
    slaDue: "2024-09-12T09:00:00+03:30",
    unread: false,
    csat: 92,
    assignedTo: "کسری سادات",
    watchers: ["نسرین احمدی"],
    user: {
      name: "مانی حق‌شناس",
      gamerTag: "ManiHS",
    },
    tags: ["پیشنهاد", "کلن"],
    metrics: {
      totalMessages: 3,
      firstResponseAt: "2024-09-10T10:00:00+03:30",
      lastPublicReply: "2024-09-13T17:40:00+03:30",
    },
    messages: [
      {
        author: "user",
        authorName: "مانی حق‌شناس",
        timestamp: "2024-09-10T09:00:00+03:30",
        content:
          "سلام. پیشنهاد می‌کنم امکان زمان‌بندی رویداد برای کلن‌ها اضافه بشه تا بتونیم برنامه‌ریزی کنیم.",
      },
      {
        author: "admin",
        authorName: "کسری سادات",
        timestamp: "2024-09-10T10:00:00+03:30",
        content:
          "مانی عزیز ممنون از پیشنهاد خوبت. درخواست رو به تیم محصول منتقل کردیم و در به‌روزرسانی بعدی بررسی می‌شه.",
      },
      {
        author: "admin",
        authorName: "کسری سادات",
        timestamp: "2024-09-13T17:40:00+03:30",
        content: "به‌روزرسانی: این قابلیت در نقشه‌راه سه‌ماهه اضافه شد.",
      },
    ],
  },
  {
    id: "TK-1112",
    subject: "باگ در نمایش رتبه لیدربرد",
    status: "waiting",
    priority: "urgent",
    channel: "website",
    createdAt: "2024-09-16T22:45:00+03:30",
    updatedAt: "2024-09-17T08:15:00+03:30",
    slaDue: "2024-09-17T10:45:00+03:30",
    unread: false,
    csat: null,
    assignedTo: "سحر موحد",
    watchers: ["نسرین احمدی", "تیم فنی"],
    user: {
      name: "پرهام صالحی",
      gamerTag: "ParhamPro",
    },
    tags: ["باگ", "لیدربرد"],
    metrics: {
      totalMessages: 6,
      firstResponseAt: "2024-09-16T22:55:00+03:30",
      lastPublicReply: "2024-09-17T08:10:00+03:30",
    },
    messages: [
      {
        author: "user",
        authorName: "پرهام صالحی",
        timestamp: "2024-09-16T22:45:00+03:30",
        content:
          "سلام. رتبه من در لیدربرد درست نمایش داده نمی‌شه و ۵ تا جایگاه افتاده پایین‌تر.",
      },
      {
        author: "admin",
        authorName: "سحر موحد",
        timestamp: "2024-09-16T22:55:00+03:30",
        content:
          "پرهام عزیز، مشکل شما در حال بررسیه. به نظر می‌رسه کش سرویس به‌روزرسانی نشده. پس از رفع، اطلاع می‌دیم.",
      },
      {
        author: "note",
        authorName: "سحر موحد",
        timestamp: "2024-09-16T23:10:00+03:30",
        content: "منتظر پاسخ تیم بک‌اند. اگر تا صبح حل نشد ارجاع به سطح دو.",
      },
      {
        author: "admin",
        authorName: "سحر موحد",
        timestamp: "2024-09-17T08:10:00+03:30",
        content: "در حال نهایی‌سازی اصلاح کش هستیم. در اولین فرصت نتیجه رو اطلاع می‌دیم.",
      },
    ],
  },
  {
    id: "TK-1101",
    subject: "تقاضای انتقال مالکیت تیم",
    status: "answered",
    priority: "medium",
    channel: "tournament",
    createdAt: "2024-09-12T15:30:00+03:30",
    updatedAt: "2024-09-13T09:20:00+03:30",
    slaDue: "2024-09-14T15:30:00+03:30",
    unread: false,
    csat: 96,
    assignedTo: "علیرضا شریف",
    watchers: [],
    user: {
      name: "سمانه خدابنده",
      gamerTag: "SamanehX",
    },
    tags: ["تیم", "مالکیت"],
    metrics: {
      totalMessages: 3,
      firstResponseAt: "2024-09-12T15:50:00+03:30",
      lastPublicReply: "2024-09-13T09:18:00+03:30",
    },
    messages: [
      {
        author: "user",
        authorName: "سمانه خدابنده",
        timestamp: "2024-09-12T15:30:00+03:30",
        content:
          "سلام. می‌خوام مالکیت تیم رو به یکی از هم‌تیمی‌ها منتقل کنم. روندش چطوریه؟",
      },
      {
        author: "admin",
        authorName: "علیرضا شریف",
        timestamp: "2024-09-12T15:50:00+03:30",
        content:
          "سلام سمانه. لینک تایید برای مالک فعلی و مالک جدید ارسال شد. بعد از تایید دوطرف مالکیت منتقل می‌شه.",
      },
      {
        author: "admin",
        authorName: "علیرضا شریف",
        timestamp: "2024-09-13T09:18:00+03:30",
        content: "مالکیت با موفقیت منتقل شد و درخواست بسته شد.",
      },
    ],
  },
];

const state = {
  tickets: typeof structuredClone === "function" ? structuredClone(ticketsData) : JSON.parse(JSON.stringify(ticketsData)),
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
};

function showFeedback(message, type = "success") {
  if (!elements.feedback) return;
  elements.feedback.innerHTML = `<div class="feedback feedback--${type}">${message}</div>`;
  setTimeout(() => {
    if (elements.feedback) {
      elements.feedback.innerHTML = "";
    }
  }, 3600);
}

function formatRelativeTime(dateLike) {
  if (!dateLike) return "نامشخص";
  const date = new Date(dateLike);
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
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateLike));
}

function formatTimeRemaining(ticket) {
  if (!ticket.slaDue) return "-";
  const due = new Date(ticket.slaDue);
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
  return new Date(ticket.slaDue) < new Date();
}

function applyFilters() {
  const { search, status, priority, channel, from, to, quick } = state.filters;
  const term = search.trim().toLowerCase();
  return state.tickets
    .filter((ticket) => {
      const created = new Date(ticket.createdAt);
      const matchesSearch =
        term.length === 0 ||
        [
          ticket.id,
          ticket.subject,
          ticket.user?.name,
          ticket.user?.gamerTag,
          ticket.tags.join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);

      if (!matchesSearch) return false;

      const matchesStatus = status === "all" || ticket.status === status;
      if (!matchesStatus) return false;

      const matchesPriority = priority === "all" || ticket.priority === priority;
      if (!matchesPriority) return false;

      const matchesChannel = channel === "all" || ticket.channel === channel;
      if (!matchesChannel) return false;

      if (from && created < new Date(from)) return false;
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        if (created > toDate) return false;
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

function getInitials(name) {
  if (!name) return "؟";
  const parts = name.trim().split(" ");
  if (parts.length === 1) {
    return parts[0].slice(0, 2);
  }
  return (parts[0][0] || "") + (parts[parts.length - 1][0] || "");
}

function renderTicketList() {
  if (!elements.list) return;
  const tickets = applyFilters();
  state.filteredTickets = tickets;

  if (tickets.length === 0) {
    elements.list.innerHTML = `
      <div class="tickets-list__header">هیچ تیکتی با فیلترهای انتخابی یافت نشد.</div>
    `;
    renderTicketDetail(null);
    updateStatistics();
    return;
  }

  if (!tickets.some((ticket) => ticket.id === state.activeTicketId)) {
    state.activeTicketId = tickets[0]?.id || null;
  }

  state.replyMode = 'reply';

  const items = tickets
    .map((ticket) => {
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
            <span class="${priorityTag}">${priorityDictionary[ticket.priority]}</span>
            <span class="${channelTag}">${channelDictionary[ticket.channel]}</span>
            ${ticket.tags
              .map((tag) => `<span class="tag-chip">${tag}</span>`)
              .join("")}
          </div>
        </button>
      `;
    })
    .join("");

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

function findTicketById(id) {
  return state.tickets.find((ticket) => ticket.id === id) || null;
}

function markTicketAsRead(ticketId) {
  const ticket = findTicketById(ticketId);
  if (ticket) {
    ticket.unread = false;
  }
}

function renderTicketDetail(ticket) {
  if (!elements.detail) return;
  if (!ticket) {
    elements.detail.innerHTML = `
      <div class="ticket-placeholder">
        <h3>یک تیکت را انتخاب کنید</h3>
        <p>برای مشاهده گفتگو و پاسخ‌دهی، از فهرست تیکت‌ها مورد دلخواه را انتخاب کنید.</p>
      </div>
    `;
    return;
  }

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
        <strong>${ticket.metrics.firstResponseAt ? formatRelativeTime(ticket.metrics.firstResponseAt) : "در انتظار"}</strong>
      </div>
      <div class="metric-card">
        <span>آخرین پیام عمومی</span>
        <strong>${ticket.metrics.lastPublicReply ? formatRelativeTime(ticket.metrics.lastPublicReply) : "هنوز ارسال نشده"}</strong>
      </div>
    </div>
    <div class="ticket-tags">
      <span class="tag-chip tag-chip--priority-${ticket.priority}">${priorityDictionary[ticket.priority]}</span>
      <span class="tag-chip tag-chip--channel-${ticket.channel}">${channelDictionary[ticket.channel]}</span>
      ${ticket.tags.map((tag) => `<span class="tag-chip">${tag}</span>`).join("")}
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
        <button type="button" class="reply-tab ${state.replyMode === "reply" ? "is-active" : ""}" data-reply-mode="reply">پاسخ به کاربر</button>
        <button type="button" class="reply-tab ${state.replyMode === "note" ? "is-active" : ""}" data-reply-mode="note">یادداشت داخلی</button>
      </div>
      <select data-reply-template>
        <option value="">انتخاب پاسخ آماده...</option>
        <option value="template-welcome">تشکر از کاربر</option>
        <option value="template-delay">اطلاع از پیگیری</option>
        <option value="template-closed">اطلاع از بستن تیکت</option>
      </select>
      <textarea data-reply-text placeholder="پیام خود را بنویسید..."></textarea>
      <div class="reply-toolbar">
        <div class="reply-toolbar-left">
          <label>
            پیوست فایل
            <input type="file" multiple data-reply-attachment>
          </label>
          <button type="button" data-action="insert-summary">خلاصه خودکار</button>
        </div>
        <div class="reply-toolbar-right">
          <label class="inline-checkbox">
            <input type="checkbox" data-close-after-send>
            پس از ارسال تیکت بسته شود
          </label>
          <button type="submit" class="primary-action">ارسال</button>
        </div>
      </div>
    </form>
  `;

  bindDetailEvents(ticket);
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
  const attachments = (message.attachments || [])
    .map(
      (file) =>
        `<span class="message-attachment">📎 ${file.name}<small> (${file.size})</small></span>`
    )
    .join("");

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
    .querySelector("[data-action=escalate]")
    ?.addEventListener("click", () => {
      showFeedback("تیکت برای تیم سطح بالاتر ارجاع شد.", "warning");
    });

  elements.detail
    .querySelector("[data-action=insert-summary]")
    ?.addEventListener("click", () => {
      const summary = buildAutoSummary(ticket);
      replyTextarea.value = summary;
      showFeedback("خلاصه گفتگو به متن اضافه شد.");
    });

  replyTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.replyMode = tab.dataset.replyMode;
      replyTabs.forEach((other) => other.classList.toggle("is-active", other === tab));
      if (state.replyMode === "note") {
        closeAfterSend.checked = false;
        closeAfterSend.disabled = true;
      } else {
        closeAfterSend.disabled = false;
      }
    });
  });

  replyTemplate?.addEventListener("change", (event) => {
    const templateText = getTemplateText(event.target.value, ticket);
    if (templateText) {
      replyTextarea.value = templateText;
    }
  });

  replyForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const messageText = replyTextarea.value.trim();
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
    ticket.metrics.totalMessages = ticket.messages.length;
    if (state.replyMode !== "note") {
      ticket.metrics.lastPublicReply = newMessage.timestamp;
    }
    if (!ticket.metrics.firstResponseAt && state.replyMode !== "note") {
      ticket.metrics.firstResponseAt = newMessage.timestamp;
    }

    if (state.replyMode !== "note") {
      ticket.status = closeAfterSend?.checked ? "resolved" : "answered";
    }

    replyTextarea.value = "";
    closeAfterSend.checked = false;
    elements.detail.querySelector("[data-ticket-thread]").innerHTML = ticket.messages
      .map(renderMessage)
      .join("");
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
  const ticket = findTicketById(ticketId);
  if (!ticket) return;
  if (!statusDictionary[status]) return;
  ticket.status = status;
  ticket.updatedAt = new Date().toISOString();
}

function updateStatistics() {
  if (!elements.stats.total) return;
  const total = state.tickets.length;
  const waiting = state.tickets.filter((ticket) => ticket.status === "waiting" || ticket.status === "new").length;
  const overdue = state.tickets.filter(isOverdue).length;
  const csatValues = state.tickets
    .map((ticket) => ticket.csat)
    .filter((value) => typeof value === "number");
  const csatAverage = csatValues.length
    ? Math.round(csatValues.reduce((sum, value) => sum + value, 0) / csatValues.length)
    : 0;

  elements.stats.total.textContent = total;
  elements.stats.waiting.textContent = waiting;
  elements.stats.overdue.textContent = overdue;
  elements.stats.csat.textContent = `${csatAverage}%`;
}

function bindFilters() {
  document.querySelector("[data-action=search]")?.addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    renderTicketList();
  });

  document.querySelectorAll("[data-filter]").forEach((element) => {
    element.addEventListener("change", () => {
      const filterName = element.dataset.filter;
      state.filters[filterName] = element.value || null;
      renderTicketList();
    });
  });

  document.querySelectorAll("[data-quick]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.quick = button.dataset.quick;
      document
        .querySelectorAll("[data-quick]")
        .forEach((btn) => btn.classList.toggle("is-active", btn === button));
      renderTicketList();
    });
  });

  document.querySelector("[data-action=export]")?.addEventListener("click", () => {
    showFeedback("گزارش وضعیت تیکت‌ها آماده و برای دانلود در دسترس قرار گرفت.");
  });
}

function init() {
  if (!elements.list || !elements.detail) {
    return;
  }
  bindFilters();
  updateStatistics();
  renderTicketList();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
