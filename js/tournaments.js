// ---------------------- تنظیمات ----------------------
let currentPage = 1;
let pageSize = 9;
let ordering = "start_date"; // پیش‌فرض مرتب‌سازی
let filterType = "all";      // پیش‌فرض همه

// ---------------------- بارگذاری تورنومنت‌ها ----------------------
async function loadTournaments(page = 1) {
    const container = document.getElementById("grid-container-tournaments");
    container.innerHTML = '<p class="loading">در حال بارگذاری تورنمنت‌ها...</p>';

    try {
        const response = await fetch(
            `https://atom-game.ir/api/tournaments/tournaments/?page=${page}&page_size=${pageSize}&ordering=${ordering}`
        );

        if (!response.ok) throw new Error("خطا در دریافت اطلاعات تورنمنت‌ها");

        const data = await response.json();
        let tournaments = data.results || [];

        // ---------------------- اعمال فیلتر وضعیت ----------------------
        const now = new Date();

        tournaments = tournaments.filter(t => {
            const start = new Date(t.start_date);
            const end = new Date(t.end_date);

            if (filterType === "upcoming") return start > now;
            if (filterType === "live") return start <= now && end > now;
            if (filterType === "finished") return end <= now;
            return true; // all
        });

        // ---------------------- نمایش ----------------------
        container.innerHTML = "";

        if (tournaments.length === 0) {
            container.innerHTML = "<p class='error'>هیچ موردی یافت نشد.</p>";
            return;
        }

        tournaments.forEach(t => {
            renderTournamentCard(t, "grid-container-tournaments");
        });

        renderPagination(data);

    } catch (error) {
        container.innerHTML = `<p class="error">${error.message}</p>`;
    }
}

// ---------------------- صفحه‌بندی ----------------------
function renderPagination(data) {
    const paginationWrapper = document.querySelector(".Pagination");
    if (!paginationWrapper) return;

    paginationWrapper.innerHTML = "";
    const totalPages = Math.ceil(data.count / pageSize);

    // دکمه قبلی
    const prevBtn = document.createElement("button");
    prevBtn.className = "Previous";
    prevBtn.textContent = "قبلی";
    if (!data.previous) prevBtn.classList.add("disabled");
    else prevBtn.onclick = () => { currentPage--; loadTournaments(currentPage); };
    paginationWrapper.appendChild(prevBtn);

    // شماره صفحات
    for (let i = 1; i <= totalPages; i++) {
        const pageLink = document.createElement("a");
        pageLink.className = "page_number";
        pageLink.textContent = i;
        if (i === currentPage) pageLink.classList.add("fillter-active");
        pageLink.onclick = (e) => {
            e.preventDefault();
            currentPage = i;
            loadTournaments(currentPage);
        };
        paginationWrapper.appendChild(pageLink);
    }

    // دکمه بعدی
    const nextBtn = document.createElement("button");
    nextBtn.className = "next";
    nextBtn.textContent = "بعدی";
    if (!data.next) nextBtn.classList.add("disabled");
    else nextBtn.onclick = () => { currentPage++; loadTournaments(currentPage); };
    paginationWrapper.appendChild(nextBtn);
}

// ---------------------- فیلتر وضعیت ----------------------
function setupFilters() {
    const filterButtons = document.querySelectorAll(".filter-btn");

    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            filterButtons.forEach(b => b.classList.remove("fillter-active"));
            btn.classList.add("fillter-active");

            filterType = btn.dataset.filter;
            currentPage = 1;
            loadTournaments(currentPage);
        });
    });
}

// ---------------------- مرتب‌سازی ----------------------
function setupSorting() {
    const sortSelect = document.getElementById("sortSelect");
    sortSelect.addEventListener("change", () => {
        ordering = sortSelect.value;
        currentPage = 1;
        loadTournaments(currentPage);
    });
}

// ---------------------- شروع ----------------------
document.addEventListener("DOMContentLoaded", () => {
    setupFilters();
    setupSorting();
    loadTournaments(currentPage);
});
