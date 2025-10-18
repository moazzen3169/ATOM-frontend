import { API_ENDPOINTS } from "./services/api-client.js";

const DEFAULT_AVATAR_SRC = "../img/profile.jpg";

const TEAM_INVITATIONS_ENDPOINTS = [
    '/api/users/teams/invitations/received/',
    API_ENDPOINTS.users.teamInvitations,
    '/api/users/team-invitations/',
    '/api/users/teams/pending-invitations/',
    '/api/users/teams/incoming-invitations/',
    '/api/users/teams/invitations/active/'
];

const USER_LOOKUP_ENDPOINTS = [
    (username) => `${API_ENDPOINTS.users.search}?username=${encodeURIComponent(username)}`,
    (username) => `${API_ENDPOINTS.users.search}?search=${encodeURIComponent(username)}`,
    (username) => `${API_ENDPOINTS.users.search}?search=${encodeURIComponent(username)}&page_size=1`
];

const helperDefaults = {
    fetchWithAuth: async () => { throw new Error('fetchWithAuth helper is not configured.'); },
    extractErrorMessage: async () => 'خطای ناشناخته رخ داد.',
    toggleButtonLoading: () => {},
    showError: (message) => console.error(message),
    showSuccess: (message) => console.log(message),
    openModal: () => {},
    closeModal: () => {},
    formatDate: (value) => value,
    onTeamsUpdated: async () => {}
};

let helpers = { ...helperDefaults };

let currentUserContext = {
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

export function configureTeamModule(config = {}) {
    helpers = { ...helperDefaults, ...config };
}

export function setTeamUserContext({ id, username, email } = {}) {
    if (typeof id !== 'undefined') {
        currentUserContext.id = id;
    }
    if (typeof username === 'string') {
        currentUserContext.username = username;
    }
    if (typeof email === 'string') {
        currentUserContext.email = email;
    }
}

function getCurrentUserId() {
    return typeof currentUserContext.id !== 'undefined' && currentUserContext.id !== null
        ? String(currentUserContext.id)
        : null;
}

function getCurrentUsername() {
    return (currentUserContext.username || '').toString();
}

function getCurrentUserEmail() {
    return (currentUserContext.email || '').toString();
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

    const currentId = getCurrentUserId();
    const currentUsername = getCurrentUsername();

    if (typeof user === 'number') {
        if (currentId !== null && String(user) === currentId && currentUsername) {
            return currentUsername;
        }
        return 'کاربر';
    }

    if (typeof user === 'object') {
        if (user.id && currentId !== null && String(user.id) === currentId && currentUsername) {
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

        function hasCaptainIndicator(value, depth = 0) {
            if (!value || depth > 3) return false;

            if (typeof value === 'boolean') {
                return value;
            }

            if (typeof value === 'number') {
                return value === 1;
            }

            if (typeof value === 'string') {
                const normalized = value.trim().toLowerCase();
                if (!normalized) return false;
                if (['1', 'true', 'yes'].includes(normalized)) {
                    return true;
                }

                const captainKeywords = [
                    'captain',
                    'leader',
                    'lead',
                    'owner',
                    'founder',
                    'coach',
                    'host',
                    'کاپیتان',
                    'سرپرست',
                    'رهبر'
                ];

                return captainKeywords.some((keyword) => normalized.includes(keyword));
            }

            if (Array.isArray(value)) {
                return value.some((item) => hasCaptainIndicator(item, depth + 1));
            }

            if (typeof value === 'object') {
                const directKeys = [
                    'is_captain',
                    'isCaptain',
                    'captain',
                    'is_leader',
                    'isLeader',
                    'leader',
                    'is_owner',
                    'isOwner',
                    'owner',
                    'is_head',
                    'isHead',
                    'head',
                    'is_founder',
                    'isFounder',
                    'founder',
                    'is_host',
                    'isHost',
                    'host'
                ];

                for (const key of directKeys) {
                    if (hasCaptainIndicator(value[key], depth + 1)) {
                        return true;
                    }
                }

                const roleKeys = [
                    'role',
                    'member_role',
                    'team_role',
                    'position',
                    'title',
                    'type',
                    'status',
                    'designation',
                    'membership_role'
                ];

                for (const key of roleKeys) {
                    if (hasCaptainIndicator(value[key], depth + 1)) {
                        return true;
                    }
                }

                const nestedKeys = [
                    'membership',
                    'membership_info',
                    'membership_detail',
                    'membership_data',
                    'user',
                    'member',
                    'player',
                    'profile',
                    'account',
                    'participant'
                ];

                for (const key of nestedKeys) {
                    if (hasCaptainIndicator(value[key], depth + 1)) {
                        return true;
                    }
                }
            }

            return false;
        }

        let resolvedIsCaptain = Boolean(isCaptain);

        const fallbackLabel = () => {
            if (resolvedIsCaptain) {
                return 'کاپیتان';
            }
            return (fallbackName && String(fallbackName).trim()) || 'عضو تیم';
        };

        if (member && typeof member === 'object') {
            if (!resolvedIsCaptain && hasCaptainIndicator(member)) {
                resolvedIsCaptain = true;
            }

            username = getUsernameFromItem(member) || '';
            label = extractUserDisplayName(member) || username || '';
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
                    if (!resolvedIsCaptain && hasCaptainIndicator(nested)) {
                        resolvedIsCaptain = true;
                    }
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
            label = member || '';
            if (!resolvedIsCaptain && hasCaptainIndicator(member)) {
                resolvedIsCaptain = true;
            }
        } else if (typeof member === 'number') {
            identifiers.add(String(member));
        }

        if (!label) {
            label = fallbackLabel();
        } else if (resolvedIsCaptain && label.trim() === 'عضو تیم') {
            label = fallbackLabel();
        }

        const finalLabel = (label || username || fallbackLabel() || '').toString().trim();
        const normalizedUsername = (username || finalLabel).toString().trim().toLowerCase();

        if (!finalLabel && !identifiers.size && !normalizedUsername) {
            return null;
        }

        return {
            label: finalLabel || fallbackLabel(),
            avatar: (avatar || DEFAULT_AVATAR_SRC).trim() || DEFAULT_AVATAR_SRC,
            isCaptain: resolvedIsCaptain,
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
        if (!candidate) continue;
        const detail = createMemberDetail(candidate, { isCaptain: true, fallbackName: fallbackCaptainName });
        if (detail) {
            captainSource = detail;
            break;
        }
    }

    const members = Array.isArray(membersList) ? membersList : [];
    const details = members
        .map(member => createMemberDetail(member, { fallbackName: 'عضو تیم' }))
        .filter(Boolean);

    if (!captainSource) {
        const flaggedDetail = details.find((detail) => detail.isCaptain);
        if (flaggedDetail) {
            captainSource = flaggedDetail;
        }
    }

    if (captainSource && !details.some(detail => detailsMatch(detail, captainSource))) {
        details.unshift(captainSource);
    } else if (captainSource) {
        details.forEach((detail) => {
            if (detailsMatch(detail, captainSource)) {
                detail.isCaptain = true;
            }
        });
    }

    const combinedMembers = details.length
        ? details
        : supplementalNames.map(name => ({ label: name, avatar: DEFAULT_AVATAR_SRC }));

    const orderedMembers = combinedMembers.slice().sort((a, b) => {
        if (a.isCaptain === b.isCaptain) {
            return 0;
        }
        return a.isCaptain ? -1 : 1;
    });

    let preview = orderedMembers
        .map((member) => {
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
            if (captainSource && !details.some(detail => detailsMatch(detail, captainSource))) {
                return baseMemberCount + 1;
            }
            return baseMemberCount;
        }
        return combinedMembers.length;
    })();

    return { count: effectiveCount, preview, members: orderedMembers };
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

    const normalizedCurrentId = getCurrentUserId();

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

    const normalizedCurrentUsername = getCurrentUsername().toLowerCase();
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

    const normalizedCurrentEmail = getCurrentUserEmail().toLowerCase();
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

function isTeamCaptain(team) {
    if (!team) return false;
    const currentId = getCurrentUserId();
    if (!currentId) return false;

    if (typeof team.captain === 'number' && String(team.captain) === currentId) return true;
    if (typeof team.captain_id === 'number' && String(team.captain_id) === currentId) return true;
    if (String(team.captain) === currentId) return true;
    const captainDetail = team.captain_detail || team.captain_info || team.captain_user;
    if (captainDetail && typeof captainDetail === 'object') {
        if (String(captainDetail.id) === currentId) return true;
        if (String(captainDetail.user_id) === currentId) return true;
        if (String(captainDetail.user) === currentId) return true;
    }
    return false;
}

function getTeamNameFromItem(item) {
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (item.team && typeof item.team === 'object') {
        return item.team.name || item.team.title || item.team.slug || item.team.team_name || item.team.display_name || '';
    }
    if (typeof item.team === 'string') return item.team;
    if (item.team_name) return item.team_name;
    if (item.teamTitle) return item.teamTitle;
    if (item.team_info && item.team_info.name) return item.team_info.name;
    return item.name || item.title || '';
}

function getTeamDetailsFromItem(item) {
    const details = {
        name: getTeamNameFromItem(item) || 'تیم ناشناخته',
        picture: DEFAULT_AVATAR_SRC,
        captain: ''
    };

    const candidates = [];
    if (item && typeof item === 'object') {
        candidates.push(item);
        const nestedKeys = [
            'team',
            'team_info',
            'team_detail',
            'team_details',
            'team_data',
            'team_profile',
            'team_obj',
            'teamObject',
            'teamProfile'
        ];

        nestedKeys.forEach((key) => {
            const value = item[key];
            if (value && typeof value === 'object') {
                candidates.push(value);
            }
        });
    }

    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'object') {
            continue;
        }

        const nameCandidates = [
            candidate.name,
            candidate.title,
            candidate.team_name,
            candidate.display_name,
            candidate.slug,
            candidate.teamTitle
        ].filter(Boolean);
        if (nameCandidates.length && !details.name) {
            details.name = nameCandidates[0];
        }

        const pictureCandidates = [
            candidate.team_picture,
            candidate.picture,
            candidate.logo,
            candidate.image,
            candidate.avatar,
            candidate.team_logo,
            candidate.team_avatar,
            candidate.profile_picture
        ];

        const picture = pictureCandidates.find((value) => typeof value === 'string' && value.trim());
        if (picture) {
            details.picture = picture;
        }

        if (!details.captain) {
            const captainSources = [
                candidate.captain,
                candidate.captain_user,
                candidate.captain_detail,
                candidate.captain_info,
                candidate.owner,
                candidate.leader,
                candidate.manager
            ];

            for (const source of captainSources) {
                const name = extractUserDisplayName(source);
                if (name) {
                    details.captain = name;
                    break;
                }
            }

            if (!details.captain && typeof candidate.captain_name === 'string') {
                details.captain = candidate.captain_name;
            }
        }
    }

    if (!details.captain && item && typeof item === 'object') {
        const invitationCaptainSources = [
            item.captain,
            item.captain_detail,
            item.captain_info,
            item.captain_user,
            item.team_captain,
            item.team_owner,
            item.owner,
            item.created_by
        ];

        for (const source of invitationCaptainSources) {
            const name = extractUserDisplayName(source);
            if (name) {
                details.captain = name;
                break;
            }
        }

        if (!details.captain && typeof item.captain_name === 'string') {
            details.captain = item.captain_name;
        }
    }

    if (!details.picture || !details.picture.trim()) {
        details.picture = DEFAULT_AVATAR_SRC;
    }

    details.name = escapeHTML(details.name || 'تیم ناشناخته');
    details.picture = escapeHTML(details.picture);
    details.captain = escapeHTML(details.captain || '');

    return details;
}

function getInvitationStatus(invitation) {
    if (!invitation || typeof invitation !== 'object') {
        return '';
    }

    return String(
        invitation.status
        || invitation.state
        || invitation.invitation_status
        || invitation.membership_status
        || invitation.relation_status
        || invitation.decision
        || ''
    ).toLowerCase();
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'accepted':
        case 'approved':
        case 'confirmed':
            return 'badge--success';
        case 'pending':
        case 'invited':
        case 'requested':
            return 'badge--warning';
        case 'declined':
        case 'rejected':
        case 'cancelled':
            return 'badge--danger';
        default:
            return 'badge--default';
    }
}

function getStatusLabel(status) {
    switch (status) {
        case 'accepted':
        case 'approved':
        case 'confirmed':
            return 'تایید شده';
        case 'pending':
        case 'invited':
        case 'requested':
            return 'در انتظار';
        case 'declined':
        case 'rejected':
        case 'cancelled':
            return 'رد شده';
        default:
            return 'نامشخص';
    }
}

export function displayUserTeams(teamsInput) {
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

    if (isTeamsPage) {
        container.classList.remove('teams_container--list');
    } else {
        container.classList.add('teams_container--list');
    }

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
    const createItem = isTeamsPage ? createTeamCard : createDashboardTeamItem;
    teamsToDisplay.forEach(team => {
        fragment.appendChild(createItem(team));
    });

    container.appendChild(fragment);

    if (!isTeamsPage && overflowHint && relevantTeams.length > displayLimit) {
        overflowHint.innerHTML = 'برای مشاهده تمام تیم‌ها به <a href="teams.html">صفحه تیم‌ها</a> بروید.';
    }
}

function createDashboardTeamItem(team) {
    const item = document.createElement('article');
    item.className = 'team_list_item';

    if (team && typeof team.id !== 'undefined') {
        item.dataset.teamId = team.id;
    }

    const numberFormatter = new Intl.NumberFormat('fa-IR');
    const membersMeta = getTeamMembersMeta(team || {});
    const totalMembers = typeof membersMeta.count === 'number' ? membersMeta.count : 0;
    const memberLabels = (membersMeta.members || [])
        .map((member) => member && member.label ? escapeHTML(member.label) : '')
        .filter(Boolean);

    const estimatedTotalMembers = totalMembers > 0 ? totalMembers : memberLabels.length;
    const MAX_PREVIEW_NAMES = 4;
    const previewNames = memberLabels.slice(0, MAX_PREVIEW_NAMES);
    const remainingMembers = Math.max(estimatedTotalMembers - previewNames.length, 0);

    const membersTextParts = [];
    if (previewNames.length) {
        membersTextParts.push(previewNames.join('، '));
    }
    if (remainingMembers > 0) {
        membersTextParts.push(`و ${numberFormatter.format(remainingMembers)} عضو دیگر`);
    }

    const membersText = membersTextParts.join(' ');
    const captainName = escapeHTML(getCaptainName(team || {}) || '-');
    const teamName = escapeHTML(team?.name || 'بدون نام');
    const memberCountLabel = estimatedTotalMembers > 0
        ? `${numberFormatter.format(estimatedTotalMembers)} عضو`
        : 'بدون عضو';

    item.innerHTML = `
        <div class="team_list_item__header">
            <span class="team_list_item__name">${teamName}</span>
            <span class="team_list_item__members_count">${memberCountLabel}</span>
        </div>
        <div class="team_list_item__body">
            <div class="team_list_item__row">
                <span class="team_list_item__label">کاپیتان:</span>
                <span class="team_list_item__value">${captainName}</span>
            </div>
            ${membersText ? `
            <div class="team_list_item__row">
                <span class="team_list_item__label">اعضا:</span>
                <span class="team_list_item__value">${membersText}</span>
            </div>` : ''}
        </div>
    `;

    return item;
}

function createTeamCard(team) {
    const card = document.createElement('article');
    card.className = 'team_card';
    if (team && typeof team.id !== 'undefined') {
        card.dataset.teamId = team.id;
    }

    const avatarSrc = team?.team_picture || DEFAULT_AVATAR_SRC;
    const membersMeta = getTeamMembersMeta(team || {});
    const captainName = getCaptainName(team || {}) || '-';
    const isCaptain = isTeamCaptain(team);
    const createdAt = team?.created_at || team?.created;
    const gameName = team?.game?.name || team?.game_name || '';
    const description = team?.bio || team?.description || '';

    const summaryHTML = `
        <div class="team_card__summary">
            <div class="team_stat">
                <span class="team_stat__label">تعداد اعضا</span>
                <span class="team_stat__value">${membersMeta.count}</span>
            </div>
            <div class="team_stat">
                <span class="team_stat__label">کاپیتان</span>
                <span class="team_stat__value">${escapeHTML(captainName || '-')}</span>
            </div>
            ${createdAt ? `<div class="team_stat"><span class="team_stat__label">تاریخ ایجاد</span><span class="team_stat__value">${escapeHTML(helpers.formatDate(createdAt))}</span></div>` : ''}
        </div>
    `;

    card.innerHTML = `
        <header class="team_card__header">
            <div class="team_avatar">
                <img src="${escapeHTML(avatarSrc)}" alt="لوگوی ${escapeHTML(team?.name || 'تیم')}" onerror="this.src='${DEFAULT_AVATAR_SRC}'; this.onerror=null;">
            </div>
            <div class="team_card__title">
                <h3>${escapeHTML(team?.name || 'بدون نام')}</h3>
                ${gameName ? `<p>${escapeHTML(gameName)}</p>` : ''}
            </div>
            ${isCaptain ? '<span class="team_badge">کاپیتان</span>' : ''}
        </header>
        <div class="team_card__body">
            ${summaryHTML}
            ${membersMeta.preview ? `<div class="team_members_preview" role="list" aria-label="اعضای تیم">${membersMeta.preview}</div>` : ''}
            ${description ? `<p class="team_description">${escapeHTML(description)}</p>` : ''}
        </div>
    `;

    const summaryElement = card.querySelector('.team_card__summary');

    const isTeamsPage = window.location.pathname.includes('teams');
    const hasValidTeamId = typeof team?.id !== 'undefined' && team?.id !== null;

    if (isTeamsPage && hasValidTeamId) {
        const footer = document.createElement('footer');
        footer.className = 'team_card__footer';

        const footerContent = document.createElement('div');
        footerContent.className = 'team_card__footer_content';

        if (summaryElement) {
            summaryElement.classList.add('team_card__summary--inline');
            footerContent.appendChild(summaryElement);
        }

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

        footerContent.appendChild(actions);
        footer.appendChild(footerContent);
        card.appendChild(footer);
    } else if (summaryElement) {
        summaryElement.classList.remove('team_card__summary--inline');
    }

    return card;
}

export function applyDashboardTeamData(dashboardData) {
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
        'sent_invitations',
        'outgoing_requests',
        'sent_requests',
        'requests_sent',
        'team_invitations_sent'
    ]);
    if (outgoing !== undefined) {
        outgoingInvitationsState = Array.isArray(outgoing) ? outgoing : toInvitationArray(outgoing);
    }

    displayIncomingInvitations(incomingInvitationsState);
    displayJoinRequests(joinRequestsState);
    displayOutgoingInvitations(outgoingInvitationsState);
    renderTeamsList();
}

export function displayIncomingInvitations(invitations) {
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

async function fetchIncomingTeamInvitations() {
    let lastError = null;

    for (const endpoint of TEAM_INVITATIONS_ENDPOINTS) {
        try {
            const response = await helpers.fetchWithAuth(endpoint, {
                method: 'GET'
            });

            if (!response.ok) {
                if (response.status >= 500) {
                    let message = null;
                    try {
                        message = await helpers.extractErrorMessage(response);
                    } catch (error) {
                        message = null;
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
    const hasFallback = Array.isArray(fallbackData);

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

export function displayJoinRequests(requests) {
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

export function displayOutgoingInvitations(invitations) {
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
    const teamDetails = getTeamDetailsFromItem(invitation);
    const senderSource = invitation.sender || invitation.invited_by || invitation.inviter || invitation.owner || invitation;
    const senderName = getUsernameFromItem(senderSource) || invitation.sender_name || invitation.inviter_name || '';
    const status = getInvitationStatus(invitation);
    const createdAt = invitation?.created_at || invitation?.created || invitation?.sent_at;
    const message = invitation?.message || invitation?.note || '';

    card.dataset.invitationId = invitation?.id ?? invitation?.invitation_id ?? '';

    const hasIdentifier = Boolean(card.dataset.invitationId);

    card.innerHTML = `
        <div class="mini_card__primary">
            <div class="mini_card__avatar">
                <img src="${teamDetails.picture}" alt="لوگوی ${teamDetails.name}" onerror="this.src='${DEFAULT_AVATAR_SRC}'; this.onerror=null;">
            </div>
            <div class="mini_card__content">
                <div class="mini_card__title">${teamDetails.name}</div>
                ${teamDetails.captain ? `<div class="mini_card__subtitle">کاپیتان: ${teamDetails.captain}</div>` : ''}
                ${senderName ? `<div class="mini_card__subtitle">ارسال از ${escapeHTML(senderName)}</div>` : ''}
            </div>
        </div>
        ${message ? `<div class="mini_card__message">${escapeHTML(message)}</div>` : ''}
        <div class="mini_card__footer">
            <span class="badge ${getStatusBadgeClass(status)}">${escapeHTML(getStatusLabel(status))}</span>
            ${createdAt ? `<span class="mini_card__subtitle">${escapeHTML(helpers.formatDate(createdAt))}</span>` : ''}
            ${hasIdentifier ? `
                <div class="mini_card__actions">
                    <button type="button" class="btn btn--primary" data-invite-action="accept" data-invite-id="${escapeHTML(card.dataset.invitationId)}">قبول</button>
                    <button type="button" class="btn btn--danger" data-invite-action="reject" data-invite-id="${escapeHTML(card.dataset.invitationId)}">رد</button>
                </div>
            ` : ''}
        </div>
    `;

    return card;
}

function renderJoinRequestCard(request) {
    const card = document.createElement('div');
    card.className = 'mini_card';
    const username = getUsernameFromItem(request) || getUsernameFromItem(request.requester || {}) || 'کاربر ناشناس';
    const teamName = getTeamNameFromItem(request) || 'تیم من';
    const status = getInvitationStatus(request);
    const createdAt = request?.created_at || request?.created || request?.requested_at;

    card.innerHTML = `
        <div class="mini_card__primary">
            <div class="mini_card__content">
                <div class="mini_card__title">${escapeHTML(username)}</div>
                <div class="mini_card__subtitle">در انتظار تایید برای تیم ${escapeHTML(teamName)}</div>
            </div>
        </div>
        <div class="mini_card__footer">
            <span class="badge ${getStatusBadgeClass(status)}">${escapeHTML(getStatusLabel(status))}</span>
            ${createdAt ? `<span class="mini_card__subtitle">${escapeHTML(helpers.formatDate(createdAt))}</span>` : ''}
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
        <div class="mini_card__primary">
            <div class="mini_card__content">
                <div class="mini_card__title">${escapeHTML(username)}</div>
                <div class="mini_card__subtitle">دعوت شده به ${escapeHTML(teamName)}</div>
            </div>
        </div>
        <div class="mini_card__footer">
            <span class="badge ${getStatusBadgeClass(status)}">${escapeHTML(getStatusLabel(status))}</span>
            ${createdAt ? `<span class="mini_card__subtitle">${escapeHTML(helpers.formatDate(createdAt))}</span>` : ''}
        </div>
    `;

    return card;
}

async function lookupUserByUsername(username) {
    const normalizedUsername = (username || '').toString().trim().toLowerCase();
    if (!normalizedUsername) {
        return null;
    }

    for (const buildPath of USER_LOOKUP_ENDPOINTS) {
        const endpoint = buildPath(username);
        try {
            const response = await helpers.fetchWithAuth(endpoint, { method: 'GET' });
            if (!response.ok) {
                if (response.status >= 500) {
                    const message = await helpers.extractErrorMessage(response);
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

export async function fetchUserTeams() {
    try {
        console.log('دریافت تیم‌های کاربر از API...');

        const response = await helpers.fetchWithAuth(API_ENDPOINTS.users.teams, {
            method: 'GET'
        });

        console.log('Status:', response.status);

        if (!response.ok) {
            const message = await helpers.extractErrorMessage(response);
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
    helpers.openModal('confirm_modal');
}

function openEditTeamModal(teamId) {
    const form = document.getElementById('edit_team_form');
    if (!form) return;
    const team = teamsState.find(teamItem => String(teamItem.id) === String(teamId));
    if (!team) {
        helpers.showError('تیم مورد نظر یافت نشد.');
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

    helpers.openModal('edit_team_modal');
}

function openInviteMemberModal(teamId) {
    const form = document.getElementById('invite_member_form');
    if (!form) return;
    form.reset();
    const teamField = document.getElementById('invite_team_id');
    if (teamField) teamField.value = teamId;
    helpers.openModal('invite_member_modal');
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
        helpers.showError('نام تیم را وارد کنید.');
        return;
    }

    const payload = new FormData();
    payload.append('name', name);

    if (teamPicture instanceof File && teamPicture.size > 0) {
        payload.append('team_picture', teamPicture);
    }

    const submitButton = form.querySelector('button[type="submit"]');
    helpers.toggleButtonLoading(submitButton, true, 'در حال ایجاد...');

    try {
        const response = await helpers.fetchWithAuth(API_ENDPOINTS.users.teams, {
            method: 'POST',
            body: payload
        });

        if (!response.ok) {
            const message = await helpers.extractErrorMessage(response);
            throw new Error(message);
        }

        helpers.showSuccess('تیم با موفقیت ایجاد شد.');
        helpers.closeModal('create_team_modal');
        form.reset();
        await ensureIncomingInvitationsLoaded({ force: true });
        await helpers.onTeamsUpdated();
    } catch (error) {
        console.error('خطا در ایجاد تیم:', error);
        helpers.showError(error.message || 'خطا در ایجاد تیم');
    } finally {
        helpers.toggleButtonLoading(submitButton, false);
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
        helpers.showError('تیم معتبر نیست.');
        return;
    }

    if (!name) {
        helpers.showError('نام تیم را وارد کنید.');
        return;
    }

    const payload = new FormData();
    payload.append('name', name);

    if (teamPicture instanceof File && teamPicture.size > 0) {
        payload.append('team_picture', teamPicture);
    }

    const submitButton = form.querySelector('button[type="submit"]');
    helpers.toggleButtonLoading(submitButton, true, 'در حال ذخیره...');

    try {
        const response = await helpers.fetchWithAuth(API_ENDPOINTS.users.team(teamId), {
            method: 'PATCH',
            body: payload
        });

        if (!response.ok) {
            const message = await helpers.extractErrorMessage(response);
            throw new Error(message);
        }

        helpers.showSuccess('تیم با موفقیت به‌روزرسانی شد.');
        helpers.closeModal('edit_team_modal');
        form.reset();
        await ensureIncomingInvitationsLoaded({ force: true });
        await helpers.onTeamsUpdated();
    } catch (error) {
        console.error('خطا در بروزرسانی تیم:', error);
        helpers.showError(error.message || 'خطا در بروزرسانی تیم');
    } finally {
        helpers.toggleButtonLoading(submitButton, false);
    }
}

async function handleInviteMember(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const teamId = formData.get('team_id');
    const username = (formData.get('username') || '').toString().trim();

    if (!teamId) {
        helpers.showError('تیم معتبر نیست.');
        return;
    }

    if (!username) {
        helpers.showError('نام کاربری کاربر را وارد کنید.');
        return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    helpers.toggleButtonLoading(submitButton, true, 'در حال ارسال...');

    try {
        const user = await lookupUserByUsername(username);
        if (!user) {
            throw new Error('کاربری با این نام کاربری یافت نشد.');
        }

        const payload = { username: user.username };
        if (typeof user.id !== 'undefined' && user.id !== null) {
            payload.user_id = user.id;
        }

        const response = await helpers.fetchWithAuth(API_ENDPOINTS.users.teamAddMember(teamId), {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const message = await helpers.extractErrorMessage(response);
            throw new Error(message);
        }

        helpers.showSuccess('درخواست دعوت با موفقیت ارسال شد.');
        helpers.closeModal('invite_member_modal');
        form.reset();
        await ensureIncomingInvitationsLoaded({ force: true });
        await helpers.onTeamsUpdated();
    } catch (error) {
        console.error('خطا در دعوت عضو:', error);
        helpers.showError(error.message || 'خطا در دعوت عضو');
    } finally {
        helpers.toggleButtonLoading(submitButton, false);
    }
}

async function handleDeleteTeam(teamId) {
    if (!teamId) throw new Error('شناسه تیم نامعتبر است.');

    try {
        const response = await helpers.fetchWithAuth(API_ENDPOINTS.users.team(teamId), {
            method: 'DELETE'
        });

        if (!response.ok) {
            const message = await helpers.extractErrorMessage(response);
            throw new Error(message);
        }

        helpers.showSuccess('تیم با موفقیت حذف شد.');
        await ensureIncomingInvitationsLoaded({ force: true });
        await helpers.onTeamsUpdated();
    } catch (error) {
        console.error('خطا در حذف تیم:', error);
        helpers.showError(error.message || 'خطا در حذف تیم');
    }
}

async function handleLeaveTeam(teamId) {
    if (!teamId) throw new Error('شناسه تیم نامعتبر است.');

    try {
        const response = await helpers.fetchWithAuth(API_ENDPOINTS.users.teamLeave(teamId), {
            method: 'POST'
        });

        if (!response.ok) {
            const message = await helpers.extractErrorMessage(response);
            throw new Error(message);
        }

        helpers.showSuccess('با موفقیت از تیم خارج شدید.');
        await ensureIncomingInvitationsLoaded({ force: true });
        await helpers.onTeamsUpdated();
    } catch (error) {
        console.error('خطا در خروج از تیم:', error);
        helpers.showError(error.message || 'خطا در خروج از تیم');
    }
}

async function respondToInvitationAction(inviteId, action) {
    if (!inviteId) {
        helpers.showError('دعوت‌نامه معتبر نیست.');
        return;
    }

    const status = action === 'accept' ? 'accepted' : 'declined';
    const payload = { invitation_id: inviteId, status };

    try {
        const response = await helpers.fetchWithAuth(API_ENDPOINTS.users.respondTeamInvitation, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const message = await helpers.extractErrorMessage(response);
            throw new Error(message);
        }

        helpers.showSuccess(action === 'accept' ? 'دعوت‌نامه پذیرفته شد.' : 'دعوت‌نامه رد شد.');
        incomingInvitationsState = incomingInvitationsState.filter(item => String(item.id || item.invitation_id) !== String(inviteId));
        incomingInvitationsLoadedFromApi = false;
        await ensureIncomingInvitationsLoaded({ force: true });
        await helpers.onTeamsUpdated();
    } catch (error) {
        console.error('خطا در پاسخ به دعوت‌نامه:', error);
        helpers.showError(error.message || 'خطا در پاسخ به دعوت‌نامه');
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
                helpers.toggleButtonLoading(confirmButton, true, 'در حال انجام...');
                try {
                    await action();
                    helpers.closeModal('confirm_modal');
                } catch (error) {
                    console.error('خطا در انجام عملیات تایید:', error);
                    helpers.showError(error.message || 'خطا در انجام عملیات');
                } finally {
                    helpers.toggleButtonLoading(confirmButton, false);
                }
            } else {
                helpers.closeModal('confirm_modal');
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

    const createTeamLinks = document.querySelectorAll('.creat_team_link');
    createTeamLinks.forEach((link) => {
        const isTeamsPage = window.location.pathname.includes('teams');
        if (isTeamsPage) {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                helpers.openModal('create_team_modal');
            });
        } else if (!link.getAttribute('href')) {
            link.setAttribute('href', 'teams.html');
        }
    });
}
