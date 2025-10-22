import { API_BASE_URL } from "/js/config.js";
import { renderInlineMessage, showAppNotification } from "/js/app-errors.js";

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
document.addEventListener("DOMContentLoaded", () => {
  loadLeaderboard();
  loadHomeTournaments();
});

async function loadLeaderboard() {
  const container = document.getElementById('grid-container');
  if (!container) return;

  container.innerHTML = ''; // پاک‌سازی قبلی

  try {
      const response = await fetch(`${API_BASE_URL}/api/users/top-players-by-rank/`);
      if (!response.ok) throw new Error('خطا در دریافت داده از API');

      const players = await response.json();
      console.log(players); // برای بررسی داده‌ها

      const topPlayers = players.sort((a,b) => b.score - a.score).slice(0,6);

      if (topPlayers.length > 0) {
          topPlayers.forEach((player,index) => {
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
                <div class="leaeder_profile_information">
                  <div class="leader_info1 leader_info">
                  <span>تعداد برد :</span> <span>${player.wins}</span>
                </div>
                <div class="leader_info2 leader_info">
                  <span>امتیاز :</span> <span>${player.score}</span>
                </div>
                <div class="leader_info3 leader_info">
                  <span>مجموع جوایز :</span> <span>${player.total_winnings} تومان</span>
                </div>
                </div>
              `;
              container.appendChild(div);
          });
      } else {
          renderInlineMessage(container, "playersEmpty");
      }
  } catch (err) {
      console.error("خطا در بارگذاری بازیکنان برتر:", err);
      renderInlineMessage(container, "playersLoadFailed");
      showAppNotification("playersLoadFailed");
  }
}



// ---------------------- بارگذاری 3 تورنمنت برای صفحه اصلی ----------------------
async function loadHomeTournaments() {
  const container = document.getElementById("grid-container-tournaments");
  renderInlineMessage(container, "tournamentsLoading");

  try {
      const response = await fetch(
          `${API_BASE_URL}/api/tournaments/tournaments/?page=1&page_size=6&ordering=start_date
`
      );

      if (!response.ok) throw new Error("خطا در دریافت اطلاعات تورنمنت‌ها");

      const data = await response.json();
      const tournaments = data.results || [];

      container.innerHTML = ""; // پاک کردن محتوای قبلی

      if (tournaments.length === 0) {
          renderInlineMessage(container, "tournamentsEmpty");
          return;
      }

      // پاس دادن داده‌ها به تابع renderTournamentCard از tournament-card.js
      tournaments.forEach(t => {
          renderTournamentCard(t, "grid-container-tournaments");
      });

  } catch (error) {
      console.error("خطا در بارگذاری تورنمنت‌ها:", error);
      renderInlineMessage(container, "tournamentsLoadFailed");
      showAppNotification("tournamentsLoadFailed");
  }
}

// ---------------------- شروع اولیه ----------------------
document.addEventListener("DOMContentLoaded", () => {
  loadHomeTournaments();
});




