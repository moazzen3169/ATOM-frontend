async function loadGames() {
    try {
        const response = await fetch("https://atom-game.ir/api/tournaments/games/");
        const games = await response.json();

        const container = document.getElementById("games_container");
        if (!container) return;
        container.innerHTML = ""; // خالی کردن قبل از پر کردن

        // مرتب کردن بازی‌ها: اول غیر coming_soon، آخر coming_soon
        const sortedGames = [...games].sort((a, b) => {
            if (a.status === "coming_soon" && b.status !== "coming_soon") return 1;
            if (a.status !== "coming_soon" && b.status === "coming_soon") return -1;
            return 0;
        });

        // ساختن کارت‌ها
        sortedGames.forEach(game => {
            const banner = game.images?.find(img => img.image_type === "hero_banner")?.image || "img/default.jpg";

            const gameItem = document.createElement("div");
            gameItem.classList.add("game_item");
            if (game.status === "coming_soon") gameItem.classList.add("comming-soon");

            const activeTournaments = game.tournaments_count?.active || 0;
            const heldTournaments = game.tournaments_count?.held || 0;

            gameItem.innerHTML = `
                <div class="game_image">
                    <img src="${banner}" alt="${game.name}">
                </div>
                <div class="game_content">
                    <div class="game_title">
                        <span>${game.name}</span>
                        ${game.status === "coming_soon" ? `<span> (coming soon)</span>` : ""}
                    </div>
                    ${game.status !== "coming_soon" ? `
                        <div class="game_live_tournaments_count">
                            <span>تعداد تورنومنت های فعال: </span><span>${activeTournaments}</span>
                        </div>
                        <div class="game_all_tournaments_count">
                            <span>تورنومنت های پایان یافته: </span><span>${heldTournaments}</span>
                        </div>
                    ` : ""}
                </div>
                ${
                    game.status === "coming_soon"
                        ? `<span class="game_link disabled">بزودی...</span>`
                        : `<a href="game-touranments.html?id=${game.id}" class="game_link">+ مشاهده تورنومنت</a>`
                }
            `;

            container.appendChild(gameItem);
        });

    } catch (error) {
        console.error("خطا در گرفتن دیتا:", error);
    }
}

loadGames();
