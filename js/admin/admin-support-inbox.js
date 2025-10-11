import {
  applyModalState,
  fetchJsonList,
  fetchWithAuth,
  formatDateTime,
  formatNumber,
} from "./admin-api.js";

const state = {
  tickets: [],
  filtered: [],
  selectedTicket: null,
  messages: new Map(),
  filters: {
    search: "",
    status: "all",
  },
};

const elements = {
  listBody: document.querySelector('.inbox-list__body'),
  listPlaceholder: document.querySelector('.inbox-list__placeholder'),
  thread: document.querySelector('[data-role="ticket-thread"]'),
  threadPlaceholder: document.querySelector('.inbox-thread__placeholder'),
  filters: document.querySelectorAll('[data-filter]'),
  composer: document.querySelector('[data-role="composer"]'),
  composerForm: document.querySelector('[data-form="reply"]'),
  composerFeedback: document.querySelector('[data-role="composer-feedback"]'),
  composerTitle: document.querySelector('[data-field="ticket-title"]'),
  composerStatus: document.querySelector('[data-field="ticket-status"]'),
  composeModal: document.getElementById('compose-message'),
  composeForm: document.querySelector('[data-form="compose"]'),
  refreshButton: document.querySelector('[data-action="refresh-inbox"]'),
  composeButton: document.querySelector('[data-action="compose-message"]'),
  archiveButton: document.querySelector('[data-action="archive-closed"]'),
};

init().catch((error) => console.error('Failed to initialise support inbox', error));

async function init() {
  bindEvents();
  await loadTickets();
}

function bindEvents() {
  elements.filters.forEach((input) => {
    input.addEventListener('input', handleFilterChange);
    input.addEventListener('change', handleFilterChange);
  });

  if (elements.refreshButton) {
    elements.refreshButton.addEventListener('click', (event) => {
      event.preventDefault();
      void loadTickets();
    });
  }

  if (elements.composeButton) {
    elements.composeButton.addEventListener('click', (event) => {
      event.preventDefault();
      openModal(elements.composeModal);
    });
  }

  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      closeModal(button.closest('.modal'));
    });
  });

  if (elements.composerForm) {
    elements.composerForm.addEventListener('submit', handleComposerSubmit);
  }

  const cancelButton = document.querySelector('[data-action="cancel-compose"]');
  if (cancelButton) {
    cancelButton.addEventListener('click', (event) => {
      event.preventDefault();
      resetComposer();
    });
  }

  if (elements.composeForm) {
    elements.composeForm.addEventListener('submit', handleComposeModalSubmit);
  }

  if (elements.archiveButton) {
    elements.archiveButton.addEventListener('click', handleArchiveClick);
  }
}

async function loadTickets() {
  try {
    const tickets = await fetchJsonList('/api/support/tickets/');
    state.tickets = tickets;
    applyFilters();
  } catch (error) {
    renderListPlaceholder('خطا در دریافت تیکت‌ها');
    console.error('Failed to load tickets', error);
  }
}

function handleFilterChange(event) {
  const field = event.target.getAttribute('data-filter');
  if (!field) return;
  state.filters[field] = event.target.value;
  applyFilters();
}

function applyFilters() {
  let items = [...state.tickets];
  const { search, status } = state.filters;

  if (search) {
    const normalized = search.trim().toLowerCase();
    items = items.filter((ticket) => {
      const title = (ticket.title || '').toLowerCase();
      const id = String(ticket.id || '').toLowerCase();
      return title.includes(normalized) || id.includes(normalized);
    });
  }

  if (status !== 'all') {
    items = items.filter((ticket) => (ticket.status || '').toLowerCase() === status);
  }

  state.filtered = items;
  renderTicketList();
}

function renderTicketList() {
  if (!elements.listBody) return;
  if (!state.filtered.length) {
    renderListPlaceholder('مکالمه‌ای یافت نشد.');
    return;
  }
  elements.listBody.innerHTML = state.filtered
    .map((ticket) => {
      const status = (ticket.status || '').toLowerCase();
      const lastMessage = getLastMessage(ticket);
      return `<article class="ticket-item" data-id="${ticket.id}">
        <h3 class="ticket-item__title">${escapeHtml(ticket.title || 'بدون عنوان')}</h3>
        <div class="ticket-item__meta">
          <span>${resolveTicketOwner(ticket)}</span>
          <span>${lastMessage ? formatDateTime(lastMessage.created_at) : '---'}</span>
        </div>
        <span class="ticket-item__status">${status === 'closed' ? 'بسته شده' : 'باز'}</span>
      </article>`;
    })
    .join('');

  elements.listBody.querySelectorAll('.ticket-item').forEach((item) => {
    item.addEventListener('click', () => selectTicket(item.getAttribute('data-id')));
  });
}

function renderListPlaceholder(message) {
  if (!elements.listBody) return;
  elements.listBody.innerHTML = `<div class="inbox-list__placeholder">${escapeHtml(message)}</div>`;
}

function selectTicket(id) {
  if (!id) return;
  const ticket = state.tickets.find((item) => String(item.id) === String(id));
  if (!ticket) return;
  state.selectedTicket = ticket;
  highlightSelectedTicket(id);
  loadTicketThread(ticket);
}

function highlightSelectedTicket(id) {
  if (!elements.listBody) return;
  elements.listBody.querySelectorAll('.ticket-item').forEach((item) => {
    item.classList.toggle('is-active', item.getAttribute('data-id') === String(id));
  });
}

async function loadTicketThread(ticket) {
  showComposer(ticket);
  const cached = state.messages.get(ticket.id);
  if (cached) {
    renderThread(ticket, cached);
    return;
  }
  renderThreadPlaceholder('در حال بارگذاری پیام‌ها...');
  try {
    const messages = await fetchJsonList(`/api/support/tickets/${ticket.id}/messages/`);
    state.messages.set(ticket.id, messages);
    renderThread(ticket, messages);
  } catch (error) {
    renderThreadPlaceholder('خطا در دریافت پیام‌ها');
    console.error('Failed to load ticket messages', error);
  }
}

function renderThread(ticket, messages) {
  if (!elements.thread) return;
  const header = `<header class="thread-header">
    <h2>${escapeHtml(ticket.title || 'بدون عنوان')}</h2>
    <div class="thread-meta">
      <span>شناسه: #${formatNumber(ticket.id)}</span>
      <span>وضعیت: ${(ticket.status || 'open') === 'closed' ? 'بسته' : 'باز'}</span>
      <span>ایجاد: ${ticket.created_at ? formatDateTime(ticket.created_at) : '---'}</span>
    </div>
  </header>`;

  const body = `<div class="thread-body">${messages
    .map((message) => renderMessage(message))
    .join('')}</div>`;

  elements.thread.innerHTML = header + body;
}

function renderThreadPlaceholder(message) {
  if (!elements.thread) return;
  elements.thread.innerHTML = `<div class="inbox-thread__placeholder">${escapeHtml(message)}</div>`;
}

function renderMessage(message) {
  const isAdmin = Boolean(message.user && message.user.is_staff);
  const author = resolveMessageAuthor(message);
  return `<article class="message ${isAdmin ? 'message--admin' : ''}">
    <div class="message__meta">
      <span>${escapeHtml(author)}</span>
      <span>${message.created_at ? formatDateTime(message.created_at) : '---'}</span>
    </div>
    <p class="message__content">${escapeHtml(message.message || '')}</p>
  </article>`;
}

function showComposer(ticket) {
  if (!elements.composer || !elements.composerForm) return;
  elements.composer.hidden = false;
  elements.composerForm.elements.ticket_id.value = ticket.id;
  if (elements.composerTitle) {
    elements.composerTitle.textContent = ticket.title || `تیکت #${ticket.id}`;
  }
  if (elements.composerStatus) {
    elements.composerStatus.textContent = (ticket.status || 'open') === 'closed' ? 'بسته' : 'باز';
  }
}

async function handleComposerSubmit(event) {
  event.preventDefault();
  const form = elements.composerForm;
  const feedback = elements.composerFeedback;
  setFeedback(feedback, '', false);
  const formData = new FormData(form);
  const ticketId = formData.get('ticket_id');
  const message = formData.get('message');
  const internal = formData.get('internal');
  if (!ticketId || !message) {
    setFeedback(feedback, 'ورود پیام الزامی است.');
    return;
  }
  try {
    const content = internal ? `[یادداشت داخلی] ${message}` : message;
    await fetchWithAuth(`/api/support/tickets/${ticketId}/messages/`, {
      method: 'POST',
      body: { ticket: Number(ticketId), message: content },
    });
    setFeedback(feedback, 'پیام با موفقیت ارسال شد.', true);
    form.reset();
    state.messages.delete(Number(ticketId));
    const ticket = state.tickets.find((item) => String(item.id) === String(ticketId));
    if (ticket) {
      await loadTicketThread(ticket);
    }
  } catch (error) {
    setFeedback(feedback, error.message || 'ارسال پیام با خطا مواجه شد.');
  }
}

async function handleComposeModalSubmit(event) {
  event.preventDefault();
  const form = elements.composeForm;
  const feedback = form.querySelector('[data-role="compose-feedback"]');
  setFeedback(feedback, '', false);
  const formData = new FormData(form);
  const ticketId = formData.get('ticket_id');
  const title = formData.get('title');
  const message = formData.get('message');
  if (!ticketId || !message) {
    setFeedback(feedback, 'شناسه تیکت و پیام الزامی است.');
    return;
  }
  try {
    const content = title ? `${title}\n${message}` : message;
    await fetchWithAuth(`/api/support/tickets/${ticketId}/messages/`, {
      method: 'POST',
      body: { ticket: Number(ticketId), message: content },
    });
    setFeedback(feedback, 'پیام ثبت شد.', true);
    form.reset();
    closeModal(elements.composeModal);
    state.messages.delete(Number(ticketId));
    const ticket = state.tickets.find((item) => String(item.id) === String(ticketId));
    if (ticket) await loadTicketThread(ticket);
  } catch (error) {
    setFeedback(feedback, error.message || 'ارسال پیام با خطا همراه بود.');
  }
}

function handleArchiveClick(event) {
  event.preventDefault();
  state.filters.status = 'closed';
  elements.filters.forEach((input) => {
    if (input.getAttribute('data-filter') === 'status') {
      input.value = 'closed';
    }
  });
  applyFilters();
}

function getLastMessage(ticket) {
  if (Array.isArray(ticket.messages) && ticket.messages.length) {
    return ticket.messages[ticket.messages.length - 1];
  }
  const cached = state.messages.get(ticket.id);
  return cached && cached.length ? cached[cached.length - 1] : null;
}

function resolveTicketOwner(ticket) {
  if (ticket.user && (ticket.user.username || ticket.user.name)) {
    return ticket.user.username || ticket.user.name;
  }
  if (ticket.user_id) {
    return `کاربر ${ticket.user_id}`;
  }
  return 'کاربر ناشناس';
}

function resolveMessageAuthor(message) {
  if (message.user && (message.user.username || message.user.name)) {
    return message.user.username || message.user.name;
  }
  if (message.user_id) {
    return `کاربر ${message.user_id}`;
  }
  return 'سیستم';
}

function setFeedback(target, message, success = false) {
  if (!target) return;
  target.textContent = message;
  target.classList.toggle('is-success', Boolean(success));
  target.classList.toggle('is-error', !success && Boolean(message));
}

function resetComposer() {
  if (!elements.composerForm) return;
  elements.composerForm.reset();
  setFeedback(elements.composerFeedback, '', false);
}

function openModal(modal) {
  if (!modal) return;
  applyModalState(modal, true);
}

function closeModal(modal) {
  if (!modal) return;
  applyModalState(modal, false);
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
