/**
 * Utility functions for common operations
 */

export function normaliseId(value) {
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

export function stableStringify(value) {
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

export function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, item]) => {
      acc[key] = cloneValue(item);
      return acc;
    }, {});
  }

  return value;
}

export function mergePayloadTemplatesList(templates = []) {
  return templates.reduce((acc, template) => {
    if (!template || typeof template !== "object") {
      return acc;
    }

    const cloned = cloneValue(template);
    Object.entries(cloned).forEach(([key, value]) => {
      acc[key] = value;
    });

    return acc;
  }, {});
}

export function isMeaningfulValue(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
}

export function ensureField(target, value, ...keys) {
  if (!target || typeof target !== "object" || !keys.length) {
    return;
  }

  if (!isMeaningfulValue(value)) {
    return;
  }

  for (const key of keys) {
    if (key in target) {
      if (!isMeaningfulValue(target[key])) {
        target[key] = value;
      }
      return;
    }
  }

  target[keys[0]] = value;
}

export function sanitizePayload(value) {
  if (Array.isArray(value)) {
    const sanitized = value
      .map((item) => sanitizePayload(item))
      .filter((item) => {
        if (item === undefined || item === null) {
          return false;
        }
        if (Array.isArray(item)) {
          return item.length > 0;
        }
        if (typeof item === "object") {
          return Object.keys(item).length > 0;
        }
        return true;
      });

    return sanitized;
  }

  if (value && typeof value === "object") {
    const result = {};
    Object.entries(value).forEach(([key, item]) => {
      const sanitizedItem = sanitizePayload(item);
      if (sanitizedItem === undefined || sanitizedItem === null) {
        return;
      }
      if (Array.isArray(sanitizedItem) && !sanitizedItem.length) {
        return;
      }
      if (
        typeof sanitizedItem === "object" &&
        !Array.isArray(sanitizedItem) &&
        !Object.keys(sanitizedItem).length
      ) {
        return;
      }
      result[key] = sanitizedItem;
    });
    return result;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }

  return value;
}

export function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

export function formatDateTime(value) {
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

export function resolveAvatar(entity) {
  if (!entity || typeof entity !== "object") {
    return "img/profile.jpg";
  }

  const direct =
    entity.avatar ||
    entity.profile_picture ||
    entity.profilePicture ||
    entity.picture ||
    entity.image ||
    entity.photo ||
    null;

  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  if (direct && typeof direct === "object") {
    const nested = direct.url || direct.src || direct.image || direct.path;
    if (typeof nested === "string" && nested.trim()) {
      return nested;
    }
  }

  const nestedImage =
    entity?.profile?.picture ||
    entity?.profile?.image ||
    entity?.user?.avatar ||
    entity?.user?.profile_picture ||
    null;

  if (typeof nestedImage === "string" && nestedImage.trim()) {
    return nestedImage;
  }

  return "img/profile.jpg";
}

export function resolveGameId(player) {
  if (!player || typeof player !== "object") {
    return "";
  }

  const id =
    player.game_id ||
    player.gameId ||
    player.in_game_id ||
    player.inGameId ||
    player.ingame_id ||
    player.identifier ||
    "";

  return typeof id === "string" || typeof id === "number" ? String(id).trim() : "";
}

export function deepEqual(a, b) {
  return stableStringify(a) === stableStringify(b);
}
