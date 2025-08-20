(async function() {
  // تابع لاگین با prompt
  async function loginPrompt() {
    const username = prompt("نام کاربری:");
    const password = prompt("رمز عبور:");
    if (!username || !password) {
      alert("نام کاربری و رمز عبور الزامی است!");
      return null;
    }

    try {
      const res = await fetch("https://atom-game.ir/api/users/auth/admin-login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!data.access || !data.refresh) {
        alert("ورود ناموفق ❌");
        return null;
      }
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);
      alert("ورود موفق ✅");
      return data.access;
    } catch(e) {
      alert("خطا در ارتباط با سرور ❌");
      return null;
    }
  }

  // تابع refresh token
  async function refreshAccessToken() {
    const refresh = localStorage.getItem("refresh_token");
    if (!refresh) return null;
    try {
      const res = await fetch("https://atom-game.ir/api/users/auth/token/refresh/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh })
      });
      const data = await res.json();
      if (data.access) {
        localStorage.setItem("access_token", data.access);
        return data.access;
      } else {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        return null;
      }
    } catch(e) {
      return null;
    }
  }

  // ارسال درخواست به API با auto-refresh
  async function fetchWithToken(url, options = {}) {
    let token = localStorage.getItem("access_token");
    if (!token) token = await loginPrompt();
    if (!token) return null;

    options.headers = options.headers || {};
    options.headers["Authorization"] = `Bearer ${token}`;

    let res = await fetch(url, options);

    // اگر 401 شد، تلاش برای refresh
    if (res.status === 401) {
      token = await refreshAccessToken();
      if (!token) {
        alert("توکن منقضی شد، لطفاً دوباره وارد شوید.");
        token = await loginPrompt();
        if (!token) return null;
        options.headers["Authorization"] = `Bearer ${token}`;
        res = await fetch(url, options);
      } else {
        options.headers["Authorization"] = `Bearer ${token}`;
        res = await fetch(url, options);
      }
    }

    return res;
  }

  // دریافت بازی‌ها
  const gamesRes = await fetchWithToken("https://atom-game.ir/api/tournaments/games/");
  if (!gamesRes) return;
  const games = await gamesRes.json();
  if (!games.length) return;

  // المان‌ها
  const gameList = document.querySelector(".game_list");
  const heroImg = document.querySelector(".game_bg img");
  const bannerTitle = document.querySelector(".game_banner_title span");
  const bannerDesc = document.querySelector(".game_banner_description span");

  // نمایش بنر یک بازی
  function showBanner(game) {
    const heroBanner = game.images.find(img => img.image_type === "hero_banner")?.image
                        || game.images[0]?.image
                        || "";
    heroImg.src = heroBanner;
    bannerTitle.textContent = game.name;
    bannerDesc.textContent = game.description || "بدون توضیحات";
  }

  showBanner(games[0]);

  // ساخت لیست بازی‌ها
  gameList.innerHTML = "";
  const gameItems = [];

  games.forEach((game, index) => {
    const gameImage = game.images.find(img => img.image_type === "game_image")?.image
                      || "https://via.placeholder.com/42x64?text=No+Image";

    const gameItem = document.createElement("div");
    gameItem.className = "game_list_item";
    if(index === 0) gameItem.classList.add("list_item_active");

    const imgDiv = document.createElement("div");
    imgDiv.className = "game_list_img";
    const img = document.createElement("img");
    img.src = gameImage;
    img.alt = game.name;
    imgDiv.appendChild(img);

    const titleDiv = document.createElement("div");
    titleDiv.className = "game_list_tilte";
    titleDiv.textContent = game.name;

    gameItem.appendChild(imgDiv);
    gameItem.appendChild(titleDiv);

    gameItem.addEventListener("click", () => {
      clearInterval(autoSlideInterval);
      setActiveItem(index);
    });

    gameList.appendChild(gameItem);
    gameItems.push(gameItem);
  });

  let currentIndex = 0;

  function setActiveItem(index) {
    gameItems.forEach(item => item.classList.remove("list_item_active"));
    gameItems[index].classList.add("list_item_active");
    showBanner(games[index]);
    currentIndex = index;
  }

  // اجرای خودکار هر ۴ ثانیه
  const autoSlideInterval = setInterval(() => {
    currentIndex = (currentIndex + 1) % gameItems.length;
    setActiveItem(currentIndex);
  }, 4000);

})();






// کد های نیاز برای اسکرول اسلایدر در حالت موبایل


const slider = document.querySelector(".mobile_slider_container");
const slides = document.querySelectorAll(".mobile_slide");

const cardWidth = 290;
const gap = 20;
const slideWidth = cardWidth + gap;
let currentIndex = 1; // کارت وسط شروع

// محاسبه اسکرول طوری که کارت وسط بیفته وسط صفحه
function scrollToCard(index) {
    const offset = (slider.offsetWidth - cardWidth) / 2; // فاصله از وسط
    slider.scrollTo({
        left: index * slideWidth - offset,
        behavior: "smooth"
    });
}

// شروع از کارت وسط
scrollToCard(currentIndex);

// اسکرول خودکار
function autoScroll() {
    currentIndex = (currentIndex + 1) % slides.length;
    scrollToCard(currentIndex);
}

let autoScrollInterval = setInterval(autoScroll, 3000);

// وقتی کاربر اسکرول دستی کرد → نزدیک‌ترین کارت وسط بیفته
let isScrolling;
slider.addEventListener("scroll", () => {
    clearTimeout(isScrolling);
    clearInterval(autoScrollInterval); // توقف موقت اسکرول خودکار

    isScrolling = setTimeout(() => {
        const offset = (slider.offsetWidth - cardWidth) / 2;
        let nearestIndex = Math.round((slider.scrollLeft + offset) / slideWidth);
        currentIndex = nearestIndex;
        scrollToCard(nearestIndex);

        autoScrollInterval = setInterval(autoScroll, 3000); // راه‌اندازی مجدد
    }, 150);
});
