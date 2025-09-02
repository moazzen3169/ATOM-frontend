// ---------------------- تنظیمات صفحه بندی ----------------------
let currentPage = 1;
let pageSize = 9;
let ordering = "start_date"; // پیش‌فرض: بر اساس تاریخ شروع صعودی

// ---------------------- تابع بارگذاری تورنمنت‌ها ----------------------
async function loadTournaments(page = 1) {
    const container = document.getElementById("grid-container-tournaments");
    container.innerHTML = '<div class="loading">در حال بارگذاری تورنمنت‌ها...</div>';

    try {
        const response = await fetch(
            `https://atom-game.ir/api/tournaments/tournaments/?page=${page}&page_size=${pageSize}&ordering=${ordering}`
        );

        if (!response.ok) throw new Error("خطا در دریافت اطلاعات تورنمنت‌ها");

        const data = await response.json();
        const tournaments = data.results || [];

        container.innerHTML = ""; // پاک کردن محتوا قبل از رندر جدید

        if (tournaments.length === 0) {
            container.innerHTML = "<p class='eror'>هیچ تورنمنتی یافت نشد.</p>";
            return;
        }

        tournaments.forEach(t => {
            renderTournamentCard(t, "grid-container-tournaments");
        });

        renderPagination(data);

    } catch (error) {
        container.innerHTML = `<p class="eror">${error.message}</p>`;
    }
}

function renderPagination(data) {
    const paginationWrapper = document.querySelector(".Pagination");
    if (!paginationWrapper) return;

    paginationWrapper.innerHTML = ""; // پاک کردن محتوای قبلی

    const totalPages = Math.ceil(data.count / pageSize);

    // دکمه قبلی
    const prevBtn = document.createElement("button");
    prevBtn.className = "Previous";
    prevBtn.innerHTML = `قبلی 
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 20 20" fill="#ffffff">
            <path fill="#ffffff" fill-rule="evenodd" d="m7.053 2.158l7.243 7.256a.66.66 0 0 1 .204.483a.705.705 0 0 1-.204.497c-2.62 2.556-5.145 5.023-7.575 7.401c-.125.117-.625.408-1.011-.024c-.386-.433-.152-.81 0-.966l7.068-6.908l-6.747-6.759c-.246-.339-.226-.652.06-.939c.286-.287.607-.3.962-.04Z"/>
        </svg>`;

    if (!data.previous) {
        prevBtn.classList.add("disabled"); // استایل غیرفعال
    } else {
        prevBtn.onclick = () => {
            currentPage--;
            loadTournaments(currentPage);
        };
    }
    paginationWrapper.appendChild(prevBtn);

    // شماره صفحات
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (endPage - startPage < maxPagesToShow - 1) {
        if (startPage === 1) {
            endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        } else if (endPage === totalPages) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageLink = document.createElement("a");
        pageLink.className = "page_number";
        pageLink.textContent = i;
        pageLink.href = "#";
        if (i === currentPage) {
            pageLink.classList.add("active"); // صفحه فعال
        }
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
    nextBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 20 20" fill="#ffffff">
            <path fill="#ffffff" fill-rule="evenodd" d="M7.222 9.897c2.3-2.307 4.548-4.559 6.744-6.754a.65.65 0 0 0 0-.896c-.311-.346-.803-.316-1.027-.08c-2.276 2.282-4.657 4.667-7.143 7.156c-.197.162-.296.354-.296.574c0 .221.099.418.296.592l7.483 7.306a.749.749 0 0 0 1.044-.029c.358-.359.22-.713.058-.881a3407.721 3407.721 0 0 1-7.16-6.988Z"/>
        </svg> بعدی`;

    if (!data.next) {
        nextBtn.classList.add("disabled"); // استایل غیرفعال
    } else {
        nextBtn.onclick = () => {
            currentPage++;
            loadTournaments(currentPage);
        };
    }
    paginationWrapper.appendChild(nextBtn);
}

// ---------------------- شروع اولیه ----------------------
document.addEventListener("DOMContentLoaded", () => {
    loadTournaments(currentPage);
});
