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

const SORT_QUERY_PARAM_MAP = {
  date_desc: "-created_at",
  date_asc: "created_at",
  score_desc: "-score",
  score_asc: "score",
  rank_asc: "rank",
  rank_desc: "-rank",
};

const HISTORY_REQUEST_PAGE_SIZE = 100;

let sortIndex = 0;

const numberFormatter = new Intl.NumberFormat("fa-IR");

let totalMatchesCount = 0;
let availableFilterMatches = [];
let currentUserId = null;
let serverFilteringEnabled = false;
let historyFetchDebounce = null;
let activeHistoryRequest = null;
let isHistoryLoading = false;

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

function getFilterSourceMatches() {
  return availableFilterMatches.length ? availableFilterMatches : matchesState;
}

function updateAvailableFilterMatches(matches, { replace = false } = {}) {
  if (!Array.isArray(matches)) {
    return;
  }

  if (replace || !availableFilterMatches.length) {
    availableFilterMatches = matches.slice();
    return;
  }

  if (!matches.length) {
    return;
  }

  availableFilterMatches = availableFilterMatches.concat(matches);
}

function getNormalizedSelectValue(select, fallback) {
  if (!select) {
    return normalizeText(fallback);
  }
  const option = select.selectedOptions?.[0];
  if (option) {
    return (
      option.dataset.normalized ||
      normalizeText(option.value || option.textContent || fallback)
    );
  }
  return normalizeText(fallback);
}

function getNormalizedFilterValue(key) {
  ensureDomRefs();
  switch (key) {
    case "game":
      return getNormalizedSelectValue(domRefs.gameSelect, filterState.game);
    case "team":
      return getNormalizedSelectValue(domRefs.teamSelect, filterState.team);
    case "search":
      return normalizeText(filterState.search);
    default:
      return normalizeText(filterState[key]);
  }
}

function setHistoryLoading(isLoading) {
  isHistoryLoading = Boolean(isLoading);
  if (isLoading) {
    renderMatchesTable(applyFilters(matchesState));
    const totalForHint = totalMatchesCount || matchesState.length;
    updateHint(matchesState.length, totalForHint);
  }
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

function extractTotalCount(payload, fallback = null) {
  if (!payload) {
    return typeof fallback === "number" ? fallback : null;
  }

  if (Array.isArray(payload)) {
    return payload.length;
  }

  if (typeof payload === "object") {
    const totalCandidates = [
      payload.total,
      payload.count,
      payload.total_count,
      payload.total_results,
      payload.total_items,
    ];

    for (const total of totalCandidates) {
      if (typeof total === "number") {
        return total;
      }
    }
  }

  return typeof fallback === "number" ? fallback : null;
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
  const normalizedSearch = getNormalizedFilterValue("search");
  const normalizedGame = getNormalizedFilterValue("game");
  const normalizedTeam = getNormalizedFilterValue("team");
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

    if (normalizedGame) {
      if (normalizeText(gameName) !== normalizedGame) {
        return false;
      }
    }

    if (normalizedTeam) {
      if (normalizeText(teamName) !== normalizedTeam) {
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

  if (isHistoryLoading) {
    const row = tbody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 6;
    cell.textContent = "در حال بارگذاری...";
    cell.className = "tournaments_history_loading";
    return;
  }

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

  if (isHistoryLoading) {
    domRefs.hint.textContent = "در حال بارگذاری...";
    return;
  }

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
  const totalForHint = totalMatchesCount || matchesState.length;
  updateHint(filtered.length, totalForHint);
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
    option.value = label;
    option.textContent = label;
    option.dataset.normalized = key;
    frag.appendChild(option);
  });

  select.innerHTML = "";
  select.appendChild(frag);

  if (currentValue) {
    const normalizedCurrent = normalizeText(currentValue);
    const options = Array.from(select.options);
    const hasOption = options.some((option) => {
      const normalized =
        option.dataset.normalized || normalizeText(option.value || option.textContent);
      return normalized === normalizedCurrent;
    });

    if (!hasOption) {
      const preservedOption = document.createElement("option");
      preservedOption.value = currentValue;
      preservedOption.textContent = currentValue;
      preservedOption.dataset.normalized = normalizedCurrent;
      preservedOption.hidden = true;
      select.appendChild(preservedOption);
    }

    select.value = currentValue;
  } else {
    select.value = "";
  }
}

function populateFilterOptions() {
  ensureDomRefs();
  if (!domRefs.gameSelect && !domRefs.teamSelect) return;

  const sourceMatches = getFilterSourceMatches();
  const games = buildOptionMap(sourceMatches.map((match) => getMatchGameName(match)));
  const teams = buildOptionMap(sourceMatches.map((match) => getMatchTeamName(match)));

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
  scheduleHistoryFetch({ immediate: true });
}

function clearFilters() {
  filterState = { ...defaultFilterState };
  sortIndex = 0;
  updateFilterFieldsFromState();
  populateFilterOptions();
  updateSortButtonLabel();
  scheduleHistoryFetch({ immediate: true });
}

function handleFilterInput(event) {
  const { id, value } = event.target;
  let debounce = false;

  switch (id) {
    case "tournaments_search_input":
      filterState.search = value;
      debounce = true;
      break;
    case "tournaments_filter_game":
      filterState.game = value;
      break;
    case "tournaments_filter_team":
      filterState.team = value;
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

  scheduleHistoryFetch({ immediate: !debounce });
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

function isServerFilteringActive() {
  const fetchFn = helpers.fetchWithAuth;
  const hasValidFetch =
    typeof fetchFn === "function" && fetchFn !== helperDefaults.fetchWithAuth;
  return serverFilteringEnabled && Boolean(currentUserId) && hasValidFetch;
}

function updateServerFilteringState() {
  const fetchFn = helpers.fetchWithAuth;
  const hasValidFetch =
    typeof fetchFn === "function" && fetchFn !== helperDefaults.fetchWithAuth;
  serverFilteringEnabled = Boolean(
    serverFilteringEnabled || (currentUserId && hasValidFetch)
  );
}

function buildHistoryQueryParams() {
  const params = new URLSearchParams();

  const searchValue = filterState.search?.trim();
  if (searchValue) {
    params.set("search", searchValue);
  }

  const gameValue = filterState.game?.trim();
  if (gameValue) {
    params.set("game", gameValue);
  }

  const teamValue = filterState.team?.trim();
  if (teamValue) {
    params.set("team", teamValue);
  }

  if (filterState.from) {
    params.set("start_date__gte", filterState.from);
  }

  if (filterState.to) {
    params.set("start_date__lte", filterState.to);
  }

  const ordering = SORT_QUERY_PARAM_MAP[filterState.sort];
  if (ordering) {
    params.set("ordering", ordering);
  }

  if (!params.has("page_size")) {
    params.set("page_size", String(HISTORY_REQUEST_PAGE_SIZE));
  }

  return params;
}

function scheduleHistoryFetch({ immediate = false } = {}) {
  if (!isServerFilteringActive()) {
    applyFiltersAndRender();
    return;
  }

  if (historyFetchDebounce) {
    clearTimeout(historyFetchDebounce);
    historyFetchDebounce = null;
  }

  if (immediate) {
    fetchHistoryFromServer();
    return;
  }

  historyFetchDebounce = setTimeout(() => {
    historyFetchDebounce = null;
    fetchHistoryFromServer();
  }, 400);
}

async function fetchHistoryFromServer() {
  if (!isServerFilteringActive()) {
    applyFiltersAndRender();
    return;
  }

  if (activeHistoryRequest) {
    activeHistoryRequest.abort();
  }

  const controller = new AbortController();
  activeHistoryRequest = controller;

  try {
    setHistoryLoading(true);

    const { items, totalCount } = await fetchUserTournamentHistory(currentUserId, {
      query: buildHistoryQueryParams(),
      signal: controller.signal,
    });

    const resolvedTotal =
      typeof totalCount === "number" ? totalCount : items.length;
    const replaceFilters = !availableFilterMatches.length;

    setHistoryLoading(false);
    displayTournamentHistory(items, {
      totalCount: resolvedTotal,
      replaceFilterSource: replaceFilters,
    });
  } catch (error) {
    if (!controller.signal.aborted) {
      setHistoryLoading(false);
      console.error("خطا در دریافت تاریخچه تورنومنت‌ها:", error);
      helpers.showError(
        error.message || "خطا در دریافت تاریخچه تورنومنت‌ها. لطفاً دوباره تلاش کنید."
      );
      applyFiltersAndRender();
    }
  } finally {
    if (activeHistoryRequest === controller) {
      activeHistoryRequest = null;
    }
    if (isHistoryLoading) {
      setHistoryLoading(false);
      applyFiltersAndRender();
    }
  }
}

export function configureTournamentHistoryModule(config = {}) {
  helpers = { ...helperDefaults, ...config };

  if (typeof config.enableServerFiltering === "boolean") {
    serverFilteringEnabled = config.enableServerFiltering;
  }

  if (typeof config.userId !== "undefined") {
    setTournamentHistoryUserContext(config.userId);
  } else {
    updateServerFilteringState();
  }
}

export function setTournamentHistoryUserContext(value) {
  if (typeof value === "undefined") {
    return;
  }

  if (value && typeof value === "object") {
    const candidates = [
      value.id,
      value.user_id,
      value.pk,
      value.uuid,
      value.slug,
    ];
    const resolved = candidates.find(
      (candidate) => candidate !== undefined && candidate !== null
    );
    currentUserId = resolved !== undefined ? String(resolved) : null;
  } else if (value === null) {
    currentUserId = null;
  } else {
    currentUserId = String(value);
  }

  updateServerFilteringState();
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

export async function fetchUserTournamentHistory(
  userId,
  { query, signal } = {}
) {
  if (!userId) {
    console.warn("شناسه کاربر برای دریافت تاریخچه تورنومنت موجود نیست.");
    return { items: [], totalCount: 0 };
  }

  try {
    console.log("دریافت تاریخچه تورنومنت‌های کاربر از API...");

    const endpoint = API_ENDPOINTS.users.userMatchHistory(userId);
    const queryString =
      query instanceof URLSearchParams
        ? query.toString()
        : query && typeof query === "object"
        ? new URLSearchParams(query).toString()
        : "";
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;

    const response = await helpers.fetchWithAuth(url, {
      method: "GET",
      signal,
    });

    console.log("Tournament history status:", response.status);

    if (!response.ok) {
      const message = await helpers.extractErrorMessage(response);
      throw new Error(message || `خطای HTTP: ${response.status}`);
    }

    const raw = await response.text();
    if (!raw) {
      console.warn("Tournament history API returned an empty response.");
      return { items: [], totalCount: 0 };
    }

    try {
      const data = JSON.parse(raw);
      console.log("داده‌های تاریخچه تورنومنت:", data);
      const items = normalizeTournamentHistory(data);
      return {
        items,
        totalCount: extractTotalCount(data, items.length),
        raw: data,
      };
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
  if (userId) {
    setTournamentHistoryUserContext(userId);
  }

  const historyPayload =
    dashboardData?.tournament_history ??
    dashboardData?.matches ??
    dashboardData?.results ??
    null;

  let matches = normalizeTournamentHistory(historyPayload);
  let totalCount = extractTotalCount(historyPayload, matches.length) ?? matches.length;
  const hasTable = Boolean(document.getElementById("tournaments_history_body"));

  if (hasTable) {
    displayTournamentHistory(matches, {
      totalCount,
      replaceFilterSource: !availableFilterMatches.length,
    });
  }

  if (shouldRefreshTournamentHistoryData(historyPayload)) {
    if (!userId) {
      console.warn("شناسه کاربر برای بروزرسانی تاریخچه تورنومنت در دسترس نیست.");
    } else {
      try {
        const result = await fetchUserTournamentHistory(userId, {
          query: buildHistoryQueryParams(),
        });
        const fetchedItems = Array.isArray(result.items)
          ? result.items
          : normalizeTournamentHistory(result.raw ?? result.items);
        matches = fetchedItems;
        totalCount =
          typeof result.totalCount === "number"
            ? result.totalCount
            : matches.length;
        if (hasTable) {
          displayTournamentHistory(matches, {
            totalCount,
            replaceFilterSource: !availableFilterMatches.length,
          });
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
    totalCount,
  };
}

export function displayTournamentHistory(
  matchesInput,
  { totalCount, replaceFilterSource = false } = {}
) {
  matchesState = Array.isArray(matchesInput) ? matchesInput.slice() : [];

  if (typeof totalCount === "number") {
    totalMatchesCount = totalCount;
  } else if (!totalMatchesCount) {
    totalMatchesCount = matchesState.length;
  }

  updateAvailableFilterMatches(matchesState, { replace: replaceFilterSource });
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
