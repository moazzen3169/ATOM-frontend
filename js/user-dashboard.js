import { API_BASE_URL } from "../js/config.js";

let authTokenCache = null;
let currentUserId = null;
let currentUsername = '';
let currentUserEmail = '';
let teamsState = [];
let incomingInvitationsState = [];
let outgoingInvitationsState = [];
let joinRequestsState = [];
let pendingConfirmation = null;
let currentUserProfile = {};
let cachedTeamsCount = 0;
let cachedTournamentsCount = 0;

const DEFAULT_AVATAR_SRC = "../img/profile.jpg";
const LEGACY_PROFILE_ENDPOINTS = [
    '/api/users/users/me/',
    '/api/auth/users/me/',
    '/api/auth/me/',
    '/api/auth/user/'
];
function getProfileUpdateEndpoints() {
    const endpoints = ['/auth/users/me/'];
    if (currentUserId) {
        endpoints.push(`/api/users/users/${currentUserId}/`);
    }
    endpoints.push(...LEGACY_PROFILE_ENDPOINTS);
    return Array.from(new Set(endpoints));
}
const PROFILE_BIO_KEYS = ['bio', 'about', 'description'];

function getProfileAvatarSrc(profile) {
    if (!profile || typeof profile !== 'object') {
        return DEFAULT_AVATAR_SRC;
    }
    return profile.profile_picture || profile.avatar || DEFAULT_AVATAR_SRC;
}

function updateEditUserAvatarPreview(src) {
    const preview = document.getElementById('edit_user_avatar_preview');
    if (preview) {
        preview.src = src || DEFAULT_AVATAR_SRC;
    }
}

function handleEditAvatarChange(event) {
    const input = event?.target;
    if (!input) return;

    const file = input.files && input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            updateEditUserAvatarPreview(reader.result);
        };
        reader.readAsDataURL(file);
    } else {
        updateEditUserAvatarPreview(getProfileAvatarSrc(currentUserProfile));
    }
}

function buildProfileUpdatePayload({ username, email, firstName, lastName, phoneNumber, bio, includeBio }) {
    const payload = {
        username,
        email,
        first_name: typeof firstName === 'string' ? firstName : '',
        last_name: typeof lastName === 'string' ? lastName : '',
        phone_number: typeof phoneNumber === 'string' ? phoneNumber : ''
    };

    if (includeBio) {
        payload.bio = typeof bio === 'string' ? bio : '';
    }

    return payload;
}

function createProfileFormData(payload, avatarFile) {
    const formData = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
        if (typeof value !== 'undefined' && value !== null) {
            formData.append(key, value);
        }
    });

    if (avatarFile && typeof avatarFile === 'object' && Number(avatarFile.size) > 0) {
        formData.append('profile_picture', avatarFile);
    }

    return formData;
}

async function submitProfileUpdate(bodyFactory, isMultipart = false) {
    let lastError = null;

    const endpoints = getProfileUpdateEndpoints();

    for (const endpointPath of endpoints) {
        const endpoint = `${API_BASE_URL}${endpointPath}`;
        try {
            const headers = new Headers();

            if (!isMultipart) {
                headers.set('Content-Type', 'application/json');
            }
            headers.set('Accept', 'application/json');

            let response = await fetchWithAuth(endpoint, {
                method: 'PATCH',
                body: bodyFactory(),
                headers
            }, false);

            if (response.status === 401) {
                await refreshToken();
                response = await fetchWithAuth(endpoint, {
                    method: 'PATCH',
                    body: bodyFactory(),
                    headers
                }, false);
            }

            if (!response.ok) {
                const message = await extractErrorMessage(response);
                throw new Error(message || `خطا در بروزرسانی پروفایل (${response.status})`);
            }

            return response;
        } catch (error) {
            lastError = error;
            console.warn(`Profile update failed via ${endpoint}:`, error);
        }
    }

    if (lastError) {
        throw lastError;
    }
    throw new Error('خطا در بروزرسانی پروفایل');
}

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

    if (typeof user === 'string') {
        return user;
    }

    const objectsToInspect = [];

    if (typeof user === 'object') {
        objectsToInspect.push(user);

        const nestedKeys = [
            'user',
            'member',
            'player',
            'profile',
            'account',
            'participant',
            'owner',
            'captain',
            'inviter',
            'invitee'
        ];

        nestedKeys.forEach((key) => {
            const value = user[key];
            if (value && typeof value === 'object') {
                objectsToInspect.push(value);
            }
        });
    }

    for (const candidate of objectsToInspect) {
        const nameFields = [
            'username',
            'user_name',
            'gamer_tag',
            'gamerTag',
            'full_name',
            'display_name',
            'nickname',
            'name'
        ];

        for (const field of nameFields) {
            const value = candidate[field];
            if (value) {
                return String(value);
            }
        }

        if (candidate.email) {
            return String(candidate.email);
        }
    }

    if (typeof user === 'number') {
        if (currentUserId !== null && String(user) === String(currentUserId) && currentUsername) {
            return currentUsername;
        }
        return 'کاربر';
    }

    if (typeof user === 'object') {
        if (user.id && currentUserId !== null && String(user.id) === String(currentUserId) && currentUsername) {
            return currentUsername;
        }
        if (user.id) {
            return 'کاربر';
        }
    }

    return '';
}

function getTeamMembersMeta(team) {
    const membersList = team.members_detail || team.members_info || team.members_data || team.members;
    const supplementalNames = Array.isArray(team.members_usernames)
        ? team.members_usernames
        : Array.isArray(team.member_usernames)
            ? team.member_usernames
            : Array.isArray(team.members_names)
                ? team.members_names
                : [];

    const memberCount = typeof team.members_count === 'number'
        ? team.members_count
        : Array.isArray(membersList)
            ? membersList.length
            : supplementalNames.length
                ? supplementalNames.length
                : Array.isArray(team.members)
                    ? team.members.length
                    : 0;

    let memberNames = [];

    if (Array.isArray(membersList)) {
        memberNames = membersList
            .map(member => extractUserDisplayName(member))
            .filter(Boolean);
    }

    if (!memberNames.length && supplementalNames.length) {
        memberNames = supplementalNames.map(name => String(name)).filter(Boolean);
    }

    if (!memberNames.length) {
        return { count: memberCount, chips: '' };
    }

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

function getTeamIdentifier(item) {
    if (!item) return null;
    if (typeof item === 'number') return item;
    if (typeof item === 'string') return item;

    const possibleKeys = ['team_id', 'teamId', 'teamID'];
    for (const key of possibleKeys) {
        if (typeof item[key] !== 'undefined' && item[key] !== null) {
            return item[key];
        }
    }

    if (typeof item.id !== 'undefined' && item.id !== null) {
        return item.id;
    }

    const nestedKeys = ['team', 'team_info', 'team_detail', 'team_data'];
    for (const key of nestedKeys) {
        if (item[key]) {
            const nestedId = getTeamIdentifier(item[key]);
            if (nestedId !== null) {
                return nestedId;
            }
        }
    }

    return null;
}

function doesMemberMatchCurrentUser(member) {
    if (!member) return false;
    const idCandidates = [
        member.id,
        member.user,
        member.user_id,
        member.member_id,
        member.player_id,
        member.player?.id,
        member.user?.id,
        member.profile?.id
    ];

    if (typeof member === 'number' || typeof member === 'string') {
        idCandidates.push(member);
    }

    const normalizedCurrentId = currentUserId !== null && typeof currentUserId !== 'undefined'
        ? String(currentUserId)
        : null;

    for (const candidate of idCandidates) {
        if (candidate === null || typeof candidate === 'undefined') continue;
        if (normalizedCurrentId !== null && String(candidate) === normalizedCurrentId) {
            return true;
        }
    }

    const usernameCandidates = [
        member.username,
        member.user?.username,
        member.player?.username,
        member.member?.username,
        member.profile?.username
    ];

    const normalizedCurrentUsername = currentUsername ? currentUsername.toLowerCase() : '';
    for (const candidate of usernameCandidates) {
        if (candidate && normalizedCurrentUsername && candidate.toLowerCase() === normalizedCurrentUsername) {
            return true;
        }
    }

    const emailCandidates = [
        member.email,
        member.user?.email,
        member.player?.email,
        member.member?.email,
        member.profile?.email
    ];

    const normalizedCurrentEmail = currentUserEmail ? currentUserEmail.toLowerCase() : '';
    for (const candidate of emailCandidates) {
        if (candidate && normalizedCurrentEmail && candidate.toLowerCase() === normalizedCurrentEmail) {
            return true;
        }
    }

    return false;
}

function isUserMemberOfTeam(team) {
    if (!team) return false;

    const truthyFlags = ['is_member', 'is_joined', 'joined', 'belongs_to_user', 'is_owner'];
    for (const key of truthyFlags) {
        if (team[key]) {
            return true;
        }
    }

    const membershipObjects = ['membership', 'user_membership', 'membership_info'];
    for (const key of membershipObjects) {
        const membership = team[key];
        if (membership && typeof membership === 'object') {
            if (doesMemberMatchCurrentUser(membership)) {
                return true;
            }
        }
    }

    const memberLists = [
        'members_detail',
        'members_info',
        'members_data',
        'members',
        'team_members',
        'players',
        'team_members_detail'
    ];

    for (const key of memberLists) {
        const list = team[key];
        if (Array.isArray(list) && list.some(doesMemberMatchCurrentUser)) {
            return true;
        }
    }

    return false;
}

function getTeamStatusForUser(team) {
    const statusKeys = [
        'membership_status',
        'user_status',
        'user_membership_status',
        'membership_state',
        'relation_status',
        'status'
    ];

    for (const key of statusKeys) {
        const value = team[key];
        if (value) {
            return String(value).toLowerCase();
        }
    }

    if (team.membership && typeof team.membership === 'object' && team.membership.status) {
        return String(team.membership.status).toLowerCase();
    }

    return '';
}

function hasPendingInvitationFromTeam(teamId) {
    if (!teamId) return false;
    const stringId = String(teamId);
    return incomingInvitationsState.some(invitation => {
        const directTeamId = invitation && typeof invitation === 'object' ? getTeamIdentifier(invitation.team) : null;
        const invitationTeamId = directTeamId !== null ? directTeamId : getTeamIdentifier(invitation);
        return invitationTeamId !== null && String(invitationTeamId) === stringId;
    });
}

function filterTeamsForUser(teams) {
    if (!Array.isArray(teams)) return [];

    return teams.filter(team => {
        if (!team) return false;

        if (isTeamCaptain(team)) {
            return true;
        }

        if (isUserMemberOfTeam(team)) {
            return true;
        }

        const teamId = getTeamIdentifier(team);
        if (teamId !== null && hasPendingInvitationFromTeam(teamId)) {
            return true;
        }

        const status = getTeamStatusForUser(team);
        if (status) {
            const allowedStatuses = ['invited', 'pending', 'requested', 'waiting', 'accepted', 'approved'];
            if (allowedStatuses.includes(status)) {
                return true;
            }
        }

        const invitationFlags = ['has_invitation', 'is_invited', 'pending_invitation'];
        for (const key of invitationFlags) {
            if (team[key]) {
                return true;
            }
        }

        return false;
    });
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

function setElementText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function setFieldValue(id, value) {
    const field = document.getElementById(id);
    if (field) {
        field.value = value === null || typeof value === 'undefined' ? '' : String(value);
    }
}

function buildFullName(user = {}) {
    if (!user) return '';
    if (user.full_name) return String(user.full_name);
    const parts = [user.first_name, user.last_name].filter(Boolean);
    if (parts.length) return parts.join(' ');
    if (user.name) return String(user.name);
    return '';
}

function getPhoneNumber(user = {}) {
    return user.phone_number || user.phone || user.mobile || user.contact_number || '';
}

function translateUserStatus(status) {
    const normalized = (status || '').toString().toLowerCase();
    switch (normalized) {
        case 'active':
        case 'verified':
        case 'approved':
        case 'confirmed':
            return 'فعال';
        case 'pending':
        case 'awaiting':
        case 'processing':
        case 'in_review':
            return 'در انتظار بررسی';
        case 'suspended':
        case 'blocked':
        case 'inactive':
            return 'غیرفعال';
        default:
            return status || 'نامشخص';
    }
}

function resolveUserStatus(user = {}) {
    const statusCandidates = [
        user.status,
        user.account_status,
        user.profile_status,
        user.verification_status,
        user.state
    ].filter(Boolean);

    if (statusCandidates.length) {
        return translateUserStatus(statusCandidates[0]);
    }
    return 'نامشخص';
}

function resolveJoinDate(user = {}) {
    const fields = ['date_joined', 'created_at', 'created', 'joined_at', 'registered_at'];
    for (const field of fields) {
        if (user[field]) {
            return user[field];
        }
    }
    return null;
}

function clearEditUserMessage() {
    const messageEl = document.getElementById('edit_user_message');
    if (messageEl) {
        messageEl.textContent = '';
        messageEl.classList.remove('is-error', 'is-success');
    }
}

function setEditUserMessage(type, message) {
    const messageEl = document.getElementById('edit_user_message');
    if (!messageEl) return;
    messageEl.textContent = message || '';
    messageEl.classList.remove('is-error', 'is-success');
    if (type === 'error') {
        messageEl.classList.add('is-error');
    } else if (type === 'success') {
        messageEl.classList.add('is-success');
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
async function fetchDashboardData() {
    try {
        console.log('دریافت اطلاعات داشبورد از API...');

        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/dashboard/`, {
            method: 'GET'
        });

        console.log('Status:', response.status);

        if (!response.ok) {
            const message = await extractErrorMessage(response);
            throw new Error(message || `خطای HTTP: ${response.status}`);
        }

        const raw = await response.text();
        if (!raw) {
            console.warn('Dashboard API returned an empty response.');
            return {};
        }

        try {
            const data = JSON.parse(raw);
            console.log('داده‌های دریافتی داشبورد:', data);
            return data;
        } catch (parseError) {
            console.error('خطا در parse داده‌های داشبورد:', parseError);
            throw new Error('داده‌های نامعتبر از سرور دریافت شد.');
        }
    } catch (error) {
        console.error("خطا در دریافت داده‌های داشبورد:", error);
        throw error;
    }
}

// تابع برای دریافت تیم‌های کاربر
async function fetchUserTeams() {
    try {
        console.log('دریافت تیم‌های کاربر از API...');

        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/`, {
            method: 'GET'
        });

        console.log('Status:', response.status);

        if (!response.ok) {
            const message = await extractErrorMessage(response);
            throw new Error(message || `خطای HTTP: ${response.status}`);
        }

        const raw = await response.text();
        if (!raw) {
            console.warn('User teams API returned an empty response.');
            return [];
        }

        try {
            const data = JSON.parse(raw);
            console.log('داده‌های دریافتی تیم‌ها:', data);
            return data;
        } catch (parseError) {
            console.error('خطا در parse داده‌های تیم‌ها:', parseError);
            throw new Error('داده‌های نامعتبر از سرور دریافت شد.');
        }
    } catch (error) {
        console.error("خطا در دریافت تیم‌های کاربر:", error);
        throw error;
    }
}

async function fetchUserTournamentHistory(userId) {
    if (!userId) {
        console.warn('شناسه کاربر برای دریافت تاریخچه تورنومنت موجود نیست.');
        return [];
    }

    try {
        console.log('دریافت تاریخچه تورنومنت‌های کاربر از API...');

        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/users/${userId}/match-history/`, {
            method: 'GET'
        });

        console.log('Tournament history status:', response.status);

        if (!response.ok) {
            const message = await extractErrorMessage(response);
            throw new Error(message || `خطای HTTP: ${response.status}`);
        }

        const raw = await response.text();
        if (!raw) {
            console.warn('Tournament history API returned an empty response.');
            return [];
        }

        try {
            const data = JSON.parse(raw);
            console.log('داده‌های تاریخچه تورنومنت:', data);
            if (Array.isArray(data)) {
                return data;
            }
            if (data && Array.isArray(data.tournament_history)) {
                return data.tournament_history;
            }
            if (data && Array.isArray(data.matches)) {
                return data.matches;
            }
            return [];
        } catch (parseError) {
            console.error('خطا در parse تاریخچه تورنومنت:', parseError);
            throw new Error('داده‌های نامعتبر از سرور دریافت شد.');
        }
    } catch (error) {
        console.error('خطا در دریافت تاریخچه تورنومنت‌های کاربر:', error);
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
    if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
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
    if (!data) return;
    console.log('نمایش داده‌ها:', data);

    currentUserProfile = data || {};
    cachedTeamsCount = Number(teamsCount) || 0;
    cachedTournamentsCount = Number(tournamentsCount) || 0;

    const username = data.username || data.user_name || 'کاربر';
    if (typeof data.id !== 'undefined') {
        currentUserId = data.id;
    }
    currentUsername = username || '';
    currentUserEmail = data.email || '';
    localStorage.setItem("username", username);

    setElementText("header_user_name", username);
    setElementText("user_name", username);
    setElementText("user_username", username);

    const email = data.email || '-';
    setElementText("user_email_primary", email);
    setElementText("user_email_detail", email);

    const rank = data.rank || data.level || '-';
    setElementText("user_rank", rank || '-');

    const statusLabel = resolveUserStatus(data);
    setElementText("user_status", statusLabel);

    const fullName = buildFullName(data) || '-';
    setElementText("user_full_name", fullName);

    const phoneNumber = getPhoneNumber(data) || 'ثبت نشده';
    setElementText("user_phone", phoneNumber);

    const joinDateRaw = resolveJoinDate(data);
    const joinDateText = joinDateRaw ? formatDate(joinDateRaw) : '-';
    setElementText("user_add_date", joinDateText);

    const numberFormatter = new Intl.NumberFormat('fa-IR');
    const rawScore = (typeof data.score === 'number' || typeof data.score === 'string') ? Number(data.score) : Number(data.points);
    const scoreValue = Number.isFinite(rawScore) ? rawScore : 0;
    setElementText("user_score", numberFormatter.format(scoreValue));



    const avatarSrc = getProfileAvatarSrc(data);
    localStorage.setItem("profile_picture", avatarSrc);
    const headerAvatar = document.getElementById("header_user_avatar");
    if (headerAvatar) {
        headerAvatar.src = avatarSrc;
    }
    const profileAvatar = document.getElementById("user_avatar");
    if (profileAvatar) {
        profileAvatar.src = avatarSrc;
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

        const dashboardData = await fetchDashboardData();
        const hasTeamsContainer = Boolean(document.getElementById('teams_container'));
        const hasTournamentTable = Boolean(document.getElementById('tournaments_history_body'));

        const initialTeams = toTeamArray(dashboardData?.teams);
        const initialTournamentHistory = Array.isArray(dashboardData?.tournament_history)
            ? dashboardData.tournament_history
            : [];

        if (dashboardData?.user_profile) {
            displayUserProfile(
                dashboardData.user_profile,
                initialTeams.length,
                initialTournamentHistory.length
            );
        }

        if (hasTeamsContainer) {
            displayUserTeams(initialTeams);
        }

        if (hasTournamentTable) {
            displayTournamentHistory(initialTournamentHistory);
        }

        handleTeamExtrasFromDashboard(dashboardData);

        const userId = dashboardData?.user_profile?.id || currentUserId;
        const teamsPromise = fetchUserTeams();
        const tournamentsPromise = userId
            ? fetchUserTournamentHistory(userId)
            : Promise.resolve(initialTournamentHistory);

        const [teamsResult, tournamentsResult] = await Promise.allSettled([
            teamsPromise,
            tournamentsPromise
        ]);

        let teamsData = initialTeams;
        if (teamsResult.status === 'fulfilled') {
            teamsData = toTeamArray(teamsResult.value);
        } else {
            console.error('خطا در دریافت تیم‌ها:', teamsResult.reason);
            showError('خطا در دریافت اطلاعات تیم‌ها. لطفاً دوباره تلاش کنید.');
        }

        let tournamentsData = initialTournamentHistory;
        if (tournamentsResult.status === 'fulfilled') {
            const rawData = tournamentsResult.value;
            tournamentsData = Array.isArray(rawData)
                ? rawData
                : Array.isArray(rawData?.tournament_history)
                    ? rawData.tournament_history
                    : Array.isArray(rawData?.matches)
                        ? rawData.matches
                        : [];
        } else {
            if (userId) {
                console.error('خطا در دریافت تاریخچه تورنومنت‌ها:', tournamentsResult.reason);
                showError('خطا در دریافت تاریخچه تورنومنت‌ها. لطفاً دوباره تلاش کنید.');
            }
        }

        if (dashboardData?.user_profile) {
            displayUserProfile(
                dashboardData.user_profile,
                toTeamArray(teamsData).length,
                Array.isArray(tournamentsData) ? tournamentsData.length : 0
            );
        }

        if (hasTeamsContainer) {
            displayUserTeams(teamsData);
        }

        if (hasTournamentTable) {
            displayTournamentHistory(Array.isArray(tournamentsData) ? tournamentsData : []);
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
    renderTeamsList();
}

function updateTeamsCounter(count) {
    const counter = document.getElementById('teams_counter');
    if (counter) {
        const formatter = new Intl.NumberFormat('fa-IR');
        const label = count === 0 ? 'بدون تیم' : `${formatter.format(count)} تیم`;
        counter.textContent = label;
    }
}

function renderTeamsList() {
    const container = document.getElementById('teams_container');
    if (!container) return;

    const relevantTeams = filterTeamsForUser(teamsState);
    const overflowHint = document.getElementById('teams_overflow_hint');
    const isTeamsPage = window.location.pathname.includes('teams');
    const displayLimit = isTeamsPage ? relevantTeams.length : 3;

    container.innerHTML = '';
    updateTeamsCounter(relevantTeams.length);

    if (overflowHint) {
        overflowHint.textContent = '';
    }

    if (relevantTeams.length === 0) {
        const emptyMessage = isTeamsPage
            ? 'هیچ تیمی ثبت نشده است. از دکمه ایجاد تیم جدید استفاده کنید.'
            : 'تیمی برای نمایش وجود ندارد. از دکمه مدیریت تیم‌ها برای ساخت تیم جدید استفاده کنید.';
        container.innerHTML = `<div class="empty_state">${emptyMessage}</div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    const teamsToDisplay = isTeamsPage ? relevantTeams : relevantTeams.slice(0, displayLimit);
    teamsToDisplay.forEach(team => {
        fragment.appendChild(createTeamCard(team));
    });

    container.appendChild(fragment);

    if (!isTeamsPage && overflowHint && relevantTeams.length > displayLimit) {
        overflowHint.innerHTML = 'برای مشاهده تمام تیم‌ها به <a href="teams.html">صفحه تیم‌ها</a> بروید.';
    }
}

function openEditUserModal() {
    const form = document.getElementById('edit_user_form');
    if (!form) return;

    clearEditUserMessage();

    const profile = currentUserProfile || {};
    setFieldValue('edit_user_username', profile.username || profile.user_name || '');
    setFieldValue('edit_user_first_name', profile.first_name || '');
    setFieldValue('edit_user_last_name', profile.last_name || '');
    setFieldValue('edit_user_email', profile.email || '');
    setFieldValue('edit_user_phone', getPhoneNumber(profile) || '');
    setFieldValue('edit_user_bio', profile.bio || profile.about || profile.description || '');

    const avatarInput = document.getElementById('edit_user_avatar');
    if (avatarInput) {
        avatarInput.value = '';
    }
    updateEditUserAvatarPreview(getProfileAvatarSrc(profile));

    openModal('edit_user_modal');
}

async function handleEditUserSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const username = (formData.get('username') || '').toString().trim();
    const email = (formData.get('email') || '').toString().trim();
    const firstName = (formData.get('first_name') || '').toString().trim();
    const lastName = (formData.get('last_name') || '').toString().trim();
    const phoneNumber = (formData.get('phone_number') || '').toString().trim();
    const bio = (formData.get('bio') || '').toString().trim();

    if (!username) {
        setEditUserMessage('error', 'نام کاربری را وارد کنید.');
        return;
    }

    if (!email) {
        setEditUserMessage('error', 'ایمیل را وارد کنید.');
        return;
    }

    const avatarFile = formData.get('profile_picture');
    const isFileObject = avatarFile && typeof avatarFile === 'object' &&
        (typeof File === 'undefined' || avatarFile instanceof File);
    const hasAvatar = Boolean(isFileObject && Number(avatarFile.size) > 0);

    const existingProfile = currentUserProfile || {};
    const shouldIncludeBioField = PROFILE_BIO_KEYS.some((key) => typeof existingProfile[key] !== 'undefined');
    const includeBio = shouldIncludeBioField || Boolean(bio);

    const profilePayload = buildProfileUpdatePayload({
        username,
        email,
        firstName,
        lastName,
        phoneNumber,
        bio,
        includeBio
    });
    const localProfileUpdates = { ...profilePayload };
    if (includeBio && shouldIncludeBioField) {
        PROFILE_BIO_KEYS.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(existingProfile, key)) {
                localProfileUpdates[key] = bio;
            }
        });
    }

    const submitButton = form.querySelector('button[type="submit"]');
    toggleButtonLoading(submitButton, true, 'در حال ذخیره...');
    clearEditUserMessage();

    try {
        let bodyFactory;
        if (hasAvatar) {
            bodyFactory = () => createProfileFormData(profilePayload, avatarFile);
        } else {
            const jsonString = JSON.stringify(profilePayload);
            bodyFactory = () => jsonString;
        }

        const response = await submitProfileUpdate(bodyFactory, hasAvatar);

        if (!response.ok) {
            const message = await extractErrorMessage(response);
            throw new Error(message);
        }

        let updatedProfile = null;
        try {
            updatedProfile = await response.json();
        } catch (jsonError) {
            updatedProfile = null;
        }

        showSuccess('پروفایل با موفقیت به‌روزرسانی شد.');
        closeModal('edit_user_modal');

        if (updatedProfile && Object.keys(updatedProfile).length) {
            currentUserProfile = { ...currentUserProfile, ...updatedProfile };
            displayUserProfile(currentUserProfile, cachedTeamsCount, cachedTournamentsCount);
        } else {
            currentUserProfile = { ...currentUserProfile, ...localProfileUpdates };
            displayUserProfile(currentUserProfile, cachedTeamsCount, cachedTournamentsCount);
            if (hasAvatar) {
                await loadDashboardData();
            }
        }
    } catch (error) {
        console.error('خطا در بروزرسانی پروفایل:', error);
        setEditUserMessage('error', error.message || 'خطا در بروزرسانی پروفایل');
        showError(error.message || 'خطا در بروزرسانی پروفایل');
    } finally {
        toggleButtonLoading(submitButton, false);
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
    renderTeamsList();
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
        fetchDashboardData(),
        fetchUserTeams()
    ]);

    if (teamsResult.status === 'fulfilled') {
        displayUserTeams(teamsResult.value);
    }

    const teamsCount = toTeamArray(teamsResult.status === 'fulfilled' ? teamsResult.value : teamsState).length;

    const dashboardData = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
    const userId = dashboardData?.user_profile?.id || currentUserId;
    let tournamentsData = [];

    if (userId) {
        try {
            const tournamentsResponse = await fetchUserTournamentHistory(userId);
            tournamentsData = Array.isArray(tournamentsResponse)
                ? tournamentsResponse
                : Array.isArray(tournamentsResponse?.tournament_history)
                    ? tournamentsResponse.tournament_history
                    : Array.isArray(tournamentsResponse?.matches)
                        ? tournamentsResponse.matches
                        : [];
        } catch (error) {
            console.error('خطا در بروزرسانی تاریخچه تورنومنت‌ها:', error);
        }
    }

    if (dashboardData) {
        const tournamentsCount = Array.isArray(tournamentsData)
            ? tournamentsData.length
            : Array.isArray(dashboardData.tournament_history)
                ? dashboardData.tournament_history.length
                : 0;
        if (dashboardData.user_profile) {
            displayUserProfile(dashboardData.user_profile, teamsCount, tournamentsCount);
        }
        handleTeamExtrasFromDashboard(dashboardData);
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
    if (pictureField) {
        if (pictureField.type === 'file') {
            pictureField.value = '';
            pictureField.dataset.currentImage = team.team_picture || '';
        } else {
            pictureField.value = team.team_picture || '';
        }
    }

    const pictureHint = document.getElementById('edit_team_picture_hint');
    if (pictureHint) {
        const baseHint = 'برای تغییر تصویر تیم، فایل جدیدی از دستگاه خود انتخاب کنید.';
        const currentImage = team.team_picture || '';
        pictureHint.textContent = currentImage
            ? `${baseHint} تصویر فعلی: ${currentImage}`
            : baseHint;
    }

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
    const teamPicture = formData.get('team_picture');

    if (!name) {
        showError('نام تیم را وارد کنید.');
        return;
    }

    const payload = new FormData();
    payload.append('name', name);

    if (teamPicture instanceof File && teamPicture.size > 0) {
        payload.append('team_picture', teamPicture);
    }

    const submitButton = form.querySelector('button[type="submit"]');
    toggleButtonLoading(submitButton, true, 'در حال ایجاد...');

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/`, {
            method: 'POST',
            body: payload
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
    const teamPicture = formData.get('team_picture');

    if (!teamId) {
        showError('تیم معتبر نیست.');
        return;
    }

    if (!name) {
        showError('نام تیم را وارد کنید.');
        return;
    }

    const payload = new FormData();
    payload.append('name', name);

    if (teamPicture instanceof File && teamPicture.size > 0) {
        payload.append('team_picture', teamPicture);
    }

    const submitButton = form.querySelector('button[type="submit"]');
    toggleButtonLoading(submitButton, true, 'در حال ذخیره...');

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/${teamId}/`, {
            method: 'PATCH',
            body: payload
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

    const editUserButton = document.querySelector('[data-action="edit-user"]');
    if (editUserButton) {
        editUserButton.addEventListener('click', openEditUserModal);
    }

    const editUserForm = document.getElementById('edit_user_form');
    if (editUserForm) {
        editUserForm.addEventListener('submit', handleEditUserSubmit);
    }

    const editUserAvatarInput = document.getElementById('edit_user_avatar');
    if (editUserAvatarInput) {
        editUserAvatarInput.addEventListener('change', handleEditAvatarChange);
    }

    const createTeamLinks = document.querySelectorAll('.creat_team_link');
    createTeamLinks.forEach((link) => {
        const isTeamsPage = window.location.pathname.includes('teams');
        if (isTeamsPage) {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                openModal('create_team_modal');
            });
        } else if (!link.getAttribute('href')) {
            link.setAttribute('href', 'teams.html');
        }
    });
});
