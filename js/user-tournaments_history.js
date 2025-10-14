import { API_ENDPOINTS } from "./services/api-client.js";

const helperDefaults = {
    fetchWithAuth: async () => { throw new Error('fetchWithAuth helper is not configured.'); },
    extractErrorMessage: async () => 'خطای ناشناخته رخ داد.'
};

let helpers = { ...helperDefaults };
let matchesState = [];

export function configureTournamentHistoryModule(config = {}) {
    helpers = { ...helperDefaults, ...config };
}

export function normalizeTournamentHistory(data) {
    if (!data) return [];
    if (Array.isArray(data)) {
        return data;
    }
    if (Array.isArray(data?.tournament_history)) {
        return data.tournament_history;
    }
    if (Array.isArray(data?.matches)) {
        return data.matches;
    }
    if (Array.isArray(data?.results)) {
        return data.results;
    }
    return [];
}

export function getTournamentMatchesCount(data) {
    return normalizeTournamentHistory(data).length;
}

export async function fetchUserTournamentHistory(userId) {
    if (!userId) {
        console.warn('شناسه کاربر برای دریافت تاریخچه تورنومنت موجود نیست.');
        return [];
    }

    try {
        console.log('دریافت تاریخچه تورنومنت‌های کاربر از API...');

        const response = await helpers.fetchWithAuth(API_ENDPOINTS.users.userMatchHistory(userId), {
            method: 'GET'
        });

        console.log('Tournament history status:', response.status);

        if (!response.ok) {
            const message = await helpers.extractErrorMessage(response);
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
            return normalizeTournamentHistory(data);
        } catch (parseError) {
            console.error('خطا در parse تاریخچه تورنومنت:', parseError);
            throw new Error('داده‌های نامعتبر از سرور دریافت شد.');
        }
    } catch (error) {
        console.error('خطا در دریافت تاریخچه تورنومنت‌های کاربر:', error);
        throw error;
    }
}

export function displayTournamentHistory(matchesInput) {
    const matches = Array.isArray(matchesInput) ? matchesInput : [];
    matchesState = matches;
    const tbody = document.getElementById('tournaments_history_body');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (matches.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 6;
        cell.textContent = 'هیچ تاریخچه‌ای یافت نشد.';
        return;
    }

    matches.forEach(match => {
        const row = tbody.insertRow();
        row.insertCell().textContent = match.score || '-';
        row.insertCell().textContent = match.rank || '-';
        row.insertCell().textContent = new Date(match.created_at || match.date).toLocaleDateString('fa-IR');
        row.insertCell().textContent = match.team_name || '-';
        row.insertCell().textContent = match.game_name || match.tournament?.game?.name || '-';
        row.insertCell().textContent = match.tournament_name || match.tournament?.name || '-';
    });
}

export function getStoredTournamentMatches() {
    return matchesState.slice();
}
