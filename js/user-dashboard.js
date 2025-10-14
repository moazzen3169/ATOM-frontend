import { API_BASE_URL } from "../js/config.js";

/**
 * @typedef {Object} DashboardUser
 * @property {string} id
 * @property {string} username
 * @property {string} email
 * @property {string} first_name
 * @property {string} last_name
 * @property {string|null} phone_number
 * @property {number} verification_level
 * @property {string} avatar_url
 */

/**
 * @typedef {Object} DashboardMetrics
 * @property {number} teams_count
 * @property {number} tournaments_count
 * @property {number} unread_notifications
 */

/**
 * @typedef {Object} DashboardMember
 * @property {string} id
 * @property {string} username
 * @property {string|null} avatar_url
 * @property {"owner"|"admin"|"member"} role
 */

/**
 * @typedef {Object} DashboardInvitee
 * @property {string} id
 * @property {string} username
 * @property {string} sent_at
 */

/**
 * @typedef {Object} DashboardTeam
 * @property {string} id
 * @property {string} name
 * @property {string|null} logo_url
 * @property {"owner"|"admin"|"member"|"invited"|"requested"} role
 * @property {"active"|"pending"|"left"|"rejected"} status
 * @property {string} created_at
 * @property {DashboardMember[]} members
 * @property {DashboardInvitee[]} pending_invites
 */

/**
 * @typedef {Object} DashboardInvitation
 * @property {string} id
 * @property {string} team_id
 * @property {string} team_name
 * @property {"pending"|"accepted"|"declined"} status
 * @property {string} sent_at
 */

/**
 * @typedef {Object} DashboardOutgoingInvitation
 * @property {string} id
 * @property {string} recipient_username
 * @property {string} team_id
 * @property {"pending"|"accepted"|"declined"} status
 * @property {string} sent_at
 */

/**
 * @typedef {Object} DashboardJoinRequest
 * @property {string} id
 * @property {string} team_id
 * @property {string} team_name
 * @property {string} requested_at
 * @property {"pending"|"approved"|"denied"} status
 */

/**
 * @typedef {Object} DashboardTournament
 * @property {string} id
 * @property {string} name
 * @property {string} game
 * @property {string} start_time
 * @property {"upcoming"|"live"|"completed"} status
 * @property {string|null} team_id
 * @property {string|null} team_name
 */

/**
 * @typedef {Object} DashboardNotification
 * @property {string} id
 * @property {string} title
 * @property {string} body
 * @property {string} created_at
 * @property {boolean} is_read
 */

/**
 * @typedef {Object} DashboardPreferences
 * @property {string} language
 * @property {string} timezone
 * @property {string} last_seen_at
 */

/**
 * @typedef {Object} DashboardInvitations
 * @property {DashboardInvitation[]} incoming
 * @property {DashboardOutgoingInvitation[]} outgoing
 * @property {DashboardJoinRequest[]} join_requests
 */

/**
 * @typedef {Object} DashboardState
 * @property {DashboardUser} user
 * @property {DashboardMetrics} metrics
 * @property {DashboardTeam[]} teams
 * @property {DashboardInvitations} invitations
 * @property {DashboardTournament[]} tournaments
 * @property {DashboardNotification[]} notifications
 * @property {DashboardPreferences} preferences
 */

const DEFAULT_AVATAR_SRC = "../img/profile.jpg";

let authTokenCache = null;
let currentUserId = null;
let currentUsername = '';
let currentUserEmail = '';
let dashboardState = createEmptyDashboardState();
let pendingConfirmation = null;
let teamsInteractionsInitialized = false;
let isFetchingDashboard = false;
let lastDashboardError = null;

const USER_LOOKUP_ENDPOINTS = [
    (username) => `/api/users/users/?username=${encodeURIComponent(username)}`,
    (username) => `/api/users/users/?search=${encodeURIComponent(username)}`,
    (username) => `/api/users/users/?search=${encodeURIComponent(username)}&page_size=1`
];

const PROFILE_BIO_KEYS = ['bio', 'about', 'description'];

function createEmptyDashboardState() {
    return {
        user: {
            id: '',
            username: '',
            email: '',
            first_name: '',
            last_name: '',
            phone_number: null,
            verification_level: 0,
            avatar_url: DEFAULT_AVATAR_SRC
        },
        metrics: {
            teams_count: 0,
            tournaments_count: 0,
            unread_notifications: 0
        },
        teams: [],
        invitations: {
            incoming: [],
            outgoing: [],
            join_requests: []
        },
        tournaments: [],
        notifications: [],
        preferences: {
            language: 'fa',
            timezone: 'Asia/Tehran',
            last_seen_at: new Date(0).toISOString()
        }
    };
}

function getProfileUpdateEndpoints() {
    const endpoints = ['/auth/users/me/', '/api/users/users/me/'];
    if (currentUserId) {
        endpoints.push(`/api/users/users/${currentUserId}/`);
    }
    return Array.from(new Set(endpoints));
}

function setDashboardState(payload) {
    const base = createEmptyDashboardState();
    if (!payload || typeof payload !== 'object') {
        dashboardState = base;
        currentUserId = null;
        currentUsername = '';
        currentUserEmail = '';
        return;
    }

    const nextState = {
        ...base,
        ...payload,
        user: {
            ...base.user,
            ...(payload.user || {})
        },
        metrics: {
            ...base.metrics,
            ...(payload.metrics || {})
        },
        teams: Array.isArray(payload.teams) ? payload.teams : base.teams,
        invitations: {
            ...base.invitations,
            ...(payload.invitations || {}),
            incoming: Array.isArray(payload?.invitations?.incoming) ? payload.invitations.incoming : base.invitations.incoming,
            outgoing: Array.isArray(payload?.invitations?.outgoing) ? payload.invitations.outgoing : base.invitations.outgoing,
            join_requests: Array.isArray(payload?.invitations?.join_requests)
                ? payload.invitations.join_requests
                : base.invitations.join_requests
        },
        tournaments: Array.isArray(payload.tournaments) ? payload.tournaments : base.tournaments,
        notifications: Array.isArray(payload.notifications) ? payload.notifications : base.notifications,
        preferences: {
            ...base.preferences,
            ...(payload.preferences || {})
        }
    };

    dashboardState = nextState;
    currentUserId = nextState.user?.id || null;
    currentUsername = nextState.user?.username || '';
    currentUserEmail = nextState.user?.email || '';
}


function getProfileAvatarSrc(profile) {
    if (!profile || typeof profile !== 'object') {
        return DEFAULT_AVATAR_SRC;
    }
    return profile.avatar_url || profile.profile_picture || profile.avatar || DEFAULT_AVATAR_SRC;
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
        updateEditUserAvatarPreview(getProfileAvatarSrc(dashboardState.user));
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

function extractUserAvatar(user) {
    if (!user || (typeof user !== 'object' && typeof user !== 'function')) {
        return DEFAULT_AVATAR_SRC;
    }

    const inspected = new Set();
    const queue = [user];
    const avatarKeys = [
        'profile_picture',
        'profilePicture',
        'avatar',
        'avatar_url',
        'avatarUrl',
        'profile_image',
        'profileImage',
        'image',
        'picture',
        'photo',
        'thumbnail',
        'profilePic'
    ];
    const nestedKeys = [
        'profile',
        'user',
        'member',
        'player',
        'account',
        'details'
    ];

    while (queue.length) {
        const current = queue.shift();
        if (!current || typeof current !== 'object') {
            continue;
        }

        if (inspected.has(current)) {
            continue;
        }
        inspected.add(current);

        for (const key of avatarKeys) {
            const value = current[key];
            if (typeof value === 'string' && value.trim()) {
                return value;
            }
        }

        for (const key of nestedKeys) {
            const nested = current[key];
            if (nested && typeof nested === 'object') {
                queue.push(nested);
            }
        }
    }

    return DEFAULT_AVATAR_SRC;
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

    const baseMemberCount = typeof team.members_count === 'number'
        ? team.members_count
        : Array.isArray(membersList)
            ? membersList.length
            : supplementalNames.length
                ? supplementalNames.length
                : Array.isArray(team.members)
                    ? team.members.length
                    : 0;

    const captainCandidates = [
        team.captain_detail,
        team.captain_info,
        team.captain_user,
        team.captain_profile,
        team.captain_data,
        team.captain
    ];

    const fallbackCaptainName = team.captain_username
        || team.captain_name
        || team.captain_display_name
        || (typeof team.captain === 'string' ? team.captain : '');

    function createMemberDetail(member, { isCaptain = false, fallbackName = '' } = {}) {
        const identifiers = new Set();
        let username = '';
        let label = '';
        let avatar = DEFAULT_AVATAR_SRC;

        const fallbackLabel = fallbackName || (isCaptain ? 'کاپیتان' : 'عضو تیم');

        if (member && typeof member === 'object') {
            username = getUsernameFromItem(member) || '';
            label = extractUserDisplayName(member) || username || fallbackLabel;
            avatar = extractUserAvatar(member) || DEFAULT_AVATAR_SRC;

            const idFields = [
                'id',
                'user',
                'user_id',
                'member_id',
                'player_id',
                'profile_id',
                'account_id',
                'participant_id',
                'memberId',
                'userId',
                'pk'
            ];

            idFields.forEach((field) => {
                if (typeof member[field] === 'undefined' || member[field] === null) {
                    return;
                }

                const value = member[field];
                if (typeof value === 'object' && value !== null) {
                    if (typeof value.id !== 'undefined' && value.id !== null) {
                        identifiers.add(String(value.id));
                    }
                } else {
                    identifiers.add(String(value));
                }
            });

            const nestedKeys = ['user', 'member', 'player', 'profile', 'account', 'participant', 'captain'];
            nestedKeys.forEach((key) => {
                const nested = member[key];
                if (nested && typeof nested === 'object') {
                    if (typeof nested.id !== 'undefined' && nested.id !== null) {
                        identifiers.add(String(nested.id));
                    }
                    if (typeof nested.user_id !== 'undefined' && nested.user_id !== null) {
                        identifiers.add(String(nested.user_id));
                    }
                    if (typeof nested.user !== 'undefined' && nested.user !== null && typeof nested.user !== 'object') {
                        identifiers.add(String(nested.user));
                    }
                }
            });
        } else if (typeof member === 'string') {
            username = member;
            label = member || fallbackLabel;
        } else if (typeof member === 'number') {
            identifiers.add(String(member));
        }

        const finalLabel = (label || username || fallbackLabel || '').toString().trim();
        const normalizedUsername = (username || finalLabel).toString().trim().toLowerCase();

        if (!finalLabel && !identifiers.size && !normalizedUsername) {
            return null;
        }

        return {
            label: finalLabel || fallbackLabel,
            avatar: (avatar || DEFAULT_AVATAR_SRC).trim() || DEFAULT_AVATAR_SRC,
            isCaptain,
            identifiers: Array.from(identifiers),
            normalizedUsername
        };
    }

    function detailsMatch(a, b) {
        if (!a || !b) return false;
        const idsA = new Set((a.identifiers || []).map(String));
        const idsB = new Set((b.identifiers || []).map(String));
        for (const id of idsA) {
            if (idsB.has(id)) {
                return true;
            }
        }
        if (a.normalizedUsername && b.normalizedUsername && a.normalizedUsername === b.normalizedUsername) {
            return true;
        }
        return false;
    }

    let captainSource = null;
    for (const candidate of captainCandidates) {
        if (candidate) {
            captainSource = candidate;
            break;
        }
    }

    let captainDetail = createMemberDetail(captainSource, {
        isCaptain: true,
        fallbackName: fallbackCaptainName
    });

    if (!captainDetail && fallbackCaptainName) {
        captainDetail = createMemberDetail(fallbackCaptainName, { isCaptain: true, fallbackName: fallbackCaptainName });
    }

    if (!captainDetail && typeof team.captain === 'number') {
        captainDetail = createMemberDetail(team.captain, { isCaptain: true, fallbackName: 'کاپیتان' });
    }

    let rawMemberDetails = [];

    if (Array.isArray(membersList)) {
        rawMemberDetails = membersList
            .map(member => createMemberDetail(member))
            .filter(detail => detail && detail.label);
    }

    if (!rawMemberDetails.length && supplementalNames.length) {
        rawMemberDetails = supplementalNames
            .map(name => createMemberDetail(String(name)))
            .filter(detail => detail && detail.label);
    }

    const uniqueMemberDetails = [];
    const seenIds = new Set();
    const seenUsernames = new Set();

    rawMemberDetails.forEach(detail => {
        const hasDuplicateId = (detail.identifiers || []).some(id => seenIds.has(String(id)));
        const normalizedUsername = detail.normalizedUsername || '';
        const hasDuplicateUsername = normalizedUsername && seenUsernames.has(normalizedUsername);
        if (hasDuplicateId || hasDuplicateUsername) {
            return;
        }

        (detail.identifiers || []).forEach(id => seenIds.add(String(id)));
        if (normalizedUsername) {
            seenUsernames.add(normalizedUsername);
        }
        uniqueMemberDetails.push(detail);
    });

    let captainIncludedInMembers = false;
    if (captainDetail) {
        const existingIndex = uniqueMemberDetails.findIndex(detail => detailsMatch(detail, captainDetail));
        if (existingIndex !== -1) {
            captainIncludedInMembers = true;
            uniqueMemberDetails.splice(existingIndex, 1);
        }
    }

    const combinedMembers = captainDetail
        ? [captainDetail, ...uniqueMemberDetails]
        : uniqueMemberDetails.slice();

    if (!combinedMembers.length) {
        return { count: baseMemberCount, preview: '' };
    }

    const previewMembers = combinedMembers.slice(0, 6);
    let preview = previewMembers
        .map(member => {
            const displayName = escapeHTML(member.label || 'عضو تیم');
            const avatarSrc = escapeHTML((member.avatar || DEFAULT_AVATAR_SRC).trim() || DEFAULT_AVATAR_SRC);
            const modifier = member.isCaptain ? ' team_member--captain' : '';
            return `
                <div class="team_member${modifier}" role="listitem" title="${displayName}">
                    <div class="team_member_avatar">
                        <img src="${avatarSrc}" alt="آواتار ${displayName}" onerror="this.src='${DEFAULT_AVATAR_SRC}'; this.onerror=null;">
                    </div>
                    <span class="team_member_name">${displayName}</span>
                </div>
            `;
        })
        .join('');

    const effectiveCount = (() => {
        if (baseMemberCount > 0) {
            if (captainDetail && !captainIncludedInMembers) {
                return baseMemberCount + 1;
            }
            return baseMemberCount;
        }
        return combinedMembers.length;
    })();

    const totalKnownMembers = effectiveCount;
    const remaining = totalKnownMembers - previewMembers.length;
    if (remaining > 0) {
        preview += `
            <div class="team_member team_member--more" role="listitem" aria-label="اعضای بیشتر">
                <div class="team_member_avatar team_member_avatar--more">+${remaining}</div>
                <span class="team_member_name">بیشتر</span>
            </div>
        `;
    } else if (combinedMembers.length > previewMembers.length) {
        const extraCount = combinedMembers.length - previewMembers.length;
        preview += `
            <div class="team_member team_member--more" role="listitem" aria-label="اعضای بیشتر">
                <div class="team_member_avatar team_member_avatar--more">+${extraCount}</div>
                <span class="team_member_name">بیشتر</span>
            </div>
        `;
    }

    return { count: effectiveCount, preview };
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
    const incoming = dashboardState?.invitations?.incoming || [];
    return incoming.some(invitation => {
        if (!invitation) return false;
        const invitationTeamId = invitation.team_id || getTeamIdentifier(invitation);
        if (invitationTeamId === null || typeof invitationTeamId === 'undefined') {
            return false;
        }
        return String(invitationTeamId) === stringId && isPendingStatus(invitation.status);
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

function formatDateTime(dateString) {
    if (!dateString || dateString === '-') return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleString('fa-IR');
    } catch (error) {
        console.error('Error formatting datetime:', error);
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

function translateTournamentStatus(status) {
    const normalized = (status || '').toString().toLowerCase();
    switch (normalized) {
        case 'upcoming':
            return 'در صف شروع';
        case 'live':
            return 'در حال برگزاری';
        case 'completed':
            return 'به پایان رسیده';
        default:
            return status || '-';
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
async function fetchDashboardData(options = {}) {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/dashboard/v2/`, {
            method: 'GET',
            signal: options.signal
        });

        if (!response.ok) {
            const message = await extractErrorMessage(response);
            const error = new Error(message || `خطای HTTP: ${response.status}`);
            error.status = response.status;
            throw error;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw error;
        }
        throw error;
    }
}

// تابع برای دریافت تیم‌های کاربر


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

            const candidates = Array.isArray(data)
                ? data
                : extractListFromObject(data, ['results', 'users', 'data', 'items', 'entries']);
            if (!Array.isArray(candidates) || !candidates.length) {
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

    const username = data.username || 'کاربر';
    currentUserId = data.id || currentUserId;
    currentUsername = username || '';
    currentUserEmail = data.email || '';

    setElementText("header_user_name", username);
    setElementText("user_name", username);
    setElementText("user_username", username);

    const email = data.email || '-';
    setElementText("user_email_primary", email);
    setElementText("user_email_detail", email);

    const statusLabel = translateUserStatus(data.status || '');
    setElementText("user_status", statusLabel);

    const fullName = buildFullName(data) || '-';
    setElementText("user_full_name", fullName);

    const phoneNumber = data.phone_number || 'ثبت نشده';
    setElementText("user_phone", phoneNumber);

    const joinDateText = data.created_at ? formatDate(data.created_at) : '-';
    setElementText("user_add_date", joinDateText);

    setElementText("user_rank", translateVerificationLevel(data.verification_level));

    const numberFormatter = new Intl.NumberFormat('fa-IR');
    const scoreValue = Number.isFinite(Number(data.score)) ? Number(data.score) : 0;
    setElementText("user_score", numberFormatter.format(scoreValue));

    const teamsCountValue = Number.isFinite(Number(teamsCount)) ? Number(teamsCount) : 0;
    const tournamentsCountValue = Number.isFinite(Number(tournamentsCount)) ? Number(tournamentsCount) : 0;
    setElementText("user_team_count", teamsCountValue.toString());
    setElementText("user_tournament_count", tournamentsCountValue.toString());

    const avatarSrc = data.avatar_url || DEFAULT_AVATAR_SRC;
    const headerAvatar = document.getElementById("header_user_avatar");
    if (headerAvatar) {
        headerAvatar.src = avatarSrc;
    }
    const profileAvatar = document.getElementById("user_avatar");
    if (profileAvatar) {
        profileAvatar.src = avatarSrc;
    }

    updateHeaderUserInfo(data);
}



// تابع اصلی برای لود کردن اطلاعات
async function loadDashboardData({ silent = false } = {}) {
    const token = setupToken();
    if (!token) return;

    if (!silent) {
        renderDashboardError(null);
    }

    isFetchingDashboard = true;

    try {
        setPageTitle();
        const dashboardData = await fetchDashboardData();
        setDashboardState(dashboardData);
        renderDashboardSections();
        lastDashboardError = null;
    } catch (error) {
        lastDashboardError = error;
        handleDashboardLoadError(error);
    } finally {
        isFetchingDashboard = false;
    }
}

async function refreshDashboardState() {
    await loadDashboardData({ silent: true });
}

function renderDashboardSections() {
    const state = dashboardState || createEmptyDashboardState();
    const metrics = state.metrics || {};
    const invitations = state.invitations || {};

    displayUserProfile(state.user, metrics.teams_count, metrics.tournaments_count);
    displayUserTeams(state.teams);
    displayIncomingInvitations(invitations.incoming);
    displayOutgoingInvitations(invitations.outgoing);
    displayJoinRequests(invitations.join_requests);
    displayTournamentHistory(state.tournaments);
    displayNotifications(state.notifications);
    displayPreferences(state.preferences);
    updateNotificationBadge(metrics.unread_notifications);
}

function handleDashboardLoadError(error) {
    console.error('خطا در لود کردن اطلاعات داشبورد:', error);
    renderDashboardError(getDashboardErrorMessage(error));
    setDashboardState(createEmptyDashboardState());
    displayUserTeams([]);
    displayIncomingInvitations([]);
    displayOutgoingInvitations([]);
    displayJoinRequests([]);
    displayTournamentHistory([]);
    displayNotifications([]);
    displayPreferences(createEmptyDashboardState().preferences);
}

function getDashboardErrorMessage(error) {
    if (!error) {
        return '';
    }
    if (error.status === 401 || error.status === 403) {
        return 'دسترسی شما به داشبورد منقضی شده است. لطفاً دوباره وارد شوید.';
    }
    return error.message || 'خطا در بارگذاری داشبورد. لطفاً دوباره تلاش کنید.';
}

function renderDashboardError(message) {
    const banner = document.getElementById('dashboard_error_banner');
    if (!banner) {
        if (message) {
            showError(message);
        }
        return;
    }

    if (!message) {
        banner.textContent = '';
        banner.classList.add('is-hidden');
        return;
    }

    banner.textContent = message;
    banner.classList.remove('is-hidden');
}



function displayUserTeams(teamsInput) {
    const container = document.getElementById('teams_container');
    if (!container) return;

    const teams = Array.isArray(teamsInput) ? teamsInput : [];
    renderTeamsList(teams);
}

function updateTeamsCounter(count) {
    const counter = document.getElementById('teams_counter');
    if (counter) {
        const formatter = new Intl.NumberFormat('fa-IR');
        const label = count === 0 ? 'بدون تیم' : `${formatter.format(count)} تیم`;
        counter.textContent = label;
    }
}

function renderTeamsList(teams) {
    const container = document.getElementById('teams_container');
    if (!container) return;

    const relevantTeams = filterTeamsForUser(Array.isArray(teams) ? teams : dashboardState.teams);
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

function displayNotifications(notifications) {
    const container = document.getElementById('notifications_list');
    if (!container) return;

    const list = Array.isArray(notifications) ? notifications : [];
    container.innerHTML = '';

    if (!list.length) {
        container.innerHTML = '<div class="empty_state">اعلانی برای نمایش وجود ندارد.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    list.forEach(notification => {
        fragment.appendChild(renderNotificationItem(notification));
    });
    container.appendChild(fragment);
}

function updateNotificationBadge(unreadCount) {
    const badge = document.getElementById('notifications_unread_badge');
    if (!badge) return;

    const count = Number(unreadCount) || 0;
    if (count <= 0) {
        badge.textContent = '0';
        badge.classList.add('is-hidden');
        return;
    }

    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.remove('is-hidden');
}

function displayPreferences(preferences) {
    const prefs = preferences || {};
    setElementText('preference_language', prefs.language || '-');
    setElementText('preference_timezone', prefs.timezone || '-');
    setElementText('preference_last_seen', prefs.last_seen_at ? formatDateTime(prefs.last_seen_at) : '-');
}

function openEditUserModal() {
    const form = document.getElementById('edit_user_form');
    if (!form) return;

    clearEditUserMessage();

    const profile = dashboardState.user || {};
    setFieldValue('edit_user_username', profile.username || '');
    setFieldValue('edit_user_first_name', profile.first_name || '');
    setFieldValue('edit_user_last_name', profile.last_name || '');
    setFieldValue('edit_user_email', profile.email || '');
    setFieldValue('edit_user_phone', profile.phone_number || '');
    setFieldValue('edit_user_bio', profile.bio || '');

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

    const existingProfile = dashboardState.user || {};
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

        if (!updatedProfile || typeof updatedProfile !== 'object') {
            updatedProfile = localProfileUpdates;
        }
        setDashboardState({
            ...dashboardState,
            user: {
                ...dashboardState.user,
                ...updatedProfile
            }
        });
        await refreshDashboardState();
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
            <div class="team_card__summary">
                <div class="team_stat">
                    <span class="team_stat__label">تعداد اعضا</span>
                    <span class="team_stat__value">${membersMeta.count}</span>
                </div>
                <div class="team_stat">
                    <span class="team_stat__label">کاپیتان</span>
                    <span class="team_stat__value">${escapeHTML(captainName || '-')}</span>
                </div>
                ${createdAt ? `<div class="team_stat"><span class="team_stat__label">تاریخ ایجاد</span><span class="team_stat__value">${escapeHTML(formatDate(createdAt))}</span></div>` : ''}
            </div>
            ${membersMeta.preview ? `<div class="team_members_preview" role="list" aria-label="اعضای تیم">${membersMeta.preview}</div>` : ''}
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
    const teamName = invitation.team_name || 'تیم ناشناخته';
    const status = invitation.status || 'pending';
    const createdAt = invitation.sent_at || invitation.created_at;

    card.dataset.invitationId = invitation.id || '';

    card.innerHTML = `
        <div class="mini_card__header">
            <div class="mini_card__title">${escapeHTML(teamName)}</div>
        </div>
        <div class="mini_card__footer">
            <span class="badge ${getStatusBadgeClass(status)}">${escapeHTML(getStatusLabel(status))}</span>
            ${createdAt ? `<span class="mini_card__subtitle">${escapeHTML(formatDate(createdAt))}</span>` : ''}
        </div>
        ${isPendingStatus(status) && card.dataset.invitationId ? `
        <div class="mini_card__footer">
            <button type="button" class="btn btn--primary" data-invite-action="accept" data-invite-id="${card.dataset.invitationId}">قبول دعوت</button>
            <button type="button" class="btn btn--ghost" data-invite-action="reject" data-invite-id="${card.dataset.invitationId}">رد کردن</button>
        </div>` : ''}
    `;

    return card;
}

function renderNotificationItem(notification) {
    const wrapper = document.createElement('div');
    wrapper.className = `notification_item${notification.is_read ? '' : ' notification_item--unread'}`;

    const createdAt = notification.created_at ? formatDateTime(notification.created_at) : '';

    wrapper.innerHTML = `
        <div class="notification_item__header">
            <h4>${escapeHTML(notification.title || 'بدون عنوان')}</h4>
            ${createdAt ? `<time datetime="${escapeHTML(notification.created_at)}">${escapeHTML(createdAt)}</time>` : ''}
        </div>
        <p class="notification_item__body">${escapeHTML(notification.body || '')}</p>
    `;

    return wrapper;
}

function renderJoinRequestCard(request) {
    const card = document.createElement('div');
    card.className = 'mini_card';
    const teamName = request.team_name || 'تیم ناشناخته';
    const status = request.status || 'pending';
    const createdAt = request.requested_at || request.created_at;

    card.innerHTML = `
        <div class="mini_card__header">
            <div class="mini_card__title">${escapeHTML(teamName)}</div>
            <div class="mini_card__subtitle">در انتظار تایید</div>
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
    const username = invitation.recipient_username || 'کاربر';
    const teamName = invitation.team_name || 'تیم';
    const status = invitation.status || 'pending';
    const createdAt = invitation.sent_at || invitation.created_at;

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

function openEditTeamModal(teamId) {
    const form = document.getElementById('edit_team_form');
    if (!form) return;
    const team = (dashboardState.teams || []).find(teamItem => String(teamItem.id) === String(teamId));
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
    const team = (dashboardState.teams || []).find(teamItem => String(teamItem.id) === String(teamId));
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
    const team = (dashboardState.teams || []).find(teamItem => String(teamItem.id) === String(teamId));
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
        await refreshDashboardState();
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
        await refreshDashboardState();
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

    const submitButton = form.querySelector('button[type="submit"]');
    toggleButtonLoading(submitButton, true, 'در حال ارسال...');

    try {
        const user = await lookupUserByUsername(username);
        if (!user) {
            throw new Error('کاربری با این نام کاربری یافت نشد.');
        }

        const payload = { username: user.username };
        if (typeof user.id !== 'undefined' && user.id !== null) {
            payload.user_id = user.id;
        }

        const response = await fetchWithAuth(`${API_BASE_URL}/api/users/teams/${teamId}/add-member/`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const message = await extractErrorMessage(response);
            throw new Error(message);
        }

        showSuccess('درخواست عضویت با موفقیت برای کاربر ارسال شد.');
        closeModal('invite_member_modal');
        form.reset();
        await refreshDashboardState();
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
    await refreshDashboardState();
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
    await refreshDashboardState();
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
        await refreshDashboardState();
    } catch (error) {
        console.error('خطا در پاسخ به دعوت‌نامه:', error);
        showError(error.message || 'خطا در پاسخ به دعوت‌نامه');
    }
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



function displayTournamentHistory(tournaments) {
    const tbody = document.getElementById('tournaments_history_body');
    if (!tbody) return;

    const list = Array.isArray(tournaments) ? tournaments : [];
    tbody.innerHTML = '';

    if (!list.length) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 6;
        cell.textContent = 'هیچ تاریخچه‌ای یافت نشد.';
        return;
    }

    list.forEach(tournament => {
        const row = tbody.insertRow();
        row.insertCell().textContent = translateTournamentStatus(tournament.status);
        row.insertCell().textContent = '-';
        row.insertCell().textContent = tournament.start_time ? formatDateTime(tournament.start_time) : '-';
        row.insertCell().textContent = tournament.team_name || '-';
        row.insertCell().textContent = tournament.game || '-';
        row.insertCell().textContent = tournament.name || '-';
    });
}


// تابع برای بروزرسانی اطلاعات کاربر در هدر از localStorage
function updateHeaderUserInfo(profile = {}) {
    const username = profile.username || 'کاربر';
    const avatar = profile.avatar_url || DEFAULT_AVATAR_SRC;

    const headerUserName = document.getElementById("header_user_name");
    if (headerUserName) {
        headerUserName.textContent = username;
    }

    const mobileUserName = document.querySelector(".user_info_name");
    if (mobileUserName) {
        mobileUserName.textContent = username;
    }

    const headerUserAvatar = document.getElementById("header_user_avatar");
    if (headerUserAvatar) {
        headerUserAvatar.src = avatar;
    }

    const mobileUserAvatar = document.querySelector(".user_profile img");
    if (mobileUserAvatar) {
        mobileUserAvatar.src = avatar;
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
                    updateHeaderUserInfo(dashboardState.user);
                    setPageTitle();
                    observer.disconnect();
                    break;
                }
            }
        });
        observer.observe(headerContainer, { childList: true });
    } else {
        // If no dynamic header, update immediately
        updateHeaderUserInfo(dashboardState.user);
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
