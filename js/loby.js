import { API_BASE_URL } from "/js/config.js";

/**************************
 * Global Variables
 **************************/
window.currentTournamentData = null;
let userProfileCache = null;

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
    if (profile && profile.id) localStorage.setItem('userId', profile.id);
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
  if (!checkGeneralConditions()) return;
  
  // بررسی سطح تأیید هویت قبل از نمایش مودال
  const tournament = window.currentTournamentData;
  const verificationCheck = await checkUserVerification(tournament);
  
  if (!verificationCheck.verified) {
    showError(verificationCheck.message);
    
    // نمایش راهنمای ارتقای سطح تأیید هویت
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
    return;
  }
  
  const modal = document.getElementById("individualJoinModal");
  if (modal) {
    modal.style.display = "flex";
  } else {
    joinIndividualTournament();
  }
}

async function openTeamJoinModal() {
  if (!checkGeneralConditions()) return;
  
  // بررسی سطح تأیید هویت قبل از نمایش مودال
  const tournament = window.currentTournamentData;
  const verificationCheck = await checkUserVerification(tournament);
  
  if (!verificationCheck.verified) {
    showError(verificationCheck.message);
    return;
  }
  
  const modal = document.getElementById("teamJoinModal");
  if (modal) {
    loadUserTeams();
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
}

/*************************
 * Load User Teams
 *************************/
async function loadUserTeams() {
  try {
    const teams = await apiFetch(`${API_BASE_URL}/api/tournaments/teams/`);
    const teamSelect = document.getElementById("teamSelect");
    
    if (teamSelect && teams) {
      teamSelect.innerHTML = '<option value="">انتخاب تیم</option>';
      
      teams.forEach(team => {
        const option = document.createElement("option");
        option.value = team.id;
        option.textContent = `${team.name} (${team.members_count} عضو)`;
        teamSelect.appendChild(option);
      });
    } else if (teamSelect) {
      teamSelect.innerHTML = '<option value="">تیمی یافت نشد</option>';
    }
  } catch (err) {
    console.error("Error loading teams:", err);
    const teamSelect = document.getElementById("teamSelect");
    if (teamSelect) {
      teamSelect.innerHTML = '<option value="">خطا در بارگذاری تیم‌ها</option>';
    }
  }
}

/*************************
 * Condition Checks
 *************************/
function checkGeneralConditions() {
  const tournament = window.currentTournamentData;
  if (!tournament) {
    showError("اطلاعات تورنومنت در دسترس نیست.");
    return false;
  }

  // 1. بررسی احراز هویت
  if (!isAuthenticated()) {
    showError("برای ثبت‌نام در تورنومنت باید وارد حساب کاربری خود شوید.");
    return false;
  }

  // 2. بررسی وضعیت تورنومنت
  const now = new Date();
  const start = new Date(tournament.start_date);
  const end = new Date(tournament.end_date);
  
  if (now > end) {
    showError("تورنومنت به پایان رسیده است.");
    return false;
  }
  
  if (now >= start && now <= end) {
    showError("تورنومنت در حال برگزاری است و امکان ثبت‌نام وجود ندارد.");
    return false;
  }

  // 3. بررسی ظرفیت
  const currentParticipants = tournament.participants?.length || 0;
  if (currentParticipants >= tournament.max_participants) {
    showError("تورنومنت به حداکثر ظرفیت خود رسیده است.");
    return false;
  }

  return true;
}

async function checkIndividualConditions() {
  const tournament = window.currentTournamentData;
  if (!tournament) return false;

  try {
    // بررسی تأیید هویت
    const verificationCheck = await checkUserVerification(tournament);
    if (!verificationCheck.verified) {
      showError(verificationCheck.message);
      return false;
    }

    // بررسی ثبت‌نام تکراری
    const userProfile = await getUserProfile();
    
    if (userProfile && userProfile.id) {
      const isAlreadyRegistered = tournament.participants?.some(p => 
        p.id === userProfile.id || 
        p.user_id === userProfile.id || 
        p.username === userProfile.username);
      
      if (isAlreadyRegistered) {
        showError("شما قبلاً در این تورنومنت ثبت‌نام کرده‌اید.");
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("Error in individual conditions check:", error);
    showError("خطا در بررسی شرایط ثبت‌نام");
    return false;
  }
}

/*************************
 * Join Tournament Functions
 *************************/
async function joinIndividualTournament() {
  try {
    const tournament = window.currentTournamentData;
    if (!tournament) return;

    // بررسی شرایط عمومی
    if (!checkGeneralConditions()) return;
    
    // بررسی شرایط خاص انفرادی
    if (!(await checkIndividualConditions())) return;

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

    if (!teamId) {
      showError("لطفاً یک تیم انتخاب کنید.");
      return;
    }

    // بررسی شرایط عمومی
    if (!checkGeneralConditions()) return;

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