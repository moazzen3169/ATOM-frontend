import {
  ensureAdminAccess,
  getAdminUser,
  onAdminUserChange,
} from "./admin/admin-auth.js";

const NAV_ITEMS = [
  {
    href: "/admin-dashboard/tickets-management.html",
    icon: "🎫",
    label: "مدیریت تیکت‌ها",
  },
  {
    href: "/admin-dashboard/accept-users-verification.html",
    icon: "🛡️",
    label: "تایید احراز هویت",
  },
];

async function initSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  try {
    await ensureAdminAccess();
  } catch (error) {
    console.error("Sidebar initialization stopped", error);
    return;
  }

  renderSidebarContent(sidebar, getAdminUser());
  onAdminUserChange((user) => {
    renderSidebarContent(sidebar, user || getAdminUser());
  });
}

function renderSidebar(user) {
  const currentPath = window.location.pathname;
  const initials = getInitials(user);
  const roleLabel = getRoleLabel(user);
  const nameLabel = getName(user);

  const navLinks = NAV_ITEMS.map((item) => {
    const itemPath = new URL(item.href, window.location.origin).pathname;
    const isActive = currentPath === itemPath;
    return `
      <a class="sidebar__link ${isActive ? "is-active" : ""}" href="${item.href}">
        <span class="sidebar__icon" aria-hidden="true">${item.icon}</span>
        <span class="sidebar__label">${item.label}</span>
      </a>
    `;
  }).join("");

  return `
    <div class="sidebar__brand">
      <div class="sidebar__logo" aria-hidden="true">AT</div>
      <div class="sidebar__brand-meta">
        <span class="sidebar__brand-title">پنل مدیریت اتم</span>
        <span class="sidebar__brand-caption">پشتیبانی و عملیات</span>
      </div>
    </div>
    <div class="sidebar__user" aria-label="اطلاعات حساب ادمین">
      <div class="sidebar__avatar" aria-hidden="true">${initials}</div>
      <div class="sidebar__user-meta">
        <span class="sidebar__user-name">${nameLabel}</span>
        <span class="sidebar__user-role">${roleLabel}</span>
      </div>
    </div>
    <nav class="sidebar__nav" aria-label="منوی مدیریتی">
      ${navLinks}
    </nav>
    <div class="sidebar__footer">
      <button type="button" class="sidebar__logout" data-action="admin-logout">
        <span aria-hidden="true">↩</span>
        <span>خروج</span>
      </button>
    </div>
  `;
}

function getName(user) {
  if (!user) return "ادمین سیستم";
  const { first_name, last_name, username, name } = user;
  const parts = [first_name, last_name].filter(Boolean);
  if (parts.length) {
    return parts.join(" ");
  }
  if (name) return name;
  if (username) return username;
  return "ادمین سیستم";
}

function getRoleLabel(user) {
  if (!user) return "دسترسی ادمین";
  if (user.is_superuser) return "سوپر ادمین";
  if (user.is_staff) return "کارشناس پشتیبانی";

  const role =
    user.role ||
    user.position ||
    (Array.isArray(user.roles) ? user.roles[0] : null) ||
    (Array.isArray(user.groups) ? user.groups[0] : null);

  if (typeof role === "string" && role.trim()) {
    return role;
  }
  return "ادمین سیستم";
}

function getInitials(user) {
  const name = getName(user);
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return "ا";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

function handleLogout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_data");
  localStorage.removeItem("profile_picture");
  try {
    const event = new CustomEvent("atom:admin-user-changed", {
      detail: { user: null },
    });
    window.dispatchEvent(event);
  } catch (error) {
    try {
      const fallbackEvent = document.createEvent("CustomEvent");
      fallbackEvent.initCustomEvent("atom:admin-user-changed", false, false, {
        user: null,
      });
      window.dispatchEvent(fallbackEvent);
    } catch (dispatchError) {
      console.warn("Failed to dispatch admin logout event", dispatchError);
    }
  }
  window.location.href = "/register/login.html";
}

function renderSidebarContent(sidebar, user) {
  sidebar.innerHTML = renderSidebar(user);

  const logoutButton = sidebar.querySelector("[data-action=admin-logout]");
  if (logoutButton) {
    logoutButton.addEventListener("click", handleLogout, { once: true });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void initSidebar();
  });
} else {
  void initSidebar();
}
