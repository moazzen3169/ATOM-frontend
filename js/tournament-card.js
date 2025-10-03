// ---------------------- تابع نمایش کارت تورنمنت ----------------------
function renderTournamentCard(tournament, containerId = "grid-container-tournaments") {
    const container = document.getElementById(containerId);
    if (!container) return;

    // جلوگیری از اضافه شدن کارت تکراری
    if (document.getElementById(`tournament-${tournament.id}`)) return;

    // انتخاب تصویر اصلی تورنومنت یا fallback به تصویر بازی
    let banner = "img/banner2.jpg"; // تصویر پیش‌فرض
    if (tournament.image?.image) {
        banner = tournament.image.image; // تصویر خود تورنومنت
    } else if (Array.isArray(tournament.game?.images) && tournament.game.images.length > 0) {
        const hero = tournament.game.images.find(img => img.image_type === "hero_banner");
        banner = hero?.image || tournament.game.images[0].image; // fallback تصویر بازی
    }

    const start = new Date(tournament.start_date);
    const end = new Date(tournament.end_date);
    const now = new Date();

    const timeStr = start.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    const dateStr = start.toLocaleDateString("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const price = tournament.is_free ? "رایگان" : (Number(tournament.entry_fee).toLocaleString("fa-IR") + " تومان");

    const div = document.createElement("div");
    div.className = "cart_container";
    div.id = `tournament-${tournament.id}`;
    div.innerHTML = `
        <div class="cart_top">
            <div class="cart_image">
                <img src="${banner}" alt="banner" loading="lazy">
                <div class="cart_countdown_game">
                    <div class="cart_countdown">
                        <img src="img/icons/clock.svg" alt="clock">
                        <span class="countdown-timer" 
                              data-start="${tournament.start_date}" 
                              data-end="${tournament.end_date}" 
                              data-countdown="${tournament.start_countdown}">
                            ${timeRemaining(tournament.start_countdown, tournament.start_date, tournament.end_date)}
                        </span>
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

    const joinBtn = div.querySelector(".cart_join");
    if (now >= end) {
        joinBtn.textContent = "دیدن نتایج";
        joinBtn.addEventListener("click", () => showResultPopup(tournament));
    } else {
        joinBtn.textContent = "اضافه شو!";
        joinBtn.addEventListener("click", () => {
            window.location.href = `/game-loby.html?id=${tournament.id}`;
        });
    }
}

// ---------------------- تابع محاسبه زمان باقی‌مانده ----------------------
function timeRemaining(startCountdown, startDate, endDate) {
    const now = new Date();
    const countdownTime = new Date(startCountdown);
    const startTime = new Date(startDate);
    const endTime = new Date(endDate);

    if (now < countdownTime) {
        return countdownTime.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    }
    if (now >= countdownTime && now < startTime) {
        const diff = startTime - now;
        return formatDiff(diff);
    }
    if (now >= startTime && now < endTime) {
        return "شروع شده";
    }
    if (now >= endTime) {
        return "پایان یافته";
    }
    return "-";
}

// ---------------------- فرمت زمان (HH : MM : SS) ----------------------
function formatDiff(diff) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2,"0")} : ${mins.toString().padStart(2,"0")} : ${secs.toString().padStart(2,"0")}`;
}

// ---------------------- مدیریت به روزرسانی شمارش معکوس ----------------------
function updateAllCountdowns() {
    const countdownElements = document.querySelectorAll('.countdown-timer');
    countdownElements.forEach(el => {
        const start = el.dataset.start;
        const end = el.dataset.end;
        const countdown = el.dataset.countdown;
        el.textContent = timeRemaining(countdown, start, end);
    });
}

// ---------------------- راه اندازی اولیه ----------------------
document.addEventListener('DOMContentLoaded', () => {
    setInterval(updateAllCountdowns, 1000);
});
