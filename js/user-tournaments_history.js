import {
  API_ENDPOINTS,
  extractApiError,
} from "./services/api-client.js";

const helperDefaults = {
  fetchWithAuth: async () => {
    throw new Error("fetchWithAuth helper is not configured.");
  },
  extractErrorMessage: extractApiError,
  showError: (message) => {
    const handler = window.showError || console.error;
    handler(message);
  },
};

let helpers = { ...helperDefaults };
let historyUserId = null;
let currentSortKey = "date_desc";
let activeRequest = null;
let debounceTimer = null;

const SORT_OPTIONS = [
  { key: "date_desc", label: "جدیدترین" },
  { key: "date_asc", label: "قدیمی‌ترین" },
  { key: "score_desc", label: "بیشترین امتیاز" },
  { key: "score_asc", label: "کمترین امتیاز" },
  { key: "rank_asc", label: "بهترین رتبه" },
  { key: "rank_desc", label: "ضعیف‌ترین رتبه" },
];

const SORT_QUERY_MAP = {
  date_desc: "-created_at",
  date_asc: "created_at",
  score_desc: "-score",
  score_asc: "score",
  rank_asc: "rank",
  rank_desc: "-rank",
};

const HISTORY_PAGE_SIZE = 50;

const dom = {
  panel: () => document.getElementById("tournaments_filters_panel"),
  hint: () => document.getElementById("tournaments_history_hint"),
  body: () => document.getElementById("tournaments_history_body"),
  sortLabel: () => document.querySelector("[data-sort-label]"),
  sortButton: () => document.querySelector('[data-action="cycle-sort"]'),
  filterButton: () => document.querySelector('[data-action="toggle-filter"]'),
  clearButton: () =>
    document.querySelector('[data-action="clear-tournament-filters"]'),
  searchInput: () => document.getElementById("tournaments_search_input"),
  gameSelect: () => document.getElementById("tournaments_filter_game"),
  teamSelect: () => document.getElementById("tournaments_filter_team"),
  fromInput: () => document.getElementById("tournaments_filter_from"),
  toInput: () => document.getElementById("tournaments_filter_to"),
};

export function configureTournamentHistoryModule(config = {}) {
  helpers = { ...helperDefaults, ...config };
  if (config.userId) {
    historyUserId = config.userId;
  }
}

export function setTournamentHistoryUserContext(userId) {
  historyUserId = userId ? String(userId) : null;
}

export async function initializeDashboardTournamentHistorySection({
  dashboardData = {},
  userId = null,
} = {}) {
  if (userId) {
    setTournamentHistoryUserContext(userId);
  }

  const initialMatches = extractMatchesFromPayload(
    dashboardData?.tournament_history ??
      dashboardData?.matches ??
      dashboardData?.results ??
      null,
  );

  if (initialMatches.length) {
    renderHistoryTable(initialMatches);
  }

  if (historyUserId) {
    await refreshTournamentHistory({ immediate: true });
  }

  return {
    matches: initialMatches,
    count: initialMatches.length,
  };
}

export function initializeTournamentHistoryUI() {
  attachHistoryEventHandlers();
  updateSortLabel();
}

function attachHistoryEventHandlers() {
  const filterButton = dom.filterButton();
  if (filterButton) {
    filterButton.addEventListener("click", toggleFilterPanel);
  }

  const sortButton = dom.sortButton();
  if (sortButton) {
    sortButton.addEventListener("click", () => {
      cycleSortOption();
      refreshTournamentHistory({ immediate: true });
    });
  }

  const clearButton = dom.clearButton();
  if (clearButton) {
    clearButton.addEventListener("click", () => {
      resetFilters();
      refreshTournamentHistory({ immediate: true });
    });
  }

  const searchInput = dom.searchInput();
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      scheduleRefresh();
    });
  }

  const selects = [dom.gameSelect(), dom.teamSelect()];
  selects.forEach((select) => {
    if (select) {
      select.addEventListener("change", () => {
        refreshTournamentHistory({ immediate: true });
      });
    }
  });

  const dateInputs = [dom.fromInput(), dom.toInput()];
  dateInputs.forEach((input) => {
    if (input) {
      input.addEventListener("change", () => {
        refreshTournamentHistory({ immediate: true });
      });
    }
  });
}

function updateSortLabel() {
  const labelEl = dom.sortLabel();
  if (!labelEl) return;
  const option = SORT_OPTIONS.find((item) => item.key === currentSortKey);
  labelEl.textContent = option ? option.label : "";
}

function toggleFilterPanel() {
  const panel = dom.panel();
  const trigger = dom.filterButton();
  if (!panel || !trigger) return;
  const isHidden = panel.hasAttribute("hidden");
  if (isHidden) {
    panel.removeAttribute("hidden");
    panel.setAttribute("aria-hidden", "false");
    trigger.setAttribute("aria-expanded", "true");
  } else {
    panel.setAttribute("hidden", "");
    panel.setAttribute("aria-hidden", "true");
    trigger.setAttribute("aria-expanded", "false");
  }
}

function cycleSortOption() {
  const index = SORT_OPTIONS.findIndex((item) => item.key === currentSortKey);
  const nextIndex = index === -1 ? 0 : (index + 1) % SORT_OPTIONS.length;
  currentSortKey = SORT_OPTIONS[nextIndex].key;
  updateSortLabel();
}

function resetFilters() {
  const searchInput = dom.searchInput();
  if (searchInput) searchInput.value = "";
  const gameSelect = dom.gameSelect();
  if (gameSelect) gameSelect.value = "";
  const teamSelect = dom.teamSelect();
  if (teamSelect) teamSelect.value = "";
  const fromInput = dom.fromInput();
  if (fromInput) fromInput.value = "";
  const toInput = dom.toInput();
  if (toInput) toInput.value = "";
  currentSortKey = "date_desc";
  updateSortLabel();
}

function scheduleRefresh() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    refreshTournamentHistory({ immediate: true });
  }, 350);
}

async function refreshTournamentHistory({ immediate = false } = {}) {
  if (!historyUserId) {
    renderHistoryTable([]);
    return;
  }

  if (activeRequest) {
    activeRequest.abort();
    activeRequest = null;
  }

  const controller = new AbortController();
  activeRequest = controller;

  if (immediate) {
    await fetchAndRenderHistory(controller);
    return;
  }

  await fetchAndRenderHistory(controller);
}

async function fetchAndRenderHistory(controller) {
  setHistoryLoading(true);
  try {
    const result = await requestTournamentHistory({ signal: controller.signal });
    renderHistoryTable(result.items);
    applyFilterOptions(result.raw);
    updateHistoryHint(result.totalCount);
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }
    console.error("Failed to load tournament history:", error);
    helpers.showError(error.message || "خطا در دریافت تاریخچه تورنومنت‌ها.");
    updateHistoryHint(null, true);
  } finally {
    if (activeRequest === controller) {
      activeRequest = null;
    }
    setHistoryLoading(false);
  }
}

function buildHistoryQueryParams() {
  const params = new URLSearchParams();
  const searchInput = dom.searchInput();
  const search = searchInput ? searchInput.value.trim() : "";
  if (search) {
    params.set("search", search);
  }

  const gameSelect = dom.gameSelect();
  if (gameSelect && gameSelect.value) {
    params.set("game", gameSelect.value);
  }

  const teamSelect = dom.teamSelect();
  if (teamSelect && teamSelect.value) {
    params.set("team", teamSelect.value);
  }

  const fromInput = dom.fromInput();
  if (fromInput && fromInput.value) {
    params.set("start_date__gte", fromInput.value);
  }

  const toInput = dom.toInput();
  if (toInput && toInput.value) {
    params.set("start_date__lte", toInput.value);
  }

  const ordering = SORT_QUERY_MAP[currentSortKey];
  if (ordering) {
    params.set("ordering", ordering);
  }

  if (!params.has("page_size")) {
    params.set("page_size", String(HISTORY_PAGE_SIZE));
  }

  return params;
}

async function requestTournamentHistory({ signal } = {}) {
  const params = buildHistoryQueryParams();
  const queryString = params.toString();
  const baseUrl = API_ENDPOINTS.users.userMatchHistory(historyUserId);
  const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;

  const response = await helpers.fetchWithAuth(url, {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    const message = await helpers.extractErrorMessage(response);
    throw new Error(message || "خطا در دریافت تاریخچه تورنومنت‌ها.");
  }

  const rawText = await response.text();
  if (!rawText) {
    return { items: [], totalCount: 0, raw: null };
  }

  let data = null;
  try {
    data = JSON.parse(rawText);
  } catch (error) {
    console.error("Invalid tournament history payload:", error);
    return { items: [], totalCount: 0, raw: null };
  }

  const items = extractMatchesFromPayload(data);
  const totalCount = extractTotalCount(data, items.length);
  return { items, totalCount, raw: data };
}

function extractMatchesFromPayload(payload) {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload.filter(Boolean);
  }

  const candidates = [
    payload.results,
    payload.items,
    payload.matches,
    payload.entries,
    payload.data,
    payload.tournament_history,
    payload.list,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(Boolean);
    }
  }

  return [];
}

function extractTotalCount(payload, fallback) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const candidates = [
    payload.total,
    payload.count,
    payload.total_count,
    payload.total_results,
    payload.total_items,
  ];

  for (const value of candidates) {
    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
    }
  }

  return fallback;
}

function renderHistoryTable(matches) {
  const tbody = dom.body();
  if (!tbody) {
    return;
  }

  if (!Array.isArray(matches) || matches.length === 0) {
    tbody.innerHTML = "";
    updateHistoryHint(0);
    return;
  }

  const rows = matches.map(createHistoryRowMarkup).join("");
  tbody.innerHTML = rows;
}

function createHistoryRowMarkup(match = {}) {
  const score = pickFirstValue(match, [
    "score",
    "points",
    "user_score",
    "team_score",
    "total_score",
  ]);
  const rank = pickFirstValue(match, ["rank", "position", "place"]);
  const date = pickFirstValue(match, [
    "created_at",
    "date",
    "match_date",
    "played_at",
    "start_date",
  ]);
  const teamName = pickFirstValue(match, [
    "team_name",
    "team",
    "team_title",
    "team_display",
    "team_label",
  ]);
  const gameName = pickFirstValue(match, [
    "game_name",
    "game",
    "game_title",
    "game_display",
  ]);
  const tournamentName = pickFirstValue(match, [
    "tournament_name",
    "tournament",
    "name",
    "title",
  ]);

  return `
    <tr>
      <td>${escapeHtml(score ?? "-")}</td>
      <td>${escapeHtml(rank ?? "-")}</td>
      <td>${escapeHtml(date ?? "-")}</td>
      <td>${escapeHtml(teamName ?? "-")}</td>
      <td>${escapeHtml(gameName ?? "-")}</td>
      <td>${escapeHtml(tournamentName ?? "-")}</td>
    </tr>
  `;
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pickFirstValue(source, keys) {
  if (!source || typeof source !== "object") {
    return null;
  }
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
  }
  return null;
}

function setHistoryLoading(isLoading) {
  const hint = dom.hint();
  if (!hint) return;
  if (isLoading) {
    hint.textContent = "در حال دریافت تاریخچه تورنومنت‌ها...";
    hint.dataset.loading = "true";
  } else {
    delete hint.dataset.loading;
  }
}

function updateHistoryHint(totalCount, isError = false) {
  const hint = dom.hint();
  if (!hint) return;

  if (isError) {
    hint.textContent = "خطا در دریافت تاریخچه تورنومنت‌ها.";
    return;
  }

  if (typeof totalCount === "number") {
    if (totalCount === 0) {
      hint.textContent = "تاریخچه‌ای برای نمایش وجود ندارد.";
    } else {
      hint.textContent = `تعداد کل نتایج: ${totalCount}`;
    }
  }
}

function applyFilterOptions(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }

  const filters = payload.filters || payload.available_filters || payload.meta;
  if (!filters || typeof filters !== "object") {
    return;
  }

  if (!dom.gameSelect() && !dom.teamSelect()) {
    return;
  }

  if (filters.games) {
    fillSelect(dom.gameSelect(), filters.games, {
      valueKey: "id",
      labelKey: "name",
    });
  }

  if (filters.teams) {
    fillSelect(dom.teamSelect(), filters.teams, {
      valueKey: "id",
      labelKey: "name",
    });
  }
}

function fillSelect(select, items, { valueKey, labelKey }) {
  if (!select || !Array.isArray(items)) {
    return;
  }

  const currentValue = select.value;
  const options = [
    '<option value="">همه</option>',
    ...items.map((item) => {
      if (item === null || item === undefined) {
        return "";
      }
      if (typeof item === "string" || typeof item === "number") {
        const value = String(item);
        const label = String(item);
        return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
      }
      if (typeof item === "object") {
        const value = item[valueKey] ?? item.id ?? item.slug ?? item.value;
        const label = item[labelKey] ?? item.title ?? item.label ?? value;
        if (value === undefined || value === null) {
          return "";
        }
        return `<option value="${escapeHtml(value)}">${escapeHtml(label ?? value)}</option>`;
      }
      return "";
    }),
  ].filter(Boolean);

  select.innerHTML = options.join("");
  if (currentValue && Array.from(select.options).some((opt) => opt.value === currentValue)) {
    select.value = currentValue;
  }
}

function autoInitializeHistoryModule() {
  const table = dom.body();
  if (!table) {
    return;
  }

  if (!historyUserId && window.dashboardUserId) {
    setTournamentHistoryUserContext(window.dashboardUserId);
  }

  initializeTournamentHistoryUI();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", autoInitializeHistoryModule);
} else {
  autoInitializeHistoryModule();
}
