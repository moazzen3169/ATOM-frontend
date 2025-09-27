// Configuration
let currentPage = 1;
const pageSize = 9;
let ordering = "start_date";
let filterType = "all";

// Load tournaments from API
async function loadTournaments(page = 1) {
    const container = document.getElementById("grid-container-tournaments");
    container.innerHTML = '<p class="loading">در حال بارگذاری تورنمنت‌ها...</p>';

    try {
        // Build URL with page, page_size, ordering, and status filter
        const url = new URL('https://atom-game.ir/api/tournaments/tournaments/');
        url.searchParams.set('page', page);
        url.searchParams.set('page_size', pageSize);
        url.searchParams.set('ordering', ordering);
        if (filterType && filterType !== 'all') {
            url.searchParams.set('status', filterType);
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error("خطا در دریافت اطلاعات تورنمنت‌ها");
        }

        const data = await response.json();
        const tournaments = data.results || [];

        container.innerHTML = "";
        if (tournaments.length === 0) {
            container.innerHTML = "<p class='error'>هیچ موردی یافت نشد.</p>";
            renderPagination(data);
            return;
        }

        tournaments.forEach(tournament => renderTournamentCard(tournament, "grid-container-tournaments"));
        renderPagination(data);

    } catch (error) {
        container.innerHTML = `<p class="error">${error.message}</p>`;
    }
}

// Render pagination controls
function renderPagination(data) {
    const paginationWrapper = document.querySelector(".Pagination");
    if (!paginationWrapper) return;

    paginationWrapper.innerHTML = "";
    const totalPages = Math.ceil((data.count || 0) / pageSize);
    if (totalPages <= 1) return;

    // Previous button
    const prevBtn = document.createElement("button");
    prevBtn.className = "Previous";
    prevBtn.textContent = "قبلی";
    if (currentPage <= 1) {
        prevBtn.classList.add("disabled");
    } else {
        prevBtn.onclick = () => {
            currentPage--;
            loadTournaments(currentPage);
        };
    }
    paginationWrapper.appendChild(prevBtn);

    // Page numbers (up to 5 visible pages around current page)
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;
    if (end > totalPages) {
        end = totalPages;
        start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
        const pageLink = document.createElement("a");
        pageLink.className = "page_number";
        pageLink.textContent = i;
        pageLink.href = "#";
        if (i === currentPage) {
            pageLink.classList.add("filter-active");
        }
        pageLink.onclick = (e) => {
            e.preventDefault();
            if (i === currentPage) return;
            currentPage = i;
            loadTournaments(currentPage);
        };
        paginationWrapper.appendChild(pageLink);
    }

    // Next button
    const nextBtn = document.createElement("button");
    nextBtn.className = "next";
    nextBtn.textContent = "بعدی";
    if (currentPage >= totalPages) {
        nextBtn.classList.add("disabled");
    } else {
        nextBtn.onclick = () => {
            currentPage++;
            loadTournaments(currentPage);
        };
    }
    paginationWrapper.appendChild(nextBtn);
}

// Setup filter buttons
function setupFilters() {
    const filterButtons = document.querySelectorAll(".filter-btn");
    filterButtons.forEach(button => {
        button.addEventListener("click", () => {
            // Prevent unnecessary requests if same filter is selected
            if (filterType === button.dataset.filter) return;

            filterButtons.forEach(btn => btn.classList.remove("filter-active"));
            button.classList.add("filter-active");
            filterType = button.dataset.filter;
            currentPage = 1;
            loadTournaments(currentPage);
        });
    });
}

// Setup sorting dropdown
function setupSorting() {
    const sortSelect = document.getElementById("sortSelect");
    if (!sortSelect) return;

    ordering = sortSelect.value || ordering; // Sync default value with UI

    sortSelect.addEventListener("change", () => {
        const newOrdering = sortSelect.value;
        if (ordering !== newOrdering) {
            ordering = newOrdering;
            currentPage = 1;
            loadTournaments(currentPage);
        }
    });
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
    setupFilters();
    setupSorting();
    loadTournaments(currentPage);
});
