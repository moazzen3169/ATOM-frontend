import {
  applyModalState,
  fetchJsonList,
  fetchWithAuth,
  formatCurrency,
  formatDateTime,
  formatNumber,
} from "./admin-api.js";

const state = {
  transactions: [],
  filtered: [],
  filters: {
    search: "",
    status: "all",
    from: "",
    to: "",
    quick: "all",
  },
  statusOverrides: {},
  selectedTransaction: null,
};

const elements = {
  tableBody: document.querySelector('[data-table="withdrawals"] tbody'),
  analytics: {
    today: document.querySelector('[data-field="today-total"]'),
    overdue: document.querySelector('[data-field="overdue-count"]'),
    average: document.querySelector('[data-field="avg-amount"]'),
    month: document.querySelector('[data-field="month-total"]'),
  },
  filters: document.querySelectorAll('[data-filter]'),
  chips: document.querySelectorAll('.toolbar-chip'),
  refreshButton: document.querySelector('[data-action="refresh-withdrawals"]'),
  updateModal: document.getElementById('update-withdraw'),
  updateForm: document.querySelector('[data-form="update-withdraw"]'),
  messageModal: document.getElementById('send-withdraw-message'),
  messageForm: document.querySelector('[data-form="withdraw-message"]'),
};

init().catch((error) => console.error('Failed to initialise withdrawals page', error));

async function init() {
  bindEvents();
  await loadTransactions();
}

function bindEvents() {
  elements.filters.forEach((input) => {
    input.addEventListener('change', handleFilterChange);
    input.addEventListener('input', handleFilterChange);
  });

  elements.chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      elements.chips.forEach((item) => item.classList.remove('is-active'));
      chip.classList.add('is-active');
      state.filters.quick = chip.getAttribute('data-quick') || 'all';
      applyFilters();
    });
  });

  if (elements.refreshButton) {
    elements.refreshButton.addEventListener('click', (event) => {
      event.preventDefault();
      void loadTransactions();
    });
  }

  document.querySelectorAll('[data-modal-target]').forEach((trigger) => {
    const targetId = trigger.getAttribute('data-modal-target');
    const modal = document.getElementById(targetId);
    if (!modal) return;
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openModal(modal);
    });
  });

  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      closeModal(button.closest('.modal'));
    });
  });

  if (elements.updateForm) {
    elements.updateForm.addEventListener('submit', handleUpdateSubmit);
  }
  if (elements.messageForm) {
    elements.messageForm.addEventListener('submit', handleMessageSubmit);
  }
}

async function loadTransactions() {
  try {
    const transactions = await fetchJsonList('/api/wallet/transactions/');
    const withdrawals = transactions.filter((tx) =>
      (tx.transaction_type || tx.type) === 'withdrawal'
    );
    state.transactions = withdrawals.map((tx) => ({
      ...tx,
      derivedStatus: state.statusOverrides[tx.id] || inferStatusFromDescription(tx.description),
    }));
    applyFilters();
    updateAnalytics();
  } catch (error) {
    renderTableError('خطا در دریافت تراکنش‌های برداشت');
    console.error('Failed to load withdrawals', error);
  }
}

function handleFilterChange(event) {
  const field = event.target.getAttribute('data-filter');
  if (!field) return;
  state.filters[field] = event.target.value;
  applyFilters();
}

function applyFilters() {
  let items = [...state.transactions];
  const { search, status, from, to, quick } = state.filters;

  if (search) {
    const normalized = search.trim().toLowerCase();
    items = items.filter((item) => {
      const description = (item.description || '').toLowerCase();
      const id = String(item.id || '').toLowerCase();
      return description.includes(normalized) || id.includes(normalized);
    });
  }

  if (status !== 'all') {
    items = items.filter((item) => resolveStatus(item) === status);
  }

  if (from) {
    const fromDate = new Date(from).getTime();
    items = items.filter((item) => {
      const timestamp = toTimestamp(item);
      return timestamp && timestamp >= fromDate;
    });
  }

  if (to) {
    const toDate = new Date(to).getTime();
    items = items.filter((item) => {
      const timestamp = toTimestamp(item);
      return timestamp && timestamp <= toDate + 24 * 60 * 60 * 1000;
    });
  }

  if (quick !== 'all') {
    items = items.filter((item) => applyQuickFilter(item, quick));
  }

  state.filtered = items;
  renderTable();
}

function renderTable() {
  if (!elements.tableBody) return;
  if (!state.filtered.length) {
    elements.tableBody.innerHTML =
      '<tr><td colspan="7" class="data-table__empty">برداشتی یافت نشد.</td></tr>';
    return;
  }

  elements.tableBody.innerHTML = state.filtered
    .map((item) => {
      const status = resolveStatus(item);
      return `<tr data-id="${item.id}">
        <td>#${formatNumber(item.id)}</td>
        <td>${escapeHtml(resolveUserLabel(item))}</td>
        <td>${formatCurrency(item.amount || 0)}</td>
        <td>${escapeHtml(item.description || '')}</td>
        <td>${item.timestamp ? formatDateTime(item.timestamp) : 'نامشخص'}</td>
        <td>${renderStatusBadge(status)}</td>
        <td class="data-table__actions">
          <button class="data-table__btn" data-action="update" data-id="${item.id}"><i class="ti ti-check"></i><span>به‌روزرسانی</span></button>
          <button class="data-table__btn" data-action="message" data-id="${item.id}"><i class="ti ti-message"></i><span>پیام</span></button>
        </td>
      </tr>`;
    })
    .join('');

  elements.tableBody.querySelectorAll('button[data-action]').forEach((button) => {
    button.addEventListener('click', handleTableAction);
  });
}

function renderTableError(message) {
  if (!elements.tableBody) return;
  elements.tableBody.innerHTML = `<tr><td colspan="7" class="data-table__empty">${escapeHtml(message)}</td></tr>`;
}

function handleTableAction(event) {
  event.preventDefault();
  const button = event.currentTarget;
  const action = button.getAttribute('data-action');
  const id = button.getAttribute('data-id');
  const transaction = state.transactions.find((tx) => String(tx.id) === String(id));
  state.selectedTransaction = transaction || null;
  if (action === 'update') {
    openUpdateModal(transaction);
  } else if (action === 'message') {
    openMessageModal(transaction);
  }
}

function openUpdateModal(transaction) {
  if (!transaction || !elements.updateForm) {
    openModal(elements.updateModal);
    return;
  }
  elements.updateForm.reset();
  elements.updateForm.elements.transaction_id.value = transaction.id;
  if (transaction.ticket_id) {
    elements.updateForm.elements.ticket_id.value = transaction.ticket_id;
  }
  const status = resolveStatus(transaction);
  elements.updateForm.elements.status.value = status;
  openModal(elements.updateModal);
}

function openMessageModal(transaction) {
  if (!elements.messageForm) {
    openModal(elements.messageModal);
    return;
  }
  elements.messageForm.reset();
  if (transaction?.ticket_id) {
    elements.messageForm.elements.ticket_id.value = transaction.ticket_id;
  }
  openModal(elements.messageModal);
}

async function handleUpdateSubmit(event) {
  event.preventDefault();
  const form = elements.updateForm;
  const feedback = form.querySelector('[data-role="update-feedback"]');
  setFeedback(feedback, '', false);
  const formData = new FormData(form);
  const transactionId = formData.get('transaction_id');
  const status = formData.get('status');
  const ticketId = formData.get('ticket_id');
  const note = formData.get('note');

  try {
    if (ticketId) {
      await updateTicketStatus(ticketId, status);
      if (note) {
        await postTicketMessage(ticketId, buildStatusMessage(status, note, transactionId));
      }
    }
    state.statusOverrides[transactionId] = status;
    setFeedback(feedback, 'وضعیت برداشت ثبت شد.', true);
    closeModal(elements.updateModal);
    await loadTransactions();
  } catch (error) {
    setFeedback(feedback, error.message || 'به‌روزرسانی وضعیت با خطا مواجه شد.');
  }
}

async function handleMessageSubmit(event) {
  event.preventDefault();
  const form = elements.messageForm;
  const feedback = form.querySelector('[data-role="message-feedback"]');
  setFeedback(feedback, '', false);
  const formData = new FormData(form);
  const ticketId = formData.get('ticket_id');
  const message = formData.get('message');
  if (!ticketId || !message) {
    setFeedback(feedback, 'شناسه تیکت و پیام الزامی است.');
    return;
  }
  try {
    await postTicketMessage(ticketId, message);
    setFeedback(feedback, 'پیام با موفقیت ارسال شد.', true);
    closeModal(elements.messageModal);
  } catch (error) {
    setFeedback(feedback, error.message || 'ارسال پیام با خطا مواجه شد.');
  }
}

function resolveStatus(item) {
  return state.statusOverrides[item.id] || item.derivedStatus || 'pending';
}

function applyQuickFilter(item, quick) {
  const timestamp = toTimestamp(item);
  switch (quick) {
    case 'large':
      return Number(item.amount || 0) >= 50000000;
    case 'today':
      if (!timestamp) return false;
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      return timestamp >= startOfDay.getTime();
    case 'overdue':
      if (!timestamp) return false;
      const age = Date.now() - timestamp;
      return resolveStatus(item) === 'pending' && age > 24 * 60 * 60 * 1000;
    default:
      return true;
  }
}

function updateAnalytics() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let todaySum = 0;
  let overdueCount = 0;
  let totalAmount = 0;
  let completedCount = 0;
  let monthTotal = 0;

  state.transactions.forEach((item) => {
    const amount = Number(item.amount || 0);
    const timestamp = toTimestamp(item);
    const status = resolveStatus(item);
    if (timestamp) {
      if (timestamp >= today.getTime()) {
        todaySum += amount;
      }
      const date = new Date(timestamp);
      if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
        monthTotal += amount;
      }
      if (status === 'pending' && Date.now() - timestamp > 24 * 60 * 60 * 1000) {
        overdueCount += 1;
      }
    }
    if (status === 'completed') {
      totalAmount += amount;
      completedCount += 1;
    }
  });

  setText(elements.analytics.today, formatCurrency(todaySum));
  setText(elements.analytics.overdue, formatNumber(overdueCount));
  const average = completedCount ? totalAmount / completedCount : 0;
  setText(elements.analytics.average, formatCurrency(average));
  setText(elements.analytics.month, formatCurrency(monthTotal));
}

function setText(element, value) {
  if (!element) return;
  element.textContent = value;
}

function renderStatusBadge(status) {
  const labels = {
    pending: 'در انتظار تایید',
    processing: 'در حال پرداخت',
    completed: 'پرداخت شده',
    rejected: 'رد شده',
  };
  const label = labels[status] || status;
  return `<span class="data-table__status data-table__status--${status}">${label}</span>`;
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

function resolveUserLabel(item) {
  if (item.user && (item.user.username || item.user.name)) {
    return item.user.username || item.user.name;
  }
  if (item.wallet && item.wallet.user) {
    return item.wallet.user.username || `کاربر ${item.wallet.user.id}`;
  }
  return item.wallet ? `کیف پول ${item.wallet}` : 'ناشناخته';
}

function toTimestamp(item) {
  if (item.timestamp) {
    const date = new Date(item.timestamp);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  if (item.created_at) {
    const date = new Date(item.created_at);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return null;
}

function inferStatusFromDescription(description = '') {
  const value = description.toString().toLowerCase();
  if (!value || value.includes('pending') || value.includes('انتظار')) return 'pending';
  if (value.includes('reject') || value.includes('رد')) return 'rejected';
  if (value.includes('process') || value.includes('پرداخت در حال انجام')) return 'processing';
  if (value.includes('paid') || value.includes('واریز') || value.includes('settled')) return 'completed';
  return 'pending';
}

async function updateTicketStatus(ticketId, status) {
  const payload = { status: status === 'completed' ? 'closed' : 'open' };
  await fetchWithAuth(`/api/support/tickets/${ticketId}/`, {
    method: 'PATCH',
    body: payload,
  });
}

async function postTicketMessage(ticketId, message) {
  await fetchWithAuth(`/api/support/tickets/${ticketId}/messages/`, {
    method: 'POST',
    body: { ticket: Number(ticketId), message },
  });
}

function buildStatusMessage(status, note, transactionId) {
  const statusLabels = {
    pending: 'در انتظار تایید',
    processing: 'در حال پردازش',
    completed: 'پرداخت شد',
    rejected: 'رد شد',
  };
  const label = statusLabels[status] || status;
  const parts = [`وضعیت برداشت #${transactionId}: ${label}`];
  if (note) parts.push(`توضیحات: ${note}`);
  return parts.join(' | ');
}

function setFeedback(target, message, success = false) {
  if (!target) return;
  target.textContent = message;
  target.classList.toggle('is-success', Boolean(success));
  target.classList.toggle('is-error', !success && Boolean(message));
}

function openModal(modal) {
  if (!modal) return;
  applyModalState(modal, true);
}

function closeModal(modal) {
  if (!modal) return;
  applyModalState(modal, false);
}
