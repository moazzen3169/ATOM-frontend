    async function loadTournament() {
        try {
            // گرفتن آیدی از URL
            const urlParams = new URLSearchParams(window.location.search);
            const tournamentId = urlParams.get("id");
            if (!tournamentId) {
                console.error("Tournament ID missing in URL");
                return;
            }
    
            // دریافت اطلاعات از API
            const response = await fetch(`https://atom-game.ir/api/tournaments/tournaments/${tournamentId}/`);
            if (!response.ok) throw new Error("API request failed");
    
            const tournament = await response.json();
            if (!tournament) {
                console.error("Tournament not found");
                return;
            }
    
            // تبدیل تاریخ‌ها
            const now = new Date();
            const startDate = new Date(tournament.start_date);
            const endDate = new Date(tournament.end_date || startDate);
    
            // حالت نمایش تاریخ (فقط تاریخ یا تاریخ+ساعت)
            const dateOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
            const dateTimeOptions = { ...dateOptions, hour: "2-digit", minute: "2-digit" };
    
            // نمایش تاریخ شروع
            if (now >= startDate) {
                // فقط تاریخ
                document.getElementById("start_time").textContent = startDate.toLocaleDateString(undefined, dateOptions);
            } else {
                // تاریخ + ساعت
                document.getElementById("start_time").textContent = startDate.toLocaleString(undefined, dateTimeOptions);
            }
    
            // تاریخ پایان همیشه با ساعت
            document.getElementById("end_time").textContent = endDate.toLocaleString(undefined, dateTimeOptions);
    
            // حالت تورنومنت
            document.getElementById("tournament_mode").textContent =
                tournament.type === "team"
                    ? `تیمی (هر تیم ${tournament.team_size} نفر)`
                    : tournament.type;
    
            // سمت چپ: بنر
            if (tournament.image?.image) {
                document.getElementById("tournament_banner").src = tournament.image.image;
            }
    
// مجموع جوایز و عنوان
const prize = Number(tournament.prize_pool) || 0;
document.getElementById("prize_pool").textContent = 
    prize.toLocaleString("fa-IR") + " تومان";

document.getElementById("tournament_title").textContent = tournament.name;

            // بخش خلاصه اطلاعات: شمارش معکوس یا تاریخ شروع
            const signupTimeEl = document.getElementById("signup_time");
    
            function updateSignupCountdown() {
                const diff = startDate - new Date();
    
                if (diff > 0) {
                    const hours = String(Math.floor(diff / 1000 / 3600)).padStart(2, "0");
                    const minutes = String(Math.floor((diff / 1000 % 3600) / 60)).padStart(2, "0");
                    const seconds = String(Math.floor(diff / 1000 % 60)).padStart(2, "0");
                    signupTimeEl.textContent = ` ${hours}:${minutes}:${seconds}`;
                } else {
                    // بعد از شروع: فقط تاریخ
                    signupTimeEl.textContent = ` ${startDate.toLocaleDateString(undefined, dateOptions)}`;
                    clearInterval(timer);
                }
            }
    
            // اجرای شمارش معکوس فقط اگر هنوز شروع نشده
            if (now < startDate) {
                var timer = setInterval(updateSignupCountdown, 1000);
                updateSignupCountdown();
            } else {
                signupTimeEl.textContent = ` ${startDate.toLocaleDateString(undefined, dateOptions)}`;
            }
    
        } catch (err) {
            console.error("Error loading tournament:", err);
        }
    }
    
    loadTournament();
    