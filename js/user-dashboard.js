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
        alert("ابتدا وارد حساب کاربری شوید");
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

    if (path.includes('tickets')) {
        title = 'تیکت‌ها';
    } else if (path.includes('wallet')) {
        title = 'کیف پول';
    } else if (path.includes('profile')) {
        title = 'پروفایل';
    } else if (path.includes('teams')) {
        title = 'تیم‌ها';
    } else if (path.includes('tournaments')) {
        title = 'تورنومنت‌ها';
    } else if (path.includes('games')) {
        title = 'بازی‌ها';
    } else if (path.includes('lobby')) {
        title = 'لابی';
    }

    if (document.getElementById("page_title_text")) {
        document.getElementById("page_title_text").textContent = title;
    }
}

// تابع برای نمایش اطلاعات کاربر
function displayUserProfile(data) {
    console.log('نمایش داده‌ها:', data);

    // اطلاعات اصلی کاربر
    const username = data.username || 'کاربر';
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

    // اطلاعات آماری - با توجه به ساختار API ممکن است متفاوت باشد
    if (document.getElementById("user_tournaments_played")) {
        document.getElementById("user_tournaments_played").textContent = data.tournaments_count || data.tournaments_played || "0";
    }
    if (document.getElementById("user_teams")) {
        document.getElementById("user_teams").textContent = data.teams_count || data.teams || "0";
    }

    // تاریخ عضویت
    const joinDate = data.date_joined || data.join_date || "-";
    if (document.getElementById("user_add_date")) {
        document.getElementById("user_add_date").textContent = formatDate(joinDate);
    }

    // آواتار کاربر
    if (data.profile_picture) {
        if (document.getElementById("header_user_avatar")) {
            document.getElementById("header_user_avatar").src = data.profile_picture;
        }
        if (document.getElementById("user_avatar")) {
            document.getElementById("user_avatar").src = data.profile_picture;
        }
    } else if (data.avatar) {
        if (document.getElementById("header_user_avatar")) {
            document.getElementById("header_user_avatar").src = data.avatar;
        }
        if (document.getElementById("user_avatar")) {
            document.getElementById("user_avatar").src = data.avatar;
        }
    }
}

// تابع برای دریافت اطلاعات کاربر از auth endpoint اگر dashboard کار نکرد
async function fetchUserFromAuth(token) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/users/me/`, {
            method: 'GET',
            headers: { 
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`خطای HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log('داده‌های از auth/me:', data);
        return data;
    } catch (error) {
        console.error("خطا در دریافت اطلاعات از auth:", error);
        throw error;
    }
}

// تابع اصلی برای لود کردن اطلاعات
async function loadDashboardData() {
    const token = setupToken();
    if (!token) return;

    try {
        console.log('شروع لود اطلاعات داشبورد...');

        // تنظیم عنوان صفحه
        setPageTitle();

        // دریافت اطلاعات پروفایل کاربر از auth/me برای اطمینان از دریافت profile_picture
        const userProfile = await fetchUserFromAuth(token);
        displayUserProfile(userProfile);

        // دریافت اطلاعات آماری اضافی از داشبورد اگر موجود باشد
        try {
            const dashboardData = await fetchDashboardData(token);
            // بروزرسانی اطلاعات آماری از داشبورد
            if (document.getElementById("user_rank")) {
                document.getElementById("user_rank").textContent = dashboardData.rank || userProfile.rank || "-";
            }
            if (document.getElementById("user_score")) {
                document.getElementById("user_score").textContent = dashboardData.score || userProfile.score || "0";
            }
            if (document.getElementById("user_tournaments_played")) {
                document.getElementById("user_tournaments_played").textContent = dashboardData.tournaments_count || dashboardData.tournaments_played || userProfile.tournaments_played || "0";
            }
            if (document.getElementById("user_teams")) {
                document.getElementById("user_teams").textContent = dashboardData.teams_count || dashboardData.teams || userProfile.teams || "0";
            }
        } catch (error) {
            console.error('خطا در دریافت داده‌های آماری داشبورد:', error);
            // اگر داشبورد شکست خورد، از داده‌های پروفایل استفاده می‌کنیم
        }

        // دریافت تیم‌ها
        try {
            const userTeams = await fetchUserTeams(token);
            if (document.getElementById('teams_container')) {
                displayUserTeams(userTeams);
            }
        } catch (error) {
            console.error('خطا در دریافت تیم‌ها:', error);
        }

        // دریافت تاریخچه تورنومنت‌ها
        try {
            const tournamentHistory = await fetchTournamentHistory(userProfile.id, token);
            if (document.getElementById('tournaments_history_body')) {
                displayTournamentHistory(tournamentHistory);
            }
        } catch (error) {
            console.error('خطا در دریافت تاریخچه تورنومنت‌ها:', error);
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
            alert("خطا در دریافت اطلاعات. لطفا دوباره وارد شوید.");
            localStorage.clear();
            window.location.href = "../register/login.html";
        }
    }
}

// سایر توابع (fetchUserTeams, displayUserTeams, etc.) مانند قبل باقی می‌مانند
// فقط مطمئن شوید که مدیریت خطا دارند

async function fetchUserTeams(token) {
    try {
        const response = await fetch('/api/users/teams/', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const teams = await response.json();
        return teams;
    } catch (error) {
        console.error('Error fetching user teams:', error);
        return [];
    }
}

function displayUserTeams(teams) {
    const container = document.getElementById('teams_container');
    container.innerHTML = ''; // Clear existing content

    if (teams.length === 0) {
        container.innerHTML = '<p>هیچ تیمی یافت نشد.</p>';
        return;
    }

    teams.forEach(team => {
        const teamCard = document.createElement('div');
        teamCard.className = 'team_card'; // Assuming CSS class exists
        teamCard.innerHTML = `
            <img src="${team.team_picture || '../img/default-team.png'}" alt="${team.name}" class="team_image">
            <h3>${team.name}</h3>
            <p>کاپیتان: ${team.captain_username || 'نامشخص'}</p>
            <p>اعضا: ${team.members.length}</p>
        `;
        container.appendChild(teamCard);
    });
}

async function fetchTournamentHistory(userId, token) {
    try {
        const response = await fetch(`/api/users/users/${userId}/match-history/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const matches = await response.json();
        return matches;
    } catch (error) {
        console.error('Error fetching tournament history:', error);
        return [];
    }
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

// وقتی DOM کاملا لود شد
document.addEventListener("DOMContentLoaded", () => {
    console.log('DOM loaded, starting dashboard...');
    loadDashboardData();
});