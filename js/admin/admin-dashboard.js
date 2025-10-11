import {
  ensureAdminAccess,
  getAdminUser,
  onAdminUserChange,
} from "./admin-auth.js";

const MAX_HEADER_UPDATE_ATTEMPTS = 12;

async function initAdminDashboard() {
  try {
    const adminUser = await ensureAdminAccess();
    document.body.classList.add("admin-dashboard-ready");
    updateDashboardHeader(adminUser);
    registerUserChangeListener();
  } catch (error) {
    console.error("Admin dashboard bootstrap failed", error);
  }
}

function registerUserChangeListener() {
  onAdminUserChange((user) => {
    updateDashboardHeader(user || getAdminUser());
  });
}

function updateDashboardHeader(user, attempt = 0) {
  const adminUser = user || getAdminUser();
  const applied = applyHeaderUser(adminUser);

  if (!applied && attempt < MAX_HEADER_UPDATE_ATTEMPTS) {
    window.requestAnimationFrame(() =>
      updateDashboardHeader(adminUser, attempt + 1)
    );
  }
}

function applyHeaderUser(user) {
  const displayName = getDisplayName(user);
  const avatarUrl = getAvatarUrl(user);

  let updated = false;

  const headerName = document.getElementById("header_user_name");
  if (headerName) {
    headerName.textContent = displayName;
    updated = true;
  }

  const headerAvatar = document.getElementById("header_user_avatar");
  if (headerAvatar && headerAvatar.tagName === "IMG") {
    if (avatarUrl && headerAvatar.getAttribute("src") !== avatarUrl) {
      headerAvatar.setAttribute("src", avatarUrl);
    }
    headerAvatar.setAttribute("alt", `پروفایل ${displayName}`.trim());
    updated = true;
  }

  const pageTitle = document.getElementById("page_title_text");
  if (pageTitle) {
    pageTitle.textContent = displayName
      ? `پنل مدیریت — ${displayName}`
      : "پنل مدیریت";
    updated = true;
  }

  if (displayName) {
    const documentTitle = `پنل مدیریت | ${displayName}`;
    if (document.title !== documentTitle) {
      document.title = documentTitle;
    }
  } else if (document.title !== "پنل مدیریت") {
    document.title = "پنل مدیریت";
  }

  return updated;
}

function getDisplayName(user) {
  if (!user || typeof user !== "object") {
    const storedName = safeGetStoredName();
    return storedName || "ادمین";
  }

  const { first_name, last_name, name, username } = user;
  const fullName = [first_name, last_name].filter(Boolean).join(" ");
  if (fullName) return fullName;
  if (name) return name;
  if (username) return username;

  const storedName = safeGetStoredName();
  return storedName || "ادمین";
}

function safeGetStoredName() {
  try {
    const raw = localStorage.getItem("user_data");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return "";
    const fullName = [parsed.first_name, parsed.last_name]
      .filter(Boolean)
      .join(" ");
    return parsed.name || fullName || parsed.username || "";
  } catch (error) {
    return "";
  }
}

function getAvatarUrl(user) {
  if (user && typeof user === "object") {
    const directAvatar =
      user.profile_picture ||
      user.avatar ||
      user.image ||
      user.photo ||
      user.photo_url ||
      user.picture;
    if (directAvatar) {
      return directAvatar;
    }
  }

  try {
    const storedAvatar = localStorage.getItem("profile_picture");
    if (storedAvatar) {
      return storedAvatar;
    }
  } catch (error) {
    // ignore storage access issues
  }

  return "../img/profile.jpg";
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void initAdminDashboard();
  });
} else {
  void initAdminDashboard();
}
