// گرفتن gameId از URL
const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get("id");

// ---------------------- 1. گرفتن اطلاعات بازی و تورنمنت‌ها ----------------------
async function loadDataOnce() {
    try {
        // درخواست همزمان بازی و تورنمنت‌ها
        const [gameRes, tournamentsRes] = await Promise.all([
            fetch(`https://atom-game.ir/api/tournaments/games/${gameId}/`),
            fetch(`https://atom-game.ir/api/tournaments/tournaments/?game=${gameId}`)
        ]);

        if (!gameRes.ok || !tournamentsRes.ok) throw new Error("خطا در دریافت اطلاعات");

        const gameData = await gameRes.json();
        let tournamentsData = await tournamentsRes.json();
        tournamentsData = Array.isArray(tournamentsData) ? tournamentsData : (tournamentsData.results || tournamentsData.data || []);

        // ---------------------- نمایش بنر و توضیحات بازی ----------------------
        const defaultBanner = "img/banner9.jpg";
        let banner = defaultBanner;
        if (gameData.images?.length) {
            const hero = gameData.images.find(img => img.image_type === "hero_banner");
            banner = hero ? hero.image : gameData.images[0].image;
        }
        document.getElementById("hero_banner").src = banner;
        const nameSpans = document.querySelectorAll("#game_name span");
        if(nameSpans[0]) nameSpans[0].textContent = gameData.name;
        const descSpan = document.querySelector("#game_description span");
        if(descSpan) descSpan.textContent = gameData.description || "توضیحی موجود نیست";

        // ---------------------- نمایش تورنمنت‌ها ----------------------
        const liveBox = document.getElementById("live_tournaments");
        const upcomingBox = document.getElementById("upcoming_tournaments");
        const finishedBox = document.getElementById("finished_tournaments");
        [liveBox, upcomingBox, finishedBox].forEach(box => box.innerHTML = "");

        const now = new Date();
        tournamentsData.forEach(t => {
            const start = new Date(t.start_date);
            const end = new Date(t.end_date);
            const countdownStart = t.countdown_start_time ? new Date(t.countdown_start_time) : start;

            if (end <= now) finishedBox.appendChild(createTournamentCard(t, false, true));
            else if (start <= now && end > now) liveBox.appendChild(createTournamentCard(t, true));
            else upcomingBox.appendChild(createTournamentCard(t, false, false, countdownStart));
        });

        startCountdowns();
        hideSectionIfEmpty(liveBox, "live");
        hideSectionIfEmpty(upcomingBox, "upcoming");
        hideSectionIfEmpty(finishedBox, "finished");

    } catch (err) {
        console.error(err);
    }
}

// ---------------------- 2. مخفی کردن بخش‌ها ----------------------
function hideSectionIfEmpty(container, titrId) {
    const titr = document.getElementById(titrId);
    if (!container.children.length) {
        titr.style.display = "none";
        container.style.display = "none";
    } else {
        titr.style.display = "flex"; 
        container.style.display = "grid"; 
    }
}

// ---------------------- 3. ساخت کارت تورنومنت ----------------------
function createTournamentCard(t, isLive = false, isFinished = false, countdownStart = null) {
    const div = document.createElement("div");
    div.className = isLive ? "live_tournament_cart" : "cart_container";

    // انتخاب تصویر کارت
    let banner = t.image?.image || "img/banner2.jpg";
    if (!t.image?.image && Array.isArray(t.game?.images) && t.game.images.length > 0) {
        const hero = t.game.images.find(img => img.image_type === "hero_banner");
        banner = hero?.image || t.game.images[0].image;
    }

    const start = new Date(t.start_date);
    const timeStr = start.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    const dateStr = start.toLocaleDateString("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const price = t.is_free ? "رایگان" : (Number(t.entry_fee).toLocaleString("fa-IR") + " تومان");

    let registered = t.type === "team" ? (t.teams?.length || 0) : (t.participants?.length || 0);
    let capacity = t.max_participants || 1;
    if (t.type === "team") capacity = t.max_participants / (t.team_size || 1);
    const percent = capacity ? (registered / capacity) * 100 : 0;

    if (isLive) {
        div.innerHTML = `
            <div class="live_right">
                <div class="live_game_name">
                    <h3>${t.game?.name || "-"}</h3>
                    <div class="live"><span></span><span>زنده</span></div>
                </div>
                <div class="live_title"><span>${t.name}</span></div>
                <div class="live_info">
                    <div class="live_info_date">
                        <img src="img/icons/tagvim.svg" alt="date">
                        <span>${dateStr}</span>
                    </div>
                    <div class="info_sign_price">
                        <img src="img/icons/money.svg" alt="money">
                        <span>هزینه ورود :</span><span>${price}</span>
                    </div>
                </div>
            </div>
            <div class="live_left">
                <div class="live_award">
                    <span>مجموع جوایز</span>
                    <h3 class="award_money">${t.prize_won || "نامشخص"}</h3>
                </div>
                <button class="live_join_link">
                    <img src="img/icons/plus.svg" alt="+"> اضافه شو!
                </button>
            </div>
            <div class="bottom">
                <div class="live-game-mode">
                    <img src="img/icons/users.svg" alt="mode">
                    <span>${t.type === "team" ? "بازی تیمی" : "بازی انفرادی"}</span>
                </div>
                <div class="team-text"> ${registered} / ${capacity}</div>
                <div class="line-bar-container">
                    <div class="progress-line">
                        <div class="progress-fill" style="width:${percent}%"></div>
                    </div>
                </div>
            </div>
        `;
        div.querySelector(".live_join_link").addEventListener("click", () => {
            window.location.href = `game-loby.html?id=${t.id}`;
        });
    } else if (isFinished) {
        div.innerHTML = `
            <div class="cart_top">
                <div class="cart_image">
                    <img src="${banner}" alt="banner">
                    <div class="cart_countdown_game">
                        <div class="cart_countdown">
                            <span>تمام شده</span>
                        </div>
                        <div class="cart_game_name">
                            <span>${t.game?.name || "-"}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="cart_middle">
                <div class="cart_date_time">
                    <span>${timeStr}</span>
                    <span>${dateStr}</span>
                </div>
                <div class="cart_title"><span>${t.name}</span></div>
                <div class="cart_description"><span>${t.description || ""}</span></div>
            </div>
            <div class="cart_bottom">
                <button class="cart_join">دیدن نتایج</button>
                <div class="cart_price"><span>${t.prize_won || "تمام شده"}</span></div>
            </div>
        `;
        div.querySelector(".cart_join").addEventListener("click", () => {
            window.location.href = `tournament-results.html?id=${t.id}`;
        });
    } else {
        div.innerHTML = `
            <div class="cart_top">
                <div class="cart_image">
                    <img src="${banner}" alt="banner">
                    <div class="cart_countdown_game">
                        <div class="cart_countdown">
                            <span class="countdown" data-start="${t.start_date}" data-countdown-start="${countdownStart.toISOString()}"></span>
                        </div>
                        <div class="cart_game_name">
                            <span>${t.game?.name || "-"}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="cart_middle">
                <div class="cart_date_time">
                    <span>${timeStr}</span>
                    <span>${dateStr}</span>
                </div>
                <div class="cart_title"><span>${t.name}</span></div>
                <div class="cart_description"><span>${t.description || ""}</span></div>
            </div>
            <div class="cart_bottom">
                <button class="cart_join">اضافه شو!</button>
                <div class="cart_price"><span>${price}</span></div>
            </div>
        `;
        div.querySelector(".cart_join").addEventListener("click", () => {
            window.location.href = `game-loby.html?id=${t.id}`;
        });
    }

    return div;
}

// ---------------------- 4. مدیریت نمایش شمارش معکوس ----------------------
function displayCountdown(startDate, countdownStart) {
    const now = new Date();
    const start = new Date(startDate);
    const countdown = new Date(countdownStart);

    if (now < countdown) return countdown.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    if (now >= start) return "شروع شده";

    const diff = start - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2,"0")} : ${mins.toString().padStart(2,"0")} : ${secs.toString().padStart(2,"0")}`;
}

// ---------------------- 5. شروع شمارش معکوس ----------------------
function startCountdowns() {
    setInterval(() => {
        document.querySelectorAll(".countdown").forEach(el => {
            const start = el.dataset.start;
            const countdownStart = el.dataset.countdownStart || start;
            el.textContent = displayCountdown(start, countdownStart);
        });
    }, 1000);
}

// ---------------------- 6. اجرای اولیه ----------------------
loadDataOnce();
