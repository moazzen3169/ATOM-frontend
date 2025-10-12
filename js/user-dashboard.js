import { API_BASE_URL } from "../js/config.js";
import {
    initUserTeamsModule,
    updateTeamsUserContext,
    toTeamArray,
    displayUserTeams,
    handleTeamExtrasFromDashboard,
    ensureIncomingInvitationsLoaded,
    fetchUserTeams,
    setupTeamsPageInteractions
} from "./user-teams.js";

let authTokenCache = null;
let currentUserId = null;
let currentUsername = '';
let currentUserEmail = '';
let currentUserProfile = {};
let cachedTeamsCount = 0;
let cachedTournamentsCount = 0;
let verificationCache = null;

const DEFAULT_AVATAR_SRC = "../img/profile.jpg";
const LEGACY_PROFILE_ENDPOINTS = [
    '/api/users/users/me/',
    '/api/auth/users/me/',
    '/api/auth/me/',
    '/api/auth/user/'
];
const USER_LOOKUP_ENDPOINTS = [
    (username) => `/api/users/users/?username=${encodeURIComponent(username)}`,
    (username) => `/api/users/users/?search=${encodeURIComponent(username)}`,
    (username) => `/api/users/users/?search=${encodeURIComponent(username)}&page_size=1`
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

async function getUserVerificationLevel() {
    if (verificationCache !== null) {
        return verificationCache;
    }

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/verification/`, {
            method: 'GET'
        });

        if (!response.ok) {
            console.warn('Failed to fetch verification level:', response.status);
            return 0;
        }

        const data = await response.json();
        verificationCache = data.verification_level || 0;
        return verificationCache;
    } catch (error) {
        console.error('Error fetching verification level:', error);
        return 0;
    }
}

async function getUserProfile() {
    let profile = null;

    for (const endpoint of LEGACY_PROFILE_ENDPOINTS) {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}${endpoint}`, {
                method: 'GET'
            });

            if (response.ok) {
                profile = await response.json();
                break;
            } else if (response.status === 404) {
                continue;
            } else {
                console.warn(`Profile fetch failed for ${endpoint}:`, response.status);
            }
        } catch (error) {
            console.warn(`Error fetching profile from ${endpoint}:`, error);
        }
    }

    if (!profile) {
        profile = {
            id: currentUserId || null,
            username: currentUsername || 'کاربر',
            email: currentUserEmail || '',
            verification_level: 0
        };
    }

    if (typeof profile.verification_level === 'undefined') {
        profile.verification_level = await getUserVerificationLevel();
    }

    return profile;
}

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

function toUserArray(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object' && typeof payload.username === 'string') {
        return [payload];
    }
    const candidates = extractListFromObject(payload, ['results', 'users', 'data', 'items', 'entries']);
    if (Array.isArray(candidates)) return candidates;
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

function translateVerificationLevel(level) {
    const numLevel = Number(level) || 0;
    switch (numLevel) {
        case 0:
            return 'تایید نشده';
        case 1:
            return 'تایید پایه';
        case 2:
            return 'تایید پیشرفته';
        default:
            return `سطح ${numLevel}`;
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

async function lookupUserByUsername(username) {
    const normalizedUsername = (username || '').toString().trim().toLowerCase();
    if (!normalizedUsername) {
        return null;
    }

    for (const buildPath of USER_LOOKUP_ENDPOINTS) {
        const endpoint = `${API_BASE_URL}${buildPath(username)}`;
        try {
            const response = await fetchWithAuth(endpoint, { method: 'GET' });
            if (!response.ok) {
                if (response.status >= 500) {
                    const message = await extractErrorMessage(response);
                    throw new Error(message || 'خطا در جستجوی کاربر');
                }
                continue;
            }

            const raw = await response.text();
            if (!raw) {
                continue;
            }

            let data;
            try {
                data = JSON.parse(raw);
            } catch (parseError) {
                console.warn('خطا در parse نتیجه جستجوی کاربر:', parseError);
                continue;
            }

            const candidates = toUserArray(data);
            if (!candidates.length) {
                continue;
            }

            const exactMatch = candidates.find(user =>
                user && typeof user.username === 'string' && user.username.toLowerCase() === normalizedUsername
            );
            if (exactMatch) {
                return exactMatch;
            }

            const partialMatch = candidates.find(user =>
                user && typeof user.username === 'string' && user.username.toLowerCase().startsWith(normalizedUsername)
            );
            if (partialMatch) {
                return partialMatch;
            }
        } catch (error) {
            console.error(`خطا در جستجوی کاربر از طریق ${endpoint}:`, error);
        }
    }

    return null;
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
    updateTeamsUserContext({
        id: currentUserId,
        username: currentUsername,
        email: currentUserEmail
    });
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
        await ensureIncomingInvitationsLoaded({
            force: !incomingInvitationsLoadedFromApi || !Array.isArray(incomingInvitationsState) || incomingInvitationsState.length === 0,
            fallbackData: incomingInvitationsState
        });

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

        await ensureIncomingInvitationsLoaded({ force: true });

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

    initUserTeamsModule({
        fetchWithAuth,
        extractErrorMessage,
        toggleButtonLoading,
        openModal,
        closeModal,
        showError: typeof showError === 'function' ? showError : undefined,
        showSuccess: typeof showSuccess === 'function' ? showSuccess : undefined,
        formatDate,
        fetchDashboardData,
        fetchUserTournamentHistory,
        displayUserProfile,
        lookupUserByUsername
    });

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

    const editUserAvatarPreview = document.querySelector('.modal_avatar_preview');
    if (editUserAvatarPreview) {
        editUserAvatarPreview.addEventListener('click', () => {
            document.getElementById('edit_user_avatar').click();
        });
    }

});
