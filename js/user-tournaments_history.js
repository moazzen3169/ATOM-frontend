import { API_ENDPOINTS } from "./services/api-client.js";

const helperDefaults = {
  fetchWithAuth: async () => {
    throw new Error("fetchWithAuth helper is not configured.");
  },
  extractErrorMessage: async () => "خطای ناشناخته رخ داد.",
  showError: (message) => console.error(message),
};

let helpers = { ...helperDefaults };
let matchesState = [];
const defaultFilterState = {
  search: "",
  game: "",
  team: "",
  from: "",
  to: "",
  sort: "date_desc",
};

let filterState = { ...defaultFilterState };

const SORT_OPTIONS = [
  { key: "date_desc", label: "جدیدترین" },
  { key: "date_asc", label: "قدیمی‌ترین" },
  { key: "score_desc", label: "بیشترین امتیاز" },
  { key: "score_asc", label: "کمترین امتیاز" },
  { key: "rank_asc", label: "بهترین رتبه" },
  { key: "rank_desc", label: "ضعیف‌ترین رتبه" },
];

let sortIndex = 0;

const numberFormatter = new Intl.NumberFormat("fa-IR");

const domRefs = {
  panel: null,
  filterButton: null,
  sortButton: null,
  sortLabel: null,
  searchInput: null,
  gameSelect: null,
  teamSelect: null,
  fromInput: null,
  toInput: null,
  hint: null,
  clearButton: null,
};

function cacheDomRefs() {
  domRefs.panel = document.getElementById("tournaments_filters_panel");
  domRefs.filterButton = document.querySelector('[data-action="toggle-filter"]');
  domRefs.sortButton = document.querySelector('[data-action="cycle-sort"]');
  domRefs.sortLabel = document.querySelector("[data-sort-label]");
  domRefs.searchInput = document.getElementById("tournaments_search_input");
  domRefs.gameSelect = document.getElementById("tournaments_filter_game");
  domRefs.teamSelect = document.getElementById("tournaments_filter_team");
  domRefs.fromInput = document.getElementById("tournaments_filter_from");
  domRefs.toInput = document.getElementById("tournaments_filter_to");
  domRefs.hint = document.getElementById("tournaments_history_hint");
  domRefs.clearButton = document.querySelector(
    '[data-action="clear-tournament-filters"]'
  );
}

function ensureDomRefs() {
  if (!domRefs.panel && !domRefs.sortButton && !domRefs.searchInput) {
    cacheDomRefs();
  }
}

function normalizeText(value) {
  return (value ?? "").toString().trim().toLowerCase();
}

function getMatchDate(match = {}) {
  return (
    match.created_at ||
    match.date ||
    match.match_date ||
    match.played_at ||
    match.start_date ||
    match.tournament?.start_date ||
    match.tournament?.created_at ||
    null
  );
}

function getMatchTimestamp(match) {
  const raw = getMatchDate(match);
  if (!raw) return null;
  const date = new Date(raw);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

function getMatchScore(match = {}) {
  const candidates = [
    match.score,
    match.points,
    match.user_score,
    match.team_score,
    match.total_score,
  ];
  for (const candidate of candidates) {
    const number = Number(candidate);
    if (!Number.isNaN(number)) {
      return number;
    }
  }
  return null;
}

function getMatchRank(match = {}) {
  const candidates = [match.rank, match.position, match.place];
  for (const candidate of candidates) {
    const number = Number(candidate);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  return null;
}

function getMatchGameName(match = {}) {
  const candidates = [
    match.game_name,
    match.game?.name,
    match.tournament?.game_name,
    match.tournament?.game?.name,
  ];
  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }
  return "";
}

function getMatchTournamentName(match = {}) {
  const candidates = [
    match.tournament_name,
    match.tournament?.name,
    match.name,
  ];
  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }
  return "";
}

function getMatchTeamName(match = {}) {
  if (match.team_name) {
    return match.team_name;
  }
  if (match.team?.name) {
    return match.team.name;
  }
  if (Array.isArray(match.teams) && match.teams.length) {
    return match.teams
      .map((team) => (typeof team === "string" ? team : team?.name || ""))
      .filter(Boolean)
      .join("، ");
  }
  return "";
}

function hasMoreInPayload(payload, itemsLength) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const totalCandidates = [
    payload.total,
    payload.count,
    payload.total_count,
    payload.total_results,
    payload.total_items,
  ];

  for (const total of totalCandidates) {
    if (typeof total === "number" && total > itemsLength) {
      return true;
    }
  }

  if (typeof payload.total_pages === "number") {
    const currentPage = Number(payload.current_page ?? payload.page ?? 1);
    if (Number.isFinite(currentPage) && currentPage < payload.total_pages) {
      return true;
    }
  }

  return false;
}

function shouldRefreshTournamentHistoryData(payload) {
  if (!payload) {
    return true;
  }

  if (Array.isArray(payload)) {
    return false;
  }

  const candidates = [payload.results, payload.matches, payload.tournament_history];
  const items = candidates.find((value) => Array.isArray(value));

  if (!Array.isArray(items)) {
    return true;
  }

  return hasMoreInPayload(payload, items.length);
}

function formatMatchDate(value) {
  if (!value) return "-";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString("fa-IR");
  } catch (error) {
    console.error("خطا در فرمت تاریخ تاریخچه تورنومنت:", error);
    return value;
  }
}

function formatScore(value) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  return numberFormatter.format(value);
}

function formatRank(value) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  return numberFormatter.format(value);
}

function formatText(value) {
  return value && String(value).trim().length ? String(value) : "-";
}

function compareNumeric(aValue, bValue, direction = "desc") {
  const aMissing = aValue === null || Number.isNaN(aValue);
  const bMissing = bValue === null || Number.isNaN(bValue);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return direction === "asc" ? aValue - bValue : bValue - aValue;
}

function sortMatches(matches) {
  const sorted = [...matches];
  switch (filterState.sort) {
    case "date_asc":
      return sorted.sort((a, b) =>
        compareNumeric(getMatchTimestamp(a), getMatchTimestamp(b), "asc")
      );
    case "score_desc":
      return sorted.sort((a, b) =>
        compareNumeric(getMatchScore(a), getMatchScore(b), "desc")
      );
    case "score_asc":
      return sorted.sort((a, b) =>
        compareNumeric(getMatchScore(a), getMatchScore(b), "asc")
      );
    case "rank_asc":
      return sorted.sort((a, b) =>
        compareNumeric(getMatchRank(a), getMatchRank(b), "asc")
      );
    case "rank_desc":
      return sorted.sort((a, b) =>
        compareNumeric(getMatchRank(a), getMatchRank(b), "desc")
      );
    case "date_desc":
    default:
      return sorted.sort((a, b) =>
        compareNumeric(getMatchTimestamp(a), getMatchTimestamp(b), "desc")
      );
  }
}

function parseDateInput(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function applyFilters(matches) {
  const normalizedSearch = normalizeText(filterState.search);
  const fromDate = parseDateInput(filterState.from);
  const toDate = parseDateInput(filterState.to);
  const fromTime = fromDate ? fromDate.getTime() : null;
  const toTime = toDate ? toDate.getTime() + 86_399_999 : null;

  return matches.filter((match) => {
    const gameName = getMatchGameName(match);
    const teamName = getMatchTeamName(match);
    const tournamentName = getMatchTournamentName(match);

    if (normalizedSearch) {
      const haystack = normalizeText(
        [tournamentName, gameName, teamName].filter(Boolean).join(" ")
      );
      if (!haystack.includes(normalizedSearch)) {
        return false;
      }
    }

    if (filterState.game) {
      if (normalizeText(gameName) !== filterState.game) {
        return false;
      }
    }

    if (filterState.team) {
      if (normalizeText(teamName) !== filterState.team) {
        return false;
      }
    }

    const matchTime = getMatchTimestamp(match);

    if (fromTime !== null) {
      if (matchTime === null || matchTime < fromTime) {
        return false;
      }
    }

    if (toTime !== null) {
      if (matchTime === null || matchTime > toTime) {
        return false;
      }
    }

    return true;
  });
}

function renderMatchesTable(matches) {
  const tbody = document.getElementById("tournaments_history_body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!matches.length) {
    const row = tbody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 6;
    cell.textContent = "هیچ تاریخچه‌ای یافت نشد.";
    return;
  }

  matches.forEach((match) => {
    const row = tbody.insertRow();
    row.insertCell().textContent = formatScore(getMatchScore(match));
    row.insertCell().textContent = formatRank(getMatchRank(match));
    row.insertCell().textContent = formatMatchDate(getMatchDate(match));
    row.insertCell().textContent = formatText(getMatchTeamName(match));
    row.insertCell().textContent = formatText(getMatchGameName(match));
    row.insertCell().textContent = formatText(getMatchTournamentName(match));
  });
}

function updateHint(filteredCount, totalCount) {
  ensureDomRefs();
  if (!domRefs.hint) return;

  if (!totalCount) {
    domRefs.hint.textContent = "تاریخچه‌ای برای نمایش وجود ندارد.";
    return;
  }

  const formattedFiltered = numberFormatter.format(filteredCount);
  const formattedTotal = numberFormatter.format(totalCount);

  if (filteredCount === totalCount) {
    domRefs.hint.textContent = `${formattedFiltered} نتیجه`; 
  } else {
    domRefs.hint.textContent = `${formattedFiltered} نتیجه از ${formattedTotal} مورد`;
  }
}

function applyFiltersAndRender() {
  const filtered = applyFilters(matchesState);
  const sorted = sortMatches(filtered);
  renderMatchesTable(sorted);
  updateHint(filtered.length, matchesState.length);
}

function buildOptionMap(values) {
  const map = new Map();
  values.forEach((value) => {
    const normalized = normalizeText(value);
    if (!normalized) return;
    if (!map.has(normalized)) {
      map.set(normalized, value);
    }
  });
  return map;
}

function setSelectOptions(select, map, currentValue, fallbackLabel) {
  if (!select) return;

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = fallbackLabel;

  const frag = document.createDocumentFragment();
  frag.appendChild(defaultOption);

  map.forEach((label, key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    frag.appendChild(option);
  });

  select.innerHTML = "";
  select.appendChild(frag);

  if (currentValue && !map.has(currentValue)) {
    currentValue = "";
  }

  select.value = currentValue;
}

function populateFilterOptions() {
  ensureDomRefs();
  if (!domRefs.gameSelect && !domRefs.teamSelect) return;

  const games = buildOptionMap(matchesState.map((match) => getMatchGameName(match)));
  const teams = buildOptionMap(matchesState.map((match) => getMatchTeamName(match)));

  if (domRefs.gameSelect) {
    setSelectOptions(domRefs.gameSelect, games, filterState.game, "همه بازی‌ها");
  }

  if (domRefs.teamSelect) {
    setSelectOptions(domRefs.teamSelect, teams, filterState.team, "همه تیم‌ها");
  }
}

function updateFilterFieldsFromState() {
  ensureDomRefs();
  if (domRefs.searchInput) {
    domRefs.searchInput.value = filterState.search;
  }
  if (domRefs.fromInput) {
    domRefs.fromInput.value = filterState.from;
  }
  if (domRefs.toInput) {
    domRefs.toInput.value = filterState.to;
  }
  if (domRefs.gameSelect) {
    domRefs.gameSelect.value = filterState.game;
  }
  if (domRefs.teamSelect) {
    domRefs.teamSelect.value = filterState.team;
  }

  sortIndex = SORT_OPTIONS.findIndex((option) => option.key === filterState.sort);
  if (sortIndex === -1) {
    sortIndex = 0;
    filterState.sort = SORT_OPTIONS[0].key;
  }
}

function updateSortButtonLabel() {
  ensureDomRefs();
  if (!domRefs.sortLabel) return;
  const option =
    SORT_OPTIONS.find((item) => item.key === filterState.sort) || SORT_OPTIONS[0];
  domRefs.sortLabel.textContent = option.label;
  if (domRefs.sortButton) {
    domRefs.sortButton.setAttribute(
      "aria-label",
      `مرتب‌سازی تاریخچه (${option.label})`
    );
  }
}

function toggleFilterPanel() {
  ensureDomRefs();
  if (!domRefs.panel || !domRefs.filterButton) return;

  const isHidden = domRefs.panel.hasAttribute("hidden");
  if (isHidden) {
    domRefs.panel.removeAttribute("hidden");
    domRefs.panel.classList.add("is-open");
    domRefs.panel.setAttribute("aria-hidden", "false");
    domRefs.filterButton.setAttribute("aria-expanded", "true");
  } else {
    domRefs.panel.setAttribute("hidden", "true");
    domRefs.panel.classList.remove("is-open");
    domRefs.panel.setAttribute("aria-hidden", "true");
    domRefs.filterButton.setAttribute("aria-expanded", "false");
  }
}

function cycleSortOption() {
  sortIndex = (sortIndex + 1) % SORT_OPTIONS.length;
  filterState.sort = SORT_OPTIONS[sortIndex].key;
  updateSortButtonLabel();
  applyFiltersAndRender();
}

function clearFilters() {
  filterState = { ...defaultFilterState };
  sortIndex = 0;
  updateFilterFieldsFromState();
  populateFilterOptions();
  updateSortButtonLabel();
  applyFiltersAndRender();
}

function handleFilterInput(event) {
  const { id, value } = event.target;

  switch (id) {
    case "tournaments_search_input":
      filterState.search = value;
      break;
    case "tournaments_filter_game":
      filterState.game = normalizeText(value);
      break;
    case "tournaments_filter_team":
      filterState.team = normalizeText(value);
      break;
    case "tournaments_filter_from":
      filterState.from = value;
      break;
    case "tournaments_filter_to":
      filterState.to = value;
      break;
    default:
      break;
  }

  applyFiltersAndRender();
}

function attachFilterListeners() {
  ensureDomRefs();

  if (domRefs.filterButton && domRefs.panel) {
    domRefs.filterButton.addEventListener("click", toggleFilterPanel);
  }

  if (domRefs.sortButton) {
    domRefs.sortButton.addEventListener("click", cycleSortOption);
  }

  if (domRefs.searchInput) {
    domRefs.searchInput.addEventListener("input", handleFilterInput);
  }

  if (domRefs.gameSelect) {
    domRefs.gameSelect.addEventListener("change", handleFilterInput);
  }

  if (domRefs.teamSelect) {
    domRefs.teamSelect.addEventListener("change", handleFilterInput);
  }

  if (domRefs.fromInput) {
    domRefs.fromInput.addEventListener("change", handleFilterInput);
  }

  if (domRefs.toInput) {
    domRefs.toInput.addEventListener("change", handleFilterInput);
  }

  if (domRefs.clearButton) {
    domRefs.clearButton.addEventListener("click", clearFilters);
  }
}

export function configureTournamentHistoryModule(config = {}) {
  helpers = { ...helperDefaults, ...config };
}

export function normalizeTournamentHistory(data) {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.tournament_history)) {
    return data.tournament_history;
  }
  if (Array.isArray(data?.matches)) {
    return data.matches;
  }
  if (Array.isArray(data?.results)) {
    return data.results;
  }
  return [];
}

export function getTournamentMatchesCount(data) {
  return normalizeTournamentHistory(data).length;
}

export async function fetchUserTournamentHistory(userId) {
  if (!userId) {
    console.warn("شناسه کاربر برای دریافت تاریخچه تورنومنت موجود نیست.");
    return [];
  }

  try {
    console.log("دریافت تاریخچه تورنومنت‌های کاربر از API...");

    const response = await helpers.fetchWithAuth(
      API_ENDPOINTS.users.userMatchHistory(userId),
      {
        method: "GET",
      }
    );

    console.log("Tournament history status:", response.status);

    if (!response.ok) {
      const message = await helpers.extractErrorMessage(response);
      throw new Error(message || `خطای HTTP: ${response.status}`);
    }

    const raw = await response.text();
    if (!raw) {
      console.warn("Tournament history API returned an empty response.");
      return [];
    }

    try {
      const data = JSON.parse(raw);
      console.log("داده‌های تاریخچه تورنومنت:", data);
      return normalizeTournamentHistory(data);
    } catch (parseError) {
      console.error("خطا در parse تاریخچه تورنومنت:", parseError);
      throw new Error("داده‌های نامعتبر از سرور دریافت شد.");
    }
  } catch (error) {
    console.error("خطا در دریافت تاریخچه تورنومنت‌های کاربر:", error);
    throw error;
  }
}

export async function initializeDashboardTournamentHistorySection({
  dashboardData = {},
  userId = null,
} = {}) {
  const historyPayload =
    dashboardData?.tournament_history ??
    dashboardData?.matches ??
    dashboardData?.results ??
    null;

  let matches = normalizeTournamentHistory(historyPayload);
  const hasTable = Boolean(document.getElementById("tournaments_history_body"));

  if (hasTable) {
    displayTournamentHistory(matches);
  }

  if (shouldRefreshTournamentHistoryData(historyPayload)) {
    if (!userId) {
      console.warn("شناسه کاربر برای بروزرسانی تاریخچه تورنومنت در دسترس نیست.");
    } else {
      try {
        const refreshed = await fetchUserTournamentHistory(userId);
        matches = normalizeTournamentHistory(refreshed);
        if (hasTable) {
          displayTournamentHistory(matches);
        }
      } catch (error) {
        console.error("خطا در دریافت تاریخچه تورنومنت‌ها:", error);
        helpers.showError("خطا در دریافت تاریخچه تورنومنت‌ها. لطفاً دوباره تلاش کنید.");
      }
    }
  }

  return {
    matches,
    count: matches.length,
  };
}

export function displayTournamentHistory(matchesInput) {
  matchesState = Array.isArray(matchesInput) ? matchesInput.slice() : [];
  populateFilterOptions();
  updateFilterFieldsFromState();
  updateSortButtonLabel();
  applyFiltersAndRender();
}

let filtersInitialized = false;

export function initializeTournamentHistoryUI() {
  cacheDomRefs();
  updateFilterFieldsFromState();
  updateSortButtonLabel();
  populateFilterOptions();

  if (!filtersInitialized) {
    attachFilterListeners();
    filtersInitialized = true;
  }

  applyFiltersAndRender();
}

export function getStoredTournamentMatches() {
  return matchesState.slice();
}
