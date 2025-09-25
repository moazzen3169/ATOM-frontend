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
  
    // دکمه‌های اکشن غیر-لینک
    el.querySelectorAll("button.alert_btn[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const act = btn.getAttribute("data-action");
        if (act === "open-verify") window.location.href = "/verify";
        if (act === "open-wallet") window.location.href = "/wallet";
        if (act === "open-teams") window.location.href = "/teams";
        el.remove();
      });
    });
  
    if (duration > 0) {
      setTimeout(() => el.remove(), duration);
    }
  }
  
  const ERROR_DEFS = {
    AUTH_REQUIRED: {
      classes: ["err-auth"],
      title: "نیاز به ورود",
      message: "برای ثبت‌نام در تورنومنت باید وارد حساب شوید.",
      actions: [{ label: "ورود", href: "/login.html" }, { label: "ثبت‌نام", href: "/signup.html" }]
    },
    CAPACITY_FULL: {
      classes: ["err-capacity"],
      title: "ظرفیت تکمیل است",
      message: "متأسفانه ظرفیت تورنومنت به حداکثر رسیده است."
    },
    DUPLICATE: {
      classes: ["err-duplicate"],
      title: "ثبت‌نام تکراری",
      message: "شما قبلاً در این تورنومنت ثبت‌نام کرده‌اید."
    },
    VERIFICATION: {
      classes: ["err-verification"],
      title: "تأیید هویت لازم است",
      message: "برای ثبت‌نام باید سطح تأیید هویت لازم را داشته باشید.",
      actions: [{ label: "انجام تأیید هویت", action: "open-verify" }]
    },
    FEE: {
      classes: ["err-fee"],
      title: "کمبود موجودی",
      message: "موجودی کیف پول برای پرداخت هزینه ورودی کافی نیست.",
      actions: [{ label: "شارژ کیف پول", action: "open-wallet" }]
    },
    CAPTAIN_ONLY: {
      classes: ["err-captain"],
      title: "فقط کاپیتان تیم",
      message: "تنها کاپیتان تیم می‌تواند تیم را در تورنومنت ثبت‌نام کند."
    },
    TEAM_SIZE: {
      classes: ["err-team-size"],
      title: "اندازه تیم نامعتبر",
      message: "تعداد اعضای تیم باید دقیقاً با اندازه تعیین‌شده تورنومنت مطابقت داشته باشد."
    },
    TEAM_REGISTERED: {
      classes: ["err-team-registered"],
      title: "تیم قبلاً ثبت‌نام شده",
      message: "این تیم پیش‌تر در تورنومنت ثبت‌نام شده است."
    },
    OVERLAP: {
      classes: ["err-overlap"],
      title: "همپوشانی اعضا",
      message: "حداقل یکی از اعضای تیم به‌صورت فردی ثبت‌نام کرده است."
    },
    VALIDATION: {
      classes: ["err-validation"],
      title: "اشکال در اطلاعات ارسالی",
      message: "لطفاً اطلاعات وارد شده را بررسی کنید."
    },
    FORBIDDEN: {
      classes: ["err-forbidden"],
      title: "مجوز کافی نیست",
      message: "شما اجازه انجام این عملیات را ندارید."
    },
    NOT_FOUND: {
      classes: ["err-notfound"],
      title: "یافت نشد",
      message: "منبع درخواستی یافت نشد یا دیگر در دسترس نیست."
    },
    NETWORK: {
      classes: ["err-network"],
      title: "مشکل شبکه",
      message: "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید."
    },
    SERVER: {
      classes: ["err-server"],
      title: "خطای سرور",
      message: "مشکلی سمت سرور رخ داده است. کمی بعد دوباره تلاش کنید."
    }
  };
  
  function showErrorByCode(code, extraMessage = "", actions = []) {
    const def = ERROR_DEFS[code] || ERROR_DEFS.SERVER;
    renderAlert({
      classes: def.classes,
      title: def.title,
      message: extraMessage ? `${def.message}<br>${extraMessage}` : def.message,
      actions: actions.length ? actions : def.actions || [],
      type: "error"
    });
  }
  
  function showSuccess(msg) {
    renderAlert({
      classes: [],
      title: "موفقیت‌آمیز",
      message: msg,
      type: "success",
      duration: 5000
    });
  }
  
  function showInfo(msg) {
    renderAlert({
      classes: [],
      title: "اطلاع",
      message: msg,
      type: "info",
      duration: 6000
    });
  }
  
  /*****************************************
   * Optional: درآوردن خطای سرور به زبان آدمیزاد
   *****************************************/
  function mapServerMessageToCode(message = "") {
    const m = message.toLowerCase();
  
    if (m.includes("authentication") || m.includes("credentials") || m.includes("not provided")) return "AUTH_REQUIRED";
    if (m.includes("already") && (m.includes("registered") || m.includes("joined"))) return "DUPLICATE";
    if (m.includes("insufficient") || m.includes("not enough") || m.includes("balance")) return "FEE";
    if (m.includes("verify") || m.includes("verification")) return "VERIFICATION";
    if (m.includes("captain")) return "CAPTAIN_ONLY";
    if (m.includes("team size") || m.includes("exactly")) return "TEAM_SIZE";
    if (m.includes("team already")) return "TEAM_REGISTERED";
    if (m.includes("overlap") || m.includes("already in another")) return "OVERLAP";
    if (m.includes("full") || m.includes("capacity")) return "CAPACITY_FULL";
    return null;
  }
  
  async function parseApiErrorResponse(response) {
    let text = "";
    let data = null;
    try {
      // تلاش برای JSON
      data = await response.clone().json();
    } catch (e) {
      try {
        text = await response.text();
      } catch (_) {}
    }
  
    // ساخت پیام دوستانه از الگوهای متداول DRF/Django
    let message = "";
    if (data) {
      if (typeof data.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data.non_field_errors)) {
        message = data.non_field_errors.join("، ");
      } else if (typeof data === "object") {
        // گرد کردن پیام‌های فیلدی
        const lines = [];
        for (const [field, val] of Object.entries(data)) {
          if (Array.isArray(val)) {
            lines.push(`${field}: ${val.join("، ")}`);
          } else if (typeof val === "string") {
            lines.push(`${field}: ${val}`);
          }
        }
        message = lines.join("<br>");
      }
    }
    if (!message && text) message = text;
  
    // نگاشت به کدهای ما
    let code = null;
    if (response.status === 401) code = "AUTH_REQUIRED";
    else if (response.status === 403) code = "FORBIDDEN";
    else if (response.status === 404) code = "NOT_FOUND";
    else if (response.status >= 500) code = "SERVER";
    else {
      code = mapServerMessageToCode(message) || "VALIDATION";
    }
  
    return { code, message: message || "خطای نامشخص از سرور" };
  }
  
  /***********************
   * Auth Check (comment)
   ***********************/
  function checkAuth() {
    // const token = localStorage.getItem("authToken");
    // if (!token) {
    //   // کاربر هنوز لاگین نکرده
    //   showErrorByCode("AUTH_REQUIRED");
    //   return false;
    // }
    // برای تست بدون احراز هویت:
    return true;
  }
  
  /***********************
   * Loading tournament
   ***********************/
  async function loadTournament() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tournamentId = urlParams.get("id");
      if (!tournamentId) {
        console.error("Tournament ID missing in URL");
        return;
      }
  
      const response = await fetch(`https://atom-game.ir/api/tournaments/tournaments/${tournamentId}/`);
      if (!response.ok) throw new Error("API request failed");
  
      const tournament = await response.json();
      if (!tournament) {
        console.error("Tournament not found");
        return;
      }
  
      window.currentTournamentData = tournament;
  
      // تاریخ‌ها
      const now = new Date();
      const startDate = new Date(tournament.start_date);
      const endDate = new Date(tournament.end_date || startDate);
      const dateOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
      const dateTimeOptions = { ...dateOptions, hour: "2-digit", minute: "2-digit" };
  
      // شروع
      if (now >= startDate) {
        document.getElementById("start_time").textContent = startDate.toLocaleDateString(undefined, dateOptions);
      } else {
        document.getElementById("start_time").textContent = startDate.toLocaleString(undefined, dateTimeOptions);
      }
  
      // پایان
      document.getElementById("end_time").textContent = endDate.toLocaleString(undefined, dateTimeOptions);
  
      // حالت
      document.getElementById("tournament_mode").textContent =
        tournament.type === "team" ? `تیمی (هر تیم ${tournament.team_size} نفر)` : tournament.type;
  
      // بنر
      if (tournament.image?.image) {
        document.getElementById("tournament_banner").src = tournament.image.image;
      }
  
      // جوایز و عنوان
      const prize = Number(tournament.prize_pool) || 0;
      document.getElementById("prize_pool").textContent = prize.toLocaleString("fa-IR") + " تومان";
      document.getElementById("tournament_title").textContent = tournament.name;
  
      // شمارش معکوس عضویت
      const signupTimeEl = document.getElementById("signup_time");
      function updateSignupCountdown() {
        const diff = startDate - new Date();
        if (diff > 0) {
          const hours = String(Math.floor(diff / 1000 / 3600)).padStart(2, "0");
          const minutes = String(Math.floor((diff / 1000 % 3600) / 60)).padStart(2, "0");
          const seconds = String(Math.floor(diff / 1000 % 60)).padStart(2, "0");
          signupTimeEl.textContent = ` ${hours}:${minutes}:${seconds}`;
        } else {
          signupTimeEl.textContent = ` ${startDate.toLocaleDateString(undefined, dateOptions)}`;
          clearInterval(timer);
        }
      }
      const now2 = new Date();
      if (now2 < startDate) {
        var timer = setInterval(updateSignupCountdown, 1000);
        updateSignupCountdown();
      } else {
        signupTimeEl.textContent = ` ${startDate.toLocaleDateString(undefined, dateOptions)}`;
      }
  
      // رندر بازیکن‌ها/تیم‌ها
      renderParticipants(tournament);
  
      // نمایش صفحه (در صورت استفاده از layout پنهان)
      const lobbyPage = document.getElementById("lobby_page");
      if (lobbyPage) lobbyPage.style.display = "grid";
  
    } catch (err) {
      console.error("Error loading tournament:", err);
      showErrorByCode("SERVER", "امکان دریافت اطلاعات تورنومنت وجود ندارد.");
    }
  }
  
  /*****************************
   * Rendering participants/teams
   *****************************/
  function renderParticipants(tournament) {
    const section = document.getElementById("participants_section");
    section.innerHTML = "";
  
    if (tournament.type === "individual") {
      // هدر تعداد
      const header = document.createElement("div");
      header.className = "players_header";
      header.innerHTML = `
        <span class="v">
          <i class="fil fni"></i>
          ${tournament.current_participants} / ${tournament.max_participants}
        </span>`;
      section.appendChild(header);
  
      // گرید
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
            <button class="team_detail team_empty" onclick="joinTournament(window.currentTournamentData)">
              همین الان اضافه شو!
              <i><img src="img/icons/plus.svg" alt="plus"></i>
            </button>`;
        }
        container.appendChild(slot);
      }
      section.appendChild(container);
  
    } else if (tournament.type === "team") {
      // هدر تعداد تیم‌ها
      const header = document.createElement("div");
      header.className = "teams_header";
      header.innerHTML = `
        <span class="v">
          <i class="fil fni"></i>
          ${tournament.current_participants} / ${tournament.max_participants}
        </span>`;
      section.appendChild(header);
  
      // گرید
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
            <button class="team_detail team_empty" onclick="joinTournament(window.currentTournamentData)">
              همین الان تیمت رو اضافه کن
              <i><img src="img/icons/plus.svg" alt="plus"></i>
            </button>`;
        }
        container.appendChild(slot);
      }
      section.appendChild(container);
    }
  }
  
  /***********************
   * Modals
   ***********************/
  function openModal(id) {
    document.getElementById(id).style.display = "flex";
  }
  function closeModal(id) {
    document.getElementById(id).style.display = "none";
  }
  
  // انفرادی
  function confirmIndividualJoin() {
    const username = document.getElementById("game_username").value;
    if (!username || username.trim().length < 2) {
      showErrorByCode("VALIDATION", "نام کاربری بازی باید حداقل ۲ کاراکتر باشد.");
      return;
    }
    closeModal('modal_individual');
    joinTournament(window.currentTournamentData, { game_username: username.trim() });
  }
  
  // تیمی
  let selectedTeamId = null;
  function loadTeamsForModal(teams) {
    const list = document.getElementById("team_list");
    list.innerHTML = "";
    (teams || []).forEach(team => {
      const btn = document.createElement("button");
      btn.textContent = team.name;
      btn.onclick = () => {
        selectedTeamId = team.id;
        [...list.querySelectorAll("button")].forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      };
      list.appendChild(btn);
    });
  }
  function confirmTeamJoin() {
    if (!selectedTeamId) {
      showInfo("لطفاً ابتدا یک تیم را انتخاب کنید.");
      return;
    }
    closeModal('modal_team');
    joinTournament(window.currentTournamentData, { team_id: selectedTeamId });
  }
  
  /*************************
   * Join Tournament (POST)
   *************************/
  async function joinTournament(tournament, extraData = {}) {
    const tournamentId = tournament.id;
    // const token = localStorage.getItem("authToken");
  
    // پیش‌شرط‌های کلاینت‌ساید
    if (tournament.current_participants >= tournament.max_participants) {
      return showErrorByCode("CAPACITY_FULL");
    }
    if (tournament.is_joined) {
      return showErrorByCode("DUPLICATE");
    }
  
    // جمع‌آوری ورودی‌ها از مودال‌ها در صورت نیاز
    if (tournament.type === "individual" && !extraData.game_username) {
      return openModal('modal_individual');
    }
    if (tournament.type === "team" && !extraData.team_id) {
      // TODO: جایگزین با API واقعی تیم‌های کاربر
      const userTeams = [
        { id: 1, name: "تیم عقاب" },
        { id: 2, name: "تیم شیرها" }
      ];
      loadTeamsForModal(userTeams);
      return openModal('modal_team');
    }
  
    // بدنه درخواست
    let body = {};
    if (tournament.type === "individual") {
      body = { game_username: extraData.game_username };
    } else {
      body = { team_id: extraData.team_id };
    }
  
    try {
      const res = await fetch(`https://atom-game.ir/api/tournaments/tournaments/${tournamentId}/join/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
  
      if (!res.ok) {
        const { code, message } = await parseApiErrorResponse(res);
        showErrorByCode(code, message);
        return;
      }
  
      showSuccess("ثبت‌نام با موفقیت انجام شد ✅");
      loadTournament();
  
    } catch (e) {
      console.error(e);
      showErrorByCode("NETWORK");
    }
  }
  
  /************
   * Bootstrap
   ************/
  document.addEventListener("DOMContentLoaded", () => {
    if (!checkAuth()) return;
    loadTournament();
  });
  