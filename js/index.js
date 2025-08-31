
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

loadTournaments(3); // فقط سه تورنومنت
