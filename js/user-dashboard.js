import { API_BASE_URL } from "../js/config.js";

// تابع برای فرمت تاریخ
function formatDate(dateString) {
    if (!dateString || dateString === "-") return "-";
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('fa-IR');
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString;
    }
}

// تابع برای بررسی و تنظیم توکن
function setupToken() {
    // بررسی انواع مختلف ذخیره‌سازی توکن
    let token = localStorage.getItem('token');
    
    if (!token) {
        token = localStorage.getItem('access_token');
    }
    
    if (!token) {
        // اگر توکن پیدا نشد، به صفحه لاگین هدایت شو
        showError("ابتدا وارد حساب کاربری شوید");
        window.location.href = "../register/login.html";
        return null;
    }
    
    return token;
}

// تابع برای دریافت اطلاعات داشبورد
async function fetchDashboardData(token) {
    try {
        console.log('دریافت اطلاعات داشبورد از API...');

        const response = await fetch(`${API_BASE_URL}/api/users/dashboard/`, {
            method: 'GET',
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            }
        });

        console.log('Status:', response.status);

        if (response.status === 401) {
            // توکن منقضی شده
            await refreshToken();
            return fetchDashboardData(localStorage.getItem('token'));
        }

        if (!response.ok) {
            throw new Error(`خطای HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log('داده‌های دریافتی داشبورد:', data);
        return data;
    } catch (error) {
        console.error("خطا در دریافت داده‌های داشبورد:", error);
        throw error;
    }
}

// تابع برای دریافت تیم‌های کاربر
async function fetchUserTeams(token) {
    try {
        console.log('دریافت تیم‌های کاربر از API...');

        const response = await fetch(`${API_BASE_URL}/api/users/teams/`, {
            method: 'GET',
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            }
        });

        console.log('Status:', response.status);

        if (response.status === 401) {
            // توکن منقضی شده
            await refreshToken();
            return fetchUserTeams(localStorage.getItem('token'));
        }

        if (!response.ok) {
            throw new Error(`خطای HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log('داده‌های دریافتی تیم‌ها:', data);
        return data;
    } catch (error) {
        console.error("خطا در دریافت تیم‌های کاربر:", error);
        throw error;
    }
}

// تابع برای refresh توکن
async function refreshToken() {
    try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
            throw new Error('Refresh token not found');
        }

        const response = await fetch(`${API_BASE_URL}/auth/jwt/refresh/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                refresh: refreshToken
            })
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.access);
            localStorage.setItem('access_token', data.access);
            console.log('Token refreshed successfully');
        } else {
            throw new Error('Failed to refresh token');
        }
    } catch (error) {
        console.error('Error refreshing token:', error);
        // اگر refresh failed، کاربر باید دوباره لاگین کند
        localStorage.clear();
        window.location.href = "../register/login.html";
    }
}

// تابع برای تنظیم عنوان صفحه
function setPageTitle() {
    const path = window.location.pathname;
    let title = 'داشبورد'; // پیش‌فرض

    const titleMap = [
        { keyword: 'tickets', value: 'تیکت‌ها' },
        { keyword: 'wallet', value: 'کیف پول' },
        { keyword: 'profile', value: 'پروفایل' },
        { keyword: 'teams', value: 'تیم‌ها' },
        { keyword: 'tournaments', value: 'تورنومنت‌ها' },
        { keyword: 'verification', value: 'احراز هویت' },
        { keyword: 'chat', value: 'پیام‌ها' },
        { keyword: 'games', value: 'بازی‌ها' },
        { keyword: 'lobby', value: 'لابی' }
    ];

    for (const item of titleMap) {
        if (path.includes(item.keyword)) {
            title = item.value;
            break;
        }
    }

    if (document.getElementById("page_title_text")) {
        document.getElementById("page_title_text").textContent = title;
    }
}

// تابع برای نمایش اطلاعات کاربر
function displayUserProfile(data, teamsCount, tournamentsCount) {
    console.log('نمایش داده‌ها:', data);

    // اطلاعات اصلی کاربر
    const username = data.username || 'کاربر';
    localStorage.setItem("username", username);
    if (document.getElementById("header_user_name")) {
        document.getElementById("header_user_name").textContent = username;
    }
    if (document.getElementById("user_name")) {
        document.getElementById("user_name").textContent = username;
    }
    if (document.getElementById("user_email")) {
        document.getElementById("user_email").textContent = data.email || "-";
    }
    if (document.getElementById("user_rank")) {
        document.getElementById("user_rank").textContent = data.rank || "-";
    }
    if (document.getElementById("user_score")) {
        document.getElementById("user_score").textContent = data.score || "0";
    }

    // اطلاعات آماری - از پارامترهای ورودی استفاده می‌کنیم
    if (document.getElementById("user_tournaments_played")) {
        document.getElementById("user_tournaments_played").textContent = tournamentsCount || "0";
    }
    if (document.getElementById("user_teams")) {
        document.getElementById("user_teams").textContent = teamsCount || "0";
    }

    // تاریخ عضویت - در API موجود نیست
    if (document.getElementById("user_add_date")) {
        document.getElementById("user_add_date").textContent = "-";
    }

    // آواتار کاربر
    const avatarSrc = data.profile_picture || "../img/profile.jpg";
    localStorage.setItem("profile_picture", avatarSrc);
    if (document.getElementById("header_user_avatar")) {
        document.getElementById("header_user_avatar").src = avatarSrc;
    }
    if (document.getElementById("user_avatar")) {
        document.getElementById("user_avatar").src = avatarSrc;
    }

    updateHeaderUserInfoFromLocalStorage();
}



// تابع اصلی برای لود کردن اطلاعات
async function loadDashboardData() {
    const token = setupToken();
    if (!token) return;

    try {
        console.log('شروع لود اطلاعات داشبورد...');

        // تنظیم عنوان صفحه
        setPageTitle();

        const path = window.location.pathname;

        if (path.includes('teams') && document.getElementById('teams_container')) {
            // اگر در صفحه تیم‌ها هستیم، تیم‌ها رو از API جداگانه دریافت کنیم
            const teams = await fetchUserTeams(token);
            displayUserTeams(teams);
        } else {
            // دریافت تمام اطلاعات داشبورد از API واحد
            const dashboardData = await fetchDashboardData(token);

            // نمایش اطلاعات پروفایل کاربر
            if (dashboardData.user_profile) {
                displayUserProfile(dashboardData.user_profile, dashboardData.teams ? dashboardData.teams.length : 0, dashboardData.tournament_history ? dashboardData.tournament_history.length : 0);
            }

            // نمایش تیم‌ها (اگر در صفحه داشبورد هستیم و تیم‌ها موجود است)
            if (dashboardData.teams && document.getElementById('teams_container')) {
                displayUserTeams(dashboardData.teams);
            }

            // نمایش تاریخچه تورنومنت‌ها
            if (dashboardData.tournament_history && document.getElementById('tournaments_history_body')) {
                displayTournamentHistory(dashboardData.tournament_history);
            }
        }

    } catch (error) {
        console.error("خطا در لود کردن اطلاعات داشبورد:", error);

        // اگر خطا داریم، از داده‌های localStorage استفاده می‌کنیم
        const userData = localStorage.getItem('user_data');
        if (userData) {
            try {
                const parsedData = JSON.parse(userData);
                if (parsedData && parsedData.length > 0) {
                    displayUserProfile(parsedData[0]);
                    console.log('استفاده از داده‌های localStorage');
                }
            } catch (e) {
                console.error('خطا در parsing user_data:', e);
            }
        } else {
            showError("خطا در دریافت اطلاعات. لطفا دوباره وارد شوید.");
            localStorage.clear();
            window.location.href = "../register/login.html";
        }
    }
}



function displayUserTeams(teams) {
    const container = document.getElementById('teams_container');
    if (!container) return;

    container.innerHTML = '';

    if (!teams || teams.length === 0) {
        container.innerHTML = '<p>هیچ تیمی یافت نشد.</p>';
        return;
    }

    teams.forEach(team => {
        const teamItem = document.createElement('div');
        teamItem.className = 'team_item';

        const teamInfo = document.createElement('div');
        teamInfo.className = 'team_info';

        const pictureWrapper = document.createElement('div');
        pictureWrapper.className = 'team_picturse';

        const picture = document.createElement('img');
        picture.src = team.team_picture || '../img/profile.jpg';
        picture.alt = team.name || 'تصویر تیم';
        pictureWrapper.appendChild(picture);

        const teamDetail = document.createElement('div');
        teamDetail.className = 'team_detail';

        const teamName = document.createElement('p');
        teamName.textContent = team.name || 'بدون نام';
        teamDetail.appendChild(teamName);

        const memberCount = document.createElement('div');
        memberCount.className = 'team_member_count';

        const memberLabel = document.createElement('span');
        memberLabel.textContent = 'اعضا';
        const memberValue = document.createElement('span');
        const membersLength = Array.isArray(team.members) ? team.members.length : (team.members_count || 0);
        memberValue.textContent = membersLength;

        memberCount.appendChild(memberLabel);
        memberCount.appendChild(memberValue);
        teamDetail.appendChild(memberCount);

        teamInfo.appendChild(pictureWrapper);
        teamInfo.appendChild(teamDetail);

        const teamButtons = document.createElement('div');
        teamButtons.className = 'team_buttons';

        const viewButton = document.createElement('button');
        viewButton.type = 'button';
        viewButton.className = 'team_btn';
        viewButton.title = 'مشاهده تیم';
        viewButton.setAttribute('aria-label', 'مشاهده تیم');
        viewButton.textContent = '👁';

        const manageButton = document.createElement('button');
        manageButton.type = 'button';
        manageButton.className = 'team_btn';
        manageButton.title = 'مدیریت تیم';
        manageButton.setAttribute('aria-label', 'مدیریت تیم');
        manageButton.textContent = '⚙';

        teamButtons.appendChild(viewButton);
        teamButtons.appendChild(manageButton);

        teamItem.appendChild(teamInfo);
        teamItem.appendChild(teamButtons);

        container.appendChild(teamItem);
    });
}



function displayTournamentHistory(matches) {
    const tbody = document.getElementById('tournaments_history_body');
    tbody.innerHTML = ''; // Clear existing content

    if (matches.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 6;
        cell.textContent = 'هیچ تاریخچه‌ای یافت نشد.';
        return;
    }

    matches.forEach(match => {
        const row = tbody.insertRow();
        row.insertCell().textContent = match.score || '-'; // Assuming score is in match data
        row.insertCell().textContent = match.rank || '-'; // Assuming rank is in match data
        row.insertCell().textContent = new Date(match.created_at || match.date).toLocaleDateString('fa-IR'); // Assuming date field
        row.insertCell().textContent = match.team_name || '-'; // Assuming team name if team match
        row.insertCell().textContent = match.game_name || match.tournament?.game?.name || '-'; // Assuming game name
        row.insertCell().textContent = match.tournament_name || match.tournament?.name || '-'; // Assuming tournament name
    });
}


// تابع برای بروزرسانی اطلاعات کاربر در هدر از localStorage
function updateHeaderUserInfoFromLocalStorage() {
    const username = localStorage.getItem("username") || "کاربر";
    const profilePicture = localStorage.getItem("profile_picture") || "../img/profile.jpg";

    // بروزرسانی نام کاربر در هدر داشبورد
    const headerUserName = document.getElementById("header_user_name");
    if (headerUserName) {
        headerUserName.textContent = username;
    }

    // بروزرسانی نام کاربر در سایدبار موبایل
    const mobileUserName = document.querySelector(".user_info_name");
    if (mobileUserName) {
        mobileUserName.textContent = username;
    }

    // بروزرسانی تصویر پروفایل در هدر داشبورد
    const headerUserAvatar = document.getElementById("header_user_avatar");
    if (headerUserAvatar) {
        headerUserAvatar.src = profilePicture;
    }

    // بروزرسانی تصویر پروفایل در سایدبار موبایل
    const mobileUserAvatar = document.querySelector(".user_profile img");
    if (mobileUserAvatar) {
        mobileUserAvatar.src = profilePicture;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    console.log('DOM loaded, starting dashboard...');

    // MutationObserver to detect when header content is loaded dynamically
    const headerContainer = document.getElementById('dashboard_header');
    if (headerContainer) {
        const observer = new MutationObserver((mutationsList, observer) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Header content loaded, update user info
                    updateHeaderUserInfoFromLocalStorage();
                    setPageTitle();
                    observer.disconnect();
                    break;
                }
            }
        });
        observer.observe(headerContainer, { childList: true });
    } else {
        // If no dynamic header, update immediately
        updateHeaderUserInfoFromLocalStorage();
        setPageTitle();
    }

    loadDashboardData().then(() => {
        setPageTitle();
    });

    // تغییر دکمه ایجاد تیم به لینک صفحه تیم‌ها
    const createTeamLink = document.querySelector('.creat_team_link');
    if (createTeamLink) {
        createTeamLink.addEventListener('click', (e) => {
            e.preventDefault();
            // هدایت به صفحه تیم‌ها
            window.location.href = "../teams/index.html"; // فرض بر این است که صفحه تیم‌ها در این مسیر است
        });
    }
});
