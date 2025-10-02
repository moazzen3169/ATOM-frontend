(async function () {
  try {
    // دریافت لیست بازی‌ها
    const gamesRes = await fetch("/api/tournaments/games/");
    let games = await gamesRes.json();
    if (!Array.isArray(games) || games.length === 0) return;

    /*** ------------------- مرتب‌سازی: active اول، coming_soon آخر ------------------- ***/
    games.sort((a, b) => {
      if (a.status === "active" && b.status === "coming_soon") return -1;
      if (a.status === "coming_soon" && b.status === "active") return 1;
      return 0;
    });

    /*** ------------------- متغیرهای مشترک ------------------- ***/
    let currentIndex = 0;
    let autoSlideInterval = null;
    const gameItems = [];
    const mobileSlides = [];

    const DEFAULT_SMALL_IMG = "https://via.placeholder.com/42x64?text=No+Image";
    const DEFAULT_BANNER_IMG = "https://via.placeholder.com/600x300?text=No+Image";

    /*** ------------------- DOM دسکتاپ / تبلت ------------------- ***/
    const gameList      = document.querySelector(".game_list");
    const heroImg       = document.querySelector(".game_bg img");
    const bannerTitle   = document.querySelector(".game_banner_title span");
    const bannerDesc    = document.querySelector(".game_banner_description span");
    const watchBtn      = document.querySelector(".watch_tourament");
    const bannerWrapper = document.querySelector(".game_bg");

   



    function showBanner(game) {
  if (!game) return;

  const heroBanner =
    game.images?.find(img => img.image_type === "hero_banner")?.image ||
    game.images?.[0]?.image ||
    DEFAULT_BANNER_IMG;

  if (bannerWrapper) {
    const oldImg = bannerWrapper.querySelector("img.active");

    // تصویر جدید
    const newImg = document.createElement("img");
    newImg.src = heroBanner;
    newImg.alt = game.name || "";
    newImg.classList.add("active");
    newImg.style.opacity = "0";
    newImg.style.transform = "translateX(-100%)";
    bannerWrapper.appendChild(newImg);

    requestAnimationFrame(() => {
      newImg.style.transition = "all 0.8s ease-in-out";
      newImg.style.opacity = "1";
      newImg.style.transform = "translateX(0)";
    });

    if (oldImg) {
      oldImg.style.transition = "all 0.8s ease-in-out";
      oldImg.style.opacity = "0";
      oldImg.style.transform = "translateX(100%)";
      oldImg.addEventListener("transitionend", () => oldImg.remove(), { once: true });
      oldImg.classList.remove("active");
    }
  }

  // انیمیشن متن
  const oldTitle = bannerTitle;
  const oldDesc = bannerDesc;

  if (oldTitle && oldDesc) {
    // متن قدیمی حرکت به راست و محو شدن
    oldTitle.style.transition = "all 0.6s ease-in-out";
    oldDesc.style.transition = "all 0.6s ease-in-out";
    oldTitle.style.opacity = "0";
    oldTitle.style.transform = "translateX(10%)";
    oldDesc.style.opacity = "0";
    oldDesc.style.transform = "translateX(10%)";

    // بعد از پایان انیمیشن، متن جدید جایگزین شود
    setTimeout(() => {
      oldTitle.textContent = game.name || "";
      oldDesc.textContent = game.description || "بدون توضیحات";

      // متن جدید از سمت چپ وارد شود
      oldTitle.style.transition = "none";
      oldDesc.style.transition = "none";
      oldTitle.style.opacity = "0";
      oldTitle.style.transform = "translateX(-10%)";
      oldDesc.style.opacity = "0";
      oldDesc.style.transform = "translateX(-10%)";

      requestAnimationFrame(() => {
        oldTitle.style.transition = "all 0.8s ease-in-out";
        oldDesc.style.transition = "all 0.8s ease-in-out";
        oldTitle.style.opacity = "1";
        oldTitle.style.transform = "translateX(0)";
        oldDesc.style.opacity = "1";
        oldDesc.style.transform = "translateX(0)";
      });
    }, 200); // 200ms فاصله برای نرم بودن حرکت متن نسبت به تصویر
  }

  // تغییر وضعیت بنر و دکمه‌ها
  if (bannerWrapper) {
    bannerWrapper.classList.remove("banner_comming_soon");
    if (game.status === "coming_soon") bannerWrapper.classList.add("banner_comming_soon");
  }

  if (watchBtn) {
    if (game.status === "coming_soon") {
      watchBtn.textContent = "coming soon";
      watchBtn.onclick = null;
      watchBtn.classList.add("disabled_btn");
    } else {
      watchBtn.textContent = "مشاهده تورنومنت";
      watchBtn.classList.remove("disabled_btn");
      watchBtn.onclick = () => window.location.href = `game-touranments.html?id=${game.id}`;
    }
  }
}


    

    // بنر اولیه
    showBanner(games[0]);

    // ساخت لیست دسکتاپ/تبلت
    if (gameList) {
      gameList.innerHTML = "";
      games.forEach((game, index) => {
        const gameImage =
          game.images?.find(img => img.image_type === "game_image")?.image ||
          DEFAULT_SMALL_IMG;

        const gameItem = document.createElement("div");
        gameItem.className = "game_list_item";
        if (index === 0) gameItem.classList.add("list_item_active");

        if (game.status === "coming_soon") {
          gameItem.classList.add("list_comming_soon");
        }

        const imgDiv = document.createElement("div");
        imgDiv.className = "game_list_img";
        const img = document.createElement("img");
        img.src = gameImage;
        img.alt = game.name || "game";
        imgDiv.appendChild(img);

        const titleDiv = document.createElement("div");
        titleDiv.className = "game_list_tilte";
        titleDiv.textContent = game.name || "";

        gameItem.appendChild(imgDiv);
        gameItem.appendChild(titleDiv);

        gameItem.addEventListener("click", () => {
          // به جای فقط clear کردن interval، آن را restart می‌کنیم تا گیر نکند
          startAutoSlide();
          setActiveItem(index);
          if (mobileSlider && isInViewport(mobileSlider)) {
            scrollMobileTo(index);
          }
        });

        gameList.appendChild(gameItem);
        gameItems.push(gameItem);
      });
    }

    /*** ------------------- توابع کمکی ------------------- ***/
    function setActiveItem(index) {
      // محافظت از ایندکس‌ها
      if (!Array.isArray(games) || index == null) return;
      if (index < 0 || index >= games.length) return;

      if (gameItems.length) {
        gameItems.forEach(item => item.classList.remove("list_item_active"));
        if (gameItems[index]) gameItems[index].classList.add("list_item_active");
      }

      // محافظت بیشتر برای showBanner
      try {
        showBanner(games[index]);
      } catch (err) {
        console.error("خطا در showBanner:", err);
      }

      currentIndex = index;
    }

    function isInViewport(element) {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
             rect.bottom > 0;
    }

    function scrollMobileTo(index) {
      const el = mobileSlides[index];
      if (!el) return;
      try {
        el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      } catch (e) {
        // بعضی مرورگرها inline: "center" رو درست پشتیبانی نمیکنن — در صورت نیاز میشه جایگزین کرد
        try {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch (err) {
          console.error("خطا در scrollIntoView:", err);
        }
      }
    }

    /*** ------------------- موبایل ------------------- ***/
    const mobileSlider = document.querySelector(".mobile_slider_container");

    if (mobileSlider) {
      mobileSlider.innerHTML = "";
      const frag = document.createDocumentFragment();

      games.forEach((game, index) => {
        const slide = document.createElement("div");
        slide.className = "mobile_slide";

        if (game.status === "coming_soon") {
          slide.classList.add("banner_comming_soon");
        }

        const gameBanner =
          game.images?.find(img => img.image_type === "hero_banner")?.image ||
          game.images?.[0]?.image ||
          DEFAULT_BANNER_IMG;

        slide.innerHTML = `
          <div class="mobile_game_banner"><img src="${gameBanner}" alt="${game.name || "banner"}"></div>
          <div class="mobile_banner_content">
            <div class="m_content_top">
              <div class="mobile_join_link">
                <button type="button">${game.status === "coming_soon" ? "coming soon" : "مشاهده تورنومنت"}</button>
              </div>
            </div>
            <div class="m_content_bottom">
              <div class="mobilr_content_title"><span>${game.name || ""}</span></div>
              <div class="mobile_content_description"><span>${game.description || "بدون توضیحات"}</span></div>
              <div class="mobile_content_user_count"><span>${game.users_count ?? 0} بازیکن</span></div>
            </div>
          </div>
        `;

        const joinBtn = slide.querySelector(".mobile_join_link button");
        if (joinBtn) {
          if (game.status === "coming_soon") {
            joinBtn.classList.add("disabled_btn"); // دکمه غیرفعال
            joinBtn.onclick = null;
          } else {
            joinBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              window.location.href = `game-touranments.html?id=${game.id}`;
            });
          }
        }

        slide.addEventListener("click", () => {
          startAutoSlide(); // restart اسلاید خودکار تا گیر نکنه
          setActiveItem(index);
          scrollMobileTo(index);
        });

        frag.appendChild(slide);
        mobileSlides.push(slide);
      });

      mobileSlider.appendChild(frag);
    }

    /*** ------------------- مدیریت اسلاید خودکار (اصلاح شده) ------------------- ***/
    function stopAutoSlide() {
      if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
        autoSlideInterval = null;
      }
    }

    function startAutoSlide() {
      // همیشه ابتدا قبلی رو قطع کن تا چندتایی setInterval ایجاد نشه
      stopAutoSlide();
      if (!Array.isArray(games) || games.length <= 1) return;

      autoSlideInterval = setInterval(() => {
        try {
          currentIndex = (currentIndex + 1) % games.length;
          setActiveItem(currentIndex);
          if (mobileSlider && isInViewport(mobileSlider)) {
            scrollMobileTo(currentIndex);
          }
        } catch (err) {
          // اگر خطایی در callback افتاد، لاگ کن و اسلاید خودکار را امن متوقف کن
          console.error("خطا در اسلاید خودکار:", err);
          stopAutoSlide();
        }
      }, 4000);
    }

    // شروع اولیه اسلاید
    startAutoSlide();

    // visibilitychange به روش متمرکز شده
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // وقتی تب مخفی شد، اسلاید رو متوقف کن
        stopAutoSlide();
      } else {
        // وقتی تب بازگشت، اسلاید را با ایمن شروع کن
        startAutoSlide();
      }
    });

  } catch (e) {
    console.error("خطا در دریافت بازی‌ها:", e);
  }
})();
