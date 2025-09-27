// ---------------------- 1. گرفتن gameId از URL ----------------------
const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get("id");

let allTournaments = [];

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

// ---------------------- عناصر UI خطا و لودینگ ----------------------
const errorContainer = document.createElement("div");
errorContainer.id = "error-message";
errorContainer.style.cssText = "display:none; color:red; text-align:center; margin:20px;";
document.body.appendChild(errorContainer);

const loadingContainer = document.createElement("div");
loadingContainer.id = "loading-message";
loadingContainer.style.cssText = "text-align:center; margin:20px;";
loadingContainer.innerHTML = "<p>در حال بارگذاری...</p>";
document.body.appendChild(loadingContainer);

function showError(msg) {
  errorContainer.textContent = msg;
  errorContainer.style.display = "block";
  loadingContainer.style.display = "none";
}

function showLoading() {
  loadingContainer.style.display = "block";
  errorContainer.style.display = "none";
}

function hideLoading() {
  loadingContainer.style.display = "none";
  errorContainer.style.display = "none";
}

// ---------------------- 2. گرفتن اطلاعات بازی و تورنومنت‌ها ----------------------
async function loadGameTournaments() {
  if (!gameId) {
    showError("شناسه بازی موجود نیست. لطفا از طریق لینک معتبر وارد شوید.");
    return;
  }

  showLoading();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const [gameRes, tournamentsRes] = await Promise.all([
      fetch(`https://atom-game.ir/api/tournaments/games/${gameId}/`, {
        headers: getAuthHeaders(),
        signal: controller.signal
      }),
      fetch(`https://atom-game.ir/api/tournaments/tournaments/?game=${gameId}`, {
        headers: getAuthHeaders(),
        signal: controller.signal
      })
    ]);

    clearTimeout(timeoutId);

    if (!gameRes.ok) throw new Error("خطا در دریافت اطلاعات بازی");
    if (!tournamentsRes.ok) throw new Error("خطا در دریافت اطلاعات تورنومنت‌ها");

    const gameData = await gameRes.json();
    let tournamentsData = await tournamentsRes.json();
    tournamentsData = Array.isArray(tournamentsData)
      ? tournamentsData
      : tournamentsData.results || tournamentsData.data || [];

    allTournaments = tournamentsData;

    renderGameInfo(gameData);
    renderTournamentsByCategory(categorizeTournaments(tournamentsData));

    hideLoading();
  } catch (err) {
    clearTimeout(timeoutId);
    hideLoading();
    showError(err.name === "AbortError"
      ? "زمان درخواست به پایان رسید. لطفا دوباره تلاش کنید."
      : err.message || "خطا در بارگذاری داده‌ها.");
    console.error("loadGameTournaments error:", err);
  }
}

// ---------------------- 3. نمایش بنر و توضیحات بازی ----------------------
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

// ---------------------- 4. دسته‌بندی تورنومنت‌ها ----------------------
function categorizeTournaments(tournaments) {
  const now = new Date();
  const live = [], upcoming = [], running = [], finished = [];

  tournaments.forEach(t => {
    const start = new Date(t.start_date);
    const end = new Date(t.end_date);
    const countdownStart = t.countdown_start_time ? new Date(t.countdown_start_time) : start;

    if (!isValidDate(start) || !isValidDate(end)) {
      finished.push(t);
      return;
    }

    if (end <= now) finished.push(t);
    else if (start <= now && end > now) live.push(t);
    else if (countdownStart <= now && start > now) running.push(t);
    else upcoming.push(t);
  });

  return { live, upcoming, running, finished };
}

// ---------------------- 5. نمایش کارت تورنومنت ----------------------
function renderTournamentCard(tournament, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const start = new Date(tournament.start_date);
  const end = new Date(tournament.end_date);
  const now = new Date();

  const registered = tournament.type === "team"
    ? safeArrayLength(tournament.teams)
    : safeArrayLength(tournament.participants);

  const maxParticipants = safeNumber(tournament.max_participants, 1);
  const teamSize = safeNumber(tournament.team_size, 1);
  const capacity = tournament.type === "team"
    ? (teamSize > 0 ? maxParticipants / teamSize : 0)
    : maxParticipants;

  let percent = 0;
  if (capacity > 0 && Number.isFinite(registered)) {
    percent = (registered / capacity) * 100;
    percent = Math.min(Math.max(percent, 0), 100);
  }

  const entryFee = safeNumber(tournament.entry_fee);
  const price = tournament.is_free
    ? "رایگان"
    : (entryFee > 0 ? entryFee.toLocaleString("fa-IR") + " تومان" : "نامشخص");

  const dateStr = isValidDate(start)
    ? start.toLocaleDateString("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "تاریخ نامشخص";

  const timeStr = isValidDate(start)
    ? start.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })
    : "زمان نامشخص";

  const banner = tournament.image?.image || (tournament.game?.images?.[0]?.image || "img/banner9.jpg");

  const div = document.createElement("div");
  div.id = `tournament-${tournament.id}`;

  // ---------------------- کارت لایو ----------------------
  if (start <= now && end > now && containerId === "live_tournaments") {
    div.className = "live_tournament_cart";
    const prizePool = safeNumber(tournament.prize_pool);
    const prizeText = prizePool > 0 ? prizePool.toLocaleString("fa-IR") + " تومان" : "نامشخص";

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
        <div class="team-text" id="teamText${tournament.id}">${registered} / ${capacity}</div>
        <div class="line-bar-container">
          <div class="progress-line">
            <div class="progress-fill" id="progressFill${tournament.id}" style="width:${percent}%"></div>
          </div>
        </div>
      </div>
    `;

    div.querySelector(".live_join_link").addEventListener("click", () => {
      if (tournament.id) {
        window.location.href = `game-loby.html?id=${tournament.id}`;
      }
    });

  } else {
    // ---------------------- کارت معمولی ----------------------
    div.className = "cart_container";
    div.innerHTML = `
      <div class="cart_top">
        <div class="cart_image">
          <img src="${banner}" alt="banner" loading="lazy" onerror="this.src='img/banner9.jpg'">
          <div class="cart_countdown_game">
            <div class="cart_countdown">
              <span id="countdown-${tournament.id}">${timeRemaining(tournament.countdown_start_time, tournament.start_date, tournament.end_date)}</span>
            </div>
            <div class="cart_game_name">
              <span>${escapeHTML(tournament.game?.name || "-")}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="cart_middle">
        <div class="cart_date_time">
          <span>${timeStr}</span>
          <span>${dateStr}</span>
        </div>
        <div class="cart_title"><span>${escapeHTML(tournament.name)}</span></div>
        <div class="cart_description"><span>${escapeHTML(tournament.description || "")}</span></div>
      </div>
      <div class="cart_bottom">
        <button class="cart_join"></button>
        <div class="cart_price"><span>${price}</span></div>
      </div>
    `;

    const joinBtn = div.querySelector(".cart_join");
    if (now >= end) {
      joinBtn.textContent = "دیدن نتایج";
      joinBtn.addEventListener("click", () => showResultPopup(tournament));
    } else {
      joinBtn.textContent = "اضافه شو!";
      joinBtn.addEventListener("click", () => {
        if (tournament.id) {
          window.location.href = `game-loby.html?id=${tournament.id}`;
        }
      });
    }
  }

  container.appendChild(div);
}

// ---------------------- 6. تایمر شمارش معکوس ----------------------
function timeRemaining(startCountdown, startDate, endDate) {
  const now = new Date();
  const countdownTime = new Date(startCountdown || startDate);
  const startTime = new Date(startDate);
  const endTime = new Date(endDate);

  if (!isValidDate(countdownTime) || !isValidDate(startTime) || !isValidDate(endTime)) {
    return "-";
  }

  if (now < countdownTime) {
    return countdownTime.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  }
  if (now >= countdownTime && now < startTime) {
    const diff = startTime - now;
    if (diff < 0) return "شروع شده";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2,"0")} : ${mins.toString().padStart(2,"0")} : ${secs.toString().padStart(2,"0")}`;
  }
  if (now >= startTime && now < endTime) return "شروع شده";
  if (now >= endTime) return "پایان یافته";
  return "-";
}

// ---------------------- 7. رندر بر اساس دسته ----------------------
function renderTournamentsByCategory(categories) {
  const { live, upcoming, running, finished } = categories;
  const containers = {
    live: document.getElementById("live_tournaments"),
    upcoming: document.getElementById("upcoming_tournaments"),
    running: document.getElementById("running_tournaments"),
    finished: document.getElementById("finished_tournaments")
  };
  const titrs = {
    live: document.getElementById("live"),
    upcoming: document.getElementById("upcoming"),
    running: document.getElementById("running"),
    finished: document.getElementById("finished")
  };

  Object.values(containers).forEach(c => { if (c) c.innerHTML = ""; });

  if (live?.length) live.forEach(t => renderTournamentCard(t, "live_tournaments"));
  if (upcoming?.length) upcoming.forEach(t => renderTournamentCard(t, "upcoming_tournaments"));
  if (running?.length) running.forEach(t => renderTournamentCard(t, "running_tournaments"));
  if (finished?.length) finished.forEach(t => renderTournamentCard(t, "finished_tournaments"));

  Object.keys(containers).forEach(key => {
    const container = containers[key];
    const titr = titrs[key];
    if (!container || container.children.length === 0) {
      if (container) container.style.display = "none";
      if (titr) titr.style.display = "none";
    } else {
      if (container) container.style.display = key === "live" ? "block" : "grid";
      if (titr) titr.style.display = "flex";
    }
  });
}

// ---------------------- 8. نمایش نتایج ----------------------
function showResultPopup(tournament) {
  if (tournament.id) {
    window.location.href = `results.html?id=${tournament.id}`;
  }
}

// ---------------------- 9. بروزرسانی تایمر ----------------------
setInterval(() => {
  allTournaments.forEach(t => {
    const span = document.getElementById(`countdown-${t.id}`);
    if (span) {
      span.textContent = timeRemaining(t.countdown_start_time, t.start_date, t.end_date);
    }
  });
}, 1000);

// ---------------------- 10. شروع ----------------------
document.addEventListener("DOMContentLoaded", loadGameTournaments);
