/**************************
 * Utils: Alert/Toast UI  *
 **************************/
function ensureAlertStack() {
  let stack = document.getElementById("alert_stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "alert_stack";
    stack.className = "alert_stack";
    document.body.appendChild(stack);
  }
  return stack;
}

function renderAlert({ classes = [], title = "", message = "", actions = [], duration = 7000, type = "error" }) {
  const stack = ensureAlertStack();
  const el = document.createElement("div");
  const base = ["alert"];
  if (type === "error") base.push("alert-error");
  if (type === "success") base.push("alert-success");
  if (type === "info") base.push("alert-info");

  el.className = [...base, ...classes].join(" ");
  el.setAttribute("role", "alert");
  el.innerHTML = `
    <button class="alert_close" aria-label="بستن">&times;</button>
    ${title ? `<div class="alert_title">${title}</div>` : ""}
    ${message ? `<div class="alert_msg">${message}</div>` : ""}
    ${actions?.length ? `
      <div class="alert_actions">
        ${actions.map(a => a.href
          ? `<a class="alert_btn" href="${a.href}" target="${a.target || "_self"}">${a.label}</a>`
          : `<button class="alert_btn" data-action="${a.action || ""}">${a.label}</button>`
        ).join("")}
      </div>` : ""}
  `;
  stack.appendChild(el);

  const closer = el.querySelector(".alert_close");
  closer.addEventListener("click", () => el.remove());

  el.querySelectorAll("button.alert_btn[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const act = btn.getAttribute("data-action");
      document.dispatchEvent(new CustomEvent("alertAction", { detail: act }));
      el.remove();
    });
  });

  if (duration > 0) {
    setTimeout(() => el.remove(), duration);
  }
}

function showError(msg) {
  renderAlert({ title: "خطا", message: msg, type: "error" });
}
function showSuccess(msg) {
  renderAlert({ title: "موفقیت‌آمیز", message: msg, type: "success", duration: 5000 });
}
function showInfo(msg) {
  renderAlert({ title: "اطلاع", message: msg, type: "info", duration: 6000 });
}

/***********************
 * Auth
 ***********************/
function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/***********************
 * API Helpers
 ***********************/
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...(options.headers || {})
      },
      ...options
    });
    if (!res.ok) {
      let errMsg = "مشکلی رخ داده است.";
      try {
        const data = await res.json();
        errMsg = data.detail || JSON.stringify(data);
      } catch {
        errMsg = await res.text();
      }
      throw new Error(errMsg);
    }
    return await res.json();
  } catch (error) {
    console.error("API Fetch Error:", error);
    throw error;
  }
}

/***********************
 * Load Tournament
 ***********************/
async function loadTournament() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const tournamentId = urlParams.get("id");
    if (!tournamentId) {
      showError("شناسه تورنومنت در URL یافت نشد.");
      return;
    }

    const tournament = await apiFetch(`https://atom-game.ir/api/tournaments/tournaments/${tournamentId}/`);
    window.currentTournamentData = tournament;
    renderTournament(tournament);

  } catch (err) {
    console.error(err);
    showError(err.message || "امکان دریافت اطلاعات تورنومنت وجود ندارد.");
  }
}

/****************************
 * Render Tournament Details
 ****************************/
function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const options = { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }; // Removed 'year'
  return date.toLocaleDateString('fa-IR', options);
}

function renderTournament(tournament) {
  const signupTime = document.getElementById("signup_time");
  const startTime = document.getElementById("start_time");
  const endTime = document.getElementById("end_time");
  const tournamentMode = document.getElementById("tournament_mode");
  const bannerElement = document.getElementById("tournament_banner");
  const prizePool = document.getElementById("prize_pool");
  const tournamentStatus = document.getElementById("tournament_status");

  if (!signupTime || !startTime || !endTime || !tournamentMode || !bannerElement || !prizePool || !tournamentStatus) {
    console.error("Missing tournament detail elements in the DOM.");
    return;
  }

  signupTime.textContent = formatDateTime(tournament.start_date);
  startTime.textContent = formatDateTime(tournament.start_date);
  endTime.textContent = formatDateTime(tournament.end_date);
  tournamentMode.textContent =
    tournament.type === "team" ? `تیمی (هر تیم ${tournament.team_size} نفر)` : "انفرادی";
  bannerElement.src = tournament.image?.image || "/img/tournaments-defalt-banner.jpg";
  bannerElement.alt = tournament.image?.alt || "بنر پیش‌فرض تورنومنت";
  prizePool.textContent = `${Number(tournament.prize_pool).toLocaleString("fa-IR")} تومان`;

  let status = "";
  const now = new Date();
  const start = new Date(tournament.start_date);
  const end = new Date(tournament.end_date);
  if (now < start) {
    status = "فعال (شروع نشده)";
  } else if (now < end) {
    status = "درحال برگزاری";
  } else {
    status = "تمام شد";
  }
  status += " ";
  tournamentStatus.textContent = status;

  renderParticipants(tournament);

  const lobbyPage = document.getElementById("lobby_page");
  if (lobbyPage) lobbyPage.style.display = "grid";
}

/*****************************
 * Rendering participants/teams
 *****************************/
function renderParticipants(tournament) {
  const section = document.getElementById("participants_section");
  if (!section) {
    console.error("Missing participants section in the DOM.");
    return;
  }
  section.innerHTML = "";

  const now = new Date();
  const end = new Date(tournament.end_date);

  // اگر تورنومنت پایان یافته باشد، لیدربورد نمایش داده شود
  if (now > end) {
    const leaderboard = document.querySelector(".loby_leaderboard");
    if (leaderboard) {
      leaderboard.style.display = "block";
      leaderboard.innerHTML = `
        <h3>لیدربورد</h3>
        <ul>
          ${tournament.leaderboard?.map(player => `
            <li>
              <span>${player.rank}. ${player.username}</span>
              <span>${player.score} امتیاز</span>
            </li>
          `).join("") || "<li>اطلاعاتی برای نمایش وجود ندارد.</li>"}
        </ul>
      `;
    }
    return;
  }

  // نمایش جایگاه‌های ثبت‌نام برای تورنومنت‌های فعال
  if (tournament.type === "individual") {
    const container = document.createElement("div");
    container.className = "players_grid";

    for (let i = 0; i < tournament.max_participants; i++) {
      const slot = document.createElement("div");
      const player = tournament.participants?.[i];

      if (player) {
        slot.innerHTML = `
          <div class="team_detail">
            <div class="team_name">${player.username}</div>
            <div class="team_players">
              <div class="player">
                <img src="${player.avatar || 'img/profile.jpg'}" alt="player">
              </div>
            </div>
          </div>`;
      } else {
        slot.innerHTML = `
          <button class="team_detail team_empty" onclick="joinTournament({})">
            همین الان اضافه شو!
            <i><img src="img/icons/plus.svg" alt="plus"></i>
          </button>`;
      }
      container.appendChild(slot);
    }

    section.appendChild(container);

  } else if (tournament.type === "team") {
    const container = document.createElement("div");
    container.className = "teams_grid";

    for (let i = 0; i < tournament.max_participants; i++) {
      const slot = document.createElement("div");
      const team = tournament.teams?.[i];

      if (team) {
        let membersHtml = "";
        (team.members || []).forEach(m => {
          membersHtml += `
            <div class="player">
              <img src="${m.avatar || 'img/profile.jpg'}" alt="member">
            </div>`;
        });

        slot.innerHTML = `
          <div class="team_detail">
            <div class="team_name">${team.name}</div>
            <div class="team_players">${membersHtml}</div>
          </div>`;
      } else {
        slot.innerHTML = `
          <button class="team_detail team_empty" onclick="joinTournament({})">
            همین الان تیمت رو اضافه کن
            <i><img src="img/icons/plus.svg" alt="plus"></i>
          </button>`;
      }
      container.appendChild(slot);
    }

    section.appendChild(container);
  }
}

/*************************
 * Join Tournament (POST)
 *************************/
async function joinTournament(extraData = {}) {
  try {
    const tournament = window.currentTournamentData;
    if (!tournament) return;

    await apiFetch(`https://atom-game.ir/api/tournaments/tournaments/${tournament.id}/join/`, {
      method: "POST",
      body: JSON.stringify(extraData)
    });

    showSuccess("ثبت‌نام با موفقیت انجام شد ✅");
    loadTournament();

  } catch (err) {
    console.error(err);
    showError(err.message || "ثبت‌نام انجام نشد.");
  }
}

/************
 * Bootstrap
 ************/
document.addEventListener("DOMContentLoaded", () => {
  loadTournament();
});
