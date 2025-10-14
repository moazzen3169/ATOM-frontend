import { API_ENDPOINTS, createAuthApiClient, extractApiError } from "./services/api-client.js";
import {
    configureTeamModule,
    setTeamUserContext,
    toTeamArray,
    displayUserTeams,
    applyDashboardTeamData,
    ensureIncomingInvitationsLoaded,
    fetchUserTeams,
    setupTeamsPageInteractions
} from "./user-teams.js";
import {
    configureTournamentHistoryModule,
    normalizeTournamentHistory,
    fetchUserTournamentHistory,
    displayTournamentHistory,
    getTournamentMatchesCount
} from "./user-tournaments_history.js";

const apiClient = createAuthApiClient();
let currentUserId = null;
let currentUsername = '';
let currentUserEmail = '';
let currentUserProfile = {};
let cachedTeamsCount = 0;
let cachedTournamentsCount = 0;
let verificationCache = null;
let notificationsState = [];
let unreadNotificationsCount = 0;

const DEFAULT_AVATAR_SRC = "../img/profile.jpg";
const LEGACY_PROFILE_ENDPOINTS = [
    API_ENDPOINTS.users.me,
    '/api/auth/users/me/',
    '/api/auth/me/',
    '/api/auth/user/'
];
function getProfileUpdateEndpoints() {
    const endpoints = [API_ENDPOINTS.auth.profile];
    if (currentUserId) {
        endpoints.push(API_ENDPOINTS.users.detail(currentUserId));
    }
    endpoints.push(...LEGACY_PROFILE_ENDPOINTS);
    return Array.from(new Set(endpoints));
}
const PROFILE_BIO_KEYS = ['bio', 'about', 'description'];

const NOTIFICATIONS_ENDPOINTS = [
    API_ENDPOINTS.users.notifications,
    '/api/notifications/',
    '/api/users/user-notifications/',
    '/api/notifications/user/',
    '/api/users/notifications/list/'
];

async function getUserVerificationLevel() {
    if (verificationCache !== null) {
        return verificationCache;
    }

    try {
        const response = await fetchWithAuth(API_ENDPOINTS.users.verification, {
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
            const response = await fetchWithAuth(endpoint, {
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
        const endpoint = endpointPath;
        try {
            const headers = new Headers();

            if (!isMultipart) {
                headers.set('Content-Type', 'application/json');
            }
            headers.set('Accept', 'application/json');

            const response = await fetchWithAuth(endpoint, {
                method: 'PATCH',
                body: bodyFactory(),
                headers
            });

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
    let token = apiClient.getAccessToken();

    if (!token && typeof localStorage !== 'undefined') {
        const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
        if (storedToken) {
            apiClient.setAccessToken(storedToken);
            token = storedToken;
        }
    }

    if (!token) {
        showError("ابتدا وارد حساب کاربری شوید");
        window.location.href = "../register/login.html";
        return null;
    }

    return token;
}

// تابع برای دریافت اطلاعات داشبورد
async function fetchDashboardData() {
    try {
        console.log('دریافت اطلاعات داشبورد از API...');

        const response = await fetchWithAuth(API_ENDPOINTS.users.dashboard, {
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
        const message = await extractErrorMessage(error);
        if (error instanceof Error) {
            error.message = message || error.message || 'خطا در دریافت داده‌های داشبورد.';
            throw error;
        }
        throw new Error(message || 'خطا در دریافت داده‌های داشبورد.');
    }
}

async function fetchWithAuth(url, options = {}, retry = true) {
    const token = apiClient.getAccessToken() || setupToken();
    if (!token) {
        throw new Error('برای انجام این عملیات ابتدا وارد حساب کاربری شوید.');
    }

    try {
        return await apiClient.fetch(url, { ...options, retry });
    } catch (error) {
        if (error && error.code === 'AUTH_REQUIRED') {
            throw new Error('برای انجام این عملیات ابتدا وارد حساب کاربری شوید.');
        }
        throw error;
    }
}

function flattenErrorDetail(detail) {
    if (!detail) return '';
    if (typeof detail === 'string') {
        return detail;
    }
    if (Array.isArray(detail)) {
        return detail
            .map(item => flattenErrorDetail(item))
            .filter(Boolean)
            .join(' | ');
    }
    if (typeof detail === 'object') {
        return Object.values(detail)
            .map(value => flattenErrorDetail(value))
            .filter(Boolean)
            .join(' | ');
    }
    return String(detail);
}

async function extractErrorMessage(errorOrResponse) {
    if (!errorOrResponse) {
        return 'خطای ناشناخته رخ داد.';
    }

    const isResponseLike = typeof errorOrResponse === 'object'
        && typeof errorOrResponse.headers === 'object'
        && typeof errorOrResponse.text === 'function';

    if (isResponseLike) {
        return extractApiError(errorOrResponse);
    }

    if (typeof errorOrResponse === 'string') {
        return errorOrResponse;
    }

    if (typeof errorOrResponse === 'object') {
        const detailCandidates = [errorOrResponse.detail, errorOrResponse.error];
        for (const candidate of detailCandidates) {
            const detailMessage = flattenErrorDetail(candidate);
            if (detailMessage) {
                return detailMessage;
            }
        }

        if (errorOrResponse instanceof Error) {
            if (errorOrResponse.message && errorOrResponse.message !== 'REQUEST_FAILED') {
                return errorOrResponse.message;
            }
        } else if (typeof errorOrResponse.message === 'string' && errorOrResponse.message !== 'REQUEST_FAILED') {
            return errorOrResponse.message;
        }
    }

    if (errorOrResponse instanceof Error && errorOrResponse.message && errorOrResponse.message !== 'REQUEST_FAILED') {
        return errorOrResponse.message;
    }

    return 'خطای ناشناخته رخ داد.';
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
    setTeamUserContext({
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

        setPageTitle();

        const dashboardData = await fetchDashboardData();
        const hasTeamsContainer = Boolean(document.getElementById('teams_container'));
        const hasTournamentTable = Boolean(document.getElementById('tournaments_history_body'));

        const initialTeams = toTeamArray(dashboardData?.teams);
        const initialTournamentHistory = normalizeTournamentHistory(dashboardData?.tournament_history);

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

        applyDashboardTeamData(dashboardData);
        await ensureIncomingInvitationsLoaded();

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
            tournamentsData = normalizeTournamentHistory(tournamentsResult.value);
        } else if (userId) {
            console.error('خطا در دریافت تاریخچه تورنومنت‌ها:', tournamentsResult.reason);
            showError('خطا در دریافت تاریخچه تورنومنت‌ها. لطفاً دوباره تلاش کنید.');
        }

        const teamsCount = teamsData.length;
        const tournamentsCount = getTournamentMatchesCount(tournamentsData);

        if (dashboardData?.user_profile) {
            displayUserProfile(dashboardData.user_profile, teamsCount, tournamentsCount);
        }

        if (hasTeamsContainer) {
            displayUserTeams(teamsData);
        }

        if (hasTournamentTable) {
            displayTournamentHistory(tournamentsData);
        }

    } catch (error) {
        console.error("خطا در لود کردن اطلاعات داشبورد:", error);

        await ensureIncomingInvitationsLoaded({ force: true });

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

configureTeamModule({
    fetchWithAuth,
    extractErrorMessage,
    toggleButtonLoading,
    showError,
    showSuccess,
    openModal,
    closeModal,
    formatDate,
    onTeamsUpdated: async () => {
        await loadDashboardData();
    }
});

configureTournamentHistoryModule({
    fetchWithAuth,
    extractErrorMessage
});

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

    const editUserAvatarPreview = document.querySelector('.modal_avatar_preview');
    if (editUserAvatarPreview) {
        editUserAvatarPreview.addEventListener('click', () => {
            document.getElementById('edit_user_avatar').click();
        });
    }

});
