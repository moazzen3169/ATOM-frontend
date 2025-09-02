  // ---------------------- مدیریت کش ----------------------
  const tournamentCache = {
    key: 'tournaments_data',
    expiry: 5 * 60 * 1000, // 5 دقیقه
    get: function() {
        const item = localStorage.getItem(this.key);
        if (!item) return null;
        
        const data = JSON.parse(item);
        if (Date.now() > data.expiry) {
            localStorage.removeItem(this.key);
            return null;
        }
        
        return data.tournaments;
    },
    set: function(tournaments) {
        const item = {
            tournaments: tournaments,
            expiry: Date.now() + this.expiry
        };
        localStorage.setItem(this.key, JSON.stringify(item));
    }
};

// ---------------------- تابع اصلی بارگذاری تورنمنت‌ها ----------------------
async function loadTournaments(limit = null) {
    const container = document.getElementById("grid-container-tournaments");
    
    // نمایش وضعیت بارگذاری
    container.innerHTML = '<div class="loading">در حال بارگذاری تورنمنت‌ها...</div>';
    
    // بررسی کش اولیه
    const cachedData = tournamentCache.get();
    if (cachedData) {
        renderTournaments(cachedData, limit);
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // تایم‌اوت 10 ثانیه
        
        const response = await fetch("https://atom-game.ir/api/tournaments/tournaments/", {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error("خطا در دریافت اطلاعات تورنمنت‌ها");
        }
        
        let tournaments = await response.json();
        if (!Array.isArray(tournaments)) {
            tournaments = tournaments.results || tournaments.data || [tournaments];
        }
        
        // ذخیره در کش
        tournamentCache.set(tournaments);
        
        // رندر تورنمنت‌ها
        renderTournaments(tournaments, limit);
        
    } catch (err) {
        if (err.name === 'AbortError') {
            if (!container.querySelector('.cart_container') && !cachedData) {
                container.innerHTML = `<p class="eror">اتصال به سرور طول کشید. لطفا دوباره تلاش کنید.</p>`;
            }
        } else if (!container.querySelector('.cart_container')) {
            container.innerHTML = `<p class="eror">${err.message}</p>`;
        }
    }
}

// ---------------------- تابع رندر تورنمنت‌ها ----------------------
function renderTournaments(tournaments, limit) {
    const container = document.getElementById("grid-container-tournaments");
    
    // مرتب‌سازی بر اساس تاریخ شروع (جدیدترین اول)
    tournaments.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
    
    // اعمال محدودیت تعداد نمایش
    if (limit) tournaments = tournaments.slice(0, limit);
    
    // پاک کردن محتوای قبلی فقط اگر هیچ کارتی وجود ندارد
    if (!container.querySelector('.cart_container')) {
        container.innerHTML = '';
    }
    
    // ایجاد کارت‌های تورنمنت
    tournaments.forEach(tournament => {
        // بررسی وجود قبلی کارت برای جلوگیری از تکرار
        if (document.getElementById(`tournament-${tournament.id}`)) return;
        
        // انتخاب بنر
        let banner = "img/banner2.jpg";
        if (tournament.image?.image) {
            banner = tournament.image.image;
        } else if (Array.isArray(tournament.game?.images) && tournament.game.images.length > 0) {
            const hero = tournament.game.images.find(img => img.image_type === "hero_banner");
            banner = hero?.image || tournament.game.images[0].image;
        }
        
        const start = new Date(tournament.start_date);
        const end = new Date(tournament.end_date);
        const now = new Date();
        
        const timeStr = start.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
        const dateStr = start.toLocaleDateString("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
        const price = tournament.is_free ? "رایگان" : (Number(tournament.entry_fee).toLocaleString("fa-IR") + " تومان");
        
        // ساخت کارت تورنمنت
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
                            <span>${timeRemaining(tournament.start_countdown, tournament.start_date, tournament.end_date)}</span>
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
        
        // تعیین متن و عملکرد دکمه
        const joinBtn = div.querySelector(".cart_join");
        if (now >= end) {
            joinBtn.textContent = "دیدن نتایج";
            joinBtn.addEventListener("click", () => {
                showResultPopup(tournament);
            });
        } else {
            joinBtn.textContent = "اضافه شو!";
            joinBtn.addEventListener("click", () => {
                window.location.href = `game-loby.html?id=${tournament.id}`;
            });
        }
    });
    
    // اگر هیچ تورنمنتی وجود ندارد
    if (tournaments.length === 0 && container.innerHTML === '') {
        container.innerHTML = '<p class="eror">هیچ تورنمنتی یافت نشد.</p>';
    }
}



// ---------------------- تابع نمایش زمان باقی‌مانده ----------------------
function timeRemaining(startCountdown, startDate, endDate) {
    const now = new Date();
    const countdownTime = new Date(startCountdown);
    const startTime = new Date(startDate);
    const endTime = new Date(endDate);
    
    // قبل از شروع شمارش معکوس
    if (now < countdownTime) {
        return countdownTime.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    }
    
    // بین start_countdown و start_date
    if (now >= countdownTime && now < startTime) {
        const diff = startTime - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        return `${hours.toString().padStart(2,"0")} : ${mins.toString().padStart(2,"0")} : ${secs.toString().padStart(2,"0")}`;
    }
    
    // بین start_date و end_date
    if (now >= startTime && now < endTime) {
        return "شروع شده";
    }
    
    // بعد از پایان
    if (now >= endTime) {
        return "پایان یافته";
    }
    
    return "-";
}

// ---------------------- مدیریت به روزرسانی زمان‌های شمارش معکوس ----------------------
function updateAllCountdowns() {
    const countdownElements = document.querySelectorAll('.cart_countdown span');
    countdownElements.forEach(element => {
        // اینجا باید اطلاعات مربوط به هر تورنمنت را ذخیره کرده باشید
        // برای سادگی، فرض می‌کنیم داده‌ها را در dataset ذخیره کرده‌اید
        const tournamentId = element.closest('.cart_container').id.replace('tournament-', '');
        // در واقعیت، باید داده‌های تورنمنت را از کش یا state برنامه بازیابی کنید
        // این یک پیاده‌سازی ساده است
        const text = element.textContent;
        if (text.includes(':')) {
            // کاهش زمان به صورت مصنوعی
            const parts = text.split(' : ');
            let hours = parseInt(parts[0]);
            let mins = parseInt(parts[1]);
            let secs = parseInt(parts[2]);
            
            secs--;
            if (secs < 0) {
                secs = 59;
                mins--;
                if (mins < 0) {
                    mins = 59;
                    hours--;
                    if (hours < 0) {
                        element.textContent = "شروع شده";
                        return;
                    }
                }
            }
            
            element.textContent = `${hours.toString().padStart(2,"0")} : ${mins.toString().padStart(2,"0")} : ${secs.toString().padStart(2,"0")}`;
        }
    });
}

// ---------------------- راه اندازی اولیه ----------------------
document.addEventListener('DOMContentLoaded', () => {
    // بارگذاری اولیه تورنمنت‌ها
    
    // تنظیم به روزرسانی دوره‌ای برای شمارش معکوس
    setInterval(updateAllCountdowns, 1000);
    
    // مدیریت دکمه رفرش
    document.getElementById('refresh-btn').addEventListener('click', () => {
        // پاک کردن کش برای دریافت داده‌های تازه
        localStorage.removeItem('tournaments_data');
    });
});