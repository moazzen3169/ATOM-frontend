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
  return res.json();
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
  const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return date.toLocaleDateString('fa-IR', options);
}

function renderTournament(tournament) {
  document.getElementById("signup_time").textContent = formatDateTime(tournament.start_date);
  document.getElementById("start_time").textContent = formatDateTime(tournament.start_date);
  document.getElementById("end_time").textContent = formatDateTime(tournament.end_date);
  document.getElementById("tournament_mode").textContent =
    tournament.type === "team" ? `تیمی (هر تیم ${tournament.team_size} نفر)` : "انفرادی";
  document.getElementById("tournament_banner").src = tournament.image?.image || "img/default.jpg";
  document.getElementById("prize_pool").textContent = `${Number(tournament.prize_pool).toLocaleString("fa-IR")} تومان`;
  document.getElementById("tournament_title").textContent = tournament.name;

  // Determine status
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
  // Assume real for now, as no is_fake field
  status += " ";
  document.getElementById("tournament_status").textContent = status;

  renderParticipants(tournament);

  const lobbyPage = document.getElementById("lobby_page");
  if (lobbyPage) lobbyPage.style.display = "grid";
}

/*****************************
 * Rendering participants/teams
 *****************************/
function renderParticipants(tournament) {
  const section = document.getElementById("participants_section");
  section.innerHTML = "";

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
