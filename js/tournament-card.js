// tournaments.js

async function loadTournaments(limit = null) {
  const container = document.getElementById("grid-container-tournaments");
  container.innerHTML = "";

  try {
    const response = await fetch("https://atom-game.ir/api/tournaments/tournaments/");
    if (!response.ok) throw new Error("خطا در دریافت اطلاعات تورنمنت‌ها");

    let tournaments = await response.json();
    if (!Array.isArray(tournaments)) {
      tournaments = tournaments.results || tournaments.data || [tournaments];
    }

    // مرتب‌سازی بر اساس تاریخ شروع (جدیدترین اول)
    tournaments.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

    // اگه limit داده بشه → فقط به همون تعداد نمایش بده
    if (limit) {
      tournaments = tournaments.slice(0, limit);
    }

    // ساخت کارت‌ها
    tournaments.forEach(tournament => {
      // عکس بنر
      let banner = "img/banner2.jpg";
      if (tournament.game?.images?.length) {
        const hero = tournament.game.images.find(img => img.image_type === "hero_banner");
        banner = hero ? hero.image : tournament.game.images[0].image;
      }

      // زمان شروع و تاریخ
      const start = new Date(tournament.start_date);
      const timeStr = start.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
      const dateStr = start.toLocaleDateString("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

      // هزینه ورود
      let price = tournament.is_free ? "رایگان" : (Number(tournament.entry_fee).toLocaleString("fa-IR") + " تومان");

      const div = document.createElement("div");
      div.className = "cart_container";
      div.innerHTML = `
        <!-- بالای کارت -->
        <div class="cart_top">
          <div class="cart_image">
            <img src="${banner}" alt="banner">
            <div class="cart_countdown_game">
              <div class="cart_countdown">
                <img src="img/icons/clock.svg" alt="clock">
                <span>${timeRemaining(tournament.start_countdown, tournament.start_date, tournament.end_date)}</span>
              </div>
              <div class="cart_game_name">
                <span>${tournament.game?.name || "-"}</span>
              </div>
            </div>
          </div>
        </div>
        <!-- وسط کارت -->
        <div class="cart_middle">
          <div class="cart_date_time">
            <span>${timeStr}</span>
            <span>${dateStr}</span>
          </div>
          <div class="cart_title"><span>${tournament.name}</span></div>
          <div class="cart_description"><span>${tournament.description || ""}</span></div>
        </div>
        <!-- پایین کارت -->
        <div class="cart_bottom">
          <button class="cart_join">اضافه شو!</button>
          <div class="cart_price"><span>${price}</span></div>
        </div>
      `;
      container.appendChild(div);

      // رویداد دکمه
      const joinBtn = div.querySelector(".cart_join");
      joinBtn.addEventListener("click", () => {
        window.location.href = `game-loby.html?id=${tournament.id}`;
      });
    });

  } catch (err) {
    container.innerHTML = `<p class="eror">${err.message}</p>`;
  }
}

// تابع نمایش زمان باقی‌مانده
function timeRemaining(startCountdown, startDate, endDate) {
  const now = new Date();

  const countdownTime = new Date(startCountdown);
  const startTime = new Date(startDate);
  const endTime = new Date(endDate);

  // 1. قبل از شروع شمارش معکوس
  if (now < countdownTime) {
    return countdownTime.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  }

  // 2. بین start_countdown و start_date → شمارش معکوس تا شروع تورنمنت
  if (now >= countdownTime && now < startTime) {
    const diff = startTime - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2,"0")} : ${mins.toString().padStart(2,"0")} : ${secs.toString().padStart(2,"0")}`;
  }

  // 3. بین start_date و end_date
  if (now >= startTime && now < endTime) {
    return " شروع شده";
  }

  // 4. بعد از پایان
  if (now >= endTime) {
    return "پایان یافته";
  }

  return "-";
}
