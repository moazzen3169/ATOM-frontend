import { API_BASE_URL } from "../js/config.js";

let authTokenCache = null;
let currentUserId = null;
let teamsState = [];
let incomingInvitationsState = [];
let outgoingInvitationsState = [];
let joinRequestsState = [];
let pendingConfirmation = null;

function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function toTeamArray(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.results)) return payload.results;
    if (Array.isArray(payload.teams)) return payload.teams;
    return [];
}

function extractListFromObject(source, keys) {
    if (!source || typeof source !== 'object') return undefined;
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            const value = source[key];
            if (Array.isArray(value)) return value;
            if (value && Array.isArray(value.results)) return value.results;
        }
    }
    return undefined;
}

function extractUserDisplayName(user) {
    if (!user) return '';
    if (typeof user === 'string') return user;
    if (typeof user === 'number') return String(user);
    return user.username || user.full_name || user.display_name || user.email || String(user.id || 'کاربر');
}

function getTeamMembersMeta(team) {
    const membersList = team.members_detail || team.members_info || team.members_data || team.members;
    const memberCount = typeof team.members_count === 'number'
        ? team.members_count
        : Array.isArray(membersList)
            ? membersList.length
            : Array.isArray(team.members)
                ? team.members.length
                : 0;

    if (!Array.isArray(membersList)) {
        return { count: memberCount, chips: '' };
    }

    const memberNames = membersList
        .map(member => extractUserDisplayName(member))
        .filter(Boolean);

    const previewNames = memberNames.slice(0, 5);
    let chips = previewNames
        .map(name => `<span class="team_member_chip">${escapeHTML(name)}</span>`)
        .join('');

    const remaining = memberCount - previewNames.length;
    if (remaining > 0) {
        chips += `<span class="team_member_chip team_member_chip--more">+${remaining}</span>`;
    } else if (memberNames.length > previewNames.length) {
        chips += `<span class="team_member_chip team_member_chip--more">+${memberNames.length - previewNames.length}</span>`;
    }

    return { count: memberCount, chips };
}

function getCaptainName(team) {
    return extractUserDisplayName(
        team.captain_detail || team.captain_info || team.captain_user || team.captain_username || team.captain
    );
}

function getInvitationStatus(invitation) {
    if (!invitation) return '';
    const status = invitation.status || invitation.state || invitation.response || invitation.result;
    if (typeof status === 'string') return status;
    if (typeof invitation.accepted === 'boolean') {
        return invitation.accepted ? 'accepted' : 'declined';
    }
    return 'pending';
}

function getStatusBadgeClass(status) {
    const normalized = (status || '').toString().toLowerCase();
    if (['accepted', 'approved', 'joined', 'confirmed'].includes(normalized)) return 'badge--accepted';
    if (['declined', 'rejected', 'denied', 'cancelled', 'canceled'].includes(normalized)) return 'badge--declined';
    return 'badge--pending';
}

function isPendingStatus(status) {
    const normalized = (status || '').toString().toLowerCase();
    if (!normalized) return true;
    return ['pending', 'waiting', 'sent', 'requested', 'invited'].includes(normalized);
}

function getStatusLabel(status) {
    const normalized = (status || '').toString().toLowerCase();
    switch (normalized) {
        case 'accepted':
        case 'approved':
        case 'joined':
        case 'confirmed':
            return 'پذیرفته شد';
        case 'declined':
        case 'rejected':
        case 'denied':
        case 'cancelled':
        case 'canceled':
            return 'رد شده';
        case 'pending':
        case 'waiting':
        case 'requested':
        case 'sent':
        case 'invited':
            return 'در انتظار';
        default:
            return status || 'نامشخص';
    }
}

function isTeamCaptain(team) {
    if (!team) return false;
    if (typeof team.captain === 'number' && team.captain === currentUserId) return true;
    if (typeof team.captain_id === 'number' && team.captain_id === currentUserId) return true;
    if (team.captain === currentUserId) return true;
    const captainDetail = team.captain_detail || team.captain_info || team.captain_user;
    if (captainDetail && (captainDetail.id === currentUserId || captainDetail.user === currentUserId)) {
        return true;
    }
    return false;
}

function getTeamNameFromItem(item) {
    if (!item) return '';
    if (item.team && typeof item.team === 'object') {
        return item.team.name || item.team.title || item.team.slug || item.team.team_name || '';
    }
    if (typeof item.team === 'string') return item.team;
    if (item.team_name) return item.team_name;
    if (item.teamTitle) return item.teamTitle;
    if (item.team_info && item.team_info.name) return item.team_info.name;
    return '';
}

function getUsernameFromItem(item) {
    if (!item || typeof item !== 'object') return '';
    return item.username
        || item.user?.username
        || item.invited_user?.username
        || item.player?.username
        || item.sender?.username
        || item.invitee_username
        || item.invited_username
        || (typeof item.user === 'string' ? item.user : '')
        || '';
}

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

    authTokenCache = token;
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
            authTokenCache = data.access;
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

async function fetchWithAuth(url, options = {}, retry = true) {
    const token = authTokenCache || setupToken();
    if (!token) {
        throw new Error('برای انجام این عملیات ابتدا وارد حساب کاربری شوید.');
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', 'Bearer ' + token);

    const isJsonBody = options.body && !(options.body instanceof FormData);
    if (isJsonBody && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 && retry) {
        await refreshToken();
        return fetchWithAuth(url, options, false);
    }

    return response;
}

async function extractErrorMessage(response) {
    if (!response) return 'خطای ناشناخته رخ داد.';

    const contentType = response.headers.get('content-type');
    try {
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            if (typeof data === 'string') return data;
            if (data.detail) return data.detail;
            const messages = [];
            Object.entries(data).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    messages.push(value.join(' '));
                } else if (value && typeof value === 'object') {
                    Object.values(value).forEach(v => {
                        if (Array.isArray(v)) {
                            messages.push(v.join(' '));
                        } else if (v) {
                            messages.push(String(v));
                        }
                    });
                } else if (value) {
                    messages.push(String(value));
                }
            });
            if (messages.length) return messages.join(' | ');
        } else {
            const text = await response.text();
            if (text) return text;
        }
    } catch (error) {
        console.warn('Failed to parse error message', error);
    }

    return response.statusText || 'خطای ناشناخته رخ داد.';
}

function toggleButtonLoading(button, isLoading, loadingText = 'لطفاً صبر کنید...') {
    if (!button) return;
    if (isLoading) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }
        button.disabled = true;
        button.textContent = loadingText;
    } else {
        button.disabled = false;
        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }
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
    if (data && typeof data.id !== 'undefined') {
        currentUserId = data.id;
    }
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
        const isTeamsPage = path.includes('teams') && document.getElementById('teams_container');

        if (isTeamsPage) {
            const [dashboardResult, teamsResult] = await Promise.allSettled([
                fetchDashboardData(token),
                fetchUserTeams(token)
            ]);

            const dashboardData = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
            const teamsData = teamsResult.status === 'fulfilled' ? teamsResult.value : [];

            if (teamsResult.status === 'fulfilled') {
                displayUserTeams(teamsData);
            } else {
                console.error('خطا در دریافت تیم‌ها:', teamsResult.reason);
                showError('خطا در دریافت اطلاعات تیم‌ها. لطفاً دوباره تلاش کنید.');
                displayUserTeams([]);
            }

            const teamsCount = toTeamArray(teamsData).length;
            const tournamentsCount = dashboardData && Array.isArray(dashboardData.tournament_history)
                ? dashboardData.tournament_history.length
                : 0;

            if (dashboardData && dashboardData.user_profile) {
                displayUserProfile(dashboardData.user_profile, teamsCount, tournamentsCount);
            }

            if (dashboardData) {
                handleTeamExtrasFromDashboard(dashboardData);
            }
        } else {
            // دریافت تمام اطلاعات داشبورد از API واحد
            const dashboardData = await fetchDashboardData(token);

            // نمایش اطلاعات پروفایل کاربر
            if (dashboardData.user_profile) {
                const teamsCount = toTeamArray(dashboardData.teams).length;
                const tournamentsCount = Array.isArray(dashboardData.tournament_history)
                    ? dashboardData.tournament_history.length
                    : 0;
                displayUserProfile(dashboardData.user_profile, teamsCount, tournamentsCount);
            }

            // نمایش تیم‌ها (اگر در صفحه داشبورد هستیم و تیم‌ها موجود است)
            if (dashboardData.teams && document.getElementById('teams_container')) {
                displayUserTeams(dashboardData.teams);
            }

            // نمایش تاریخچه تورنومنت‌ها
            if (dashboardData.tournament_history && document.getElementById('tournaments_history_body')) {
                displayTournamentHistory(dashboardData.tournament_history);
            }

            handleTeamExtrasFromDashboard(dashboardData);
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



function displayUserTeams(teamsInput) {
    const container = document.getElementById('teams_container');
    if (!container) return;

    const teams = toTeamArray(teamsInput);
    teamsState = teams;

    container.innerHTML = '';
    updateTeamsCounter(teams.length);

    if (teams.length === 0) {
        container.innerHTML = '<div class="empty_state">تیمی برای نمایش وجود ندارد. با دکمه بالا یک تیم جدید بسازید.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    teams.forEach(team => {
        fragment.appendChild(createTeamCard(team));
    });

    container.appendChild(fragment);
}

function updateTeamsCounter(count) {
    const counter = document.getElementById('teams_counter');
    if (counter) {
        counter.textContent = `${count} تیم`;
    }
}

function createTeamCard(team) {
    const card = document.createElement('article');
    card.className = 'team_card';
    if (team && typeof team.id !== 'undefined') {
        card.dataset.teamId = team.id;
    }

    const avatarSrc = team?.team_picture || '../img/profile.jpg';
    const membersMeta = getTeamMembersMeta(team || {});
    const captainName = getCaptainName(team || {}) || '-';
    const isCaptain = isTeamCaptain(team);
    const createdAt = team?.created_at || team?.created;
    const gameName = team?.game?.name || team?.game_name || '';
    const description = team?.bio || team?.description || '';

    card.innerHTML = `
        <header class="team_card__header">
            <div class="team_avatar">
                <img src="${escapeHTML(avatarSrc)}" alt="لوگوی ${escapeHTML(team?.name || 'تیم')}" onerror="this.src='../img/profile.jpg'; this.onerror=null;">
            </div>
            <div class="team_card__title">
                <h3>${escapeHTML(team?.name || 'بدون نام')}</h3>
                ${gameName ? `<p>${escapeHTML(gameName)}</p>` : ''}
            </div>
            ${isCaptain ? '<span class="team_badge">کاپیتان</span>' : ''}
        </header>
        <div class="team_card__body">
            <dl class="team_meta">
                <div>
                    <dt>تعداد اعضا</dt>
                    <dd>${membersMeta.count}</dd>
                </div>
                <div>
                    <dt>کاپیتان</dt>
                    <dd>${escapeHTML(captainName || '-')}</dd>
                </div>
                ${createdAt ? `<div><dt>تاریخ ایجاد</dt><dd>${escapeHTML(formatDate(createdAt))}</dd></div>` : ''}
            </dl>
            ${membersMeta.chips ? `<div class="team_members_chips">${membersMeta.chips}</div>` : ''}
            ${description ? `<p class="team_description">${escapeHTML(description)}</p>` : ''}
        </div>
        <footer class="team_card__footer">
            <div class="team_card__actions">
                ${isCaptain ? `<button class="btn btn--primary" data-team-action="invite" data-team-id="${team?.id}">دعوت عضو</button>` : ''}
                ${isCaptain ? `<button class="btn" data-team-action="edit" data-team-id="${team?.id}">ویرایش</button>` : ''}
                ${isCaptain
                    ? `<button class="btn btn--danger" data-team-action="delete" data-team-id="${team?.id}">حذف تیم</button>`
                    : `<button class="btn btn--danger" data-team-action="leave" data-team-id="${team?.id}">خروج از تیم</button>`}
            </div>
        </footer>
    `;

    return card;
}

function handleTeamExtrasFromDashboard(dashboardData) {
    if (!dashboardData || typeof dashboardData !== 'object') return;

    const incoming = extractListFromObject(dashboardData, [
        'team_invitations',
        'incoming_invitations',
        'invitations',
        'received_invitations'
    ]);
    if (incoming !== undefined) {
        incomingInvitationsState = Array.isArray(incoming) ? incoming : [];
    }

    const joinRequests = extractListFromObject(dashboardData, [
        'team_requests',
        'pending_team_requests',
        'join_requests',
        'membership_requests'
    ]);
    if (joinRequests !== undefined) {
        joinRequestsState = Array.isArray(joinRequests) ? joinRequests : [];
    }

    const outgoing = extractListFromObject(dashboardData, [
        'sent_team_invitations',
        'outgoing_invitations',
        'sent_invitations'
    ]);
    if (outgoing !== undefined) {
        outgoingInvitationsState = Array.isArray(outgoing) ? outgoing : [];
    }

    displayIncomingInvitations(incomingInvitationsState);
    displayJoinRequests(joinRequestsState);
    displayOutgoingInvitations(outgoingInvitationsState);
}

function displayIncomingInvitations(invitations) {
    const container = document.getElementById('incoming_invitations_container');
    if (!container) return;

    const list = Array.isArray(invitations) ? invitations : [];
    container.innerHTML = '';

    if (!list.length) {
        container.innerHTML = '<div class="empty_state">دعوت‌نامه فعالی وجود ندارد.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    list.forEach(invitation => {
        fragment.appendChild(renderInvitationCard(invitation));
    });
    container.appendChild(fragment);
}

function displayJoinRequests(requests) {
    const container = document.getElementById('team_join_requests_container');
    if (!container) return;

    const list = Array.isArray(requests) ? requests : [];
    container.innerHTML = '';

    if (!list.length) {
        container.innerHTML = '<div class="empty_state">درخواستی ثبت نشده است.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    list.forEach(request => {
        fragment.appendChild(renderJoinRequestCard(request));
    });
    container.appendChild(fragment);
}

function displayOutgoingInvitations(invitations) {
    const container = document.getElementById('outgoing_invitations_container');
    if (!container) return;

    const list = Array.isArray(invitations) ? invitations : [];
    container.innerHTML = '';

    if (!list.length) {
        container.innerHTML = '<div class="empty_state">تا کنون دعوتی ارسال نشده است.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    list.forEach(invitation => {
        fragment.appendChild(renderOutgoingInvitationCard(invitation));
    });
    container.appendChild(fragment);
}

function renderInvitationCard(invitation) {
    const card = document.createElement('div');
    card.className = 'mini_card';
    const teamName = getTeamNameFromItem(invitation) || 'تیم ناشناخته';
    const senderName = getUsernameFromItem(invitation.sender ? invitation.sender : invitation) || '';
    const status = getInvitationStatus(invitation);
    const createdAt = invitation?.created_at || invitation?.created || invitation?.sent_at;
    const message = invitation?.message || invitation?.note || '';

    card.dataset.invitationId = invitation?.id ?? invitation?.invitation_id ?? '';

    const hasIdentifier = Boolean(card.dataset.invitationId);

    card.innerHTML = `
        <div class="mini_card__header">
            <div class="mini_card__title">${escapeHTML(teamName)}</div>
            ${senderName ? `<div class="mini_card__subtitle">ارسال از ${escapeHTML(senderName)}</div>` : ''}
        </div>
        ${message ? `<div class="mini_card__subtitle">${escapeHTML(message)}</div>` : ''}
        <div class="mini_card__footer">
            <span class="badge ${getStatusBadgeClass(status)}">${escapeHTML(getStatusLabel(status))}</span>
            ${createdAt ? `<span class="mini_card__subtitle">${escapeHTML(formatDate(createdAt))}</span>` : ''}
        </div>
        ${isPendingStatus(status) && hasIdentifier ? `
        <div class="mini_card__footer">
            <button type="button" class="btn btn--primary" data-invite-action="accept" data-invite-id="${card.dataset.invitationId}">قبول دعوت</button>
            <button type="button" class="btn btn--ghost" data-invite-action="reject" data-invite-id="${card.dataset.invitationId}">رد کردن</button>
        </div>` : ''}
    `;

    return card;
}

function renderJoinRequestCard(request) {
    const card = document.createElement('div');
    card.className = 'mini_card';
    const username = getUsernameFromItem(request) || getUsernameFromItem(request.requester || {}) || 'کاربر ناشناس';
    const teamName = getTeamNameFromItem(request) || 'تیم من';
    const status = getInvitationStatus(request);
    const createdAt = request?.created_at || request?.created || request?.sent_at;

    card.innerHTML = `
        <div class="mini_card__header">
            <div class="mini_card__title">${escapeHTML(username)}</div>
            <div class="mini_card__subtitle">در انتظار تایید برای تیم ${escapeHTML(teamName)}</div>
        </div>
        <div class="mini_card__footer">
            <span class="badge ${getStatusBadgeClass(status)}">${escapeHTML(getStatusLabel(status))}</span>
            ${createdAt ? `<span class="mini_card__subtitle">${escapeHTML(formatDate(createdAt))}</span>` : ''}
        </div>
    `;

    return card;
}

function renderOutgoingInvitationCard(invitation) {
    const card = document.createElement('div');
    card.className = 'mini_card';
    const username = getUsernameFromItem(invitation) || getUsernameFromItem(invitation.invited_user || {}) || 'کاربر';
    const teamName = getTeamNameFromItem(invitation) || 'تیم';
    const status = getInvitationStatus(invitation);
    const createdAt = invitation?.created_at || invitation?.created || invitation?.sent_at;

    card.innerHTML = `
        <div class="mini_card__header">
            <div class="mini_card__title">${escapeHTML(username)}</div>
            <div class="mini_card__subtitle">دعوت شده به ${escapeHTML(teamName)}</div>
        </div>
        <div class="mini_card__footer">
            <span class="badge ${getStatusBadgeClass(status)}">${escapeHTML(getStatusLabel(status))}</span>
            ${createdAt ? `<span class="mini_card__subtitle">${escapeHTML(formatDate(createdAt))}</span>` : ''}
        </div>
    `;

    return card;
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('modal--open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal_open');
    const focusable = modal.querySelector('[data-autofocus]') || modal.querySelector('input, textarea, button');
    if (focusable) {
        setTimeout(() => focusable.focus(), 50);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('modal--open');
    modal.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal.modal--open')) {
        document.body.classList.remove('modal_open');
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal.modal--open').forEach(modal => {
        modal.classList.remove('modal--open');
        modal.setAttribute('aria-hidden', 'true');
    });
    document.body.classList.remove('modal_open');
}

function setupModalEvents() {
    document.addEventListener('click', (event) => {
        const openTrigger = event.target.closest('[data-open-modal]');
        if (openTrigger) {
            const targetId = openTrigger.getAttribute('data-open-modal');
            const modal = targetId ? document.getElementById(targetId) : null;
            if (modal) {
                event.preventDefault();
                openModal(targetId);
                return;
            }
        }

        const closeTrigger = event.target.closest('[data-close-modal]');
        if (closeTrigger) {
            const modal = closeTrigger.closest('.modal');
            if (modal && modal.id) {
                closeModal(modal.id);
            }
            return;
        }

        if (event.target.classList.contains('modal')) {
            const modalId = event.target.id;
            if (modalId) {
                closeModal(modalId);
            }
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeAllModals();
        }
    });
}

function confirmAction({ message, confirmLabel = 'تایید', onConfirm }) {
    const messageContainer = document.getElementById('confirm_modal_message');
    if (messageContainer) {
        messageContainer.textContent = message;
    }
    const confirmButton = document.getElementById('confirm_modal_confirm');
    if (confirmButton) {
        confirmButton.textContent = confirmLabel;
        confirmButton.dataset.originalText = confirmLabel;
    }
    pendingConfirmation = onConfirm;
    openModal('confirm_modal');
}

async function refreshTeamData() {
    const token = authTokenCache || setupToken();
    if (!token) return;
    if (!window.location.pathname.includes('teams')) return;

    const [dashboardResult, teamsResult] = await Promise.allSettled([
        fetchDashboardData(token),
        fetchUserTeams(token)
    ]);

    if (teamsResult.status === 'fulfilled') {
        displayUserTeams(teamsResult.value);
    }

    const teamsCount = toTeamArray(teamsResult.status === 'fulfilled' ? teamsResult.value : teamsState).length;

    if (dashboardResult.status === 'fulfilled') {
        const data = dashboardResult.value;
        const tournamentsCount = Array.isArray(data.tournament_history) ? data.tournament_history.length : 0;
        if (data.user_profile) {
            displayUserProfile(data.user_profile, teamsCount, tournamentsCount);
        }
        handleTeamExtrasFromDashboard(data);
    } else {
        displayIncomingInvitations(incomingInvitationsState);
        displayJoinRequests(joinRequestsState);
        displayOutgoingInvitations(outgoingInvitationsState);
    }
}

function openEditTeamModal(teamId) {
    const form = document.getElementById('edit_team_form');
    if (!form) return;
    const team = teamsState.find(teamItem => String(teamItem.id) === String(teamId));
    if (!team) {
        showError('تیم مورد نظر یافت نشد.');
        return;
    }

    form.reset();
    const idField = document.getElementById('edit_team_id');
    const nameField = document.getElementById('edit_team_name');
    const pictureField = document.getElementById('edit_team_picture');
    if (idField) idField.value = team.id;
    if (nameField) nameField.value = team.name || '';
    if (pictureField) pictureField.value = team.team_picture || '';

    openModal('edit_team_modal');
}

function openInviteMemberModal(teamId) {
    const form = document.getElementById('invite_member_form');
    if (!form) return;
    form.reset();
    const teamField = document.getElementById('invite_team_id');
    if (teamField) teamField.value = teamId;
    openModal('invite_member_modal');
}

function confirmDeleteTeam(teamId) {
    const team = teamsState.find(teamItem => String(teamItem.id) === String(teamId));
    const teamName = team?.name || 'تیم';
    confirmAction({
        message: `آیا از حذف تیم «${teamName}» اطمینان دارید؟ این عمل غیرقابل بازگشت است.`,
        confirmLabel: 'حذف تیم',
        onConfirm: async () => {
            await handleDeleteTeam(teamId);
        }
    });
}

function confirmLeaveTeam(teamId) {
    const team = teamsState.find(teamItem => String(teamItem.id) === String(teamId));
    const teamName = team?.name || 'تیم';
    confirmAction({
        message: `آیا می‌خواهید از تیم «${teamName}» خارج شوید؟`,
        confirmLabel: 'خروج از تیم',
        onConfirm: async () => {
            await handleLeaveTeam(teamId);
        }
    });
}

async function handleCreateTeam(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const name = (formData.get('name') || '').toString().trim();
    const teamPicture = (formData.get('team_picture') || '').toString().trim();

    if (!name) {
        showError('نام تیم را وارد کنید.');
        return;
    }

    const payload = { name };
    if (teamPicture) {
        payload.team_picture = teamPicture;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    toggleButtonLoading(submitButton, true, 'در حال ایجاد...');

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const message = await extractErrorMessage(response);
            throw new Error(message);
        }

        showSuccess('تیم با موفقیت ایجاد شد.');
        closeModal('create_team_modal');
        form.reset();
        await refreshTeamData();
    } catch (error) {
        console.error('خطا در ایجاد تیم:', error);
        showError(error.message || 'خطا در ایجاد تیم');
    } finally {
        toggleButtonLoading(submitButton, false);
    }
}

async function handleEditTeam(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const teamId = formData.get('team_id');
    const name = (formData.get('name') || '').toString().trim();
    const teamPicture = (formData.get('team_picture') || '').toString().trim();

    if (!teamId) {
        showError('تیم معتبر نیست.');
        return;
    }

    if (!name) {
        showError('نام تیم را وارد کنید.');
        return;
    }

    const payload = { name };
    if (teamPicture) {
        payload.team_picture = teamPicture;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    toggleButtonLoading(submitButton, true, 'در حال ذخیره...');

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/${teamId}/`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const message = await extractErrorMessage(response);
            throw new Error(message);
        }

        showSuccess('تیم با موفقیت به‌روزرسانی شد.');
        closeModal('edit_team_modal');
        form.reset();
        await refreshTeamData();
    } catch (error) {
        console.error('خطا در بروزرسانی تیم:', error);
        showError(error.message || 'خطا در بروزرسانی تیم');
    } finally {
        toggleButtonLoading(submitButton, false);
    }
}

async function handleInviteMember(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const teamId = formData.get('team_id');
    const username = (formData.get('username') || '').toString().trim();

    if (!teamId) {
        showError('تیم معتبر نیست.');
        return;
    }

    if (!username) {
        showError('نام کاربری کاربر را وارد کنید.');
        return;
    }

    const payload = { username };

    const submitButton = form.querySelector('button[type="submit"]');
    toggleButtonLoading(submitButton, true, 'در حال ارسال...');

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/${teamId}/add-member/`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const message = await extractErrorMessage(response);
            throw new Error(message);
        }

        showSuccess('دعوت‌نامه با موفقیت ارسال شد.');
        closeModal('invite_member_modal');
        form.reset();
        await refreshTeamData();
    } catch (error) {
        console.error('خطا در ارسال دعوت:', error);
        showError(error.message || 'خطا در ارسال دعوت');
    } finally {
        toggleButtonLoading(submitButton, false);
    }
}

async function handleDeleteTeam(teamId) {
    if (!teamId) throw new Error('شناسه تیم نامعتبر است.');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/${teamId}/`, {
        method: 'DELETE'
    });

    if (!(response.ok || response.status === 204)) {
        const message = await extractErrorMessage(response);
        throw new Error(message);
    }

    showSuccess('تیم با موفقیت حذف شد.');
    await refreshTeamData();
}

async function handleLeaveTeam(teamId) {
    if (!teamId) throw new Error('شناسه تیم نامعتبر است.');

    const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/${teamId}/leave_team/`, {
        method: 'POST',
        body: JSON.stringify({})
    });

    if (!response.ok) {
        const message = await extractErrorMessage(response);
        throw new Error(message);
    }

    showSuccess('از تیم خارج شدید.');
    await refreshTeamData();
}

async function respondToInvitationAction(inviteId, action) {
    if (!inviteId) {
        showError('دعوت‌نامه معتبر نیست.');
        return;
    }

    const status = action === 'accept' ? 'accepted' : 'declined';
    const payload = { invitation_id: inviteId, status };

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/respond-invitation/`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const message = await extractErrorMessage(response);
            throw new Error(message);
        }

        showSuccess(action === 'accept' ? 'دعوت‌نامه پذیرفته شد.' : 'دعوت‌نامه رد شد.');
        incomingInvitationsState = incomingInvitationsState.filter(item => String(item.id || item.invitation_id) !== String(inviteId));
        await refreshTeamData();
    } catch (error) {
        console.error('خطا در پاسخ به دعوت‌نامه:', error);
        showError(error.message || 'خطا در پاسخ به دعوت‌نامه');
    }
}

function setupTeamsPageInteractions() {
    const teamsContainer = document.getElementById('teams_container');
    if (teamsContainer) {
        teamsContainer.addEventListener('click', (event) => {
            const button = event.target.closest('[data-team-action]');
            if (!button) return;
            const action = button.getAttribute('data-team-action');
            const teamId = button.getAttribute('data-team-id');
            if (!action || !teamId) return;

            switch (action) {
                case 'edit':
                    openEditTeamModal(teamId);
                    break;
                case 'invite':
                    openInviteMemberModal(teamId);
                    break;
                case 'delete':
                    confirmDeleteTeam(teamId);
                    break;
                case 'leave':
                    confirmLeaveTeam(teamId);
                    break;
                default:
                    break;
            }
        });
    }

    const createForm = document.getElementById('create_team_form');
    if (createForm) {
        createForm.addEventListener('submit', handleCreateTeam);
    }

    const editForm = document.getElementById('edit_team_form');
    if (editForm) {
        editForm.addEventListener('submit', handleEditTeam);
    }

    const inviteForm = document.getElementById('invite_member_form');
    if (inviteForm) {
        inviteForm.addEventListener('submit', handleInviteMember);
    }

    const confirmButton = document.getElementById('confirm_modal_confirm');
    if (confirmButton) {
        confirmButton.addEventListener('click', async () => {
            if (typeof pendingConfirmation === 'function') {
                const action = pendingConfirmation;
                pendingConfirmation = null;
                toggleButtonLoading(confirmButton, true, 'در حال انجام...');
                try {
                    await action();
                    closeModal('confirm_modal');
                } catch (error) {
                    console.error('خطا در انجام عملیات تایید:', error);
                    showError(error.message || 'خطا در انجام عملیات');
                } finally {
                    toggleButtonLoading(confirmButton, false);
                }
            } else {
                closeModal('confirm_modal');
            }
        });
    }

    document.addEventListener('click', (event) => {
        const inviteAction = event.target.closest('[data-invite-action]');
        if (inviteAction) {
            const action = inviteAction.getAttribute('data-invite-action');
            const inviteId = inviteAction.getAttribute('data-invite-id');
            respondToInvitationAction(inviteId, action);
        }
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

    setupModalEvents();
    setupTeamsPageInteractions();

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

    // مدیریت دکمه ایجاد تیم
    const createTeamLink = document.querySelector('.creat_team_link');
    if (createTeamLink) {
        createTeamLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.location.pathname.includes('teams')) {
                openModal('create_team_modal');
            } else {
                window.location.href = 'teams.html';
            }
        });
    }
});
