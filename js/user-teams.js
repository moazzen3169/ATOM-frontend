import { API_BASE_URL } from "./config.js";

const TEAM_INVITATIONS_ENDPOINTS = [
    '/api/users/teams/invitations/received/',
    '/api/users/teams/invitations/',
    '/api/users/team-invitations/',
    '/api/users/teams/pending-invitations/',
    '/api/users/teams/incoming-invitations/',
    '/api/users/teams/invitations/active/'
];

const dependencies = {
    fetchWithAuth: null,
    extractErrorMessage: null,
    toggleButtonLoading: null,
    openModal: null,
    closeModal: null,
    showError: (message) => console.error(message),
    showSuccess: (message) => console.log(message),
    formatDate: (dateString) => {
        if (!dateString || dateString === '-') return '-';
        try {
            return new Date(dateString).toLocaleDateString('fa-IR');
        } catch (error) {
            console.warn('Failed to format date in teams module:', error);
            return dateString;
        }
    },
    fetchDashboardData: null,
    fetchUserTournamentHistory: null,
    displayUserProfile: null,
    lookupUserByUsername: null,
};

let userContext = {
    id: null,
    username: '',
    email: ''
};

let teamsState = [];
let incomingInvitationsState = [];
let outgoingInvitationsState = [];
let joinRequestsState = [];
let pendingConfirmation = null;
let teamsInteractionsInitialized = false;
let incomingInvitationsLoadedFromApi = false;

function notifyError(message) {
    if (typeof dependencies.showError === 'function') {
        dependencies.showError(message);
        return;
    }
    if (typeof window !== 'undefined' && typeof window.showError === 'function') {
        window.showError(message);
        return;
    }
    console.error(message);
}

function notifySuccess(message) {
    if (typeof dependencies.showSuccess === 'function') {
        dependencies.showSuccess(message);
        return;
    }
    if (typeof window !== 'undefined' && typeof window.showSuccess === 'function') {
        window.showSuccess(message);
        return;
    }
    console.log(message);
}

function toggleButtonLoading(button, isLoading, loadingText) {
    if (typeof dependencies.toggleButtonLoading === 'function') {
        dependencies.toggleButtonLoading(button, isLoading, loadingText);
        return;
    }
    if (!button) return;
    if (isLoading) {
        button.disabled = true;
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }
        if (loadingText) {
            button.textContent = loadingText;
        }
    } else {
        button.disabled = false;
        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }
}

function openModal(modalId) {
    if (typeof dependencies.openModal === 'function') {
        dependencies.openModal(modalId);
    }
}

function closeModal(modalId) {
    if (typeof dependencies.closeModal === 'function') {
        dependencies.closeModal(modalId);
    }
}

function getFormattedDate(value) {
    return dependencies.formatDate ? dependencies.formatDate(value) : value;
}

function requireDependency(name) {
    if (typeof dependencies[name] !== 'function') {
        throw new Error(`Dependency ${name} is required for user-teams module.`);
    }
    return dependencies[name];
}

export function initUserTeamsModule(options = {}) {
    Object.assign(dependencies, options);
}

export function updateTeamsUserContext({ id = null, username = '', email = '' } = {}) {
    userContext = {
        id: id !== undefined && id !== null ? Number(id) : null,
        username: username || '',
        email: email || ''
    };
}

export function toTeamArray(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.results)) return payload.results;
    if (Array.isArray(payload.teams)) return payload.teams;
    return [];
}

function toInvitationArray(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;

    const primaryCandidates = [
        'results',
        'data',
        'items',
        'entries',
        'list',
        'invitations',
        'incoming_invitations',
        'received_invitations',
        'team_invitations',
        'pending_invitations',
        'active_invitations',
        'received'
    ];

    for (const key of primaryCandidates) {
        if (!Object.prototype.hasOwnProperty.call(payload, key)) {
            continue;
        }
        const value = payload[key];
        if (Array.isArray(value)) {
            return value;
        }
        if (value && typeof value === 'object') {
            const nestedCandidates = ['results', 'data', 'items', 'entries', 'list', 'received'];
            for (const nestedKey of nestedCandidates) {
                const nestedValue = value[nestedKey];
                if (Array.isArray(nestedValue)) {
                    return nestedValue;
                }
            }
        }
    }

    if (payload.invitations && typeof payload.invitations === 'object') {
        const nested = payload.invitations;
        if (Array.isArray(nested)) {
            return nested;
        }
        const nestedCandidates = ['results', 'data', 'items', 'entries', 'list', 'received'];
        for (const nestedKey of nestedCandidates) {
            const nestedValue = nested[nestedKey];
            if (Array.isArray(nestedValue)) {
                return nestedValue;
            }
        }
    }

    if (payload.detail && typeof payload.detail === 'string') {
        return [];
    }

    if (typeof payload === 'object' && (Object.prototype.hasOwnProperty.call(payload, 'id') || Object.prototype.hasOwnProperty.call(payload, 'invitation_id'))) {
        return [payload];
    }

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

function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function extractUserDisplayName(user) {
    if (!user) return '';
    if (typeof user === 'string') return user;
    if (typeof user.full_name === 'string' && user.full_name.trim()) return user.full_name;
    const parts = [user.first_name, user.last_name].filter(Boolean);
    if (parts.length) return parts.join(' ');
    return user.username || user.name || user.display_name || '';
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

    const normalizedCurrentId = userContext.id !== null && typeof userContext.id !== 'undefined'
        ? String(userContext.id)
        : null;

    for (const candidate of idCandidates) {
        if (candidate === null || typeof candidate === 'undefined') continue;
        if (normalizedCurrentId !== null && String(candidate) === normalizedCurrentId) {
            return true;
        }
    }

    const normalizedCurrentUsername = userContext.username ? userContext.username.toLowerCase() : '';
    const usernameCandidates = [
        member.username,
        member.user?.username,
        member.player?.username,
        member.member?.username,
        member.profile?.username
    ];
    for (const candidate of usernameCandidates) {
        if (candidate && normalizedCurrentUsername && candidate.toLowerCase() === normalizedCurrentUsername) {
            return true;
        }
    }

    const normalizedCurrentEmail = userContext.email ? userContext.email.toLowerCase() : '';
    const emailCandidates = [
        member.email,
        member.user?.email,
        member.player?.email,
        member.member?.email,
        member.profile?.email
    ];
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

function isTeamCaptain(team) {
    if (!team) return false;
    if (typeof team.captain === 'number' && userContext.id !== null && team.captain === userContext.id) return true;
    if (typeof team.captain_id === 'number' && userContext.id !== null && team.captain_id === userContext.id) return true;
    if (userContext.id !== null && team.captain === userContext.id) return true;
    const captainDetail = team.captain_detail || team.captain_info || team.captain_user;
    if (captainDetail && typeof captainDetail === 'object') {
        const idCandidates = [captainDetail.id, captainDetail.user_id, captainDetail.user?.id];
        for (const candidate of idCandidates) {
            if (candidate !== null && typeof candidate !== 'undefined' && userContext.id !== null && Number(candidate) === userContext.id) {
                return true;
            }
        }
        const usernameCandidates = [captainDetail.username, captainDetail.user?.username];
        const normalizedUsername = userContext.username ? userContext.username.toLowerCase() : '';
        for (const candidate of usernameCandidates) {
            if (candidate && normalizedUsername && candidate.toLowerCase() === normalizedUsername) {
                return true;
            }
        }
    }
    return false;
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
        if (['pending', 'requested', 'invited'].includes(status)) {
            return true;
        }

        return false;
    });
}

function getTeamNameFromItem(item) {
    if (!item) return '';
    if (item.team && typeof item.team === 'object') {
        return item.team.name || item.team.title || item.team.slug || item.team.team_name || item.team.display_name || '';
    }
    if (typeof item.team === 'string') return item.team;
    if (item.team_name) return item.team_name;
    if (item.teamTitle) return item.teamTitle;
    if (item.team_info && item.team_info.name) return item.team_info.name;
    if (typeof item.name === 'string') return item.name;
    if (typeof item.title === 'string') return item.title;
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
        || item.sender_name
        || item.inviter?.username
        || item.inviter_name
        || item.approved_by?.username
        || item.approved_by_name
        || item.owner?.username
        || item.created_by?.username
        || item.captain?.username
        || item.captain_username
        || item.requester_name
        || item.requested_by
        || (typeof item.user === 'string' ? item.user : '')
        || '';
}

function getInvitationStatus(item) {
    const statusCandidates = [
        item.status,
        item.state,
        item.invitation_status,
        item.membership_status,
        item.request_status
    ].filter(Boolean);

    if (statusCandidates.length) {
        return String(statusCandidates[0]).toLowerCase();
    }

    if (item.is_accepted) return 'accepted';
    if (item.is_declined) return 'declined';
    if (item.is_pending) return 'pending';

    return '';
}

function getStatusLabel(status) {
    const normalized = (status || '').toString().toLowerCase();
    switch (normalized) {
        case 'accepted':
        case 'approved':
        case 'confirmed':
        case 'joined':
            return 'تایید شده';
        case 'declined':
        case 'rejected':
        case 'cancelled':
            return 'رد شده';
        case 'pending':
        case 'waiting':
        case 'requested':
        case 'invited':
            return 'در انتظار';
        default:
            return normalized || 'نامشخص';
    }
}

function getStatusBadgeClass(status) {
    const normalized = (status || '').toString().toLowerCase();
    switch (normalized) {
        case 'accepted':
        case 'approved':
        case 'confirmed':
        case 'joined':
            return 'badge--success';
        case 'declined':
        case 'rejected':
        case 'cancelled':
            return 'badge--danger';
        case 'pending':
        case 'waiting':
        case 'requested':
        case 'invited':
            return 'badge--warning';
        default:
            return 'badge--muted';
    }
}

function isPendingStatus(status) {
    const normalized = (status || '').toString().toLowerCase();
    return ['pending', 'waiting', 'requested', 'invited'].includes(normalized);
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

function createTeamCard(team) {
    const card = document.createElement('article');
    card.className = 'team_card';
    if (team && typeof team.id !== 'undefined') {
        card.dataset.teamId = team.id;
    }

    const avatarSrc = team?.team_picture || '../img/profile.jpg';
    const membersMeta = getTeamMembersMeta(team || {});
    const captainName = getCaptainName(team || {}) || '-';
    const captainLabel = escapeHTML(captainName || '-');
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
                    <dd>${captainLabel}</dd>
                </div>
                ${createdAt ? `<div><dt>تاریخ ایجاد</dt><dd>${escapeHTML(getFormattedDate(createdAt))}</dd></div>` : ''}
            </dl>
            ${membersMeta.chips ? `<div class="team_members_chips">${membersMeta.chips}</div>` : ''}
            ${description ? `<p class="team_description">${escapeHTML(description)}</p>` : ''}
        </div>
    `;

    const isTeamsPage = window.location.pathname.includes('teams');
    const hasValidTeamId = typeof team?.id !== 'undefined' && team?.id !== null;

    if (isTeamsPage && hasValidTeamId) {
        const footer = document.createElement('footer');
        footer.className = 'team_card__footer';

        const actions = document.createElement('div');
        actions.className = 'team_card__actions';
        const teamIdAttr = escapeHTML(String(team.id));

        if (isCaptain) {
            actions.innerHTML = `
                <button type="button" class="btn btn--primary" data-team-action="invite" data-team-id="${teamIdAttr}" aria-label="دعوت عضو به تیم ${escapeHTML(team?.name || '')}">دعوت عضو</button>
                <button type="button" class="btn" data-team-action="edit" data-team-id="${teamIdAttr}" aria-label="ویرایش تیم ${escapeHTML(team?.name || '')}">ویرایش تیم</button>
                <button type="button" class="btn btn--danger" data-team-action="delete" data-team-id="${teamIdAttr}" aria-label="حذف تیم ${escapeHTML(team?.name || '')}">حذف تیم</button>
            `;
        } else {
            actions.innerHTML = `
                <button type="button" class="btn btn--danger" data-team-action="leave" data-team-id="${teamIdAttr}" aria-label="خروج از تیم ${escapeHTML(team?.name || '')}">خروج از تیم</button>
            `;
        }

        footer.appendChild(actions);
        card.appendChild(footer);
    }

    return card;
}

export function displayUserTeams(teamsInput) {
    const container = document.getElementById('teams_container');
    if (!container) return;

    teamsState = toTeamArray(teamsInput);
    renderTeamsList();
}

export function handleTeamExtrasFromDashboard(dashboardData) {
    if (!dashboardData || typeof dashboardData !== 'object') return;

    const incoming = extractListFromObject(dashboardData, [
        'team_invitations',
        'incoming_invitations',
        'invitations',
        'received_invitations'
    ]);
    if (incoming !== undefined) {
        incomingInvitationsState = Array.isArray(incoming) ? incoming : [];
        incomingInvitationsLoadedFromApi = false;
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
        container.innerHTML = '<div class="empty_state">درخواستی برای عضویت وجود ندارد.</div>';
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
        container.innerHTML = '<div class="empty_state">دعوتی ارسال نشده است.</div>';
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
    const senderSource = invitation.sender || invitation.invited_by || invitation.inviter || invitation.owner || invitation;
    const senderName = getUsernameFromItem(senderSource) || invitation.sender_name || invitation.inviter_name || '';
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
            ${createdAt ? `<span class="mini_card__subtitle">${escapeHTML(getFormattedDate(createdAt))}</span>` : ''}
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
            ${createdAt ? `<span class="mini_card__subtitle">${escapeHTML(getFormattedDate(createdAt))}</span>` : ''}
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
            ${createdAt ? `<span class="mini_card__subtitle">${escapeHTML(getFormattedDate(createdAt))}</span>` : ''}
        </div>
    `;

    return card;
}

async function fetchIncomingTeamInvitations() {
    const fetchWithAuth = requireDependency('fetchWithAuth');
    const extractErrorMessage = dependencies.extractErrorMessage;

    let lastError = null;

    for (const endpoint of TEAM_INVITATIONS_ENDPOINTS) {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}${endpoint}`, {
                method: 'GET'
            });

            if (!response.ok) {
                if (response.status >= 500) {
                    let message = null;
                    if (typeof extractErrorMessage === 'function') {
                        try {
                            message = await extractErrorMessage(response);
                        } catch (error) {
                            message = null;
                        }
                    }
                    console.warn(`خطا در دریافت دعوت‌نامه‌ها از ${endpoint}:`, message || response.status);
                }
                continue;
            }

            const raw = await response.text();
            if (!raw) {
                return [];
            }

            let data;
            try {
                data = JSON.parse(raw);
            } catch (parseError) {
                console.warn(`امکان parse پاسخ دعوت‌نامه‌ها از ${endpoint} وجود ندارد:`, parseError);
                continue;
            }

            if (data && typeof data === 'object' && !Array.isArray(data) && typeof data.detail === 'string') {
                continue;
            }

            const invitations = toInvitationArray(data);
            if (Array.isArray(invitations)) {
                return invitations;
            }
        } catch (error) {
            lastError = error;
            console.warn(`خطا در تلاش برای دریافت دعوت‌نامه‌ها از ${endpoint}:`, error);
        }
    }

    if (lastError) {
        throw lastError;
    }

    return [];
}

export async function ensureIncomingInvitationsLoaded({ force = false, fallbackData = null } = {}) {
    const hasFallback = Array.isArray(fallbackData) && fallbackData.length > 0;

    if (hasFallback && !force && !incomingInvitationsLoadedFromApi) {
        incomingInvitationsState = fallbackData;
        displayIncomingInvitations(incomingInvitationsState);
        return incomingInvitationsState;
    }

    if (incomingInvitationsLoadedFromApi && !force) {
        displayIncomingInvitations(incomingInvitationsState);
        return incomingInvitationsState;
    }

    try {
        const invitations = await fetchIncomingTeamInvitations();
        incomingInvitationsState = Array.isArray(invitations) ? invitations : [];
        incomingInvitationsLoadedFromApi = true;
        displayIncomingInvitations(incomingInvitationsState);
        return incomingInvitationsState;
    } catch (error) {
        console.error('خطا در دریافت دعوت‌نامه‌های تیم:', error);
        incomingInvitationsLoadedFromApi = false;

        if (Array.isArray(fallbackData)) {
            incomingInvitationsState = fallbackData;
        }

        displayIncomingInvitations(incomingInvitationsState);
        return incomingInvitationsState;
    }
}

export async function fetchUserTeams() {
    const fetchWithAuth = requireDependency('fetchWithAuth');
    const extractErrorMessage = dependencies.extractErrorMessage;

    try {
        console.log('دریافت تیم‌های کاربر از API...');

        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/`, {
            method: 'GET'
        });

        console.log('Status:', response.status);
        if (!response.ok) {
            const message = typeof extractErrorMessage === 'function'
                ? await extractErrorMessage(response)
                : null;
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
        console.error('خطا در دریافت تیم‌های کاربر:', error);
        throw error;
    }
}

export async function refreshTeamData() {
    const fetchDashboardData = dependencies.fetchDashboardData;
    const fetchUserTournamentHistory = dependencies.fetchUserTournamentHistory;
    const displayUserProfile = dependencies.displayUserProfile;

    const fetchWithAuth = dependencies.fetchWithAuth;
    if (!fetchDashboardData || !fetchWithAuth) {
        console.warn('وابستگی‌های لازم برای بروزرسانی تیم‌ها موجود نیست.');
        return;
    }

    const [dashboardResult, teamsResult] = await Promise.allSettled([
        fetchDashboardData(),
        fetchUserTeams()
    ]);

    if (teamsResult.status === 'fulfilled') {
        displayUserTeams(teamsResult.value);
    }

    const teamsCount = toTeamArray(teamsResult.status === 'fulfilled' ? teamsResult.value : teamsState).length;

    const dashboardData = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
    const userId = dashboardData?.user_profile?.id || userContext.id;
    let tournamentsData = [];

    if (userId && typeof fetchUserTournamentHistory === 'function') {
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

    if (dashboardData && typeof displayUserProfile === 'function') {
        const tournamentsCount = Array.isArray(tournamentsData)
            ? tournamentsData.length
            : Array.isArray(dashboardData?.tournament_history)
                ? dashboardData.tournament_history.length
                : 0;
        if (dashboardData.user_profile) {
            displayUserProfile(dashboardData.user_profile, teamsCount, tournamentsCount);
        }
        handleTeamExtrasFromDashboard(dashboardData);
        await ensureIncomingInvitationsLoaded({
            force: !incomingInvitationsLoadedFromApi || !Array.isArray(incomingInvitationsState) || incomingInvitationsState.length === 0,
            fallbackData: incomingInvitationsState
        });
    } else {
        displayIncomingInvitations(incomingInvitationsState);
        displayJoinRequests(joinRequestsState);
        displayOutgoingInvitations(outgoingInvitationsState);
        await ensureIncomingInvitationsLoaded({ force: true });
    }
}

function openEditTeamModal(teamId) {
    const form = document.getElementById('edit_team_form');
    if (!form) return;
    const team = teamsState.find(teamItem => String(teamItem.id) === String(teamId));
    if (!team) {
        notifyError('تیم مورد نظر یافت نشد.');
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
    const teamField = document.getElementById('invite_team_id');
    if (teamField) teamField.value = teamId;
    const usernameField = document.getElementById('invite_member_username');
    if (usernameField) usernameField.value = '';
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
        notifyError('نام تیم را وارد کنید.');
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
        const fetchWithAuth = requireDependency('fetchWithAuth');
        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/`, {
            method: 'POST',
            body: payload
        });

        if (!response.ok) {
            const extractErrorMessage = dependencies.extractErrorMessage;
            const message = typeof extractErrorMessage === 'function'
                ? await extractErrorMessage(response)
                : null;
            throw new Error(message || 'خطا در ایجاد تیم');
        }

        notifySuccess('تیم با موفقیت ایجاد شد.');
        closeModal('create_team_modal');
        form.reset();
        await refreshTeamData();
    } catch (error) {
        console.error('خطا در ایجاد تیم:', error);
        notifyError(error.message || 'خطا در ایجاد تیم');
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
        notifyError('تیم معتبر نیست.');
        return;
    }

    if (!name) {
        notifyError('نام تیم را وارد کنید.');
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
        const fetchWithAuth = requireDependency('fetchWithAuth');
        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/${teamId}/`, {
            method: 'PATCH',
            body: payload
        });

        if (!response.ok) {
            const extractErrorMessage = dependencies.extractErrorMessage;
            const message = typeof extractErrorMessage === 'function'
                ? await extractErrorMessage(response)
                : null;
            throw new Error(message || 'خطا در بروزرسانی تیم');
        }

        notifySuccess('تیم با موفقیت به‌روزرسانی شد.');
        closeModal('edit_team_modal');
        form.reset();
        await refreshTeamData();
    } catch (error) {
        console.error('خطا در بروزرسانی تیم:', error);
        notifyError(error.message || 'خطا در بروزرسانی تیم');
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
        notifyError('تیم معتبر نیست.');
        return;
    }

    if (!username) {
        notifyError('نام کاربری کاربر را وارد کنید.');
        return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    toggleButtonLoading(submitButton, true, 'در حال ارسال...');

    try {
        const lookupUserByUsername = requireDependency('lookupUserByUsername');
        const user = await lookupUserByUsername(username);
        if (!user) {
            throw new Error('کاربری با این نام کاربری یافت نشد.');
        }

        const payload = { username: user.username };
        if (typeof user.id !== 'undefined' && user.id !== null) {
            payload.user_id = user.id;
        }

        const fetchWithAuth = requireDependency('fetchWithAuth');
        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/${teamId}/add-member/`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const extractErrorMessage = dependencies.extractErrorMessage;
            const message = typeof extractErrorMessage === 'function'
                ? await extractErrorMessage(response)
                : null;
            throw new Error(message || 'خطا در ارسال دعوت');
        }

        let responseData = null;
        try {
            responseData = await response.clone().json();
        } catch (parseError) {
            if (response.status !== 204) {
                console.warn('امکان parse پاسخ دعوت وجود ندارد:', parseError);
            }
        }

        notifySuccess('درخواست عضویت با موفقیت برای کاربر ارسال شد.');
        closeModal('invite_member_modal');
        form.reset();

        if (responseData) {
            const updatedOutgoing = extractListFromObject(responseData, [
                'outgoing_invitations',
                'sent_invitations',
                'team_invitations'
            ]);
            if (Array.isArray(updatedOutgoing)) {
                outgoingInvitationsState = updatedOutgoing;
                displayOutgoingInvitations(outgoingInvitationsState);
            } else {
                await refreshTeamData();
            }
        } else {
            await refreshTeamData();
        }
    } catch (error) {
        console.error('خطا در ارسال دعوت:', error);
        notifyError(error.message || 'خطا در ارسال دعوت');
    } finally {
        toggleButtonLoading(submitButton, false);
    }
}

async function handleDeleteTeam(teamId) {
    if (!teamId) throw new Error('شناسه تیم نامعتبر است.');

    const fetchWithAuth = requireDependency('fetchWithAuth');
    const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/${teamId}/`, {
        method: 'DELETE'
    });

    if (!(response.ok || response.status === 204)) {
        const extractErrorMessage = dependencies.extractErrorMessage;
        const message = typeof extractErrorMessage === 'function'
            ? await extractErrorMessage(response)
            : null;
        throw new Error(message || 'خطا در حذف تیم');
    }

    notifySuccess('تیم با موفقیت حذف شد.');
    await refreshTeamData();
}

async function handleLeaveTeam(teamId) {
    if (!teamId) throw new Error('شناسه تیم نامعتبر است.');

    const fetchWithAuth = requireDependency('fetchWithAuth');
    const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/${teamId}/leave_team/`, {
        method: 'POST',
        body: JSON.stringify({})
    });

    if (!response.ok) {
        const extractErrorMessage = dependencies.extractErrorMessage;
        const message = typeof extractErrorMessage === 'function'
            ? await extractErrorMessage(response)
            : null;
        throw new Error(message || 'خطا در خروج از تیم');
    }

    notifySuccess('از تیم خارج شدید.');
    await refreshTeamData();
}

async function respondToInvitationAction(inviteId, action) {
    if (!inviteId) {
        notifyError('دعوت‌نامه معتبر نیست.');
        return;
    }

    const status = action === 'accept' ? 'accepted' : 'declined';
    const payload = { invitation_id: inviteId, status };

    try {
        const fetchWithAuth = requireDependency('fetchWithAuth');
        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/respond-invitation/`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const extractErrorMessage = dependencies.extractErrorMessage;
            const message = typeof extractErrorMessage === 'function'
                ? await extractErrorMessage(response)
                : null;
            throw new Error(message || 'خطا در پاسخ به دعوت‌نامه');
        }

        notifySuccess(action === 'accept' ? 'دعوت‌نامه پذیرفته شد.' : 'دعوت‌نامه رد شد.');
        incomingInvitationsState = incomingInvitationsState.filter(item => String(item.id || item.invitation_id) !== String(inviteId));
        incomingInvitationsLoadedFromApi = false;
        await refreshTeamData();
        await ensureIncomingInvitationsLoaded({ force: true });
    } catch (error) {
        console.error('خطا در پاسخ به دعوت‌نامه:', error);
        notifyError(error.message || 'خطا در پاسخ به دعوت‌نامه');
    }
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

function setupConfirmationListener() {
    const confirmButton = document.getElementById('confirm_modal_confirm');
    if (!confirmButton) return;

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
                notifyError(error.message || 'خطا در انجام عملیات');
            } finally {
                toggleButtonLoading(confirmButton, false);
            }
        } else {
            closeModal('confirm_modal');
        }
    });
}

function setupCreateTeamLinks() {
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
}

export function setupTeamsPageInteractions() {
    if (teamsInteractionsInitialized) {
        return;
    }

    teamsInteractionsInitialized = true;

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

    setupConfirmationListener();
    setupCreateTeamLinks();

    document.addEventListener('click', (event) => {
        const inviteAction = event.target.closest('[data-invite-action]');
        if (inviteAction) {
            const action = inviteAction.getAttribute('data-invite-action');
            const inviteId = inviteAction.getAttribute('data-invite-id');
            respondToInvitationAction(inviteId, action);
        }
    });
}

// Teams module does not execute automatically. It expects the host page to call
// initUserTeamsModule with the required dependencies and setupTeamsPageInteractions
// when appropriate.
