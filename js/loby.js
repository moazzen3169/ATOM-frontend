import { API_BASE_URL } from "/js/config.js";

/**************************
 * Global Variables
 **************************/
window.currentTournamentData = null;
let userProfileCache = null;
let verificationCache = null;
const teamCache = new Map();
const walletCache = new Map();

/**************************
 * Utility helpers
 **************************/
function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normaliseArray(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.results)) return value.results;
  if (value && Array.isArray(value.data)) return value.data;
  return [];
}

function getParticipantId(item) {
  return (
    item?.id ||
    item?.user_id ||
    item?.user?.id ||
    item?.player_id ||
    null
  );
}

function getParticipantUsername(item) {
  return item?.username || item?.user?.username || item?.name || null;
}

function getTeamMembers(team) {
  if (!team) return [];
  if (Array.isArray(team.members)) return team.members;
  if (Array.isArray(team.players)) return team.players;
  if (Array.isArray(team.users)) return team.users;
  return [];
}

function getTeamMemberCount(team) {
  if (!team) return 0;
  const members = getTeamMembers(team);
  if (Array.isArray(members) && members.length) return members.length;
  if (team.members_count !== undefined) return toNumber(team.members_count);
  if (team.member_count !== undefined) return toNumber(team.member_count);
  return 0;
}

function getTournamentRegistrationCount(tournament) {
  if (!tournament) return 0;
  if (tournament.type === "team") {
    const teamCount = toNumber(tournament.current_participants, 0);
    if (teamCount > 0) return teamCount;
    const teams = normaliseArray(tournament.teams);
    if (teams.length) return teams.length;
  }

  const participantCount = toNumber(tournament.current_participants, 0);
  if (participantCount > 0) return participantCount;
  const participants = normaliseArray(tournament.participants);
  return participants.length;
}

/**************************
 * Auth & Token Management
 **************************/
function getAuthToken() {
  const token = 
    localStorage.getItem("authToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("authToken") ||
    sessionStorage.getItem("token");
  
  return token;
}

function getAuthHeaders() {
  const token = getAuthToken();
  if (!token) {
    return { "Content-Type": "application/json" };
  }
  
  return { 
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

function isAuthenticated() {
  return !!getAuthToken();
}

function getCurrentUserId() {
  return localStorage.getItem("userId") || 
         localStorage.getItem("user_id");
}

/**************************
 * Utils: Alert/Toast UI
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

/**************************
 * API Helpers
 **************************/
async function apiFetch(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers
    });

    if (res.status === 401) {
      console.error("Authentication failed - 401 Unauthorized");
      showError("احراز هویت ناموفق. لطفاً دوباره وارد شوید.");
      localStorage.removeItem("authToken");
      localStorage.removeItem("token");
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("token");
      throw new Error("احراز هویت ناموفق");
    }

    if (!res.ok) {
      let errMsg = "مشکلی رخ داده است.";
      try {
        const data = await res.json();
        errMsg = data.detail || data.message || data.error || JSON.stringify(data);
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

/**************************
 * User Profile & Verification - ENHANCED
 **************************/
async function getUserProfile() {
  if (userProfileCache) return userProfileCache;

  try {
    // تلاش برای دریافت پروفایل از اندپوینت‌های مختلف
    let profile = null;

    // اندپوینت ۱: اندپوینت اصلی پروفایل
    try {
      profile = await apiFetch(`${API_BASE_URL}/api/auth/users/me/`);
    } catch (error) {
      console.log("Primary profile endpoint failed, trying alternatives...");
    }

    // اندپوینت ۲: اندپوینت جایگزین
    if (!profile) {
      try {
        profile = await apiFetch(`${API_BASE_URL}/api/auth/me/`);
      } catch (error) {
        console.log("Alternative profile endpoint failed...");
      }
    }

    // اندپوینت ۳: اندپوینت کاربر
    if (!profile) {
      try {
        profile = await apiFetch(`${API_BASE_URL}/api/auth/user/`);
      } catch (error) {
        console.log("User endpoint failed...");
      }
    }

    // اگر هیچکدام کار نکرد، از اطلاعات پایه استفاده کن
    if (!profile) {
      console.warn("All profile endpoints failed, using basic info");
      profile = {
        id: getCurrentUserId(),
        username: "کاربر",
        verification_level: 0
      };
    }

    userProfileCache = profile;
    if (profile && profile.id) {
      localStorage.setItem('userId', profile.id);
      // Set verification level from dedicated function
      profile.verification_level = await getUserVerificationLevel();
    }
    return profile;
    
  } catch (error) {
    console.error("Error fetching user profile:", error);
    // بازگشت به اطلاعات پایه در صورت خطا
    return {
      id: getCurrentUserId(),
      username: "کاربر",
      verification_level: 0
    };
  }
}

async function getUserVerificationLevel() {
  if (verificationCache !== null) return verificationCache;

  if (!isAuthenticated()) return 0;

  try {
    const status = await apiFetch(`${API_BASE_URL}/api/verification/status/`);
    verificationCache = status.level || 1;
    return verificationCache;
  } catch (error) {
    console.log("Verification status fetch failed, defaulting to 1");
    verificationCache = 1;
    return 1;
  }
}

async function checkUserVerification(tournament) {
  try {
    const profile = await getUserProfile();

    // اگر پروفایل اصلی دریافت نشد، خطا برگردان
    if (!profile || !profile.id) {
      return {
        verified: false,
        message: "امکان دریافت اطلاعات کاربر وجود ندارد. لطفاً دوباره وارد شوید."
      };
    }

    // بررسی سطح تأیید هویت
    const userVerificationLevel = profile.verification_level || 0;
    const requiredVerificationLevel = tournament.required_verification_level || 0;

    console.log("Verification Check:", {
      userLevel: userVerificationLevel,
      requiredLevel: requiredVerificationLevel,
      tournament: tournament.name
    });

    if (userVerificationLevel < requiredVerificationLevel) {
      return {
        verified: false,
        message: `سطح تأیید هویت شما (${userVerificationLevel}) برای این تورنومنت کافی نیست. سطح مورد نیاز: ${requiredVerificationLevel}`,
        userLevel: userVerificationLevel,
        requiredLevel: requiredVerificationLevel
      };
    }

    return {
      verified: true,
      userLevel: userVerificationLevel,
      requiredLevel: requiredVerificationLevel
    };
  } catch (error) {
    console.error("Error checking verification:", error);
    return {
      verified: false,
      message: "خطا در بررسی تأیید هویت کاربر"
    };
  }
}

/**************************
 * Load Tournament
 **************************/
async function loadTournament() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const tournamentId = urlParams.get("id");
    if (!tournamentId) {
      showError("شناسه تورنومنت در URL یافت نشد.");
      return;
    }

    const tournament = await apiFetch(`${API_BASE_URL}/api/tournaments/tournaments/${tournamentId}/`);
    if (!tournament) {
      showError("تورنومنت یافت نشد.");
      return;
    }

    console.log("Tournament Data:", tournament);
    window.currentTournamentData = tournament;
    renderTournament(tournament);

    // نمایش اطلاعات تأیید هویت تورنومنت
    if (tournament.required_verification_level > 0) {
      console.log(`این تورنومنت نیازمند سطح تأیید هویت ${tournament.required_verification_level} است`);
    }

  } catch (err) {
    console.error(err);
    showError(err.message || "امکان دریافت اطلاعات تورنومنت وجود ندارد.");
  }
}

/****************************
 * Render Tournament Details - ENHANCED
 ****************************/
function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const options = { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
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
  tournamentStatus.textContent = status;

  const titleElement = document.getElementById("tournaments-title");
  if (titleElement) {
    titleElement.textContent = tournament.name || "بدون عنوان";
  }

  const tournamentTitleElement = document.getElementById("tournament_title");
  if (tournamentTitleElement) {
    tournamentTitleElement.textContent = tournament.name || "بدون عنوان";
  }

  // نمایش سطح تأیید هویت مورد نیاز
  if (tournament.required_verification_level > 0) {
    const verificationInfo = document.createElement("div");
    verificationInfo.className = "verification-info";
    verificationInfo.innerHTML = `
      <div class="info-badge">
        <i>🔒</i>
        <span>سطح تأیید هویت مورد نیاز: ${tournament.required_verification_level}</span>
      </div>
    `;
    tournamentTitleElement.parentNode.insertBefore(verificationInfo, tournamentTitleElement.nextSibling);
  }

  // Render tournament creator information
  if (tournament.creator) {
    const { username, first_name, last_name, profile_picture } = tournament.creator;

    const adminUsername = document.getElementById("adminUsername");
    const adminFullName = document.getElementById("adminFullName");
    const adminProfilePicture = document.getElementById("adminProfilePicture");

    if (adminUsername) adminUsername.innerText = `نام کاربری: ${username}`;
    if (adminFullName) adminFullName.innerText = `نام: ${first_name || "نامشخص"} ${last_name || ""}`;
    if (adminProfilePicture) adminProfilePicture.src = profile_picture || "img/profile.jpg";
  }

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
  const start = new Date(tournament.start_date);
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

  // اگر تورنومنت درحال برگزاری باشد، جایگاه‌های ثبت‌نام نمایش داده نشود
  if (now >= start && now <= end) {
    section.innerHTML = ``;
    return;
  }

  // نمایش جایگاه‌های ثبت‌نام برای تورنومنت‌های فعال (شروع نشده)
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
          <button class="team_detail team_empty" onclick="openIndividualJoinModal()">
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
          <button class="team_detail team_empty" onclick="openTeamJoinModal()">
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
 * Modal Functions - ENHANCED
 *************************/
async function openIndividualJoinModal() {
  if (!(await ensureIndividualEligibility())) return;

  const modal = document.getElementById("individualJoinModal");
  if (modal) {
    modal.style.display = "flex";
  } else {
    joinIndividualTournament();
  }
}

async function openTeamJoinModal() {
  const tournament = window.currentTournamentData;
  const baseCheck = await ensureBaseEligibility(tournament);
  if (!baseCheck.ok) return;

  const modal = document.getElementById("teamJoinModal");
  if (modal) {
    loadUserTeams(baseCheck.profile);
    modal.style.display = "flex";
  } else {
    showError("مودال انتخاب تیم یافت نشد.");
  }
}

function closeIndividualJoinModal() {
  const modal = document.getElementById("individualJoinModal");
  if (modal) modal.style.display = "none";
}

function closeTeamJoinModal() {
  const modal = document.getElementById("teamJoinModal");
  if (modal) modal.style.display = "none";

  const confirmButton = document.getElementById("teamJoinConfirmButton");
  if (confirmButton) {
    const originalText = confirmButton.dataset.originalText || "تایید و ثبت‌نام تیم";
    confirmButton.textContent = originalText;
    confirmButton.disabled = true;
    delete confirmButton.dataset.originalText;
  }
}

/*************************
 * Load User Teams
 *************************/
async function loadUserTeams(profileFromEligibility = null) {
  const tournament = window.currentTournamentData;
  const teamSize = toNumber(tournament?.team_size);

  const listEl = document.getElementById("teamModalList");
  const selectEl = document.getElementById("teamSelect");
  const loadingEl = document.getElementById("teamModalLoading");
  const emptyEl = document.getElementById("teamModalEmptyState");
  const searchInput = document.getElementById("teamModalSearch");
  const hintEl = document.getElementById("teamModalHint");
  const metaEl = document.getElementById("teamModalMeta");
  const confirmButton = document.getElementById("teamJoinConfirmButton");

  if (metaEl) {
    if (teamSize > 0) {
      metaEl.textContent = `ظرفیت مورد نیاز هر تیم در این تورنومنت ${teamSize.toLocaleString("fa-IR")} نفر است.`;
    } else {
      metaEl.textContent = "یکی از تیم‌هایی که کاپیتان آن هستید را برای ثبت‌نام انتخاب کنید.";
    }
  }

  const emptyTitle = emptyEl?.querySelector("p");
  const emptySubtitle = emptyEl?.querySelector("span");

  if (confirmButton) {
    confirmButton.disabled = true;
  }

  if (listEl) listEl.innerHTML = "";
  if (selectEl) selectEl.innerHTML = '<option value="">انتخاب تیم</option>';
  if (emptyEl) emptyEl.classList.add("is-hidden");
  if (loadingEl) loadingEl.classList.remove("is-hidden");
  if (searchInput) searchInput.value = "";

  let profile = profileFromEligibility;

  try {
    const teamsResponse = await apiFetch(`${API_BASE_URL}/api/tournaments/teams/`);
    const teams = normaliseArray(teamsResponse);

    if (!profile) {
      profile = await getUserProfile();
    }

    const currentUserId = profile?.id || getCurrentUserId();

    const eligibleTeams = teams.filter(team => {
      if (!team?.id) return false;

      teamCache.set(String(team.id), team);

      const memberCount = getTeamMemberCount(team);
      if (teamSize > 0 && memberCount > teamSize) {
        return false;
      }

      if (!currentUserId) return true;
      return isUserTeamCaptain(team, currentUserId);
    });

    const oversizedCount = teams.reduce((acc, team) => {
      const memberCount = getTeamMemberCount(team);
      return acc + (teamSize > 0 && memberCount > teamSize ? 1 : 0);
    }, 0);

    const baseHintParts = [];
    if (teamSize > 0) baseHintParts.push(`حداکثر ${teamSize.toLocaleString("fa-IR")} عضو`);
    baseHintParts.push("فقط تیم‌هایی که کاپیتان آن‌ها هستید نمایش داده می‌شوند");
    if (oversizedCount > 0) baseHintParts.push(`${oversizedCount.toLocaleString("fa-IR")} تیم به دلیل ظرفیت بالا نمایش داده نشد`);

    const decorateTeams = eligibleTeams.map(team => ({
      team,
      memberCount: getTeamMemberCount(team),
      members: getTeamMembers(team)
    }));

    let selectedTeamId = "";

    const updateHint = (visibleCount) => {
      if (!hintEl) return;
      const visibleMessage = visibleCount > 0
        ? `تعداد تیم‌های قابل انتخاب: ${visibleCount.toLocaleString("fa-IR")}`
        : "تیمی برای نمایش وجود ندارد";
      const suffix = baseHintParts.length ? ` • ${baseHintParts.join(" • ")}` : "";
      hintEl.textContent = `${visibleMessage}${suffix}`;
    };

    const updateSelection = (teamId, { silent = false } = {}) => {
      selectedTeamId = teamId ? String(teamId) : "";

      if (selectEl) {
        selectEl.value = selectedTeamId;
      }

      if (listEl) {
        listEl.querySelectorAll(".team-option").forEach(card => {
          const isSelected = card.dataset.teamId === selectedTeamId;
          card.classList.toggle("selected", isSelected);
          card.setAttribute("aria-pressed", isSelected ? "true" : "false");
        });
      }

      if (confirmButton && !silent) {
        confirmButton.disabled = !selectedTeamId;
      }
    };

    const renderTeams = (searchTerm = "") => {
      const term = searchTerm.trim().toLowerCase();
      const visibleTeams = decorateTeams.filter(({ team }) => {
        if (!term) return true;
        const name = (team.name || "").toLowerCase();
        return name.includes(term);
      });

      if (listEl) listEl.innerHTML = "";
      if (selectEl) selectEl.innerHTML = '<option value="">انتخاب تیم</option>';

      if (!visibleTeams.length) {
        if (emptyEl) {
          emptyEl.classList.remove("is-hidden");
          if (emptyTitle && emptySubtitle) {
            if (term) {
              emptyTitle.textContent = "تیمی با این مشخصات پیدا نشد.";
              emptySubtitle.textContent = "عبارت دیگری را امتحان کنید یا شرایط تیم خود را بررسی کنید.";
            } else {
              emptyTitle.textContent = "هیچ تیم واجد شرایطی برای این تورنومنت پیدا نشد.";
              emptySubtitle.textContent = "تیم انتخابی باید با ظرفیت تورنومنت هم‌خوانی داشته باشد و شما کاپیتان آن باشید.";
            }
          }
        }
      } else if (emptyEl) {
        emptyEl.classList.add("is-hidden");
      }

      visibleTeams.forEach(({ team, memberCount, members }) => {
        const option = document.createElement("option");
        option.value = team.id;
        option.textContent = `${team.name} (${memberCount.toLocaleString("fa-IR")} عضو)`;
        selectEl?.appendChild(option);

        const card = document.createElement("button");
        card.type = "button";
        card.className = "team-option";
        card.dataset.teamId = String(team.id);
        card.setAttribute("aria-pressed", "false");
        card.setAttribute("aria-label", `انتخاب تیم ${team.name}`);

        let statusClass = "team-option__status";
        let statusText = `${memberCount.toLocaleString("fa-IR")} عضو`;

        if (teamSize > 0) {
          if (memberCount === teamSize) {
            statusClass += " team-option__status--ok";
            statusText = "آماده ثبت‌نام";
          } else if (memberCount < teamSize) {
            statusClass += " team-option__status--warning";
            const diff = teamSize - memberCount;
            statusText = `${diff.toLocaleString("fa-IR")} عضو تا تکمیل`;
          } else {
            statusClass += " team-option__status--danger";
            statusText = "اعضای بیش از حد";
          }
        }

        const displayMembers = members.slice(0, 6);
        let avatarsHtml = "";

        displayMembers.forEach(member => {
          const avatar = member?.avatar || member?.profile_image || member?.image || "img/profile.jpg";
          const name = member?.username || member?.name || "بازیکن";
          avatarsHtml += `
            <div class="team-option__avatar" title="${name}">
              <img src="${avatar}" alt="${name}">
            </div>`;
        });

        if (!avatarsHtml) {
          avatarsHtml = `
            <div class="team-option__avatar team-option__avatar--placeholder">
              <i class="fas fa-user"></i>
            </div>`;
        }

        const remaining = memberCount - displayMembers.length;
        if (remaining > 0) {
          avatarsHtml += `
            <div class="team-option__avatar team-option__avatar--more">+${remaining.toLocaleString("fa-IR")}</div>`;
        }

        const gameName = team?.game?.name || team?.game_name;
        const roleBadge = (team?.is_captain === true || team?.user_role === "captain")
          ? '<span class="team-option__role"><i class="fas fa-crown"></i> کاپیتان</span>'
          : "";

        const metaItems = [];
        if (teamSize > 0) {
          metaItems.push(`<span><i class="fas fa-users"></i>${memberCount.toLocaleString("fa-IR")} / ${teamSize.toLocaleString("fa-IR")} عضو</span>`);
        } else {
          metaItems.push(`<span><i class="fas fa-users"></i>${memberCount.toLocaleString("fa-IR")} عضو</span>`);
        }
        if (gameName) metaItems.push(`<span><i class="fas fa-gamepad"></i>${gameName}</span>`);
        if (team?.ranking || team?.rank) metaItems.push(`<span><i class="fas fa-trophy"></i>${team.ranking || team.rank}</span>`);
        if (roleBadge) metaItems.push(roleBadge);

        card.innerHTML = `
          <div class="team-option__header">
            <div class="team-option__name">${team.name || "بدون نام"}</div>
            <span class="${statusClass}">${statusText}</span>
          </div>
          <div class="team-option__body">
            <div class="team-option__avatars">${avatarsHtml}</div>
            <div class="team-option__meta">${metaItems.join("")}</div>
          </div>`;

        card.addEventListener("click", () => {
          updateSelection(team.id);
          confirmButton?.focus();
        });

        listEl?.appendChild(card);
      });

      if (!selectedTeamId && visibleTeams.length) {
        updateSelection(visibleTeams[0].team.id, { silent: true });
        if (confirmButton) confirmButton.disabled = false;
      } else {
        const stillExists = visibleTeams.some(({ team }) => String(team.id) === selectedTeamId);
        if (!stillExists) {
          updateSelection("", { silent: true });
          if (confirmButton) confirmButton.disabled = true;
        } else {
          updateSelection(selectedTeamId, { silent: true });
          if (confirmButton) confirmButton.disabled = !selectedTeamId;
        }
      }

      updateHint(visibleTeams.length);
    };

    renderTeams();

    if (searchInput) {
      searchInput.oninput = (event) => {
        renderTeams(event.target.value || "");
      };
    }
  } catch (error) {
    console.error("Failed to load teams:", error);
    showError("خطا در بارگذاری تیم‌ها. لطفاً دوباره تلاش کنید.");
    if (emptyEl && emptyTitle && emptySubtitle) {
      emptyEl.classList.remove("is-hidden");
      emptyTitle.textContent = "بروز خطا در دریافت تیم‌ها.";
      emptySubtitle.textContent = "لطفاً اتصال اینترنت خود را بررسی کرده و دوباره تلاش کنید.";
    }
  } finally {
    if (loadingEl) loadingEl.classList.add("is-hidden");
  }
}

/*************************
 * Eligibility & Wallet Checks
 *************************/
function describeMember(member) {
  const id = getParticipantId(member);
  return (
    getParticipantUsername(member) ||
    member?.gamertag ||
    (id ? `کاربر ${id}` : "یک عضو تیم")
  );
}

function isTeamAlreadyRegistered(tournament, teamId) {
  if (!tournament || !teamId) return false;
  const registeredTeams = normaliseArray(tournament.teams);
  return registeredTeams.some(team => {
    const id = getParticipantId(team) || team?.team_id;
    return id && String(id) === String(teamId);
  });
}

function isUserTeamCaptain(team, userId) {
  if (!team || !userId) return false;

  if (team.is_captain === true || team.user_role === "captain") return true;
  const captainId = team.captain_id || team.owner_id || getParticipantId(team.captain) || getParticipantId(team.owner);
  if (captainId && String(captainId) === String(userId)) return true;

  return getTeamMembers(team).some(member => {
    if (!member) return false;
    const memberId = getParticipantId(member);
    const isCaptainMember =
      member.is_captain ||
      member.is_leader ||
      member.role === "captain" ||
      member.position === "captain";
    return isCaptainMember && memberId && String(memberId) === String(userId);
  });
}

function getOverlappingMembers(tournament, members) {
  if (!tournament || !Array.isArray(members) || !members.length) return [];

  const participantIds = new Set();
  const participantNames = new Map();

  normaliseArray(tournament.participants).forEach(p => {
    const id = getParticipantId(p);
    const username = getParticipantUsername(p);
    if (id) participantIds.add(String(id));
    if (id && username) participantNames.set(String(id), username);
    if (!id && username) participantNames.set(username, username);
  });

  normaliseArray(tournament.teams).forEach(team => {
    getTeamMembers(team).forEach(member => {
      const id = getParticipantId(member);
      const username = getParticipantUsername(member);
      if (id) participantIds.add(String(id));
      if (id && username) participantNames.set(String(id), username);
      if (!id && username) participantNames.set(username, username);
    });
  });

  return members.reduce((acc, member) => {
    const id = getParticipantId(member);
    const username = getParticipantUsername(member);

    if (id && participantIds.has(String(id))) {
      acc.push(describeMember(member));
    } else if (!id && username && participantNames.has(username)) {
      acc.push(username);
    }

    return acc;
  }, []);
}

async function fetchTeamDetails(teamId) {
  if (!teamId) return null;
  const key = String(teamId);
  if (teamCache.has(key)) return teamCache.get(key);

  const url = `${API_BASE_URL}/api/tournaments/teams/${teamId}/`;
  try {
    const team = await apiFetch(url);
    teamCache.set(key, team);
    return team;
  } catch (error) {
    console.error("Failed to fetch team details:", error);
    teamCache.set(key, null);
    return null;
  }
}

function resolveWalletBalance(data) {
  if (!data) return null;

  let wallet = null;
  if (Array.isArray(data)) {
    [wallet] = data;
  } else if (Array.isArray(data?.results)) {
    [wallet] = data.results;
  } else if (Array.isArray(data?.data)) {
    [wallet] = data.data;
  } else if (data.wallet) {
    wallet = data.wallet;
  } else if (data.id || data.balance !== undefined || data.total_balance !== undefined) {
    wallet = data;
  }

  if (!wallet) return null;

  const balance = toNumber(
    wallet.withdrawable_balance ??
    wallet.available_balance ??
    wallet.total_balance ??
    wallet.balance
  );

  return { balance, wallet };
}

async function getCurrentUserWallet(cacheKey = "self") {
  if (walletCache.has(cacheKey)) return walletCache.get(cacheKey);

  try {
    const data = await apiFetch(`${API_BASE_URL}/api/wallet/wallets/`);
    const walletInfo = resolveWalletBalance(data);
    walletCache.set(cacheKey, walletInfo);
    return walletInfo;
  } catch (error) {
    console.error("Failed to fetch current user wallet:", error);
    walletCache.set(cacheKey, null);
    return null;
  }
}

async function fetchWalletForUser(userId) {
  if (!userId) return null;
  const key = `user-${userId}`;
  if (walletCache.has(key)) return walletCache.get(key);

  const endpoints = [
    `${API_BASE_URL}/api/wallet/wallets/?user=${userId}`,
    `${API_BASE_URL}/api/wallet/wallets/?user_id=${userId}`,
    `${API_BASE_URL}/api/wallet/users/${userId}/wallet/`
  ];

  for (const url of endpoints) {
    try {
      const data = await apiFetch(url);
      const walletInfo = resolveWalletBalance(data);
      if (walletInfo) {
        walletCache.set(key, walletInfo);
        return walletInfo;
      }
    } catch (error) {
      console.warn(`Failed to fetch wallet from ${url}:`, error);
    }
  }

  walletCache.set(key, null);
  return null;
}

async function ensureUserHasEnoughBalance(tournament, profile) {
  if (!tournament || tournament.is_free) return true;
  const entryFee = toNumber(tournament.entry_fee);
  if (entryFee <= 0) return true;

  const walletInfo = await getCurrentUserWallet(profile?.id ? `self-${profile.id}` : "self");
  if (!walletInfo) {
    showError("امکان بررسی موجودی کیف پول وجود ندارد. لطفاً بعداً دوباره تلاش کنید.");
    return false;
  }

  if (walletInfo.balance < entryFee) {
    showError(`موجودی کیف پول شما برای پرداخت ورودی (${entryFee.toLocaleString("fa-IR")} تومان) کافی نیست.`);
    return false;
  }

  return true;
}

async function ensureTeamMembersHaveFunds(team, tournament) {
  if (!team || !tournament || tournament.is_free) return true;
  const entryFee = toNumber(tournament.entry_fee);
  if (entryFee <= 0) return true;

  const members = getTeamMembers(team);
  if (!members.length) return true;

  const insufficientMembers = [];
  const uncheckedMembers = [];

  await Promise.all(members.map(async (member) => {
    const memberId = getParticipantId(member);
    if (!memberId) {
      uncheckedMembers.push(describeMember(member));
      return;
    }

    const walletInfo = await fetchWalletForUser(memberId);
    if (!walletInfo) {
      uncheckedMembers.push(describeMember(member));
      return;
    }

    if (walletInfo.balance < entryFee) {
      insufficientMembers.push(describeMember(member));
    }
  }));

  if (insufficientMembers.length) {
    showError(`موجودی کیف پول اعضای زیر برای پرداخت ورودی کافی نیست: ${insufficientMembers.join("، ")}`);
    return false;
  }

  if (uncheckedMembers.length) {
    showInfo(`امکان بررسی موجودی کیف پول ${uncheckedMembers.join("، ")} وجود نداشت. لطفاً پیش از ثبت‌نام از کافی بودن موجودی آن‌ها اطمینان حاصل کنید.`);
  }

  return true;
}

async function ensureBaseEligibility(tournament) {
  if (!tournament) {
    showError("اطلاعات تورنومنت در دسترس نیست.");
    return { ok: false };
  }

  if (!isAuthenticated()) {
    showError("برای ثبت‌نام در تورنومنت باید وارد حساب کاربری خود شوید.");
    return { ok: false };
  }

  const now = new Date();
  const start = tournament.start_date ? new Date(tournament.start_date) : null;
  const end = tournament.end_date ? new Date(tournament.end_date) : null;

  if (end && now > end) {
    showError("تورنومنت به پایان رسیده است.");
    return { ok: false };
  }

  if (start && end && now >= start && now <= end) {
    showError("تورنومنت در حال برگزاری است و امکان ثبت‌نام وجود ندارد.");
    return { ok: false };
  }

  const maxParticipants = toNumber(tournament.max_participants);
  if (maxParticipants > 0) {
    const current = getTournamentRegistrationCount(tournament);
    if (current >= maxParticipants) {
      showError("تورنومنت به حداکثر ظرفیت خود رسیده است.");
      return { ok: false };
    }
  }

  const verificationCheck = await checkUserVerification(tournament);
  if (!verificationCheck.verified) {
    showError(verificationCheck.message);
    renderAlert({
      title: "سطح تأیید هویت ناکافی",
      message: verificationCheck.message,
      type: "info",
      actions: [
        {
          label: "راهنمای ارتقای سطح",
          href: "/verification-guide.html",
          target: "_self"
        },
        {
          label: "تورنومنت‌های دیگر",
          href: "/tournaments.html",
          target: "_self"
        }
      ]
    });
    return { ok: false };
  }

  const profile = await getUserProfile();
  if (!profile || !profile.id) {
    showError("امکان دریافت اطلاعات کاربر وجود ندارد. لطفاً دوباره وارد شوید.");
    return { ok: false };
  }

  return { ok: true, profile };
}

async function ensureIndividualEligibility({ checkWallet = false } = {}) {
  const tournament = window.currentTournamentData;
  const base = await ensureBaseEligibility(tournament);
  if (!base.ok) return false;

  const participants = normaliseArray(tournament.participants);
  const userId = base.profile.id;
  const username = base.profile.username;

  const alreadyRegistered = participants.some(p => {
    const participantId = getParticipantId(p);
    const participantUsername = getParticipantUsername(p);
    if (participantId && String(participantId) === String(userId)) return true;
    if (participantUsername && username && participantUsername === username) return true;
    return false;
  });

  if (alreadyRegistered) {
    showError("شما قبلاً در این تورنومنت ثبت‌نام کرده‌اید.");
    return false;
  }

  if (checkWallet) {
    const hasFunds = await ensureUserHasEnoughBalance(tournament, base.profile);
    if (!hasFunds) return false;
  }

  return true;
}

async function ensureTeamEligibility(teamId, { checkWallet = false } = {}) {
  const tournament = window.currentTournamentData;
  const base = await ensureBaseEligibility(tournament);
  if (!base.ok) return { ok: false };

  if (!teamId) {
    showError("لطفاً یک تیم انتخاب کنید.");
    return { ok: false };
  }

  const team = await fetchTeamDetails(teamId);
  if (!team) {
    showError("امکان دریافت اطلاعات تیم وجود ندارد.");
    return { ok: false };
  }

  if (!isUserTeamCaptain(team, base.profile.id)) {
    showError("فقط کاپیتان تیم می‌تواند درخواست ثبت‌نام را ارسال کند.");
    return { ok: false };
  }

  const expectedSize = toNumber(tournament.team_size);
  const members = getTeamMembers(team);
  const actualSize = getTeamMemberCount(team);

  if (expectedSize > 0 && actualSize > expectedSize) {
    showError(`تعداد اعضای تیم نباید بیشتر از ${expectedSize.toLocaleString("fa-IR")} نفر باشد.`);
    return { ok: false };
  }

  if (expectedSize > 0 && actualSize < expectedSize) {
    const diff = expectedSize - actualSize;
    showError(`تیم شما هنوز کامل نشده است. ${diff.toLocaleString("fa-IR")} عضو دیگر برای ثبت‌نام لازم است.`);
    return { ok: false };
  }

  if (isTeamAlreadyRegistered(tournament, team.id)) {
    showError("این تیم قبلاً در تورنومنت ثبت‌نام شده است.");
    return { ok: false };
  }

  const overlappingMembers = getOverlappingMembers(tournament, members);
  if (overlappingMembers.length) {
    showError(`اعضای زیر قبلاً در این تورنومنت ثبت‌نام کرده‌اند: ${overlappingMembers.join("، ")}`);
    return { ok: false };
  }

  if (checkWallet) {
    const hasFunds = await ensureTeamMembersHaveFunds(team, tournament);
    if (!hasFunds) return { ok: false };
  }

  return { ok: true, team, profile: base.profile };
}

/*************************
 * Join Tournament Functions
 *************************/
async function joinIndividualTournament() {
  try {
    const tournament = window.currentTournamentData;
    if (!tournament) return;

    if (!(await ensureIndividualEligibility({ checkWallet: true }))) return;

    console.log("Joining individual tournament");

    await apiFetch(`${API_BASE_URL}/api/tournaments/tournaments/${tournament.id}/join/`, {
      method: "POST",
      body: JSON.stringify({})
    });

    showSuccess("ثبت‌نام با موفقیت انجام شد ✅");
    closeIndividualJoinModal();
    
    // بارگذاری مجدد اطلاعات تورنومنت
    setTimeout(() => {
      loadTournament();
    }, 1000);

  } catch (err) {
    console.error("Join tournament error:", err);
    showError(err.message || "ثبت‌نام انجام نشد.");
  }
}

async function joinTeamTournament() {
  try {
    const tournament = window.currentTournamentData;
    if (!tournament) return;

    const teamSelect = document.getElementById("teamSelect");
    const teamId = teamSelect?.value;
    const confirmButton = document.getElementById("teamJoinConfirmButton");

    if (confirmButton && !confirmButton.dataset.originalText) {
      confirmButton.dataset.originalText = confirmButton.textContent?.trim() || "";
    }

    if (!teamId) {
      showError("لطفاً یک تیم انتخاب کنید.");
      return;
    }

    const eligibility = await ensureTeamEligibility(teamId, { checkWallet: true });
    if (!eligibility.ok) return;

    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.textContent = "در حال ثبت...";
    }

    console.log("Joining team tournament with team_id:", teamId);

    await apiFetch(`${API_BASE_URL}/api/tournaments/tournaments/${tournament.id}/join/`, {
      method: "POST",
      body: JSON.stringify({ team_id: parseInt(teamId) })
    });

    showSuccess("ثبت‌نام تیم با موفقیت انجام شد ✅");
    closeTeamJoinModal();
    
    // بارگذاری مجدد اطلاعات تورنومنت
    setTimeout(() => {
      loadTournament();
    }, 1000);

  } catch (err) {
    console.error("Join team tournament error:", err);
    showError(err.message || "ثبت‌نام تیم انجام نشد.");
  } finally {
    const confirmButton = document.getElementById("teamJoinConfirmButton");
    if (confirmButton) {
      const originalText = confirmButton.dataset.originalText || "تایید و ثبت‌نام تیم";
      confirmButton.textContent = originalText;
      confirmButton.disabled = false;
      delete confirmButton.dataset.originalText;
    }
  }
}

/*************************
 * Verification Helper Functions
 *************************/
async function getUserVerificationInfo() {
  try {
    const profile = await getUserProfile();
    const tournament = window.currentTournamentData;
    
    if (!profile || !tournament) {
      return null;
    }
    
    return {
      userLevel: profile.verification_level || 0,
      requiredLevel: tournament.required_verification_level || 0,
      canJoin: (profile.verification_level || 0) >= (tournament.required_verification_level || 0)
    };
  } catch (error) {
    console.error("Error getting verification info:", error);
    return null;
  }
}

/*************************
 * Debug Functions
 *************************/
function debugAuthStatus() {
  console.log("=== Debug Auth Status ===");
  console.log("isAuthenticated():", isAuthenticated());
  console.log("Auth Token:", getAuthToken() ? "Exists" : "Not Found");
  console.log("Current User ID:", getCurrentUserId());
  console.log("Tournament Data:", window.currentTournamentData);
  console.log("=== End Debug ===");
}

async function debugProfile() {
  console.log("=== Debug Profile ===");
  try {
    const profile = await getUserProfile();
    console.log("User Profile:", profile);
    
    const verificationInfo = await getUserVerificationInfo();
    console.log("Verification Info:", verificationInfo);
  } catch (error) {
    console.error("Profile debug error:", error);
  }
  console.log("=== End Profile Debug ===");
}

/************
 * Bootstrap
 ************/
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Loaded - Starting tournament load");
  
  loadTournament();
  
  // اضافه کردن event listener برای مودال‌ها
  const individualModal = document.getElementById("individualJoinModal");
  const teamModal = document.getElementById("teamJoinModal");
  
  if (individualModal) {
    individualModal.addEventListener("click", (e) => {
      if (e.target === individualModal) closeIndividualJoinModal();
    });
  }
  
  if (teamModal) {
    teamModal.addEventListener("click", (e) => {
      if (e.target === teamModal) closeTeamJoinModal();
    });
  }
});

// اضافه کردن توابع به scope جهانی
window.openIndividualJoinModal = openIndividualJoinModal;
window.openTeamJoinModal = openTeamJoinModal;
window.closeIndividualJoinModal = closeIndividualJoinModal;
window.closeTeamJoinModal = closeTeamJoinModal;
window.joinIndividualTournament = joinIndividualTournament;
window.joinTeamTournament = joinTeamTournament;
window.debugAuthStatus = debugAuthStatus;
window.debugProfile = debugProfile;
window.getUserVerificationInfo = getUserVerificationInfo;