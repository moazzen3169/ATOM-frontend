import {
  applyModalState,
  fetchJsonList,
  fetchWithAuth,
  formatCurrency,
  formatDateTime,
  formatNumber,
  toQueryString,
} from "./admin-api.js";

const state = {
  tournaments: [],
  filtered: [],
  filters: {
    search: "",
    status: "all",
    type: "all",
    month: "",
    quick: "all",
  },
  selectedId: null,
  games: [],
};

const elements = {
  tableBody: document.querySelector('[data-table="tournaments"] tbody'),
  tableInfo: document.querySelector("#table-info"),
  detailsCard: document.querySelector("[data-role=\"tournament-details\"]"),
  createModal: document.getElementById("create-tournament"),
  editModal: document.getElementById("edit-tournament"),
  actionModal: document.getElementById("action-tournament"),
  createForm: document.querySelector('[data-form="create-tournament"]'),
  editForm: document.querySelector('[data-form="edit-tournament"]'),
  actionForm: document.querySelector('[data-form="action-tournament"]'),
  gamesSelect: document.querySelector('[data-role="games-select"]'),
  chips: document.querySelectorAll(".toolbar-chip"),
  toolbarInputs: document.querySelectorAll("[data-filter]")
};

init().catch((error) => console.error("Failed to initialise tournaments page", error));

async function init() {
  bindFilterEvents();
  bindModalTriggers();
  initJalaliPickers();
  await Promise.all([loadGames(), loadTournaments()]);
}

function bindFilterEvents() {
  elements.toolbarInputs.forEach((input) => {
    input.addEventListener("input", handleFilterChange);
    input.addEventListener("change", handleFilterChange);
  });

  elements.chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      elements.chips.forEach((item) => item.classList.remove("is-active"));
      chip.classList.add("is-active");
      state.filters.quick = chip.getAttribute("data-quick") || "all";
      applyFilters();
    });
  });

  const refreshButton = document.querySelector('[data-action="refresh-tournaments"]');
  if (refreshButton) {
    refreshButton.addEventListener("click", (event) => {
      event.preventDefault();
      void loadTournaments();
    });
  }

  const exportButton = document.querySelector('[data-action="export-tournaments"]');
  if (exportButton) {
    exportButton.addEventListener("click", handleExportClick);
  }
}

function bindModalTriggers() {
  document.querySelectorAll("[data-modal-target]").forEach((trigger) => {
    const targetId = trigger.getAttribute("data-modal-target");
    const modal = document.getElementById(targetId);
    if (!modal) return;
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openModal(modal);
    });
  });

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      const modal = btn.closest(".modal");
      closeModal(modal);
    });
  });

  if (elements.createForm) {
    elements.createForm.addEventListener("submit", handleCreateSubmit);
  }
  if (elements.editForm) {
    elements.editForm.addEventListener("submit", handleEditSubmit);
  }
  if (elements.actionForm) {
    elements.actionForm.addEventListener("submit", handleActionSubmit);
  }
}

async function loadGames() {
  try {
    const games = await fetchJsonList("/api/tournaments/games/" + toQueryString({ limit: 100 }));
    state.games = games;
    populateGamesSelect(games);
  } catch (error) {
    console.warn("Failed to load games", error);
  }
}

function populateGamesSelect(games) {
  if (!elements.gamesSelect) return;
  elements.gamesSelect.innerHTML = games.length
    ? games
        .map((game) => `<option value="${escapeHtml(game.id)}">${escapeHtml(game.name || game.title || `بازی ${game.id}`)}</option>`)
        .join("")
    : '<option value="">بازی‌ای یافت نشد</option>';
}

async function loadTournaments() {
  try {
    const tournaments = await fetchJsonList(
      "/api/tournaments/tournaments/" + toQueryString({ limit: 200, ordering: "-start_date" })
    );
    state.tournaments = tournaments;
    applyFilters();
  } catch (error) {
    renderTableError("خطا در دریافت فهرست تورنومنت‌ها");
    console.error("Failed to load tournaments", error);
  }
}

function handleFilterChange(event) {
  const field = event.target.getAttribute("data-filter");
  const value = event.target.value;
  if (!field) return;
  state.filters[field] = value;
  applyFilters();
}

function applyFilters() {
  let items = [...state.tournaments];
  const { search, status, type, month, quick } = state.filters;

  if (search) {
    const normalized = search.trim().toLowerCase();
    items = items.filter((item) => {
      const name = (item.name || "").toLowerCase();
      const gameName = (item.game?.name || item.game_name || "").toLowerCase();
      const code = (item.code || item.id || "").toString().toLowerCase();
      return [name, gameName, code].some((value) => value.includes(normalized));
    });
  }

  if (status !== "all") {
    items = items.filter((item) => resolveStatus(item) === status);
  }

  if (type !== "all") {
    items = items.filter((item) => (item.type || "").toLowerCase() === type);
  }

  if (month) {
    items = items.filter((item) => {
      if (!item.start_date) return false;
      return item.start_date.startsWith(month);
    });
  }

  if (quick !== "all") {
    items = items.filter((item) => applyQuickFilter(item, quick));
  }

  state.filtered = items;
  renderTable();
  renderDetails();
}

function applyQuickFilter(item, quick) {
  switch (quick) {
    case "top-prize":
      return Number(item.prize_pool || 0) >= 50000000;
    case "nearly-full":
      return (item.spots_left !== undefined && Number(item.spots_left) <= 4) ||
        (item.max_participants && item.participants?.length >= item.max_participants - 4);
    case "needs-action":
      const status = resolveStatus(item);
      const start = item.start_date ? new Date(item.start_date) : null;
      if (!start) return false;
      const hoursDiff = Math.abs(start.getTime() - Date.now()) / (1000 * 60 * 60);
      return status === "upcoming" && hoursDiff <= 24;
    default:
      return true;
  }
}

function renderTable() {
  if (!elements.tableBody) return;
  if (!state.filtered.length) {
    elements.tableBody.innerHTML =
      '<tr><td colspan="7" class="data-table__empty">هیچ تورنومنتی مطابق فیلترها یافت نشد.</td></tr>';
  } else {
    elements.tableBody.innerHTML = state.filtered
      .map((item) => {
        const status = resolveStatus(item);
        return `<tr data-id="${escapeHtml(item.id)}">
          <td>${escapeHtml(item.name || "بدون عنوان")}</td>
          <td>${escapeHtml(item.game?.name || item.game_name || "ناشناخته")}</td>
          <td>${item.start_date ? formatDateTime(item.start_date) : "نامشخص"}</td>
          <td>${formatNumber(item.participants?.length || item.current_participants || 0)} / ${formatNumber(item.max_participants || 0)}</td>
          <td>${item.prize_pool ? formatCurrency(item.prize_pool) : "--"}</td>
          <td>${renderStatusBadge(status)}</td>
          <td class="table-actions">
            <button class="table-action-btn" data-action="view" data-id="${escapeHtml(item.id)}"><i class="ti ti-eye"></i><span>جزئیات</span></button>
            <button class="table-action-btn" data-action="edit" data-id="${escapeHtml(item.id)}"><i class="ti ti-edit"></i><span>ویرایش</span></button>
            <button class="table-action-btn" data-action="quick" data-id="${escapeHtml(item.id)}"><i class="ti ti-rocket"></i><span>اقدام سریع</span></button>
          </td>
        </tr>`;
      })
      .join("");
  }

  const total = state.tournaments.length;
  const visible = state.filtered.length;
  if (elements.tableInfo) {
    elements.tableInfo.querySelector("[data-field=\"visible-count\"]").textContent = formatNumber(visible);
    elements.tableInfo.querySelector("[data-field=\"total-count\"]").textContent = formatNumber(total);
  }

  elements.tableBody.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", handleTableAction);
  });

  elements.tableBody.querySelectorAll("tr[data-id]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      const id = row.getAttribute("data-id");
      selectTournament(id);
    });
  });
}

function renderTableError(message) {
  if (!elements.tableBody) return;
  elements.tableBody.innerHTML = `<tr><td colspan="7" class="data-table__empty">${escapeHtml(message)}</td></tr>`;
}

function handleTableAction(event) {
  event.preventDefault();
  const button = event.currentTarget;
  const action = button.getAttribute("data-action");
  const id = button.getAttribute("data-id");
  if (!id) return;

  if (action === "edit") {
    openEditModal(id);
  } else if (action === "quick") {
    openQuickModal(id);
  } else if (action === "view") {
    selectTournament(id);
  }
}

function selectTournament(id) {
  state.selectedId = id;
  renderDetails();
}

function renderDetails() {
  if (!elements.detailsCard) return;
  const tournament = state.filtered.find((item) => String(item.id) === String(state.selectedId));
  if (!tournament) {
    elements.detailsCard.innerHTML = `
      <div class="details-placeholder">
        <h3>یک تورنومنت را انتخاب کنید</h3>
        <p>برای مشاهده اطلاعات کامل و اقدامات مدیریتی، از جدول بالا یک تورنومنت را انتخاب کنید.</p>
      </div>`;
    return;
  }

  const status = resolveStatus(tournament);
  const participants = formatNumber(tournament.participants?.length || tournament.current_participants || 0);
  const maxParticipants = formatNumber(tournament.max_participants || 0);
  const description = escapeHtml(tournament.description || "");
  const rules = escapeHtml(tournament.rules || "");
  const start = tournament.start_date ? formatDateTime(tournament.start_date) : "نامشخص";
  const end = tournament.end_date ? formatDateTime(tournament.end_date) : "نامشخص";
  const entry = tournament.entry_fee ? formatCurrency(tournament.entry_fee) : tournament.is_free ? "رایگان" : "--";

  elements.detailsCard.innerHTML = `
    <div class="details-header">
      <div>
        <h3>${escapeHtml(tournament.name || "بدون عنوان")}</h3>
        <p>${escapeHtml(tournament.game?.name || tournament.game_name || "بازی نامشخص")}</p>
      </div>
      ${renderStatusBadge(status, true)}
    </div>
    <dl class="details-grid">
      <div><dt>تاریخ شروع</dt><dd>${start}</dd></div>
      <div><dt>تاریخ پایان</dt><dd>${end}</dd></div>
      <div><dt>ورودی</dt><dd>${entry}</dd></div>
      <div><dt>جایزه کل</dt><dd>${tournament.prize_pool ? formatCurrency(tournament.prize_pool) : "--"}</dd></div>
      <div><dt>ظرفیت</dt><dd>${participants} از ${maxParticipants}</dd></div>
      <div><dt>سطح احراز مورد نیاز</dt><dd>${formatNumber(tournament.required_verification_level || 1)}</dd></div>
      <div class="details-full"><dt>قوانین</dt><dd>${rules || "ثبت نشده"}</dd></div>
      <div class="details-full"><dt>توضیحات</dt><dd>${description || "بدون توضیح"}</dd></div>
    </dl>
    <div class="details-actions">
      <button class="admin-button" data-action="edit" data-id="${escapeHtml(tournament.id)}"><i class="ti ti-edit"></i><span>ویرایش</span></button>
      <button class="admin-button" data-action="quick" data-id="${escapeHtml(tournament.id)}"><i class="ti ti-rocket"></i><span>اقدام سریع</span></button>
    </div>`;

  elements.detailsCard.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", handleTableAction);
  });
}

function renderStatusBadge(status, large = false) {
  const statusLabels = {
    upcoming: "در انتظار شروع",
    running: "در حال برگزاری",
    completed: "پایان یافته",
    draft: "پیش‌نویس",
  };
  const label = statusLabels[status] || status;
  const className = large ? "table-status table-status--large" : "table-status";
  return `<span class="${className}">${label}</span>`;
}

function resolveStatus(item) {
  const now = Date.now();
  const start = item.start_date ? new Date(item.start_date).getTime() : null;
  const end = item.end_date ? new Date(item.end_date).getTime() : null;
  if (item.status && typeof item.status === "string") {
    const normalized = item.status.toLowerCase();
    if (["draft", "running", "completed", "upcoming"].includes(normalized)) {
      return normalized;
    }
  }
  if (start && start > now) return "upcoming";
  if (end && end < now) return "completed";
  return "running";
}

function openEditModal(id) {
  const tournament = state.tournaments.find((item) => String(item.id) === String(id));
  if (!tournament || !elements.editForm) return;
  elements.editForm.reset();
  elements.editForm.elements.id.value = tournament.id;
  setOptionalValue(elements.editForm.elements.name, tournament.name);
  setOptionalValue(elements.editForm.elements.entry_fee, tournament.entry_fee);
  setOptionalValue(elements.editForm.elements.prize_pool, tournament.prize_pool);
  setOptionalValue(elements.editForm.elements.max_participants, tournament.max_participants);
  setOptionalValue(
    elements.editForm.elements.required_verification_level,
    tournament.required_verification_level
  );
  setOptionalValue(elements.editForm.elements.rules, tournament.rules);
  setOptionalValue(elements.editForm.elements.description, tournament.description);
  openModal(elements.editModal);
}

function openQuickModal(id) {
  if (!elements.actionForm) return;
  elements.actionForm.reset();
  elements.actionForm.elements.id.value = id;
  openModal(elements.actionModal);
}

async function handleCreateSubmit(event) {
  event.preventDefault();
  if (!elements.createForm) return;
  const feedback = elements.createForm.querySelector('[data-role="create-feedback"]');
  setFeedback(feedback, "", false);
  let payload;
  try {
    payload = buildTournamentPayload(new FormData(elements.createForm));
  } catch (error) {
    setFeedback(feedback, error.message || "ثبت تورنومنت با مشکل مواجه شد.");
    return;
  }
  try {
    await fetchWithAuth("/api/tournaments/tournaments/", {
      method: "POST",
      body: payload,
    });
    setFeedback(feedback, "تورنومنت با موفقیت ایجاد شد.", true);
    elements.createForm.reset();
    closeModal(elements.createModal);
    await loadTournaments();
  } catch (error) {
    setFeedback(feedback, error.message || "ثبت تورنومنت با مشکل مواجه شد.");
  }
}

async function handleEditSubmit(event) {
  event.preventDefault();
  if (!elements.editForm) return;
  const feedback = elements.editForm.querySelector('[data-role="edit-feedback"]');
  setFeedback(feedback, "", false);
  const formData = new FormData(elements.editForm);
  const id = formData.get("id");
  if (!id) {
    setFeedback(feedback, "شناسه تورنومنت نامعتبر است");
    return;
  }
  let payload;
  try {
    payload = buildTournamentPayload(formData, true);
  } catch (error) {
    setFeedback(feedback, error.message || "ذخیره تغییرات با خطا مواجه شد.");
    return;
  }
  try {
    await fetchWithAuth(`/api/tournaments/tournaments/${id}/`, {
      method: "PATCH",
      body: payload,
    });
    setFeedback(feedback, "تغییرات ذخیره شد.", true);
    closeModal(elements.editModal);
    await loadTournaments();
  } catch (error) {
    setFeedback(feedback, error.message || "ذخیره تغییرات با خطا مواجه شد.");
  }
}

async function handleActionSubmit(event) {
  event.preventDefault();
  if (!elements.actionForm) return;
  const feedback = elements.actionForm.querySelector('[data-role="action-feedback"]');
  setFeedback(feedback, "", false);
  const formData = new FormData(elements.actionForm);
  const id = formData.get("id");
  const action = formData.get("action");
  if (!id || !action) {
    setFeedback(feedback, "اطلاعات مورد نیاز تکمیل نشده است.");
    return;
  }
  try {
    if (action === "start_countdown") {
      await fetchWithAuth(`/api/tournaments/tournaments/${id}/start_countdown/`, {
        method: "POST",
        body: {},
      });
    } else if (action === "generate_matches") {
      await fetchWithAuth(`/api/tournaments/tournaments/${id}/generate_matches/`, {
        method: "POST",
        body: {},
      });
    } else if (action === "close_registration") {
      const tournament = state.tournaments.find((item) => String(item.id) === String(id));
      const currentParticipants = tournament?.participants?.length || tournament?.current_participants || 0;
      await fetchWithAuth(`/api/tournaments/tournaments/${id}/`, {
        method: "PATCH",
        body: { max_participants: currentParticipants },
      });
    }
    setFeedback(feedback, "اقدام با موفقیت انجام شد.", true);
    closeModal(elements.actionModal);
    await loadTournaments();
  } catch (error) {
    setFeedback(feedback, error.message || "اجرای اقدام با خطا مواجه شد.");
  }
}

function handleExportClick(event) {
  event.preventDefault();
  const params = {
    status: state.filters.status,
    type: state.filters.type,
    month: state.filters.month,
  };
  const query = toQueryString(params).replace(/^\?/, "");
  const url = `/api/tournaments/tournaments/?${query ? `${query}&` : ""}format=csv`;
  window.open(url, "_blank");
}

function buildTournamentPayload(formData, isPartial = false) {
  const payload = {};

  const assignValue = (key, value, hasField = true) => {
    if (!hasField) {
      if (!isPartial) payload[key] = null;
      return;
    }
    if (value === undefined) {
      if (!isPartial) payload[key] = null;
      return;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      payload[key] = trimmed === "" ? null : trimmed;
      return;
    }
    payload[key] = value === "" ? null : value;
  };

  if (formData.has("name")) {
    const name = (formData.get("name") || "").toString().trim();
    if (!name && !isPartial) {
      throw new Error("نام تورنومنت را وارد کنید.");
    }
    assignValue("name", name || null, true);
  }

  if (formData.has("game")) {
    const gameValue = toEnglishDigits(formData.get("game"));
    const gameId = gameValue ? Number(gameValue) : null;
    if (gameValue && (Number.isNaN(gameId) || gameId <= 0)) {
      throw new Error("بازی انتخاب‌شده نامعتبر است.");
    }
    if (!gameId && !isPartial) {
      throw new Error("بازی را انتخاب کنید.");
    }
    assignValue("game", gameId, true);
  }

  if (formData.has("type")) {
    assignValue("type", formData.get("type") || null, true);
  }

  if (formData.has("mode")) {
    assignValue("mode", formData.get("mode") || null, true);
  }

  const startDateField = parseDateField(formData, "start_date");
  if (startDateField.hasField) {
    if (!startDateField.value && !isPartial) {
      throw new Error("تاریخ شروع نامعتبر است.");
    }
    assignValue("start_date", startDateField.value, true);
  }

  const endDateField = parseDateField(formData, "end_date");
  if (endDateField.hasField) {
    if (!endDateField.value && !isPartial) {
      throw new Error("تاریخ پایان نامعتبر است.");
    }
    assignValue("end_date", endDateField.value, true);
  }

  if (startDateField.value && endDateField.value) {
    const start = new Date(startDateField.value);
    const end = new Date(endDateField.value);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
      throw new Error("تاریخ پایان باید بعد از تاریخ شروع باشد.");
    }
  }

  const hasEntryFee = formData.has("entry_fee");
  const entryFee = hasEntryFee ? normalizeDecimal(formData.get("entry_fee")) : null;
  if (hasEntryFee) {
    assignValue("entry_fee", entryFee, true);
    const isFree = !entryFee || Number(entryFee) <= 0;
    assignValue("is_free", Boolean(isFree), true);
  } else if (!isPartial) {
    assignValue("is_free", true, true);
  }

  const hasPrize = formData.has("prize_pool");
  const prize = hasPrize ? normalizeDecimal(formData.get("prize_pool")) : null;
  if (hasPrize) {
    assignValue("prize_pool", prize, true);
  }

  if (formData.has("max_participants")) {
    const maxParticipants = normalizeInteger(formData.get("max_participants"));
    assignValue("max_participants", maxParticipants, true);
  }

  if (formData.has("required_verification_level")) {
    const verificationLevel = normalizeInteger(formData.get("required_verification_level"));
    if (verificationLevel !== null && (verificationLevel < 1 || verificationLevel > 3)) {
      throw new Error("سطح احراز نامعتبر است.");
    }
    assignValue("required_verification_level", verificationLevel, true);
  }

  if (formData.has("rules")) {
    const rules = (formData.get("rules") || "").toString();
    assignValue("rules", rules, true);
  }

  if (formData.has("description")) {
    const description = (formData.get("description") || "").toString();
    assignValue("description", description, true);
  }

  return payload;
}

function parseDateField(formData, field) {
  const hasField = formData.has(field);
  if (!hasField) {
    return { hasField: false, value: null };
  }
  const dateValue = formData.get(field);
  const timeField = `${field}_time`;
  const hasTimeField = formData.has(timeField);
  const timeValue = hasTimeField ? formData.get(timeField) : null;
  if (!dateValue) {
    return { hasField: true, value: null };
  }
  const isoValue = toIsoDateTime(dateValue, timeValue, hasTimeField);
  return { hasField: true, value: isoValue };
}

function toIsoDateTime(dateValue, timeValue, hasExplicitTime) {
  const rawDate = toEnglishDigits((dateValue || "").toString().trim());
  if (!rawDate) return null;
  if (/\d{4}-\d{2}-\d{2}t\d{2}:\d{2}/i.test(rawDate)) {
    return toIsoString(rawDate);
  }
  if (/\d{4}-\d{2}-\d{2}/.test(rawDate)) {
    return toIsoString(rawDate);
  }

  const parts = rawDate.replace(/[\.\-]/g, "/").split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const datePart = parts[0];
  const inlineTime = parts[1];
  const match = datePart.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) {
    return null;
  }

  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (![jy, jm, jd].every(Number.isFinite)) {
    return null;
  }

  const timeSource = hasExplicitTime ? timeValue : inlineTime;
  const time = parseTimeValue(timeSource, { required: hasExplicitTime });
  const gregorian = jalaliToGregorian(jy, jm, jd);
  if (!gregorian) {
    return null;
  }
  const { gy, gm, gd } = gregorian;
  const date = new Date(Date.UTC(gy, gm - 1, gd, time.hour, time.minute, time.second));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function parseTimeValue(value, options = {}) {
  const { required = false } = options;
  if (!value) {
    if (required) {
      throw new Error("ساعت را به درستی وارد کنید.");
    }
    return { hour: 0, minute: 0, second: 0 };
  }
  const normalized = toEnglishDigits(value).trim();
  const match = normalized.match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?$/);
  if (!match) {
    throw new Error("ساعت وارد شده نامعتبر است.");
  }
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const second = Number(match[3] || 0);
  if ([hour, minute, second].some((n) => !Number.isFinite(n))) {
    throw new Error("ساعت وارد شده نامعتبر است.");
  }
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error("ساعت وارد شده نامعتبر است.");
  }
  return { hour, minute, second };
}

function normalizeDecimal(value) {
  if (value === null || value === undefined) return null;
  const normalized = toEnglishDigits(value).replace(/,/g, "").trim();
  if (!normalized) return null;
  if (!/^-?\d+(?:\.\d{0,2})?$/.test(normalized)) {
    throw new Error("مقدار عددی نامعتبر است.");
  }
  if (Number(normalized) < 0) {
    throw new Error("مقدار عددی باید مثبت باشد.");
  }
  return normalized;
}

function normalizeInteger(value) {
  if (value === null || value === undefined) return null;
  const normalized = toEnglishDigits(value).replace(/,/g, "").trim();
  if (!normalized) return null;
  if (!/^-?\d+$/.test(normalized)) {
    throw new Error("مقدار عددی نامعتبر است.");
  }
  const intValue = Number.parseInt(normalized, 10);
  if (!Number.isFinite(intValue)) {
    throw new Error("مقدار عددی نامعتبر است.");
  }
  if (intValue < 0) {
    throw new Error("مقدار عددی باید مثبت باشد.");
  }
  return intValue;
}

function toEnglishDigits(value) {
  if (value === null || value === undefined) return "";
  return value
    .toString()
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

function jalaliToGregorian(jy, jm, jd) {
  const cal = jalCal(jy);
  if (!cal) return null;
  const jdValue = jalaliToJd(jy, jm, jd, cal);
  const gregorianDay = jdToGregorian(jdValue);
  return { gy: gregorianDay[0], gm: gregorianDay[1], gd: gregorianDay[2] };
}

function jalaliToJd(jy, jm, jd, cal) {
  const gregorianJd = gregorianToJd(cal.gy, 3, cal.march);
  const dayIndex =
    (jm <= 6 ? (jm - 1) * 31 : 6 * 31 + (jm - 7) * 30) + (jd - 1);
  return gregorianJd + dayIndex;
}

function gregorianToJd(gy, gm, gd) {
  const a = Math.floor((14 - gm) / 12);
  const y = gy + 4800 - a;
  const m = gm + 12 * a - 3;
  return (
    gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) -
    Math.floor(y / 100) + Math.floor(y / 400) - 32045
  );
}

function jdToGregorian(jd) {
  let j = jd + 32044;
  const g = Math.floor(j / 146097);
  let dg = j % 146097;
  let c = Math.floor((Math.floor(dg / 36524) + 1) * 3 / 4);
  dg -= c * 36524;
  const b = Math.floor(dg / 1461);
  let db = dg % 1461;
  const a = Math.floor((Math.floor(db / 365) + 1) * 3 / 4);
  db -= a * 365;
  const y = g * 400 + c * 100 + b * 4 + a;
  const m = Math.floor((db * 5 + 308) / 153) - 2;
  const d = db - Math.floor((m + 4) * 153 / 5) + 122;
  const year = y - 4800 + Math.floor((m + 2) / 12);
  const month = (m + 2) % 12 + 1;
  const day = d + 1;
  return [year, month, day];
}

function jalCal(jy) {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635,
    2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
  ];

  if (jy < breaks[0] || jy >= breaks[breaks.length - 1]) {
    return null;
  }

  let gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm = breaks[1];
  let jump = 0;

  for (let i = 1; i < breaks.length; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) {
      break;
    }
    leapJ += Math.floor(jump / 33) * 8 + Math.floor((jump % 33) / 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ += Math.floor(n / 33) * 8 + Math.floor(((n % 33) + 3) / 4);
  if (jump % 33 === 4 && jump - n === 4) {
    leapJ += 1;
  }

  const leapG = Math.floor(gy / 4) - Math.floor((Math.floor(gy / 100) + 1) * 3 / 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) {
    n = n - jump + Math.floor((jump + 4) / 33) * 33;
  }

  return { leap: ((n + 1) % 33 - 1 + 33) % 4, gy, march };
}

function initJalaliPickers() {
  if (typeof window === "undefined") return;
  if (typeof window.jalaliDatepicker !== "undefined") {
    window.jalaliDatepicker.startWatch();
  }

  const form = elements.createForm;
  if (!form) return;
  const startInput = form.elements.start_date;
  const endInput = form.elements.end_date;
  if (startInput && endInput) {
    startInput.addEventListener("change", () => {
      if (!endInput.value) {
        endInput.setAttribute("data-jdp-min-date", startInput.value || "");
      }
    });
  }
}

function openModal(modal) {
  if (!modal) return;
  applyModalState(modal, true);
}

function closeModal(modal) {
  if (!modal) return;
  applyModalState(modal, false);
}

function setFeedback(target, message, success = false) {
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("is-success", Boolean(success));
  target.classList.toggle("is-error", !success && Boolean(message));
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

function setOptionalValue(element, value) {
  if (!element || value === undefined || value === null) return;
  element.value = value;
}

function toIsoString(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
