  import { API_BASE_URL } from "/js/config.js";

  const notifier = typeof window !== "undefined" ? window.AppNotifier || {} : {};
  const renderInlineMessage = notifier.renderInlineMessage || ((container, _key, overrides = {}) => {
    if (!container) return;
    const message = overrides.message || "اطلاعاتی برای نمایش وجود ندارد.";
    container.innerHTML = `<div class="app-message app-message--info" role="alert">${message}</div>`;
  });
  const showAppNotification = notifier.showAppNotification || (() => {});

  // ---------------------- 1. گرفتن gameId از URL ----------------------
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get("id");

  const HIGHLIGHT_COUNT = 2;

  const tournamentCache = new Map();
  const paginationState = {
    upcoming: { page: 1, pageSize: 6, totalCount: 0 },
    ongoing: { page: 1, pageSize: 6, totalCount: 0 },
    finished: { page: 1, pageSize: 9, totalCount: 0 }
  };

  const activeControllers = {
    upcoming: null,
    ongoing: null,
    finished: null,
    finishedPreview: null
  };

  // ---------------------- توابع کمکی ----------------------
  function safeNumber(value, defaultValue = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : defaultValue;
  }

  function safeArrayLength(arr) {
    return Array.isArray(arr) ? arr.length : 0;
  }

  function isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
  }

  function getAuthHeaders() {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function createController(key) {
    if (activeControllers[key]) {
      activeControllers[key].abort();
    }
    const controller = new AbortController();
    activeControllers[key] = controller;
    return controller;
  }

  function toggleSectionVisibility(containerId, hasContent) {
    // مخفی/نمایش container
    const section = document.getElementById(containerId);
    if (section) section.style.display = hasContent ? "block" : "none";

    // مخفی/نمایش تیتر مربوطه
    // در HTML شما، تیتر بالای container غالباً div.parentElement با کلاس 'titr' است
    const titr = section?.previousElementSibling;
    if (titr && titr.classList.contains("titr")) {
      titr.style.display = hasContent ? "flex" : "none";
    }

    // برای بخش پایان‌یافته، تیتر داخل section است
    if (containerId === "recent_finished_tournaments") {
      const finishedSectionTitr = document.querySelector("#finished .titr");
      if (finishedSectionTitr) finishedSectionTitr.style.display = hasContent ? "flex" : "none";
    }
  };


  // ---------------------- Fetch تورنومنت ----------------------
  async function fetchTournamentsData({ status = "all", page = 1, pageSize = 6, ordering = "start_date", signal }) {
    const url = new URL(`${API_BASE_URL}/api/tournaments/tournaments/`);
    url.searchParams.set("page", page);
    url.searchParams.set("page_size", pageSize);
    url.searchParams.set("ordering", ordering);
    if (status && status !== "all") url.searchParams.set("status", status);
    if (gameId) url.searchParams.set("game", gameId);

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders(),
      signal
    });

    if (!response.ok) {
      const error = new Error("خطا در دریافت اطلاعات تورنومنت‌ها");
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    return {
      results: Array.isArray(data) ? data : data.results || [],
      count: Array.isArray(data) ? data.length : data.count || 0
    };
  }

  // ---------------------- پیام‌ها ----------------------
  function renderSectionMessage(containerId, message) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `<div class="section-message">${message}</div>`;
  }

  function cacheTournament(tournament) {
    if (!tournament || !tournament.id) return;
    tournamentCache.set(tournament.id, tournament);
  }

  // ---------------------- Pagination ----------------------
  function renderPaginationControls({ containerId, totalCount, pageSize, currentPage, onPageChange }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    const totalPages = Math.ceil(totalCount / pageSize);
    if (!totalPages || totalPages <= 1) {
      container.style.display = "none";
      return;
    }

    container.style.display = "flex";

    const prevBtn = document.createElement("button");
    prevBtn.className = "Previous";
    prevBtn.textContent = "قبلی";
    if (currentPage <= 1) {
      prevBtn.classList.add("disabled");
    } else {
      prevBtn.addEventListener("click", () => onPageChange(currentPage - 1));
    }
    container.appendChild(prevBtn);

    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let page = start; page <= end; page++) {
      const pageLink = document.createElement("a");
      pageLink.className = "page_number";
      pageLink.textContent = page;
      pageLink.href = "#";
      if (page === currentPage) pageLink.classList.add("filter-active");
      pageLink.addEventListener("click", event => {
        event.preventDefault();
        if (page === currentPage) return;
        onPageChange(page);
      });
      container.appendChild(pageLink);
    }

    const nextBtn = document.createElement("button");
    nextBtn.className = "next";
    nextBtn.textContent = "بعدی";
    if (currentPage >= totalPages) {
      nextBtn.classList.add("disabled");
    } else {
      nextBtn.addEventListener("click", () => onPageChange(currentPage + 1));
    }
    container.appendChild(nextBtn);
  }

  function hidePagination(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.style.display = "none";
      container.innerHTML = "";
    }
  }

  // ---------------------- Render لیست تورنومنت‌ها ----------------------
  function renderTournamentList(containerId, tournaments) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!Array.isArray(tournaments) || tournaments.length === 0) {
      toggleSectionVisibility(containerId, false);
      return;
    }

    toggleSectionVisibility(containerId, true);
    container.innerHTML = "";

    tournaments.forEach(tournament => {
      cacheTournament(tournament);
      renderTournamentCard(tournament, containerId);
    });
  }

  // ---------------------- وضعیت بارگذاری و خطا ----------------------
  const statusContainer = document.createElement("div");
  statusContainer.id = "game-tournaments-status";
  statusContainer.className = "app-message-host game-tournaments-status";
  if (document.body) {
    document.body.prepend(statusContainer);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      document.body.prepend(statusContainer);
    });
  }

  function showError(key, fallbackMessage) {
    const overrides = fallbackMessage ? { message: fallbackMessage } : {};
    renderInlineMessage(statusContainer, key, overrides);
    showAppNotification(key, overrides);
  }

  function showLoading() {
    renderInlineMessage(statusContainer, "loadingInProgress");
  }

  function hideLoading() {
    if (statusContainer) statusContainer.innerHTML = "";
  }

  // ---------------------- Load اطلاعات بازی و تورنومنت‌ها ----------------------
  async function loadGameTournaments() {
    if (!gameId) {
      showError("gameIdMissing");
      return;
    }

    showLoading();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const gameRes = await fetch(`${API_BASE_URL}/api/tournaments/games/${gameId}/`, {
        headers: getAuthHeaders(),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!gameRes.ok) throw new Error("خطا در دریافت اطلاعات بازی");

      const gameData = await gameRes.json();
      renderGameInfo(gameData);

      await loadOngoingTournaments(1, { updateHighlights: true });
      await loadUpcomingTournaments(1);
      await loadFinishedPreview();
    } catch (err) {
      clearTimeout(timeoutId);
      hideLoading();
      if (err.name === "AbortError") showError("requestTimeout");
      else showError("gameTournamentsLoadFailed");
      console.error("loadGameTournaments error:", err);
      return;
    }

    hideLoading();
  }

  // ---------------------- نمایش اطلاعات بازی ----------------------
  function renderGameInfo(gameData) {
    const defaultBanner = "img/banner9.jpg";
    const banner = gameData.images?.length
      ? (gameData.images.find(img => img.image_type === "hero_banner")?.image || gameData.images[0].image)
      : defaultBanner;

    const heroBannerEl = document.getElementById("hero_banner");
    if (heroBannerEl) heroBannerEl.src = banner;

    const nameEl = document.querySelector("#game_name span");
    if (nameEl) nameEl.textContent = gameData.name;

    const descSpan = document.querySelector("#game_description span");
    if (descSpan) descSpan.textContent = gameData.description || "توضیحی موجود نیست";
  }

  // ---------------------- Load تورنومنت‌ها ----------------------
  async function loadOngoingTournaments(page = 1, { updateHighlights = false } = {}) {
    const controller = createController("ongoing");
    paginationState.ongoing.page = page;

    renderSectionMessage("running_tournaments", "در حال بارگذاری...");
    renderSectionMessage("live_tournaments", "در حال بارگذاری...");

    try {
      const { results, count } = await fetchTournamentsData({
        status: "ongoing",
        page,
        pageSize: paginationState.ongoing.pageSize,
        signal: controller.signal
      });

      if (controller.signal.aborted) return;

      paginationState.ongoing.totalCount = count;

      renderLiveHighlights(results.slice(0, HIGHLIGHT_COUNT));
      renderRunningTournaments(results, page);

      renderPaginationControls({
        containerId: "ongoing_pagination",
        totalCount: count,
        pageSize: paginationState.ongoing.pageSize,
        currentPage: page,
        onPageChange: newPage => loadOngoingTournaments(newPage)
      });

      if (!results.length) toggleSectionVisibility("running_tournaments", false);
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("loadOngoingTournaments error:", error);
      toggleSectionVisibility("running_tournaments", false);
      toggleSectionVisibility("live_tournaments", false);
      hidePagination("ongoing_pagination");
    }
  }

  async function loadUpcomingTournaments(page = 1) {
    const controller = createController("upcoming");
    paginationState.upcoming.page = page;

    renderSectionMessage("upcoming_tournaments", "در حال بارگذاری...");

    try {
      const { results, count } = await fetchTournamentsData({
        status: "upcoming",
        page,
        pageSize: paginationState.upcoming.pageSize,
        signal: controller.signal
      });

      if (controller.signal.aborted) return;

      paginationState.upcoming.totalCount = count;

      renderTournamentList("upcoming_tournaments", results);

      renderPaginationControls({
        containerId: "upcoming_pagination",
        totalCount: count,
        pageSize: paginationState.upcoming.pageSize,
        currentPage: page,
        onPageChange: newPage => loadUpcomingTournaments(newPage)
      });
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("loadUpcomingTournaments error:", error);
      toggleSectionVisibility("upcoming_tournaments", false);
      hidePagination("upcoming_pagination");
    }
  }

  async function loadFinishedPreview() {
    const controller = createController("finishedPreview");
    renderSectionMessage("recent_finished_tournaments", "در حال بارگذاری...");

    try {
      const { results, count } = await fetchTournamentsData({
        status: "finished",
        page: 1,
        pageSize: 3,
        ordering: "-start_date",
        signal: controller.signal
      });

      if (controller.signal.aborted) return;

      paginationState.finished.totalCount = count;

      const previewContainer = document.getElementById("recent_finished_tournaments");
      const showMoreBtn = document.getElementById("show_all_finished_btn");
      const finishedWrapper = document.getElementById("all_finished_wrapper");

      if (!Array.isArray(results) || results.length === 0) {
        toggleSectionVisibility("recent_finished_tournaments", false);
        if (showMoreBtn) showMoreBtn.parentElement?.classList.add("hidden");
        if (finishedWrapper) finishedWrapper.classList.add("hidden");
        return;
      }

      toggleSectionVisibility("recent_finished_tournaments", true);
      previewContainer.innerHTML = "";
      results.forEach(tournament => {
        cacheTournament(tournament);
        renderTournamentCard(tournament, "recent_finished_tournaments");
      });

      if (showMoreBtn) {
        const actionsContainer = showMoreBtn.parentElement;
        if (count > results.length) {
          showMoreBtn.classList.remove("hidden");
          showMoreBtn.disabled = false;
          if (actionsContainer) actionsContainer.classList.remove("hidden");
        } else {
          showMoreBtn.classList.add("hidden");
          if (actionsContainer) actionsContainer.classList.add("hidden");
        }
      }

      if (finishedWrapper) finishedWrapper.classList.add("hidden");
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("loadFinishedPreview error:", error);
      toggleSectionVisibility("recent_finished_tournaments", false);
    }
  }

  async function loadFinishedTournaments(page = 1) {
    const controller = createController("finished");
    paginationState.finished.page = page;

    renderSectionMessage("finished_tournaments", "در حال بارگذاری...");

    try {
      const { results, count } = await fetchTournamentsData({
        status: "finished",
        page,
        pageSize: paginationState.finished.pageSize,
        ordering: "-start_date",
        signal: controller.signal
      });

      if (controller.signal.aborted) return;

      paginationState.finished.totalCount = count;

      renderTournamentList("finished_tournaments", results);

      renderPaginationControls({
        containerId: "finished_pagination",
        totalCount: count,
        pageSize: paginationState.finished.pageSize,
        currentPage: page,
        onPageChange: newPage => loadFinishedTournaments(newPage)
      });
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("loadFinishedTournaments error:", error);
      toggleSectionVisibility("finished_tournaments", false);
      hidePagination("finished_pagination");
    }
  }

  // ---------------------- Render کارت‌های تورنومنت ----------------------
  function renderLiveHighlights(tournaments = []) {
    const containerId = "live_tournaments";
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!tournaments.length) {
      toggleSectionVisibility(containerId, false);
      return;
    }

    toggleSectionVisibility(containerId, true);
    container.innerHTML = "";
    tournaments.forEach(tournament => {
      cacheTournament(tournament);
      renderTournamentCard(tournament, containerId);
    });
  }

  function renderRunningTournaments(tournaments = [], page = 1) {
    const containerId = "running_tournaments";
    const container = document.getElementById(containerId);
    if (!container) return;

    const items = page === 1 ? tournaments.slice(HIGHLIGHT_COUNT) : tournaments;

    if (!items.length) {
      toggleSectionVisibility(containerId, false);
      return;
    }

    toggleSectionVisibility(containerId, true);
    container.innerHTML = "";
    items.forEach(tournament => {
      cacheTournament(tournament);
      renderTournamentCard(tournament, containerId);
    });
  }

  // ---------------------- Toggle بخش پایان یافته ----------------------
  function setupFinishedSectionToggle() {
    const button = document.getElementById("show_all_finished_btn");
    if (!button) return;

    button.addEventListener("click", () => {
      button.classList.add("hidden");
      const wrapper = document.getElementById("all_finished_wrapper");
      if (wrapper) wrapper.classList.remove("hidden");
      if (button.parentElement) button.parentElement.classList.add("hidden");
      loadFinishedTournaments(1);
    });
  }

  // ---------------------- Scroll کوتاه ----------------------
  function setupScrollShortcuts() {
    const showButton = document.querySelector(".show_tournaments");
    if (showButton) {
      showButton.addEventListener("click", () => {
        const target = document.getElementById("running") || document.getElementById("upcoming") || document.getElementById("finished");
        if (target && typeof target.scrollIntoView === "function") {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }
  }
  function renderTournamentCard(tournament, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
  
    const start = new Date(tournament.start_date);
    const end = new Date(tournament.end_date);
    const now = new Date();
  
    const maxParticipants = safeNumber(tournament.max_participants, 1);
    const teamSize = safeNumber(tournament.team_size, 1);
  
    const registeredCount = tournament.type === "team"
      ? safeArrayLength(tournament.teams)
      : safeArrayLength(tournament.participants);
  
    const totalCapacity = tournament.type === "team"
      ? teamSize > 0 ? maxParticipants / teamSize : 0
      : maxParticipants;
  
    const emptySpots = Math.max(totalCapacity - registeredCount, 0);
  
    let percent = 0;
    if (totalCapacity > 0 && Number.isFinite(registeredCount)) {
      percent = (registeredCount / totalCapacity) * 100;
      percent = Math.min(Math.max(percent, 0), 100);
    }
  
    const entryFee = safeNumber(tournament.entry_fee);
    const price = tournament.is_free
      ? "رایگان"
      : (entryFee > 0 ? entryFee.toLocaleString("fa-IR") + " تومان" : "نامشخص");
  
    const dateStr = isValidDate(start)
      ? start.toLocaleDateString("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
      : "تاریخ نامشخص";
  
    const div = document.createElement("div");
    div.id = `tournament-${tournament.id}`;
    div.className = "live_tournament_cart";
  
    const prizePool = safeNumber(tournament.prize_pool);
    const prizeText = prizePool > 0 ? prizePool.toLocaleString("fa-IR") + " تومان" : "نامشخص";
  
    // حالت لایو (چینش اولیه)
    if (start <= now && end > now && containerId === "live_tournaments") {
      div.innerHTML = `
        <div class="live_right">
          <div class="live_game_name">
            <h3>${escapeHTML(tournament.game?.name || "-")}</h3>
            <div class="live"><span></span><span>زنده</span></div>
          </div>
          <div class="live_title"><span>${escapeHTML(tournament.name)}</span></div>
          <div class="live_info">
            <div class="live_info_date">
              <img src="img/icons/tagvim.svg" alt="tagvim">
              <span>${dateStr}</span>
            </div>
            <div class="info_sign_price">
              <img src="img/icons/money.svg" alt="money">
              <span>هزینه ورود :</span><span>${price}</span>
            </div>
          </div>
        </div>
        <div class="live_left">
          <div class="live_award">
            <span>مجموع جوایز</span>
            <h3 class="award_money">${prizeText}</h3>
          </div>
          <button class="live_join_link">اضافه شو!</button>
        </div>
        <div class="bottom">
          <div class="live-game-mode">
            <img src="img/icons/users.svg" alt="users">
            <span>${tournament.type === "team" ? "بازی تیمی" : "بازی انفرادی"}</span>
          </div>
          <div class="team-text" id="teamText${tournament.id}">
            ${tournament.type === "team"
              ? `${registeredCount} تیم / ${totalCapacity} جایگاه خالی: ${emptySpots}`
              : `${registeredCount} نفر / ${totalCapacity} جایگاه خالی: ${emptySpots}`
            }
          </div>
          <div class="line-bar-container">
            <div class="progress-line">
              <div class="progress-fill" id="progressFill${tournament.id}" style="width:${percent}%"></div>
            </div>
          </div>
        </div>
      `;
  
      div.querySelector(".live_join_link").addEventListener("click", () => {
        if (tournament.id) window.location.href = `game-loby.html?id=${tournament.id}`;
      });
    }
  
    container.appendChild(div);
  }
  
  // ---------------------- تایمر ----------------------
  function timeRemaining(startCountdown, startDate, endDate) {
    const now = new Date();
    const countdownTime = new Date(startCountdown || startDate);
    const startTime = new Date(startDate);
    const endTime = new Date(endDate);

    if (!isValidDate(countdownTime) || !isValidDate(startTime) || !isValidDate(endTime)) return "-";

    if (now < countdownTime) {
      return countdownTime.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    }
    if (now >= countdownTime && now < startTime) {
      const diff = startTime - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      return `${hours.toString().padStart(2,"0")} : ${mins.toString().padStart(2,"0")} : ${secs.toString().padStart(2,"0")}`;
    }
    if (now >= startTime && now < endTime) return "شروع شده";
    if (now >= endTime) return "پایان یافته";
    return "-";
  }

  // ---------------------- نتایج ----------------------
  function showResultPopup(tournament) {
    if (tournament.id) window.location.href = `results.html?id=${tournament.id}`;
  }

  // ---------------------- بروزرسانی تایمر ----------------------
  setInterval(() => {
    tournamentCache.forEach(t => {
      const span = document.getElementById(`countdown-${t.id}`);
      if (span) span.textContent = timeRemaining(t.countdown_start_time, t.start_date, t.end_date);
    });
  }, 1000);

  // ---------------------- شروع ----------------------
  document.addEventListener("DOMContentLoaded", () => {
    setupFinishedSectionToggle();
    setupScrollShortcuts();
    loadGameTournaments();
  });
