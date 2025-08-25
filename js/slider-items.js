(async function () {
  try {
    // دریافت لیست بازی‌ها
    const gamesRes = await fetch("https://atom-game.ir/api/tournaments/games/");
    const games = await gamesRes.json();
    if (!Array.isArray(games) || games.length === 0) return;

    /*** ------------------- دسکتاپ / تبلت ------------------- ***/
    const gameList = document.querySelector(".game_list");
    const heroImg = document.querySelector(".game_bg img");
    const bannerTitle = document.querySelector(".game_banner_title span");
    const bannerDesc = document.querySelector(".game_banner_description span");
    const watchBtn = document.querySelector(".watch_tourament"); // دکمه دسکتاپ

    function showBanner(game) {
      const heroBanner =
        game.images?.find(img => img.image_type === "hero_banner")?.image ||
        game.images?.[0]?.image ||
        "";
      heroImg.src = heroBanner;
      bannerTitle.textContent = game.name || "";
      bannerDesc.textContent = game.description || "بدون توضیحات";

      // آپدیت کردن اکشن دکمه دسکتاپ
      if (watchBtn) {
        watchBtn.onclick = () => {
          window.location.href = `game-touranments.html?id=${game.id}`;
        };
      }
    }

    showBanner(games[0]);

    gameList.innerHTML = "";
    const gameItems = [];

    games.forEach((game, index) => {
      const gameImage =
        game.images?.find(img => img.image_type === "game_image")?.image ||
        "https://via.placeholder.com/42x64?text=No+Image";

      const gameItem = document.createElement("div");
      gameItem.className = "game_list_item";
      if (index === 0) gameItem.classList.add("list_item_active");

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
        clearInterval(autoSlideInterval);
        setActiveItem(index);
        scrollMobileTo(index);
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

    /*** ------------------- موبایل (کنار هم افقی) ------------------- ***/
    const mobileSlider = document.querySelector(".mobile_slider_container");
    const mobileSlides = [];
    if (mobileSlider) {
      mobileSlider.innerHTML = ""; // حذف نمونه اولیه HTML

      const frag = document.createDocumentFragment();

      games.forEach((game, index) => {
        const slide = document.createElement("div");
        slide.className = "mobile_slide";

        const gameBanner =
          game.images?.find(img => img.image_type === "hero_banner")?.image ||
          game.images?.[0]?.image ||
          "https://via.placeholder.com/600x300?text=No+Image";

        slide.innerHTML = `
          <div class="mobile_game_banner"><img src="${gameBanner}" alt="${game.name || "banner"}"></div>
          <div class="mobile_banner_content">
            <div class="m_content_top">
              <div class="mobile_join_link">
                <button type="button"><img src="img/icons/plus.svg" alt="join"></button>
              </div>
            </div>
            <div class="m_content_bottom">
              <div class="mobilr_content_title"><span>${game.name || ""}</span></div>
              <div class="mobile_content_description"><span>${game.description || "بدون توضیحات"}</span></div>
              <div class="mobile_content_user_count"><span>${game.users_count ?? 0} بازیکن</span></div>
            </div>
          </div>
        `;

        // 🎯 هندل کردن کلیک روی دکمه موبایل
        const joinBtn = slide.querySelector(".mobile_join_link button");
        if (joinBtn) {
          joinBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // جلوگیری از تریگر شدن کلیک روی کل کارت
            window.location.href = `game-touranments.html?id=${game.id}`;
          });
        }

        // کلیک روی کل کارت موبایل -> هم دسکتاپ آپدیت بشه
        slide.addEventListener("click", () => {
          clearInterval(autoSlideInterval);
          setActiveItem(index);
          scrollMobileTo(index);
        });

        frag.appendChild(slide);
        mobileSlides.push(slide);
      });

      mobileSlider.appendChild(frag);
    }

    // اسکرول به اسلاید موبایل متناظر
    function scrollMobileTo(index) {
      const el = mobileSlides[index];
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }

    /*** ------------------- اسلاید خودکار ------------------- ***/
    const autoSlideInterval = setInterval(() => {
      currentIndex = (currentIndex + 1) % gameItems.length;
      setActiveItem(currentIndex);
      scrollMobileTo(currentIndex);
    }, 4000);
  } catch (e) {
    console.error("خطا در دریافت بازی‌ها:", e);
  }
})();
