
// کد های مورد نیاز برای لودیینگ

window.onload = function() {
  // لودیینگ رو پیدا کن
  const preloader = document.getElementById('preloader');
  const content = document.querySelector('.content');

  // انیمیشن محو کردن لودیینگ
  preloader.style.opacity = 1;
  const fadeOut = setInterval(() => {
    if (preloader.style.opacity > 0) {
      preloader.style.opacity -= 0.1;
    } else {
      clearInterval(fadeOut);
      preloader.style.display = 'none';
      content.style.display = 'block';
    }
  }, 50);
};

// 
// 
// 
// 









  const goTOp = document.querySelector(".go-top");

  goTOp.addEventListener("click", function() {
    window.scrollTo({
      top: 0,
      behavior: "smooth" // اسکرول نرم
    });
  });
  


  // بخش مربوط به اسلایدر بازی ها
document.addEventListener("DOMContentLoaded", function () {
    const gameSection = document.querySelector(".game_section");
    const card = document.querySelector(".game_item"); // یک کارت نمونه
    card.style.width="240";
    const cardWidth = card.offsetWidth + parseInt(getComputedStyle(card).marginRight); // عرض کارت + فاصله

    document.querySelector(".game_arrowkey.right").addEventListener("click", function () {
        gameSection.scrollBy({
            left: cardWidth, // به سمت راست
            behavior: "smooth"
        });
    });

    document.querySelector(".game_arrowkey.left").addEventListener("click", function () {
        gameSection.scrollBy({
            left: -cardWidth, // به سمت چپ
            behavior: "smooth"
        });
    });
});





// برای نمایش اطالعات 3کاربر برتر سایت



async function loadLeaderboard() {
  const container = document.getElementById('grid-container');
  container.innerHTML = ''; // پاک‌سازی قبلی

  try {
    const response = await fetch('https://atom-game.ir/api/users/top-players-by-rank/');
    if (!response.ok) throw new Error('خطا در دریافت داده از API');

    const players = await response.json();

    // مرتب‌سازی بر اساس امتیاز (نزولی)
    const topPlayers = players
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // فقط 3 نفر اول

    if (topPlayers.length > 0) {
      topPlayers.forEach((player, index) => {
        const div = document.createElement('div');
        div.className = 'leaderboard_item';
        div.innerHTML = `
          <div class="leaeder_profile">
            <div class="profile_img">
              <img src="img/profile.jpg" alt="profile">
            </div>
            <div class="user_name"><span>${player.username}</span></div>
            <div class="user_rank"><span>${index + 1}</span></div>
          </div>
          <div class="leader_info1 leader_info">
            <span>تعداد برد :</span> <span>${player.wins}</span>
          </div>
          <div class="leader_info2 leader_info">
            <span>امتیاز :</span> <span>${player.score}</span>
          </div>
          <div class="leader_info3 leader_info">
            <span>مجموع جوایز :</span> <span>${player.total_winnings} تومان</span>
          </div>
        `;
        container.appendChild(div);
      });
    } else {
      container.innerHTML = `<p class="eror">هیچ بازیکنی یافت نشد</p>`;
    }
  } catch (err) {
    container.innerHTML = `<p class="eror">${err.message}</p>`;
  }
}

loadLeaderboard();





// کد  های درخواست برای نمایش تورنومنت ها در صفحه اصلی



async function loadTournaments() {
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

    // فقط 3 تا از جدیدترین‌ها
    const latestTournaments = tournaments.slice(0, 3);

    latestTournaments.forEach(tournament => {
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
                <span>${timeRemaining(tournament.start_date)}</span>
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
function timeRemaining(startDate) {
  const diff = new Date(startDate) - new Date();
  if (diff <= 0) return "شروع شده";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2,"0")} : ${mins.toString().padStart(2,"0")} : ${secs.toString().padStart(2,"0")}`;
}

loadTournaments();








