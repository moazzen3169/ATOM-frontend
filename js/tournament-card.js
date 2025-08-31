// ---------------------- تابع اصلی بارگذاری تورنمنت‌ها ----------------------
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

    // اعمال محدودیت تعداد نمایش
    if (limit) tournaments = tournaments.slice(0, limit);

    tournaments.forEach(tournament => {
      // انتخاب بنر
      let banner = "img/banner2.jpg";
      if (tournament.image?.image) {
        banner = tournament.image.image;
      } else if (Array.isArray(tournament.game?.images) && tournament.game.images.length > 0) {
        const hero = tournament.game.images.find(img => img.image_type === "hero_banner");
        banner = hero?.image || tournament.game.images[0].image;
      }

      const start = new Date(tournament.start_date);
      const end = new Date(tournament.end_date);
      const now = new Date();

      const timeStr = start.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
      const dateStr = start.toLocaleDateString("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const price = tournament.is_free ? "رایگان" : (Number(tournament.entry_fee).toLocaleString("fa-IR") + " تومان");

      // ساخت کارت تورنمنت
      const div = document.createElement("div");
      div.className = "cart_container";
      div.innerHTML = `
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
        <div class="cart_middle">
          <div class="cart_date_time">
            <span>${timeStr}</span>
            <span>${dateStr}</span>
          </div>
          <div class="cart_title"><span>${tournament.name}</span></div>
          <div class="cart_description"><span>${tournament.description || ""}</span></div>
        </div>
        <div class="cart_bottom">
          <button class="cart_join"></button>
          <div class="cart_price"><span>${price}</span></div>
        </div>
      `;
      container.appendChild(div);

      // تعیین متن و عملکرد دکمه
      const joinBtn = div.querySelector(".cart_join");
      if (now >= end) {
        joinBtn.textContent = "دیدن نتایج";
        joinBtn.addEventListener("click", () => {
          showResultPopup(tournament);
        });
      } else {
        joinBtn.textContent = "اضافه شو!";
        joinBtn.addEventListener("click", () => {
          window.location.href = `game-loby.html?id=${tournament.id}`;
        });
      }
    });

  } catch (err) {
    container.innerHTML = `<p class="eror">${err.message}</p>`;
  }
}

// ---------------------- تابع نمایش پاپ‌آپ نتایج ----------------------
function showResultPopup(tournament) {
  const popup = document.createElement("div");
  popup.className = "result-popup";
  popup.innerHTML = `
    <div class="popup-content">
      <span class="close-popup">&times;</span>
      <h2>نتایج ${tournament.name}</h2>
      <p>اینجا می‌تونید نتایج تورنمنت رو نمایش بدید.</p>
      <!-- اطلاعات بیشتر مثل جدول رتبه‌بندی یا جوایز -->
    </div>
  `;
  document.body.appendChild(popup);

  // بستن پاپ‌آپ
  popup.querySelector(".close-popup").addEventListener("click", () => {
    document.body.removeChild(popup);
  });
}

// ---------------------- تابع نمایش زمان باقی‌مانده ----------------------
function timeRemaining(startCountdown, startDate, endDate) {
  const now = new Date();
  const countdownTime = new Date(startCountdown);
  const startTime = new Date(startDate);
  const endTime = new Date(endDate);

  // قبل از شروع شمارش معکوس
  if (now < countdownTime) {
    return countdownTime.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  }

  // بین start_countdown و start_date
  if (now >= countdownTime && now < startTime) {
    const diff = startTime - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2,"0")} : ${mins.toString().padStart(2,"0")} : ${secs.toString().padStart(2,"0")}`;
  }

  // بین start_date و end_date
  if (now >= startTime && now < endTime) {
    return "شروع شده";
  }

  // بعد از پایان
  if (now >= endTime) {
    return "پایان یافته";
  }

  return "-";
}
