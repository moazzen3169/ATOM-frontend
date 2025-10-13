import { API_BASE_URL } from "../js/config.js";
import { createTeamsModule } from "./user-teams.js";

let authTokenCache = null;
let currentUserId = null;
let currentUsername = '';
let currentUserEmail = '';
let currentUserProfile = {};
let cachedTeamsCount = 0;
let cachedTournamentsCount = 0;
let verificationCache = null;
let teamsModule;

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


async function loadDashboardData() {
    const token = setupToken();
    if (!token) return;

    try {
        console.log('شروع لود اطلاعات داشبورد...');

        setPageTitle();

        const dashboardData = await fetchDashboardData();
        const hasTeamsContainer = Boolean(document.getElementById('teams_container'));
        const hasTournamentTable = Boolean(document.getElementById('tournaments_history_body'));

        const initialTeams = teamsModule.toTeamArray(dashboardData?.teams);
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
            teamsModule.displayUserTeams(initialTeams);
        }

        if (hasTournamentTable) {
            displayTournamentHistory(initialTournamentHistory);
        }

        teamsModule.handleTeamExtrasFromDashboard(dashboardData);
        await teamsModule.ensureIncomingInvitationsLoaded({
            force: !teamsModule.areIncomingInvitationsLoaded() || !Array.isArray(teamsModule.getIncomingInvitationsState()) || teamsModule.getIncomingInvitationsState().length === 0,
            fallbackData: teamsModule.getIncomingInvitationsState()
        });

        const userId = dashboardData?.user_profile?.id || currentUserId;
        const teamsPromise = teamsModule.fetchUserTeams();
        const tournamentsPromise = userId
            ? fetchUserTournamentHistory(userId)
            : Promise.resolve(initialTournamentHistory);

        const [teamsResult, tournamentsResult] = await Promise.allSettled([
            teamsPromise,
            tournamentsPromise
        ]);

        let teamsData = initialTeams;
        if (teamsResult.status === 'fulfilled') {
            teamsData = teamsModule.toTeamArray(teamsResult.value);
        } else {
            console.error('خطا در دریافت تیم‌ها:', teamsResult.reason);
            if (typeof window !== 'undefined' && typeof window.showError === 'function') {
                window.showError('خطا در دریافت اطلاعات تیم‌ها. لطفاً دوباره تلاش کنید.');
            }
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
        } else if (userId) {
            console.error('خطا در دریافت تاریخچه تورنومنت‌ها:', tournamentsResult.reason);
            if (typeof window !== 'undefined' && typeof window.showError === 'function') {
                window.showError('خطا در دریافت تاریخچه تورنومنت‌ها. لطفاً دوباره تلاش کنید.');
            }
        }

        if (dashboardData?.user_profile) {
            displayUserProfile(
                dashboardData.user_profile,
                teamsModule.toTeamArray(teamsData).length,
                Array.isArray(tournamentsData) ? tournamentsData.length : 0
            );
        }

        if (hasTeamsContainer) {
            teamsModule.displayUserTeams(teamsData);
        }

        if (hasTournamentTable) {
            displayTournamentHistory(Array.isArray(tournamentsData) ? tournamentsData : []);
        }

    } catch (error) {
        console.error('خطا در لود کردن اطلاعات داشبورد:', error);

        await teamsModule.ensureIncomingInvitationsLoaded({ force: true });

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
            if (typeof window !== 'undefined' && typeof window.showError === 'function') {
                window.showError('خطا در دریافت اطلاعات. لطفا دوباره وارد شوید.');
            }
            localStorage.clear();
            window.location.href = '../register/login.html';
        }
    }
}

async function refreshTeamData() {
    const token = authTokenCache || setupToken();
    if (!token) return;
    if (!window.location.pathname.includes('teams')) return;

    const [dashboardResult, teamsResult] = await Promise.allSettled([
        fetchDashboardData(),
        teamsModule.fetchUserTeams()
    ]);

    if (teamsResult.status === 'fulfilled') {
        teamsModule.displayUserTeams(teamsResult.value);
    }

    const fallbackTeams = teamsResult.status === 'fulfilled'
        ? teamsModule.toTeamArray(teamsResult.value)
        : teamsModule.toTeamArray(teamsModule.getTeamsState());
    const teamsCount = fallbackTeams.length;

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
        teamsModule.handleTeamExtrasFromDashboard(dashboardData);
        await teamsModule.ensureIncomingInvitationsLoaded({
            force: !teamsModule.areIncomingInvitationsLoaded() || !Array.isArray(teamsModule.getIncomingInvitationsState()) || teamsModule.getIncomingInvitationsState().length === 0,
            fallbackData: teamsModule.getIncomingInvitationsState()
        });
    } else {
        teamsModule.displayIncomingInvitations(teamsModule.getIncomingInvitationsState());
        teamsModule.displayJoinRequests(teamsModule.getJoinRequestsState());
        teamsModule.displayOutgoingInvitations(teamsModule.getOutgoingInvitationsState());
        await teamsModule.ensureIncomingInvitationsLoaded({ force: true });
    }
}

teamsModule = createTeamsModule({
    formatDate,
    fetchWithAuth,
    extractErrorMessage,
    toggleButtonLoading,
    lookupUserByUsername,
    showError: (...args) => {
        if (typeof window !== 'undefined' && typeof window.showError === 'function') {
            window.showError(...args);
        } else {
            console.error(...args);
        }
    },
    showSuccess: (...args) => {
        if (typeof window !== 'undefined' && typeof window.showSuccess === 'function') {
            window.showSuccess(...args);
        } else {
            console.log(...args);
        }
    },
    openModal,
    closeModal,
    getCurrentUserId: () => currentUserId,
    getCurrentUsername: () => currentUsername,
    getCurrentUserEmail: () => currentUserEmail,
    refreshTeamData,
    extractListFromObject
});

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
    teamsModule.setupTeamsPageInteractions();

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
