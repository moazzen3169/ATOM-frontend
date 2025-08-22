(async function () {
  try {
    // دریافت لیست بازی‌ها بدون لاگین و توکن
    const gamesRes = await fetch("https://atom-game.ir/api/tournaments/games/");
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

  } catch (e) {
    console.error("خطا در دریافت بازی‌ها:", e);
  }
})();
