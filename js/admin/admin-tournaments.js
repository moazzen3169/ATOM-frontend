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
  const payload = buildTournamentPayload(new FormData(elements.createForm));
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
  const payload = buildTournamentPayload(formData, true);
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
  const assign = (key, value) => {
    if (value === null || value === undefined || value === "") {
      if (!isPartial) payload[key] = value;
      return;
    }
    payload[key] = value;
  };

  assign("name", formData.get("name"));
  assign("game", Number(formData.get("game")) || null);
  assign("type", formData.get("type"));
  assign("mode", formData.get("mode"));

  const startDate = toIsoString(formData.get("start_date"));
  const endDate = toIsoString(formData.get("end_date"));
  if (startDate || !isPartial) assign("start_date", startDate);
  if (endDate || !isPartial) assign("end_date", endDate);

  const entryFee = formData.get("entry_fee");
  assign("entry_fee", entryFee ? Number(entryFee) : null);
  assign("is_free", !entryFee || Number(entryFee) <= 0);
  const prize = formData.get("prize_pool");
  assign("prize_pool", prize ? Number(prize) : null);
  const maxParticipants = formData.get("max_participants");
  assign("max_participants", maxParticipants ? Number(maxParticipants) : null);
  const verification = formData.get("required_verification_level");
  assign("required_verification_level", verification ? Number(verification) : null);
  assign("rules", formData.get("rules"));
  assign("description", formData.get("description"));

  return payload;
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
