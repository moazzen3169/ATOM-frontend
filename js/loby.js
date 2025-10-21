import { API_ENDPOINTS, buildApiUrl } from "/js/services/api-client.js";

const STORAGE_KEYS = {
  inGameIds: "atom_in_game_ids",
  userId: "atom_cached_user_id",
};

const MAX_SAVED_INGAME_IDS = 10;

const TEAM_SEARCH_DEBOUNCE_MS = 400;
const TEAM_VALIDATION_NOTIFICATION_KEYS = {
  TEAM_NOT_FOUND: "teamNotFound",
  NOT_CAPTAIN: "teamJoinUnauthorized",
  ALREADY_REGISTERED: "teamAlreadyRegistered",
  MEMBERS_MISSING: "teamMembersMissing",
  TEAM_TOO_SMALL: "teamTooSmall",
  TEAM_TOO_LARGE: "teamTooLarge",
  TEAM_SIZE_UNKNOWN: "teamSizeUnknown",
};

const PARTICIPANT_PAGE_SIZE = 24;
const PARTICIPANT_RENDER_BATCH = 16;

const state = {
  tournamentId: null,
  tournament: null,
  selectedTeamId: null,
  teamRequestInFlight: false,
  lastUsedInGameId: "",
  userId: null,
  userIdPromise: null,
  userProfile: null,
  userProfilePromise: null,
  userWallet: null,
  userWalletPromise: null,
  teamsById: new Map(),
  teamDetailPromises: new Map(),
  tournamentTeamIds: new Set(),
  teamAbortController: null,
  participants: [],
  participantIds: new Set(),
  participantNextUrl: null,
  participantLoading: false,
  participantRenderedCount: 0,
  participantTotalCount: null,
  participantsInitialised: false,
  participantError: null,
};

function cacheUserId(identifier) {
  const normalised = normaliseId(identifier);
  if (!normalised) {
    return;
  }

  const storages = [];
  if (typeof sessionStorage !== "undefined") {
    storages.push(sessionStorage);
  }
  if (typeof localStorage !== "undefined") {
    storages.push(localStorage);
  }

  storages.forEach((storage) => {
    try {
      storage.setItem(STORAGE_KEYS.userId, normalised);
    } catch (error) {
      console.warn("Failed to persist user id", error);
    }
  });
}

function restoreCachedUserId() {
  const storages = [];
  if (typeof sessionStorage !== "undefined") {
    storages.push(sessionStorage);
  }
  if (typeof localStorage !== "undefined") {
    storages.push(localStorage);
  }

  for (const storage of storages) {
    try {
      const stored = storage.getItem(STORAGE_KEYS.userId);
      const identifier = normaliseId(stored);
      if (identifier) {
        return identifier;
      }
    } catch (error) {
      console.warn("Failed to read cached user id", error);
    }
  }

  return null;
}

function normaliseId(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "object") {
    const candidates = [value.id, value.user_id, value.pk, value.uuid, value.slug];
    for (const candidate of candidates) {
      const resolved = normaliseId(candidate);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }

  const stringValue = String(value).trim();
  return stringValue.length ? stringValue : null;
}

function stableStringify(value) {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(",")}}`;
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const segments = token.split(".");
  if (segments.length < 2) {
    return null;
  }

  const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  try {
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch (error) {
    console.warn("Failed to decode JWT payload", error);
    return null;
  }
}

function extractUserIdFromPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const directCandidates = [
    payload.user_id,
    payload.userId,
    payload.sub,
    payload.id,
    payload.pk,
    payload.uuid,
    payload.uid,
  ];

  for (const candidate of directCandidates) {
    const resolved = normaliseId(candidate);
    if (resolved) {
      return resolved;
    }
  }

  const nestedCandidates = [
    payload.user,
    payload.profile,
    payload.account,
    payload.member,
    payload.owner,
    payload.identity,
    payload.details,
  ];

  for (const candidate of nestedCandidates) {
    const resolved = normaliseId(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

async function resolveUserIdFromProfile() {
  try {
    const url = buildApiUrl(API_ENDPOINTS.users.me);
    const profile = await apiFetch(url.toString());
    const identifier =
      normaliseId(profile?.id) ||
      normaliseId(profile?.user_id) ||
      normaliseId(profile?.pk) ||
      null;

    if (!identifier) {
      throw new Error("شناسه کاربر در حساب کاربری یافت نشد.");
    }

    return identifier;
  } catch (error) {
    console.error("Failed to load user profile", error);
    throw error;
  }
}

async function ensureUserId() {
  if (state.userId) {
    return state.userId;
  }

  if (state.userIdPromise) {
    return state.userIdPromise;
  }

  const cachedIdentifier = restoreCachedUserId();
  if (cachedIdentifier) {
    state.userId = cachedIdentifier;
    return cachedIdentifier;
  }

  const token = getAuthToken();
  const payload = decodeJwtPayload(token);
  const decodedId = extractUserIdFromPayload(payload);

  if (decodedId) {
    state.userId = decodedId;
    cacheUserId(decodedId);
    return decodedId;
  }

  state.userIdPromise = resolveUserIdFromProfile()
    .then((identifier) => {
      state.userId = identifier;
      cacheUserId(identifier);
      return identifier;
    })
    .finally(() => {
      state.userIdPromise = null;
    });

  return state.userIdPromise;
}

async function fetchUserProfile() {
  const url = buildApiUrl(API_ENDPOINTS.users.me);
  return apiFetch(url.toString());
}

async function ensureUserProfile() {
  if (state.userProfile) {
    return state.userProfile;
  }

  if (state.userProfilePromise) {
    return state.userProfilePromise;
  }

  state.userProfilePromise = fetchUserProfile()
    .then((profile) => {
      state.userProfile = profile || null;
      return state.userProfile;
    })
    .catch((error) => {
      console.error("Failed to load user profile", error);
      throw error;
    })
    .finally(() => {
      state.userProfilePromise = null;
    });

  return state.userProfilePromise;
}

async function fetchUserWallet() {
  const url = buildApiUrl(API_ENDPOINTS.wallet.list);
  const payload = await apiFetch(url.toString());

  if (Array.isArray(payload) && payload.length) {
    return payload[0];
  }

  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.results) && payload.results.length) {
      return payload.results[0];
    }

    if (payload.wallet && typeof payload.wallet === "object") {
      return payload.wallet;
    }
  }

  return null;
}

async function ensureUserWallet() {
  if (state.userWallet) {
    return state.userWallet;
  }

  if (state.userWalletPromise) {
    return state.userWalletPromise;
  }

  state.userWalletPromise = fetchUserWallet()
    .then((wallet) => {
      state.userWallet = wallet || null;
      return state.userWallet;
    })
    .catch((error) => {
      console.error("Failed to load user wallet", error);
      throw error;
    })
    .finally(() => {
      state.userWalletPromise = null;
    });

  return state.userWalletPromise;
}

function parseNumericValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const normalised = trimmed.replace(/[^\d.,+-]/g, "").replace(/,/g, "");
    if (!normalised) {
      return null;
    }
    const numeric = Number.parseFloat(normalised);
    return Number.isNaN(numeric) ? null : numeric;
  }

  return null;
}

function parseIntegerValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const normalised = trimmed.replace(/[^\d+-]/g, "");
    if (!normalised) {
      return null;
    }
    const parsed = Number.parseInt(normalised, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function parseCurrencyValue(value) {
  const numeric = parseNumericValue(value);
  if (numeric === null) {
    return null;
  }
  return Number.isFinite(numeric) ? numeric : null;
}

function formatCurrencyValue(value) {
  const numeric = parseCurrencyValue(value);
  if (numeric === null) {
    return "";
  }

  try {
    return new Intl.NumberFormat("fa-IR").format(Math.round(numeric));
  } catch (error) {
    console.warn("Failed to format currency", error);
    return String(Math.round(numeric));
  }
}

function resolveWalletBalance(wallet) {
  if (!wallet || typeof wallet !== "object") {
    return { amount: null, display: null };
  }

  const amountCandidates = [
    wallet.total_balance,
    wallet.totalBalance,
    wallet.balance,
    wallet.available_balance,
    wallet.availableBalance,
    wallet.withdrawable_balance,
    wallet.withdrawableBalance,
  ];

  for (const candidate of amountCandidates) {
    const parsed = parseCurrencyValue(candidate);
    if (parsed !== null) {
      return { amount: parsed, display: formatCurrencyValue(parsed) };
    }
  }

  const displayCandidates = [
    wallet.total_balance_display,
    wallet.display_total_balance,
    wallet.balance_display,
    wallet.display_balance,
    wallet.available_balance_display,
    wallet.display_available_balance,
  ];

  for (const candidate of displayCandidates) {
    if (typeof candidate === "string" && candidate.trim().length) {
      return {
        amount: parseCurrencyValue(candidate),
        display: candidate.trim(),
      };
    }
  }

  return { amount: null, display: null };
}

function resolveUserVerificationLevel(profile) {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const candidates = [
    profile.verification_level,
    profile.verificationLevel,
    profile.level,
    profile.user_level,
    profile.userLevel,
    profile.account_level,
    profile.accountLevel,
    profile.verification?.level,
    profile.verification?.level_id,
    profile.verification?.levelId,
  ];

  for (const candidate of candidates) {
    const parsed = parseIntegerValue(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function resolveUserRank(profile) {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const candidates = [
    profile.rank,
    profile.rank_value,
    profile.rankValue,
    profile.rank_level,
    profile.rankLevel,
    profile.score_rank,
    profile.scoreRank,
  ];

  for (const candidate of candidates) {
    const parsed = parseIntegerValue(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function resolveColorIdentifier(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    const candidates = [
      value.id,
      value.color_id,
      value.colorId,
      value.identifier,
      value.slug,
      value.value,
    ];
    for (const candidate of candidates) {
      const resolved = normaliseId(candidate);
      if (resolved) {
        return resolved;
      }
    }
  }

  return normaliseId(value);
}

function resolveColorName(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    const candidates = [
      value.name,
      value.title,
      value.label,
      value.display_name,
      value.displayName,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length) {
        return candidate.trim();
      }
    }
  }

  return "";
}

function resolveUserColorIdentifier(profile) {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const candidates = [
    profile.tournament_color,
    profile.color,
    profile.rank_color,
    profile.rankColor,
    profile.tier,
    profile.level_color,
    profile.levelColor,
  ];

  for (const candidate of candidates) {
    const resolved = resolveColorIdentifier(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function resolveTournamentColorIdentifier(tournament) {
  if (!tournament || typeof tournament !== "object") {
    return null;
  }

  const candidates = [
    tournament.required_color,
    tournament.requiredColor,
    tournament.color_requirement,
    tournament.colorRequirement,
    tournament.color,
  ];

  for (const candidate of candidates) {
    const resolved = resolveColorIdentifier(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function resolveTournamentColorName(tournament) {
  if (!tournament || typeof tournament !== "object") {
    return "";
  }

  const candidates = [
    tournament.required_color,
    tournament.requiredColor,
    tournament.color_requirement,
    tournament.colorRequirement,
    tournament.color,
  ];

  for (const candidate of candidates) {
    const name = resolveColorName(candidate);
    if (name) {
      return name;
    }
  }

  return "";
}

function interpretTruthyFlag(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase();
    if (!normalised) {
      return false;
    }
    return ["true", "1", "yes", "registered", "joined", "y"].includes(normalised);
  }

  return false;
}

function matchesUserIdentity(record, userId, depth = 0) {
  if (!userId) {
    return false;
  }

  if (record === null || record === undefined) {
    return false;
  }

  if (depth > 4) {
    return false;
  }

  const direct = normaliseId(record);
  if (direct && direct === userId) {
    return true;
  }

  if (typeof record !== "object") {
    return false;
  }

  const directKeys = [
    "id",
    "user_id",
    "userId",
    "member_id",
    "memberId",
    "player_id",
    "playerId",
    "participant_id",
    "participantId",
    "pk",
    "uuid",
    "slug",
  ];

  for (const key of directKeys) {
    if (!(key in record)) {
      continue;
    }
    const value = record[key];
    const resolved = normaliseId(value);
    if (resolved && resolved === userId) {
      return true;
    }
  }

  const nestedKeys = [
    "user",
    "member",
    "player",
    "account",
    "profile",
    "identity",
    "owner",
    "participant",
    "member_user",
    "memberUser",
  ];

  for (const key of nestedKeys) {
    if (record[key] && matchesUserIdentity(record[key], userId, depth + 1)) {
      return true;
    }
  }

  const arrayKeys = [
    "members",
    "users",
    "players",
    "participants",
    "memberships",
    "team_members",
    "teamMembers",
    "entries",
    "items",
  ];

  for (const key of arrayKeys) {
    const collection = record[key];
    if (!Array.isArray(collection)) {
      continue;
    }
    for (const item of collection) {
      if (matchesUserIdentity(item, userId, depth + 1)) {
        return true;
      }
    }
  }

  return false;
}

function hasUserAlreadyJoinedTournament() {
  const userId = normaliseId(state.userId);
  if (!userId) {
    return false;
  }

  const flagSources = [
    state.tournament?.has_joined,
    state.tournament?.hasJoined,
    state.tournament?.user_has_joined,
    state.tournament?.userHasJoined,
    state.tournament?.already_joined,
    state.tournament?.alreadyJoined,
    state.tournament?.is_registered,
    state.tournament?.isRegistered,
    state.tournament?.registration?.has_joined,
    state.tournament?.registration?.hasJoined,
    state.tournament?.registration?.user_has_joined,
    state.tournament?.registration?.userHasJoined,
    state.tournament?.registration?.is_registered,
    state.tournament?.registration?.isRegistered,
    state.tournament?.registration_settings?.has_joined,
    state.tournament?.registration_settings?.hasJoined,
  ];

  if (flagSources.some(interpretTruthyFlag)) {
    return true;
  }

  const participantCollections = [
    state.tournament?.participants,
    state.participants,
    state.tournament?.teams,
    state.tournament?.registration?.participants,
  ];

  for (const collection of participantCollections) {
    if (!Array.isArray(collection)) {
      continue;
    }
    for (const participant of collection) {
      if (matchesUserIdentity(participant, userId)) {
        return true;
      }
      const members = getTeamMembersList(participant);
      if (members.some((member) => matchesUserIdentity(member, userId))) {
        return true;
      }
    }
  }

  return false;
}

function getTournamentEntryFee(tournament) {
  if (!tournament || typeof tournament !== "object") {
    return null;
  }

  const candidates = [
    tournament.entry_fee,
    tournament.entryFee,
    tournament.registration?.entry_fee,
    tournament.registration?.entryFee,
    tournament.registration_settings?.entry_fee,
    tournament.registration_settings?.entryFee,
  ];

  for (const candidate of candidates) {
    const parsed = parseCurrencyValue(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function getTournamentEntryFeeDisplay(tournament) {
  if (!tournament || typeof tournament !== "object") {
    return "";
  }

  const displayCandidates = [
    tournament.entry_fee_display,
    tournament.entryFeeDisplay,
    tournament.registration?.entry_fee_display,
    tournament.registration?.entryFeeDisplay,
    tournament.registration_settings?.entry_fee_display,
    tournament.registration_settings?.entryFeeDisplay,
  ];

  for (const candidate of displayCandidates) {
    if (typeof candidate === "string" && candidate.trim().length) {
      return candidate.trim();
    }
  }

  const numeric = getTournamentEntryFee(tournament);
  return numeric !== null ? `${formatCurrencyValue(numeric)} تومان` : "";
}

function isTournamentFree(tournament) {
  if (!tournament || typeof tournament !== "object") {
    return true;
  }

  const freeCandidates = [
    tournament.is_free,
    tournament.isFree,
    tournament.registration?.is_free,
    tournament.registration?.isFree,
    tournament.registration_settings?.is_free,
    tournament.registration_settings?.isFree,
  ];

  for (const candidate of freeCandidates) {
    if (candidate !== undefined && candidate !== null) {
      return interpretTruthyFlag(candidate);
    }
  }

  const entryFee = getTournamentEntryFee(tournament);
  return entryFee === null || entryFee <= 0;
}

function resolveTournamentVerificationRequirement(tournament) {
  if (!tournament || typeof tournament !== "object") {
    return null;
  }

  const candidates = [
    tournament.required_verification_level,
    tournament.requiredVerificationLevel,
    tournament.registration?.required_verification_level,
    tournament.registration?.requiredVerificationLevel,
    tournament.registration_settings?.required_verification_level,
    tournament.registration_settings?.requiredVerificationLevel,
  ];

  for (const candidate of candidates) {
    const parsed = parseIntegerValue(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function resolveTournamentRankBounds(tournament) {
  if (!tournament || typeof tournament !== "object") {
    return { min: null, max: null };
  }

  const minCandidates = [
    tournament.min_rank,
    tournament.minRank,
    tournament.registration?.min_rank,
    tournament.registration?.minRank,
    tournament.registration_settings?.min_rank,
    tournament.registration_settings?.minRank,
  ];

  const maxCandidates = [
    tournament.max_rank,
    tournament.maxRank,
    tournament.registration?.max_rank,
    tournament.registration?.maxRank,
    tournament.registration_settings?.max_rank,
    tournament.registration_settings?.maxRank,
  ];

  let min = null;
  let max = null;

  for (const candidate of minCandidates) {
    const parsed = parseIntegerValue(candidate);
    if (parsed !== null) {
      min = parsed;
      break;
    }
  }

  for (const candidate of maxCandidates) {
    const parsed = parseIntegerValue(candidate);
    if (parsed !== null) {
      max = parsed;
      break;
    }
  }

  return { min, max };
}

function evaluateTournamentEligibility({ requireWalletCheck = false } = {}) {
  const defaultTitle = "امکان ثبت‌نام وجود ندارد";

  if (!state.tournament) {
    return {
      allowed: false,
      title: defaultTitle,
      message: "اطلاعات تورنومنت در دسترس نیست. لطفاً صفحه را بازنشانی کنید.",
    };
  }

  if (hasUserAlreadyJoinedTournament()) {
    return {
      allowed: false,
      title: defaultTitle,
      message: "شما قبلاً در این تورنومنت ثبت‌نام کرده‌اید.",
      reason: "already_joined",
    };
  }

  const requiredLevel = resolveTournamentVerificationRequirement(state.tournament);
  if (requiredLevel !== null) {
    const userLevel = resolveUserVerificationLevel(state.userProfile);
    if (userLevel === null) {
      return {
        allowed: false,
        title: defaultTitle,
        message: "برای ثبت‌نام در این تورنومنت ابتدا سطح احراز هویت حساب خود را تکمیل کنید.",
        reason: "level_unknown",
      };
    }

    if (userLevel < requiredLevel) {
      return {
        allowed: false,
        title: defaultTitle,
        message: `برای شرکت در این تورنومنت حداقل سطح احراز ${requiredLevel} مورد نیاز است؛ سطح فعلی حساب شما ${userLevel} است.`,
        reason: "level_insufficient",
      };
    }
  }

  const { min: minRank, max: maxRank } = resolveTournamentRankBounds(state.tournament);
  if (minRank !== null || maxRank !== null) {
    const userRank = resolveUserRank(state.userProfile);
    if (userRank === null) {
      return {
        allowed: false,
        title: defaultTitle,
        message: "برای ثبت‌نام، رتبه شما باید مشخص باشد. لطفاً پروفایل خود را کامل کنید.",
        reason: "rank_unknown",
      };
    }

    if (minRank !== null && userRank < minRank) {
      return {
        allowed: false,
        title: defaultTitle,
        message: `حداقل رتبه مجاز برای این تورنومنت ${minRank} است؛ رتبه فعلی شما ${userRank} می‌باشد.`,
        reason: "rank_too_low",
      };
    }

    if (maxRank !== null && userRank > maxRank) {
      return {
        allowed: false,
        title: defaultTitle,
        message: `حداکثر رتبه مجاز برای این تورنومنت ${maxRank} است؛ رتبه فعلی شما ${userRank} می‌باشد.`,
        reason: "rank_too_high",
      };
    }
  }

  const requiredColorId = resolveTournamentColorIdentifier(state.tournament);
  if (requiredColorId) {
    const userColorId = resolveUserColorIdentifier(state.userProfile);
    if (userColorId && userColorId !== requiredColorId) {
      const colorName = resolveTournamentColorName(state.tournament) || "ویژه";
      return {
        allowed: false,
        title: defaultTitle,
        message: `برای شرکت در این تورنومنت نیاز به رنگ ${colorName} دارید.`,
        reason: "color_mismatch",
      };
    }
  }

  if (requireWalletCheck && !isTournamentFree(state.tournament)) {
    const entryFee = getTournamentEntryFee(state.tournament);
    if (entryFee !== null && entryFee > 0) {
      const walletInfo = resolveWalletBalance(state.userWallet || {});
      const balance = walletInfo.amount !== null ? walletInfo.amount : null;
      const balanceDisplay =
        walletInfo.display || (balance !== null ? `${formatCurrencyValue(balance)} تومان` : "");

      if (balance === null || balance < entryFee) {
        const shortage = balance === null ? entryFee : entryFee - balance;
        const formattedEntry =
          getTournamentEntryFeeDisplay(state.tournament) || `${formatCurrencyValue(entryFee)} تومان`;
        const shortageText = shortage > 0 ? `${formatCurrencyValue(shortage)} تومان` : "";
        const messageParts = [`هزینه ورود به این تورنومنت ${formattedEntry} است.`];
        if (balanceDisplay) {
          messageParts.push(`موجودی فعلی شما ${balanceDisplay} می‌باشد.`);
        }
        if (shortageText) {
          messageParts.push(`برای ثبت‌نام به ${shortageText} دیگر نیاز دارید.`);
        }

        return {
          allowed: false,
          title: defaultTitle,
          message: messageParts.join(" "),
          reason: "balance_insufficient",
          actions: [
            {
              label: "شارژ حساب",
              href: "/user-dashboard/wallet.html",
              variant: "primary",
            },
            {
              label: "بازگشت",
              close: true,
              variant: "secondary",
            },
          ],
        };
      }
    }
  }

  return { allowed: true };
}

function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

function getTeamMembersList(team) {
  if (!team || typeof team !== "object") {
    return [];
  }

  const candidates = [team.members, team.players, team.users, team.members_list];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function getTeamMemberCount(team) {
  if (!team || typeof team !== "object") {
    return null;
  }

  const numericCandidates = [
    team.member_count,
    team.members_count,
    team.memberCount,
    team.count,
  ];

  for (const candidate of numericCandidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string" && candidate.trim().length) {
      const parsed = Number.parseInt(candidate, 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  const members = getTeamMembersList(team);
  return members.length || null;
}

function markTournamentTeamsCache(tournament) {
  state.tournamentTeamIds = new Set();

  if (!tournament) {
    return;
  }

  const teams = Array.isArray(tournament.teams)
    ? tournament.teams
    : state.tournament?.type === "team" && Array.isArray(state.participants)
    ? state.participants
    : [];
  teams.forEach((team) => {
    const identifier = resolveTeamId(team);
    if (identifier) {
      state.tournamentTeamIds.add(String(identifier));
    }
  });

  state.teamsById.forEach((team, key) => {
    state.teamsById.set(String(key), {
      ...team,
      alreadyRegistered: isTeamAlreadyRegistered(key),
    });
  });

  updateTeamOptionElements();
}

function isTeamAlreadyRegistered(teamId) {
  if (!teamId) {
    return false;
  }
  return state.tournamentTeamIds.has(String(teamId));
}

function normaliseTeamRecord(team) {
  const identifier = resolveTeamId(team);
  if (!identifier) {
    return null;
  }

  const memberList = getTeamMembersList(team);
  const memberCount = getTeamMemberCount({ ...team, members: memberList });

  const captainId = normaliseId(team?.captain);
  const isCaptain = (() => {
    const currentUserId = normaliseId(state.userId);
    if (!currentUserId) {
      return Boolean(team?.is_captain);
    }

    const directCaptain = normaliseId(team?.captain);
    if (directCaptain) {
      return directCaptain === currentUserId;
    }

    if (team?.captain && typeof team.captain === "object") {
      const nestedCandidates = [
        team.captain.id,
        team.captain.user_id,
        team.captain.pk,
      ];
      for (const candidate of nestedCandidates) {
        const resolved = normaliseId(candidate);
        if (resolved) {
          return resolved === currentUserId;
        }
      }
    }

    if (Array.isArray(memberList)) {
      return memberList.some((member) => {
        if (!member || typeof member !== "object") {
          return false;
        }
        const roles = [member.role, member.position];
        if (roles.some((role) => typeof role === "string" && role.toLowerCase() === "captain")) {
          const memberId = normaliseId(member.id || member.user_id || member.pk);
          return memberId === currentUserId;
        }
        return false;
      });
    }

    return Boolean(team?.is_captain);
  })();

  return {
    ...team,
    identifier: String(identifier),
    memberList,
    memberCount,
    captainId,
    isCaptain,
    alreadyRegistered: isTeamAlreadyRegistered(identifier),
    _hydrated:
      (Array.isArray(memberList) && memberList.length > 0) ||
      typeof memberCount === "number",
  };
}

function updateTeamCache(teams) {
  state.teamsById.clear();
  teams.forEach((team) => {
    const normalised = normaliseTeamRecord(team);
    if (normalised) {
      state.teamsById.set(normalised.identifier, normalised);
    }
  });
}

function mergeTeamRecord(teamId, updates) {
  const key = String(teamId);
  const existing = state.teamsById.get(key) || { identifier: key };
  const merged = normaliseTeamRecord({ ...existing, ...updates });
  if (merged) {
    state.teamsById.set(key, merged);
  }
  return merged;
}

function getCachedTeam(teamId) {
  if (!teamId) {
    return null;
  }
  return state.teamsById.get(String(teamId)) || null;
}

function hasTeamMemberData(team) {
  return Array.isArray(team?.memberList) && team.memberList.length > 0;
}

function getRequiredTeamSize() {
  const size = Number(state.tournament?.team_size);
  if (Number.isFinite(size) && size > 0) {
    return size;
  }
  return null;
}

function createTeamSizeValidation(team) {
  const requiredSize = getRequiredTeamSize();
  if (!requiredSize) {
    return { valid: true };
  }

  const actualCount = typeof team?.memberCount === "number" ? team.memberCount : null;
  if (actualCount === null) {
    return {
      valid: false,
      code: "TEAM_SIZE_UNKNOWN",
      message: "تعداد اعضای تیم مشخص نیست. لطفاً اعضای تیم را بررسی کنید.",
    };
  }

  if (actualCount < requiredSize) {
    return {
      valid: false,
      code: "TEAM_TOO_SMALL",
      message: `این تورنومنت به تیمی با ${requiredSize} عضو نیاز دارد؛ تیم شما ${actualCount} عضو دارد.`,
    };
  }

  if (actualCount > requiredSize) {
    return {
      valid: false,
      code: "TEAM_TOO_LARGE",
      message: `حداکثر تعداد مجاز اعضای تیم در این تورنومنت ${requiredSize} نفر است؛ تیم شما ${actualCount} عضو دارد.`,
    };
  }

  return { valid: true };
}

function validateTeamEligibility(team, { includeRegistrationCheck = true } = {}) {
  if (!team) {
    return {
      valid: false,
      code: "TEAM_NOT_FOUND",
      message: "اطلاعات تیم انتخاب‌شده یافت نشد.",
    };
  }

  if (!team.isCaptain) {
    return {
      valid: false,
      code: "NOT_CAPTAIN",
      message: "برای ثبت‌نام تیم باید کاپیتان آن باشید.",
    };
  }

  if (includeRegistrationCheck && team.alreadyRegistered) {
    return {
      valid: false,
      code: "ALREADY_REGISTERED",
      message: "این تیم قبلاً در تورنومنت ثبت شده است.",
    };
  }

  const resolvedMemberCount =
    typeof team.memberCount === "number"
      ? team.memberCount
      : Array.isArray(team.memberList)
      ? team.memberList.length
      : null;

  if (resolvedMemberCount === null) {
    return {
      valid: false,
      code: "TEAM_SIZE_UNKNOWN",
      message: "تعداد اعضای تیم مشخص نیست. لطفاً اطلاعات تیم را به‌روزرسانی کنید.",
    };
  }

  if (resolvedMemberCount <= 0) {
    return {
      valid: false,
      code: "MEMBERS_MISSING",
      message: "تیمی بدون عضو قابل ثبت‌نام نیست. لطفاً ابتدا اعضای تیم را اضافه کنید.",
    };
  }

  const sizeValidation = createTeamSizeValidation({
    ...team,
    memberCount: resolvedMemberCount,
  });
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  return { valid: true };
}

function describeTeamMeta(team) {
  if (!team) {
    return "";
  }

  const fragments = [];

  if (typeof team.memberCount === "number") {
    fragments.push(`${team.memberCount} عضو`);
  }

  if (team.alreadyRegistered) {
    fragments.push("ثبت شده در تورنومنت");
  }

  if (!team.isCaptain) {
    fragments.push("کاپیتان تیم نیستید");
  }

  const sizeValidation = createTeamSizeValidation(team);
  if (!sizeValidation.valid) {
    if (sizeValidation.code === "TEAM_TOO_SMALL") {
      fragments.push("کمتر از حد مجاز");
    } else if (sizeValidation.code === "TEAM_TOO_LARGE") {
      fragments.push("بیشتر از حد مجاز");
    }
  }

  return fragments.join(" • ");
}

function teamRequiresHydration(team) {
  if (!team) {
    return false;
  }

  if (typeof team.memberCount === "number") {
    return false;
  }

  if (team._hydrated) {
    return false;
  }

  return !hasTeamMemberData(team);
}

function notifyTeamValidationError(result) {
  if (!result || result.valid) {
    return;
  }

  const key =
    (result.code && TEAM_VALIDATION_NOTIFICATION_KEYS[result.code]) ||
    "teamJoinValidationFailed";
  notify(key, result.message, "error");
}

async function hydrateTeamIfNeeded(teamId) {
  const key = normaliseId(teamId);
  if (!key) {
    return null;
  }

  const existing = getCachedTeam(key);
  if (existing && !teamRequiresHydration(existing)) {
    return existing;
  }

  if (state.teamDetailPromises.has(key)) {
    try {
      return await state.teamDetailPromises.get(key);
    } catch (error) {
      return existing || null;
    }
  }

  const controllerUrl = buildApiUrl(API_ENDPOINTS.users.team(key));

  const detailPromise = apiFetch(controllerUrl.toString())
    .then((details) => {
      const merged = mergeTeamRecord(key, details);
      updateTeamOptionElements();
      return merged;
    })
    .catch((error) => {
      console.error("Failed to hydrate team details", error);
      const message =
        error?.message || "امکان دریافت اطلاعات کامل تیم وجود ندارد.";
      notify("teamDetailsFetchFailed", message, "error");
      showModalError("teamJoinError", message);
      throw error;
    })
    .finally(() => {
      state.teamDetailPromises.delete(key);
    });

  state.teamDetailPromises.set(key, detailPromise);

  try {
    return await detailPromise;
  } catch (error) {
    return existing || null;
  }
}

function getAuthToken() {
  return (
    localStorage.getItem("authToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    null
  );
}

function isAuthenticated() {
  return Boolean(getAuthToken());
}

function getAuthHeaders() {
  const token = getAuthToken();
  return token
    ? {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }
    : { "Content-Type": "application/json" };
}

async function apiFetch(url, options = {}) {
  const config = {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  };

  if (config.body instanceof FormData) {
    if (config.headers && "Content-Type" in config.headers) {
      delete config.headers["Content-Type"];
    }
    if (config.headers && "content-type" in config.headers) {
      delete config.headers["content-type"];
    }
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }
    const networkError = new Error("برقراری ارتباط با سرور ممکن نشد. لطفاً اتصال اینترنت خود را بررسی کنید.");
    networkError.cause = error;
    throw networkError;
  }

  if (response.status === 204) {
    return null;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      payload?.detail ||
      payload?.message ||
      (typeof payload === "string" && payload) ||
      "درخواست با خطا روبه‌رو شد.";
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    error.response = response;
    throw error;
  }

  return payload;
}

function hidePreloader() {
  const loader = document.getElementById("preloader");
  if (loader) loader.style.display = "none";
}

function showLoginRequired() {
  const loginBox = document.getElementById("login_required");
  const lobbyPage = document.getElementById("lobby_page");
  if (loginBox) loginBox.style.display = "flex";
  if (lobbyPage) lobbyPage.style.display = "none";
  hidePreloader();
}

function showLobbyPage() {
  const loginBox = document.getElementById("login_required");
  const lobbyPage = document.getElementById("lobby_page");
  if (loginBox) loginBox.style.display = "none";
  if (lobbyPage) lobbyPage.style.display = "grid";
}

function openModalElement(modal) {
  if (!modal) {
    return;
  }
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}

function closeModalElement(modal) {
  if (!modal) {
    return;
  }
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
}

function showAuthRequiredModal() {
  const modal = document.getElementById("authRequiredModal");
  openModalElement(modal);
}

function closeAuthRequiredModal() {
  const modal = document.getElementById("authRequiredModal");
  closeModalElement(modal);
}

function resolveModalButtonClass(variant) {
  switch (variant) {
    case "secondary":
      return "modal_button modal_button--secondary";
    case "ghost":
      return "modal_button modal_button--ghost";
    case "primary":
    default:
      return "modal_button modal_button--primary";
  }
}

function renderJoinEligibilityActions(actions = []) {
  const container = document.getElementById("joinEligibilityModalActions");
  if (!container) {
    return;
  }

  const effectiveActions = Array.isArray(actions) && actions.length
    ? actions
    : [
        {
          label: "متوجه شدم",
          close: true,
          variant: "primary",
        },
      ];

  container.innerHTML = "";

  effectiveActions.forEach((action) => {
    const label = action?.label || "متوجه شدم";
    const variantClass = resolveModalButtonClass(action?.variant);
    let element;

    if (action?.href) {
      element = document.createElement("a");
      element.href = action.href;
      if (action?.target) {
        element.target = action.target;
      }
      element.rel = action.rel || "noopener";
    } else {
      element = document.createElement("button");
      element.type = "button";
    }

    element.className = variantClass;
    element.textContent = label;

    const shouldClose = Boolean(action?.close || !action?.href);
    if (typeof action?.onClick === "function") {
      element.addEventListener("click", (event) => {
        action.onClick(event);
        if (shouldClose) {
          closeJoinEligibilityModal();
        }
      });
    } else if (shouldClose) {
      element.addEventListener("click", () => closeJoinEligibilityModal());
    }

    container.appendChild(element);
  });
}

function showJoinEligibilityModal(options = {}) {
  const modal = document.getElementById("joinEligibilityModal");
  const titleEl = document.getElementById("joinEligibilityModalTitle");
  const messageEl = document.getElementById("joinEligibilityModalMessage");

  if (titleEl) {
    titleEl.textContent = options.title || "امکان ثبت‌نام وجود ندارد";
  }

  if (messageEl) {
    messageEl.textContent = options.message || "";
  }

  renderJoinEligibilityActions(options.actions);
  openModalElement(modal);
}

function closeJoinEligibilityModal() {
  const modal = document.getElementById("joinEligibilityModal");
  closeModalElement(modal);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderAdminInfo(tournament) {
  const usernameEl = document.getElementById("adminUsername");
  const fullnameEl = document.getElementById("adminFullName");
  const avatarEl = document.getElementById("adminProfilePicture");

  const creator = tournament?.creator || {};
  const firstName = creator.first_name || "";
  const lastName = creator.last_name || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  if (usernameEl) {
    usernameEl.textContent = `نام کاربری: ${creator.username || "---"}`;
  }

  if (fullnameEl) {
    fullnameEl.textContent = `نام: ${fullName || "---"}`;
  }

  if (avatarEl) {
    avatarEl.src = creator.profile_picture || "img/profile.jpg";
    avatarEl.alt = creator.username || "ادمین";
  }
}

function renderTournamentSummary(tournament) {
  const signupTime = document.getElementById("signup_time");
  const startTime = document.getElementById("start_time");
  const endTime = document.getElementById("end_time");
  const tournamentMode = document.getElementById("tournament_mode");
  const banner = document.getElementById("tournament_banner");
  const prizePool = document.getElementById("prize_pool");
  const title = document.getElementById("tournament_title");
  const pageTitle = document.getElementById("tournaments-title");
  const statusEl = document.getElementById("tournament_status");

  if (signupTime) {
    const recruitmentStart =
      tournament.countdown_start_time ||
      tournament.registration_start ||
      tournament.start_date;
    signupTime.textContent = formatDateTime(recruitmentStart);
  }
  if (startTime) startTime.textContent = formatDateTime(tournament.start_date);
  if (endTime) endTime.textContent = formatDateTime(tournament.end_date);
  if (tournamentMode) {
    tournamentMode.textContent =
      tournament.type === "team"
        ? `تیمی (حداکثر ${tournament.team_size || 0} نفر)`
        : "انفرادی";
  }
  if (banner) {
    banner.src = tournament.image?.image || "/img/tournaments-defalt-banner.jpg";
    banner.alt = tournament.image?.alt || tournament.name || "بنر";
  }
  if (prizePool) {
    const prize = Number(tournament.prize_pool || 0);
    prizePool.textContent = prize
      ? `${prize.toLocaleString("fa-IR")} تومان`
      : "---";
  }
  if (title) title.textContent = tournament.name || "";
  if (pageTitle) pageTitle.textContent = tournament.name || "";

  if (statusEl) {
    const serverStatus = [
      tournament.status_label,
      tournament.status_display,
      tournament.status,
    ].find((value) => typeof value === "string" && value.trim());

    if (serverStatus) {
      statusEl.textContent = serverStatus.trim();
    } else {
      const now = new Date();
      const start = tournament.start_date ? new Date(tournament.start_date) : null;
      const end = tournament.end_date ? new Date(tournament.end_date) : null;
      let status = "";

      if (start && now < start) {
        status = "فعال (شروع نشده)";
      } else if (end && now <= end) {
        status = "در حال برگزاری";
      } else {
        status = "تمام شده";
      }

      statusEl.textContent = status;
    }
  }
}

function createPlayerSlot(player) {
  const slot = document.createElement("div");
  slot.className = "team_detail";
  slot.innerHTML = `
    <div class="team_name">${player.username || player.name || "کاربر"}</div>
    <div class="team_players">
      <div class="player">
        <img src="${
          player.avatar || player.profile_picture || "img/profile.jpg"
        }" alt="player" loading="lazy">
      </div>
    </div>
  `;
  return slot;
}

function renderTeamSlot(team) {
  const slot = document.createElement("div");
  slot.className = "team_detail";
  const members = Array.isArray(team.members)
    ? team.members
    : Array.isArray(team.players)
    ? team.players
    : Array.isArray(team.users)
    ? team.users
    : [];

  const membersMarkup = members
    .map(
      (member) => `
        <div class="player">
          <img src="${
            member.avatar || member.profile_picture || "img/profile.jpg"
          }" alt="member" loading="lazy">
        </div>
      `,
    )
    .join("");

  slot.innerHTML = `
    <div class="team_name">${team.name || "تیم"}</div>
    <div class="team_players">${membersMarkup}</div>
  `;

  return slot;
}

function createEmptyButton(label, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "team_detail team_empty";
  button.innerHTML = `
    ${label}
    <i><img src="img/icons/plus.svg" alt="plus"></i>
  `;
  button.addEventListener("click", handler);
  return button;
}

function getKnownParticipantCount(tournament) {
  const countCandidates = [
    state.participantTotalCount,
    state.participants?.length,
    tournament?.current_participants,
    tournament?.registration?.current_participants,
    tournament?.registration?.currentParticipants,
    tournament?.participants?.length,
    tournament?.teams?.length,
  ];

  for (const candidate of countCandidates) {
    if (candidate === undefined || candidate === null) {
      continue;
    }

    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }

    if (typeof candidate === "string") {
      const parsed = Number.parseInt(candidate.replace(/[^\d-]/g, ""), 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function parseSpotsLeftValue(tournament) {
  if (!tournament) {
    return null;
  }

  const rawValue = tournament.spots_left;
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === "string") {
    const match = rawValue.match(/-?\d+/);
    if (match) {
      const parsed = Number.parseInt(match[0], 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  const maxSlots = Number(tournament.max_participants);
  if (!Number.isFinite(maxSlots)) {
    return null;
  }

  const currentCount = getKnownParticipantCount(tournament);
  if (!Number.isFinite(currentCount)) {
    return null;
  }

  return Math.max(maxSlots - currentCount, 0);
}

function describeSpotsLeft(tournament) {
  if (!tournament) {
    return "";
  }

  if (typeof tournament.spots_left === "string" && tournament.spots_left.trim()) {
    return tournament.spots_left.trim();
  }

  const remaining = parseSpotsLeftValue(tournament);
  if (remaining === null) {
    return "";
  }

  if (remaining <= 0) {
    return "ظرفیت این تورنومنت تکمیل شده است.";
  }

  return tournament.type === "team"
    ? `${remaining} تیم ظرفیت باقی مانده است.`
    : `${remaining} جای خالی باقی مانده است.`;
}

function getParticipantsSection() {
  const section = document.getElementById("participants_section");
  if (!section) {
    return null;
  }

  let list = section.querySelector("[data-participants-list]");
  let loadMore = section.querySelector("[data-participants-load-more]");
  let meta = section.querySelector("[data-participants-meta]");

  if (!list) {
    list = document.createElement("div");
    list.dataset.participantsList = "true";
    section.appendChild(list);
  }

  if (!loadMore) {
    loadMore = document.createElement("button");
    loadMore.type = "button";
    loadMore.dataset.participantsLoadMore = "true";
    loadMore.className = "participants_load_more";
    loadMore.addEventListener("click", handleParticipantsLoadMore);
    section.appendChild(loadMore);
  }

  if (!meta) {
    meta = document.createElement("div");
    meta.dataset.participantsMeta = "true";
    meta.className = "participants_meta";
    section.appendChild(meta);
  }

  return { section, list, loadMore, meta };
}

function resetParticipantsSection(tournament) {
  const section = document.getElementById("participants_section");
  if (!section) {
    return null;
  }

  section.innerHTML = "";
  const refs = getParticipantsSection();
  if (!refs) {
    return null;
  }

  refs.list.innerHTML = "";
  refs.list.className = tournament.type === "team" ? "teams_grid" : "players_grid";

  refs.loadMore.textContent = "";
  refs.loadMore.disabled = true;
  refs.loadMore.hidden = true;

  refs.meta.textContent = "";
  refs.meta.classList.add("is-hidden");

  state.participants = [];
  state.participantIds.clear();
  state.participantRenderedCount = 0;
  state.participantNextUrl = null;
  state.participantLoading = false;
  state.participantError = null;
  state.participantsInitialised = true;

  return refs;
}

function updateParticipantsMeta(tournament) {
  const refs = getParticipantsSection();
  if (!refs) {
    return;
  }

  const message = describeSpotsLeft(tournament);
  if (message) {
    refs.meta.textContent = message;
    refs.meta.classList.remove("is-hidden");
  } else {
    refs.meta.textContent = "";
    refs.meta.classList.add("is-hidden");
  }
}

function updateJoinCta(tournament) {
  const refs = getParticipantsSection();
  if (!refs) {
    return;
  }

  const existing = refs.list.querySelector(".participants_cta");
  if (existing) {
    existing.remove();
  }

  const availableSpots = parseSpotsLeftValue(tournament);
  const hasCapacity = availableSpots === null ? true : availableSpots > 0;
  if (!hasCapacity) {
    return;
  }

  const ctaLabel =
    tournament.type === "team"
      ? "همین الان تیمت رو اضافه کن"
      : "همین الان اضافه شو!";
  const handler = tournament.type === "team" ? openTeamJoinModal : openIndividualJoinModal;
  const cta = createEmptyButton(ctaLabel, handler);
  cta.classList.add("participants_cta");
  refs.list.appendChild(cta);
}

function updateParticipantsLoadMoreButton() {
  const refs = getParticipantsSection();
  if (!refs) {
    return;
  }

  const hasBuffered = state.participantRenderedCount < state.participants.length;
  const canFetchMore = Boolean(state.participantNextUrl);
  const loading = state.participantLoading;

  if (!hasBuffered && !canFetchMore) {
    refs.loadMore.hidden = true;
    refs.loadMore.disabled = true;
    return;
  }

  refs.loadMore.hidden = false;
  refs.loadMore.disabled = loading;
  refs.loadMore.textContent = loading
    ? "در حال بارگیری..."
    : hasBuffered
    ? "نمایش بیشتر"
    : "بارگیری بیشتر";
}

function handleParticipantsLoadMore() {
  if (state.participantLoading) {
    return;
  }

  if (state.participantRenderedCount < state.participants.length) {
    renderParticipantBatch();
    return;
  }

  if (state.participantNextUrl) {
    fetchParticipantsPage(state.participantNextUrl);
  }
}

function normaliseParticipantKey(participant) {
  if (participant === null || participant === undefined) {
    return null;
  }

  if (typeof participant !== "object") {
    return String(participant);
  }

  const directCandidates = [
    participant.identifier,
    participant.id,
    participant.user_id,
    participant.userId,
    participant.pk,
    participant.uuid,
    participant.slug,
    participant.team_id,
    participant.teamId,
    participant.username,
    participant.name,
  ];

  for (const candidate of directCandidates) {
    const resolved = normaliseId(candidate);
    if (resolved) {
      return resolved;
    }
  }

  const nestedCandidates = [participant.user, participant.profile, participant.account];
  for (const nested of nestedCandidates) {
    const resolved = normaliseId(nested?.id) || normaliseId(nested?.username);
    if (resolved) {
      return resolved;
    }
  }

  return stableStringify(participant);
}

function mergeParticipants(participants, { replace = false } = {}) {
  if (!Array.isArray(participants) || !participants.length) {
    return;
  }

  if (replace) {
    state.participants = [];
    state.participantIds.clear();
    state.participantRenderedCount = 0;
  }

  participants.forEach((participant) => {
    const key = normaliseParticipantKey(participant);
    if (key && state.participantIds.has(key)) {
      return;
    }
    state.participants.push(participant);
    if (key) {
      state.participantIds.add(key);
      if (state.tournament?.type === "team") {
        state.tournamentTeamIds.add(String(key));
      }
    }
  });
}

function renderParticipantBatch() {
  const refs = getParticipantsSection();
  if (!refs) {
    return;
  }

  const startIndex = state.participantRenderedCount;
  const nextTarget = Math.min(
    state.participants.length,
    state.participantRenderedCount + PARTICIPANT_RENDER_BATCH,
  );

  if (nextTarget <= startIndex) {
    updateParticipantsLoadMoreButton();
    return;
  }

  const existingCta = refs.list.querySelector(".participants_cta");
  if (existingCta) {
    existingCta.remove();
  }

  const fragment = document.createDocumentFragment();
  for (let index = startIndex; index < nextTarget; index += 1) {
    const item = state.participants[index];
    const node = state.tournament?.type === "team"
      ? renderTeamSlot(item)
      : createPlayerSlot(item);
    fragment.appendChild(node);
  }

  refs.list.appendChild(fragment);
  state.participantRenderedCount = nextTarget;
  updateJoinCta(state.tournament);
  updateParticipantsLoadMoreButton();
}

function normaliseParticipantPage(payload) {
  if (Array.isArray(payload)) {
    return { results: payload, next: null, count: payload.length };
  }

  if (payload && typeof payload === "object") {
    const results = Array.isArray(payload.results)
      ? payload.results
      : Array.isArray(payload.items)
      ? payload.items
      : [];
    const count =
      typeof payload.count === "number"
        ? payload.count
        : typeof payload.total === "number"
        ? payload.total
        : null;
    const next = payload.next || payload.next_page || null;
    return { results, next, count };
  }

  return { results: [], next: null, count: null };
}

function buildParticipantsRequestUrl(rawUrl) {
  if (rawUrl) {
    try {
      return new URL(rawUrl, window.location.origin);
    } catch (error) {
      console.warn("Failed to parse participant next URL", error);
    }
  }

  if (!state.tournamentId) {
    return null;
  }

  const basePath = API_ENDPOINTS.tournaments.detail(state.tournamentId);
  const normalisedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const url = buildApiUrl(`${normalisedBase}participants/`);
  url.searchParams.set("page_size", PARTICIPANT_PAGE_SIZE);
  return url;
}

async function fetchParticipantsPage(rawUrl) {
  if (state.participantLoading) {
    return;
  }

  const requestUrl = buildParticipantsRequestUrl(rawUrl);
  if (!requestUrl) {
    return;
  }

  state.participantLoading = true;
  updateParticipantsLoadMoreButton();

  try {
    const payload = await apiFetch(requestUrl.toString());
    const page = normaliseParticipantPage(payload);
    if (typeof page.count === "number") {
      state.participantTotalCount = page.count;
    }
    state.participantNextUrl = page.next || null;
    mergeParticipants(page.results);
    renderParticipantBatch();
  } catch (error) {
    console.warn("Failed to load tournament participants", error);
    state.participantNextUrl = null;
    state.participantError = error;
    if (!state.participants.length && Array.isArray(state.tournament?.participants)) {
      mergeParticipants(state.tournament.participants, { replace: true });
      renderParticipantBatch();
    } else if (!state.participants.length) {
      const refs = getParticipantsSection();
      if (refs) {
        refs.meta.textContent = "امکان دریافت لیست شرکت‌کنندگان وجود ندارد.";
        refs.meta.classList.remove("is-hidden");
      }
    }
  } finally {
    state.participantLoading = false;
    updateParticipantsLoadMoreButton();
    updateParticipantsMeta(state.tournament);
  }
}

function renderParticipants(tournament, options = {}) {
  const refs = resetParticipantsSection(tournament);
  if (!refs) {
    return;
  }

  const initialParticipants = Array.isArray(options.participants)
    ? options.participants
    : Array.isArray(tournament.participants)
    ? tournament.participants
    : [];

  if (typeof options.totalCount === "number") {
    state.participantTotalCount = options.totalCount;
  } else if (typeof tournament.participants_count === "number") {
    state.participantTotalCount = tournament.participants_count;
  }

  state.participantNextUrl = options.nextUrl || null;

  if (initialParticipants.length) {
    mergeParticipants(initialParticipants, { replace: true });
    renderParticipantBatch();
  } else {
    updateJoinCta(tournament);
    updateParticipantsLoadMoreButton();
  }

  updateParticipantsMeta(tournament);
}

function applyTournamentPayload(tournament, options = {}) {
  if (!tournament) {
    return;
  }

  const mergedTournament = { ...(state.tournament || {}), ...tournament };
  state.tournament = mergedTournament;

  markTournamentTeamsCache(mergedTournament);
  renderTournamentSummary(mergedTournament);
  renderAdminInfo(mergedTournament);

  const participantOptions = {};
  if (options.participants !== undefined) {
    participantOptions.participants = options.participants;
  } else if (Array.isArray(tournament.participants)) {
    participantOptions.participants = tournament.participants;
  }

  if (options.participantsNext !== undefined) {
    participantOptions.nextUrl = options.participantsNext;
  }

  if (options.participantsTotal !== undefined) {
    participantOptions.totalCount = options.participantsTotal;
  } else if (typeof tournament.participants_count === "number") {
    participantOptions.totalCount = tournament.participants_count;
  }

  renderParticipants(mergedTournament, participantOptions);

  if (options.fetchParticipants) {
    if (!state.participants.length) {
      fetchParticipantsPage();
    } else {
      updateParticipantsLoadMoreButton();
    }
  }
}

function notify(key, fallbackMessage, type = "info", overrides = {}) {
  const payload = { ...overrides };
  if (fallbackMessage) {
    payload.message = fallbackMessage;
  }
  if (window.AppNotifier?.showAppNotification) {
    window.AppNotifier.showAppNotification(key, payload);
    return;
  }
  const fallbackType = type === "success" ? "success" : type === "error" ? "error" : "info";
  const fallbackText = payload.message || "";
  if (fallbackType === "success" && typeof window.showSuccess === "function") {
    window.showSuccess(fallbackText);
  } else if (fallbackType === "error" && typeof window.showError === "function") {
    window.showError(fallbackText);
  } else if (typeof window.showInfo === "function") {
    window.showInfo(fallbackText);
  }
}

function showModalError(elementId, message) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const text = message?.toString().trim() || "";
  element.textContent = text;
  element.classList.toggle("is-hidden", !text);
}

function clearModalError(elementId) {
  showModalError(elementId, "");
}

function openJoinSuccessModal(message) {
  const modal = document.getElementById("joinSuccessModal");
  const description = document.getElementById("joinSuccessModalMessage");

  if (description) {
    description.textContent =
      message || "جزئیات تورنومنت به ایمیل شما ارسال شد. لطفاً ایمیل خود را بررسی کنید.";
  }

  if (modal) {
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  }
}

function closeJoinSuccessModal() {
  const modal = document.getElementById("joinSuccessModal");
  if (modal) {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }
}

function showJoinSuccessFeedback({ isTeam } = {}) {
  const message = isTeam
    ? "جزئیات تورنومنت به ایمیل کاپیتان تیم ارسال شد. لطفاً ایمیل را بررسی کنید."
    : "جزئیات تورنومنت به ایمیل شما ارسال شد. لطفاً ایمیل خود را بررسی کنید.";

  openJoinSuccessModal(message);
}

function getStoredInGameIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.inGameIds);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0);
  } catch (error) {
    console.warn("Failed to parse stored in-game IDs", error);
    return [];
  }
}

function storeInGameIds(values) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.inGameIds,
      JSON.stringify(values.slice(0, MAX_SAVED_INGAME_IDS)),
    );
  } catch (error) {
    console.warn("Failed to store in-game IDs", error);
  }
}

function populateInGameIdOptions(selectedValue = "") {
  const select = document.getElementById("inGameIdSelect");
  const wrapper = document.getElementById("inGameIdSavedWrapper");
  if (!select || !wrapper) return;

  const saved = getStoredInGameIds();
  select.innerHTML = '<option value="">یکی از نام‌های قبلی را انتخاب کنید</option>';

  if (!saved.length) {
    wrapper.classList.add("is-hidden");
    return;
  }

  wrapper.classList.remove("is-hidden");

  saved.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    if (selectedValue && item === selectedValue) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

function setInGameIdInputValue(value) {
  const input = document.getElementById("inGameIdInput");
  if (!input) return;
  input.value = value || "";
}

function rememberInGameId(value) {
  const trimmed = value.trim();
  if (!trimmed) return;

  const saved = getStoredInGameIds();
  const filtered = saved.filter((item) => item !== trimmed);
  filtered.unshift(trimmed);
  storeInGameIds(filtered);
  state.lastUsedInGameId = trimmed;
  populateInGameIdOptions(trimmed);
}

function useSavedInGameId() {
  const select = document.getElementById("inGameIdSelect");
  if (!select) return;

  const chosen = select.value?.trim();
  if (!chosen) {
    showModalError(
      "individualJoinError",
      "لطفاً یک نام ذخیره‌شده را انتخاب کنید یا نام جدیدی وارد نمایید.",
    );
    return;
  }

  clearModalError("individualJoinError");
  setInGameIdInputValue(chosen);
}

function resetIndividualJoinModal() {
  const form = document.querySelector("#individualJoinModal form");
  if (form) {
    form.reset();
  }

  const defaultValue = state.lastUsedInGameId || getStoredInGameIds()[0] || "";
  setInGameIdInputValue(defaultValue);
  populateInGameIdOptions(defaultValue);
  clearModalError("individualJoinError");
}

async function loadTournament() {
  if (!state.tournamentId) return;

  try {
    const detailUrl = buildApiUrl(
      API_ENDPOINTS.tournaments.detail(state.tournamentId),
    );
    const detailFields = [
      "id",
      "name",
      "description",
      "image",
      "color",
      "game",
      "start_date",
      "end_date",
      "countdown_start_time",
      "type",
      "mode",
      "max_participants",
      "team_size",
      "prize_pool",
      "spots_left",
      "creator",
      "status",
      "status_display",
      "status_label",
      "team_join_field",
      "join_payload_template",
      "join_payload",
      "registration_payload_template",
      "registration_payload",
      "registration",
      "registration_settings",
    ];
    detailUrl.searchParams.set("fields", detailFields.join(","));
    detailUrl.searchParams.set("expand", "creator,image");

    const tournament = await apiFetch(detailUrl.toString());

    applyTournamentPayload(tournament, { fetchParticipants: true });
    showLobbyPage();
  } catch (error) {
    console.error("Failed to load tournament", error);
    const message =
      error.message || "امکان دریافت اطلاعات تورنومنت وجود ندارد. لطفاً بعداً دوباره تلاش کنید.";
    notify("tournamentFetchFailed", message, "error");
  } finally {
    hidePreloader();
  }
}

function hasTeamSelectionValue(value) {
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
}

function resetTeamSelection() {
  state.selectedTeamId = null;
  const confirmBtn = document.getElementById("teamJoinConfirmButton");
  if (confirmBtn) confirmBtn.disabled = true;

  const list = document.getElementById("teamModalList");
  if (list) {
    list.querySelectorAll(".team-option").forEach((btn) => {
      btn.classList.remove("selected");
      btn.setAttribute("aria-pressed", "false");
    });
  }

  clearModalError("teamJoinError");
}

function applyTeamValidationResult(result) {
  const confirmBtn = document.getElementById("teamJoinConfirmButton");
  if (result?.valid) {
    if (confirmBtn) confirmBtn.disabled = false;
    clearModalError("teamJoinError");
    return;
  }

  if (confirmBtn) confirmBtn.disabled = true;
  if (result?.message) {
    showModalError("teamJoinError", result.message);
  }
}

function markSelectedTeamButton(teamId) {
  const list = document.getElementById("teamModalList");
  if (!list) {
    return;
  }

  list.querySelectorAll(".team-option").forEach((btn) => {
    const isSelected = String(btn.dataset.teamId) === String(teamId);
    btn.classList.toggle("selected", isSelected);
    btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });
}

function selectTeam(teamId) {
  const normalisedValue = hasTeamSelectionValue(teamId)
    ? String(teamId).trim()
    : null;

  state.selectedTeamId = normalisedValue;
  markSelectedTeamButton(normalisedValue);

  const selectEl = document.getElementById("teamSelect");
  if (selectEl) {
    selectEl.value = hasTeamSelectionValue(normalisedValue) ? normalisedValue : "";
  }

  if (!hasTeamSelectionValue(normalisedValue)) {
    applyTeamValidationResult({ valid: false, message: "لطفاً یک تیم انتخاب کنید." });
    return;
  }

  const cachedTeam = getCachedTeam(normalisedValue);
  if (!cachedTeam) {
    applyTeamValidationResult({
      valid: false,
      message: "اطلاعات تیم انتخاب‌شده یافت نشد.",
    });
    return;
  }

  if (teamRequiresHydration(cachedTeam)) {
    applyTeamValidationResult({
      valid: false,
      message: "در حال بررسی شرایط تیم...",
    });

    hydrateTeamIfNeeded(normalisedValue)
      .then((updatedTeam) => {
        if (state.selectedTeamId !== normalisedValue) {
          return;
        }
        const validation = validateTeamEligibility(updatedTeam);
        applyTeamValidationResult(validation);
      })
      .catch(() => {
        if (state.selectedTeamId === normalisedValue) {
          applyTeamValidationResult({
            valid: false,
            message: "امکان بررسی شرایط تیم وجود ندارد.",
          });
        }
      });

    return;
  }

  const validation = validateTeamEligibility(cachedTeam);
  applyTeamValidationResult(validation);
}

function resolveTeamId(team) {
  if (!team || typeof team !== "object") return null;

  const candidates = [
    team.identifier,
    team.id,
    team.pk,
    team.team_id,
    team.teamId,
    team.team,
    team.uuid,
    team.slug,
  ];

  for (const value of candidates) {
    const resolved = normaliseId(value);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function resolveTeamJoinPayloadIdentifier(teamId) {
  if (!hasTeamSelectionValue(teamId)) {
    return null;
  }

  const stringValue = String(teamId).trim();
  if (!stringValue) {
    return null;
  }

  if (/^\d+$/.test(stringValue)) {
    const numeric = Number.parseInt(stringValue, 10);
    return Number.isNaN(numeric) ? null : numeric;
  }

  return stringValue;
}

function getPreferredTeamJoinField() {
  const modal = document.getElementById("teamJoinModal");
  const modalField = modal?.dataset?.teamJoinField;
  if (typeof modalField === "string" && modalField.trim().length) {
    return modalField.trim();
  }

  const bodyField = document.body?.dataset?.teamJoinField;
  if (typeof bodyField === "string" && bodyField.trim().length) {
    return bodyField.trim();
  }

  const tournamentFieldCandidates = [
    state.tournament?.team_join_field,
    state.tournament?.teamJoinField,
    state.tournament?.registration?.team_field,
    state.tournament?.registration?.teamField,
    state.tournament?.registration_settings?.team_field,
    state.tournament?.registration_settings?.teamField,
  ];

  for (const candidate of tournamentFieldCandidates) {
    if (typeof candidate === "string" && candidate.trim().length) {
      return candidate.trim();
    }
  }

  return null;
}

function createTeamJoinPayloadCandidates(team, identifier) {
  const candidates = [];
  const seen = new Set();

  const addCandidate = (payload) => {
    if (!payload || typeof payload !== "object") {
      return;
    }
    const serialized = JSON.stringify(payload);
    if (seen.has(serialized)) {
      return;
    }
    seen.add(serialized);
    candidates.push(payload);
  };

  const preferredField = getPreferredTeamJoinField();
  if (preferredField) {
    addCandidate({ [preferredField]: identifier });
  }

  const knownIdentifiers = new Set();
  if (hasTeamSelectionValue(identifier)) {
    knownIdentifiers.add(identifier);
  }

  if (team && typeof team === "object") {
    const identifierFields = [
      team.identifier,
      team.id,
      team.team_id,
      team.teamId,
      team.slug,
      team.uuid,
    ];
    identifierFields.forEach((value) => {
      const normalised = normaliseId(value);
      if (normalised) {
        knownIdentifiers.add(normalised);
      }
    });
  }

  knownIdentifiers.forEach((value) => {
    addCandidate({ team: value });

    const numericId =
      typeof value === "number"
        ? value
        : /^\d+$/.test(String(value))
        ? Number.parseInt(String(value), 10)
        : null;

    if (numericId !== null && !Number.isNaN(numericId)) {
      addCandidate({ team_id: numericId });
      addCandidate({ teamId: numericId });
    } else if (typeof value === "string" && value.trim().length) {
      addCandidate({ team_slug: value });
      addCandidate({ teamSlug: value });
    }
  });

  const templateSources = [
    state.tournament?.registration_payload_template,
    state.tournament?.registration_payload,
    state.tournament?.join_payload_template,
    state.tournament?.join_payload,
  ];

  templateSources.forEach((template) => {
    if (!template || typeof template !== "object") {
      return;
    }
    const cloned = { ...template };
    const hasTeamKey = Object.keys(cloned).some((key) =>
      typeof key === "string" && key.toLowerCase().startsWith("team"),
    );
    if (!hasTeamKey) {
      cloned.team = identifier;
    }
    addCandidate(cloned);
  });

  if (!candidates.length) {
    addCandidate({ team: identifier });
  }

  return candidates;
}

function shouldRetryTeamJoinRequest(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  if (![400, 422].includes(error.status)) {
    return false;
  }

  const messages = [];

  if (error.payload) {
    const stack = [error.payload];
    while (stack.length) {
      const value = stack.pop();
      if (value === null || value === undefined) {
        continue;
      }
      if (typeof value === "string" || typeof value === "number") {
        messages.push(String(value));
        continue;
      }
      if (Array.isArray(value)) {
        stack.push(...value);
        continue;
      }
      if (typeof value === "object") {
        stack.push(...Object.values(value));
      }
    }
  }

  if (typeof error.message === "string") {
    messages.push(error.message);
  }

  const combined = messages.map((text) => text.toLowerCase()).join(" ");

  const stopKeywords = [
    "captain",
    "کاپیتان",
    "already",
    "قبلا",
    "ثبت",
    "member",
    "عضو",
    "اعضا",
    "ظرفیت",
    "full",
    "size",
    "limit",
    "حداکثر",
    "حداقل",
    "تعداد",
  ];

  if (combined && stopKeywords.some((keyword) => combined.includes(keyword))) {
    return false;
  }

  const retryKeywords = [
    "field",
    "payload",
    "body",
    "json",
    "required",
    "missing",
    "invalid",
    "team_id",
    "team id",
    "team",
    "شناسه",
    "اجباری",
    "الزامی",
  ];

  if (!combined) {
    return true;
  }

  return retryKeywords.some((keyword) => combined.includes(keyword));
}

async function submitTeamJoinRequest(joinUrl, team, identifier) {
  const payloadCandidates = createTeamJoinPayloadCandidates(team, identifier);
  let lastError = null;

  for (const payload of payloadCandidates) {
    try {
      const response = await apiFetch(joinUrl, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return response;
    } catch (error) {
      if (!shouldRetryTeamJoinRequest(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("ارسال اطلاعات ثبت‌نام تیم با خطا مواجه شد.");
}

function renderTeamOptions(teams, meta = {}) {
  const list = document.getElementById("teamModalList");
  const selectEl = document.getElementById("teamSelect");
  const emptyState = document.getElementById("teamModalEmptyState");
  const emptyTitle = emptyState?.querySelector("p");
  const emptySubtitle = emptyState?.querySelector("span");

  if (list) list.innerHTML = "";
  if (selectEl) selectEl.innerHTML = '<option value="">انتخاب تیم</option>';

  if (selectEl && !selectEl.dataset.listenerAttached) {
    selectEl.addEventListener("change", (event) => {
      const { value } = event.target;
      selectTeam(value);
    });
    selectEl.dataset.listenerAttached = "true";
  }

  updateTeamCache(Array.isArray(teams) ? teams : []);
  const processedTeams = Array.from(state.teamsById.values());

  if (!processedTeams.length) {
    if (emptyState) emptyState.classList.remove("is-hidden");
    if (emptyTitle) {
      emptyTitle.textContent =
        meta.empty_title || "هیچ تیم واجد شرایطی برای این تورنومنت پیدا نشد.";
    }
    if (emptySubtitle) {
      emptySubtitle.textContent =
        meta.empty_subtitle ||
        "برای ثبت‌نام، تیمی که کاپیتان آن هستید باید توسط سرور تایید شود.";
    }
    resetTeamSelection();
    return;
  }

  if (emptyState) emptyState.classList.add("is-hidden");

  const fragment = document.createDocumentFragment();

  processedTeams.forEach((team) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "team-option";
    button.dataset.teamId = team.identifier;

    const infoWrapper = document.createElement("div");
    infoWrapper.className = "team-option__info";

    const nameSpan = document.createElement("span");
    nameSpan.className = "team-option__name";
    nameSpan.textContent = team.name || "تیم";

    const metaSpan = document.createElement("span");
    metaSpan.className = "team-option__meta";
    metaSpan.textContent = describeTeamMeta(team);

    infoWrapper.appendChild(nameSpan);
    infoWrapper.appendChild(metaSpan);
    button.appendChild(infoWrapper);

    const tooltipParts = [team.name || "تیم"];
    if (metaSpan.textContent) {
      tooltipParts.push(metaSpan.textContent);
    }
    button.title = tooltipParts.filter(Boolean).join(" - ");

    const previewValidation = validateTeamEligibility(team, {
      includeRegistrationCheck: false,
    });
    if (!previewValidation.valid || team.alreadyRegistered) {
      button.classList.add("team-option--warning");
      button.title = previewValidation.message || "";
    }

    button.addEventListener("click", () => selectTeam(team.identifier));
    fragment.appendChild(button);

    if (selectEl) {
      const option = document.createElement("option");
      option.value = team.identifier;
      option.textContent = team.name || "تیم";
      selectEl.appendChild(option);
    }
  });

  list?.appendChild(fragment);

  const previousSelection = state.selectedTeamId;
  if (previousSelection && state.teamsById.has(String(previousSelection))) {
    selectTeam(previousSelection);
  } else {
    resetTeamSelection();
  }
}

//

function updateTeamOptionElements() {
  const list = document.getElementById("teamModalList");
  if (!list) {
    return;
  }

  list.querySelectorAll(".team-option").forEach((button) => {
    const teamId = button.dataset.teamId;
    const team = getCachedTeam(teamId);
    if (!team) {
      return;
    }

    const metaSpan = button.querySelector(".team-option__meta");
    if (metaSpan) {
      metaSpan.textContent = describeTeamMeta(team);
    }

    const tooltipParts = [team.name || "تیم"];
    if (metaSpan?.textContent) {
      tooltipParts.push(metaSpan.textContent);
    }
    button.title = tooltipParts.filter(Boolean).join(" - ");

    const previewValidation = validateTeamEligibility(team, {
      includeRegistrationCheck: false,
    });

    if (!previewValidation.valid || team.alreadyRegistered) {
      button.classList.add("team-option--warning");
    } else {
      button.classList.remove("team-option--warning");
    }
  });
}

//

async function fetchTeamOptions(searchTerm = "") {
  const trimmedSearch = searchTerm?.toString().trim() || "";

  if (state.teamRequestInFlight && state.teamAbortController) {
    state.teamAbortController.abort();
  }

  const controller = new AbortController();
  state.teamAbortController = controller;
  state.teamRequestInFlight = true;

  const loading = document.getElementById("teamModalLoading");
  if (loading) loading.classList.remove("is-hidden");
  clearModalError("teamJoinError");

  try {
    const userId = await ensureUserId();
    if (!userId) {
      const message = "شناسه کاربر یافت نشد. لطفاً دوباره وارد شوید.";
      notify("loginRequired", message, "error");
      showModalError("teamJoinError", message);
      renderTeamOptions([], {});
      return;
    }

    const url = buildApiUrl(API_ENDPOINTS.users.teams);
    url.searchParams.set("captain", userId);
    if (trimmedSearch) {
      url.searchParams.set("name", trimmedSearch);
      url.searchParams.set("search", trimmedSearch);
    }

    const result = await apiFetch(url.toString(), {
      signal: controller.signal,
    });

    const metaEl = document.getElementById("teamModalMeta");
    const hintEl = document.getElementById("teamModalHint");
    if (metaEl) {
      const description =
        result?.meta?.description ||
        result?.meta?.message ||
        "تیم‌هایی که کاپیتان آن‌ها هستید برای ثبت‌نام در اینجا نمایش داده می‌شوند.";
      metaEl.textContent = description;
    }
    if (hintEl) {
      hintEl.textContent = result?.meta?.hint || "";
    }

    const teams = Array.isArray(result?.results)
      ? result.results
      : Array.isArray(result)
      ? result
      : [];

    renderTeamOptions(teams, result?.meta || {});
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }
    console.error("Failed to load teams", error);
    const message =
      error?.message || "امکان دریافت تیم‌ها وجود ندارد. لطفاً بعداً دوباره تلاش کنید.";
    notify("tournamentFetchFailed", message, "error");
    showModalError("teamJoinError", message);
    renderTeamOptions([], {});
  } finally {
    state.teamRequestInFlight = false;
    if (state.teamAbortController === controller) {
      state.teamAbortController = null;
    }
    if (loading) loading.classList.add("is-hidden");
  }
}


async function ensureJoinEligibilityPreconditions() {
  if (!state.tournamentId) {
    showJoinEligibilityModal({
      title: "امکان ثبت‌نام وجود ندارد",
      message: "شناسه تورنومنت معتبر نیست.",
    });
    return false;
  }

  if (!isAuthenticated()) {
    showAuthRequiredModal();
    return false;
  }

  try {
    await ensureUserId();
  } catch (error) {
    console.error("Failed to resolve user identifier", error);
    showJoinEligibilityModal({
      title: "خطا در دریافت اطلاعات کاربری",
      message: error?.message || "امکان بررسی حساب کاربری وجود ندارد. لطفاً دوباره تلاش کنید.",
    });
    return false;
  }

  if (!state.tournament) {
    showJoinEligibilityModal({
      title: "امکان ثبت‌نام وجود ندارد",
      message: "اطلاعات تورنومنت هنوز بارگذاری نشده است. لطفاً کمی صبر کنید و دوباره تلاش نمایید.",
    });
    return false;
  }

  const requireWalletCheck = !isTournamentFree(state.tournament);
  const tasks = [];
  if (!state.userProfile) {
    tasks.push(ensureUserProfile());
  }
  if (requireWalletCheck && !state.userWallet) {
    tasks.push(ensureUserWallet());
  }

  if (tasks.length) {
    try {
      await Promise.all(tasks);
    } catch (error) {
      console.error("Failed to prepare join prerequisites", error);
      if (error?.status === 401) {
        showAuthRequiredModal();
      } else {
        showJoinEligibilityModal({
          title: "خطا در بررسی شرایط",
          message:
            error?.message || "امکان بررسی شرایط حساب شما وجود ندارد. لطفاً بعداً دوباره تلاش کنید.",
        });
      }
      return false;
    }
  }

  const evaluation = evaluateTournamentEligibility({ requireWalletCheck });
  if (!evaluation.allowed) {
    showJoinEligibilityModal(evaluation);
    return false;
  }

  return true;
}

async function openIndividualJoinModal() {
  const canProceed = await ensureJoinEligibilityPreconditions();
  if (!canProceed) {
    return;
  }

  const modal = document.getElementById("individualJoinModal");
  if (!modal) return;

  resetIndividualJoinModal();
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}

async function openTeamJoinModal() {
  const canProceed = await ensureJoinEligibilityPreconditions();
  if (!canProceed) {
    return;
  }

  const modal = document.getElementById("teamJoinModal");
  if (!modal) return;

  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
  clearModalError("teamJoinError");
  await fetchTeamOptions();
}

function closeIndividualJoinModal() {
  const modal = document.getElementById("individualJoinModal");
  if (!modal) return;
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  resetIndividualJoinModal();
}

function closeTeamJoinModal() {
  const modal = document.getElementById("teamJoinModal");
  if (!modal) return;
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  clearModalError("teamJoinError");
  resetTeamSelection();
}

async function joinIndividualTournament(event) {
  if (event?.preventDefault) {
    event.preventDefault();
  }

  if (!state.tournamentId) return;

  clearModalError("individualJoinError");

  const input = document.getElementById("inGameIdInput");
  const select = document.getElementById("inGameIdSelect");
  const submitBtn = document.querySelector("#individualJoinModal button[type='submit']");

  let inGameId = input?.value?.trim() || "";
  if (!inGameId && select) {
    inGameId = select.value?.trim() || "";
  }

  if (!inGameId) {
    showModalError("individualJoinError", "لطفاً نام کاربری خود در بازی را وارد کنید.");
    input?.focus();
    return;
  }

  if (inGameId.length < 3) {
    showModalError("individualJoinError", "نام وارد شده باید حداقل ۳ کاراکتر باشد.");
    input?.focus();
    return;
  }

  if (submitBtn) submitBtn.disabled = true;

  const eligibility = evaluateTournamentEligibility({ requireWalletCheck: true });
  if (!eligibility.allowed) {
    if (submitBtn) submitBtn.disabled = false;
    closeIndividualJoinModal();
    showJoinEligibilityModal(eligibility);
    return;
  }

  try {
    const payload = { in_game_id: inGameId };

    const joinUrl = buildApiUrl(
      API_ENDPOINTS.tournaments.join(state.tournamentId),
    );
    const updatedTournament = await apiFetch(joinUrl.toString(), {
      method: "POST",
      body: JSON.stringify(payload),
    });

    notify("tournamentJoinSuccess", null, "success");
    rememberInGameId(inGameId);
    closeIndividualJoinModal();
    showJoinSuccessFeedback({ isTeam: false });
    applyTournamentPayload(updatedTournament, {
      participants: Array.isArray(updatedTournament?.participants)
        ? updatedTournament.participants
        : undefined,
      participantsNext:
        updatedTournament?.participants_next || updatedTournament?.participantsNext || null,
      participantsTotal:
        typeof updatedTournament?.participants_count === "number"
          ? updatedTournament.participants_count
          : Array.isArray(updatedTournament?.participants)
          ? updatedTournament.participants.length
          : undefined,
    });
  } catch (error) {
    console.error("Failed to join tournament", error);
    const message =
      error.message || "امکان ثبت‌نام وجود ندارد. لطفاً بعداً دوباره تلاش کنید.";
    notify("tournamentJoinFailed", message, "error");
    showModalError("individualJoinError", message);
  }

  if (submitBtn) submitBtn.disabled = false;
}

function interpretTeamJoinError(error) {
  const defaultMessage = "امکان ثبت‌نام تیم وجود ندارد. لطفاً دوباره تلاش کنید.";

  if (!error) {
    return { message: defaultMessage, key: "tournamentJoinFailed" };
  }

  const textSources = [];
  if (error.message) textSources.push(error.message);

  if (error.payload) {
    if (typeof error.payload === "string") {
      textSources.push(error.payload);
    } else if (typeof error.payload === "object") {
      const detailCandidates = [
        error.payload.detail,
        error.payload.message,
        error.payload.error,
        error.payload.non_field_errors,
      ];
      detailCandidates.forEach((candidate) => {
        if (!candidate) return;
        if (Array.isArray(candidate)) {
          candidate.forEach((item) => {
            if (item) {
              textSources.push(String(item));
            }
          });
        } else {
          textSources.push(String(candidate));
        }
      });
    }
  }

  const combined = textSources
    .map((text) => String(text).toLowerCase())
    .join(" ");

  if (
    error.status === 403 ||
    combined.includes("permission") ||
    combined.includes("forbidden") ||
    combined.includes("not allowed") ||
    combined.includes("captain") ||
    combined.includes("کاپیتان")
  ) {
    return {
      message: "برای ثبت‌نام این تیم دسترسی ندارید. تنها کاپیتان تیم می‌تواند اقدام کند.",
      key: "teamJoinUnauthorized",
    };
  }

  if (
    error.status === 409 ||
    combined.includes("already") ||
    combined.includes("exists") ||
    combined.includes("duplicat") ||
    combined.includes("قبلا") ||
    combined.includes("ثبت شده")
  ) {
    return {
      message: "این تیم قبلاً در تورنومنت ثبت شده است.",
      key: "teamAlreadyRegistered",
    };
  }

  if (
    combined.includes("member") ||
    combined.includes("size") ||
    combined.includes("capacity") ||
    combined.includes("حداکثر") ||
    combined.includes("حداقل") ||
    combined.includes("full") ||
    combined.includes("limit")
  ) {
    return {
      message: "تعداد اعضای تیم با شرایط تورنومنت مطابقت ندارد.",
      key: "teamTooLarge",
    };
  }

  if (error.status === 404 || combined.includes("not found")) {
    return {
      message: "تیم انتخاب‌شده روی سرور پیدا نشد. لطفاً دوباره تلاش کنید.",
      key: "tournamentJoinFailed",
    };
  }

  const fallbackMessage = textSources.length ? textSources[0] : defaultMessage;
  return {
    message: fallbackMessage,
    key: "tournamentJoinFailed",
  };
}

async function joinTeamTournament() {
  if (!state.tournamentId) return;
  if (!hasTeamSelectionValue(state.selectedTeamId)) {
    const message = "لطفاً یک تیم انتخاب کنید.";
    notify("teamSelectionRequired", message);
    showModalError("teamJoinError", message);
    return;
  }

  const confirmBtn = document.getElementById("teamJoinConfirmButton");
  if (confirmBtn) confirmBtn.disabled = true;

  const eligibility = evaluateTournamentEligibility({ requireWalletCheck: true });
  if (!eligibility.allowed) {
    if (confirmBtn) confirmBtn.disabled = false;
    closeTeamJoinModal();
    showJoinEligibilityModal(eligibility);
    return;
  }

  try {
    const hydratedTeam = await hydrateTeamIfNeeded(state.selectedTeamId);
    const validation = validateTeamEligibility(hydratedTeam);

    if (!validation.valid) {
      notifyTeamValidationError(validation);
      applyTeamValidationResult(validation);
      return;
    }

    const payloadIdentifier = resolveTeamJoinPayloadIdentifier(
      hydratedTeam?.identifier || state.selectedTeamId,
    );

    if (payloadIdentifier === null) {
      const error = new Error(
        "شناسه تیم انتخاب‌شده نامعتبر است. لطفاً دوباره تلاش کنید.",
      );
      error.code = "INVALID_TEAM_ID";
      throw error;
    }

    clearModalError("teamJoinError");

    const joinUrl = buildApiUrl(
      API_ENDPOINTS.tournaments.join(state.tournamentId),
    );

    const updatedTournament = await submitTeamJoinRequest(
      joinUrl.toString(),
      hydratedTeam,
      payloadIdentifier,
    );

    notify("teamJoinSuccess", null, "success");
    closeTeamJoinModal();
    showJoinSuccessFeedback({ isTeam: true });
    applyTournamentPayload(updatedTournament, {
      participants: Array.isArray(updatedTournament?.teams)
        ? updatedTournament.teams
        : Array.isArray(updatedTournament?.participants)
        ? updatedTournament.participants
        : undefined,
      participantsNext:
        updatedTournament?.participants_next ||
        updatedTournament?.participantsNext ||
        updatedTournament?.teams_next ||
        null,
      participantsTotal:
        typeof updatedTournament?.participants_count === "number"
          ? updatedTournament.participants_count
          : typeof updatedTournament?.teams_count === "number"
          ? updatedTournament.teams_count
          : Array.isArray(updatedTournament?.teams)
          ? updatedTournament.teams.length
          : Array.isArray(updatedTournament?.participants)
          ? updatedTournament.participants.length
          : undefined,
    });
  } catch (error) {
    console.error("Failed to join team tournament:", error);

    if (error?.name === "AbortError") {
      return;
    }

    const { message, key } = interpretTeamJoinError(error);
    notify(key || "tournamentJoinFailed", message, "error");
    showModalError("teamJoinError", message);
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
  }
}


function setupModalDismiss() {
  const individualModal = document.getElementById("individualJoinModal");
  if (individualModal) {
    individualModal.addEventListener("click", (event) => {
      if (event.target === individualModal) {
        closeIndividualJoinModal();
      }
    });
  }

  const teamModal = document.getElementById("teamJoinModal");
  if (teamModal) {
    teamModal.addEventListener("click", (event) => {
      if (event.target === teamModal) {
        closeTeamJoinModal();
      }
    });
  }

  const successModal = document.getElementById("joinSuccessModal");
  if (successModal) {
    successModal.addEventListener("click", (event) => {
      if (event.target === successModal) {
        closeJoinSuccessModal();
      }
    });
  }

  const authModal = document.getElementById("authRequiredModal");
  if (authModal) {
    authModal.addEventListener("click", (event) => {
      if (event.target === authModal) {
        closeAuthRequiredModal();
      }
    });
  }

  const eligibilityModal = document.getElementById("joinEligibilityModal");
  if (eligibilityModal) {
    eligibilityModal.addEventListener("click", (event) => {
      if (event.target === eligibilityModal) {
        closeJoinEligibilityModal();
      }
    });
  }
}

function setupTeamSearch() {
  const searchInput = document.getElementById("teamModalSearch");
  if (!searchInput) return;

  const debouncedSearch = debounce((value) => {
    fetchTeamOptions(value);
  }, TEAM_SEARCH_DEBOUNCE_MS);

  searchInput.addEventListener("input", (event) => {
    const value = event.target.value?.trim() || "";
    debouncedSearch(value);
  });
}

function setupInGameIdHandlers() {
  const input = document.getElementById("inGameIdInput");
  const select = document.getElementById("inGameIdSelect");

  if (input) {
    input.addEventListener("input", () => {
      clearModalError("individualJoinError");
    });
  }

  if (select) {
    select.addEventListener("change", () => {
      const value = select.value?.trim() || "";
      if (value) {
        setInGameIdInputValue(value);
        clearModalError("individualJoinError");
      }
    });
  }
}

function initialise() {
  const params = new URLSearchParams(window.location.search);
  state.tournamentId = params.get("id");

  if (!state.tournamentId) {
    notify("tournamentIdMissing", "شناسه تورنومنت در آدرس وجود ندارد.");
    hidePreloader();
    return;
  }

  const authenticated = isAuthenticated();
  if (authenticated) {
    ensureUserId().catch(() => {});
  }

  if (!authenticated) {
    showLoginRequired();
  } else {
    showLobbyPage();
    loadTournament();
  }

  setupModalDismiss();
  setupTeamSearch();
  setupInGameIdHandlers();
  populateInGameIdOptions();
}

document.addEventListener("DOMContentLoaded", initialise);

window.openIndividualJoinModal = openIndividualJoinModal;
window.openTeamJoinModal = openTeamJoinModal;
window.closeIndividualJoinModal = closeIndividualJoinModal;
window.closeTeamJoinModal = closeTeamJoinModal;
window.closeJoinSuccessModal = closeJoinSuccessModal;
window.closeAuthRequiredModal = closeAuthRequiredModal;
window.closeJoinEligibilityModal = closeJoinEligibilityModal;
window.joinIndividualTournament = joinIndividualTournament;
window.joinTeamTournament = joinTeamTournament;
window.useSavedInGameId = useSavedInGameId;
