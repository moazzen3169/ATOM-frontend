import { API_BASE_URL } from "/js/config.js";

document.addEventListener("DOMContentLoaded", async () => {
  const headerContainer = document.getElementById("header");
  if (!headerContainer) return;

  // ---- 1. نمایش سریع هدر از کش ----
  const cachedHeader = localStorage.getItem("header_html");
  if (cachedHeader) {
    headerContainer.innerHTML = cachedHeader;
    initHeaderAndSidebar({ skipData: true }); // فقط UI init
  }

  // ---- 2. گرفتن نسخه جدید در پس‌زمینه ----
  try {
    const response = await fetch("header.html", { cache: "reload" });
    if (response.ok) {
      const html = await response.text();
      if (html && html !== cachedHeader) {
        headerContainer.innerHTML = html;
        localStorage.setItem("header_html", html);
      }
    }
  } catch (err) {
    console.warn("Failed to fetch header:", err);
  }

  // ---- 3. همیشه دیتا رو async لود کن ----
  initHeaderAndSidebar({ skipData: false });

  // Scroll to top
  window.scrollTo(0, 0);
});

/* ----------------- Utility ----------------- */
const closest = (el, sel) => el?.closest ? el.closest(sel) : null;

const getHeaderElements = () => ({
  userButton: document.querySelector(".open_user_links"),
  userMenu: document.querySelector(".user_info_links"),
  notifButton: document.querySelector(".notification"),
  notifMenu: document.querySelector(".notification_hover")
});

const closeMenus = () => {
  const { userMenu, notifMenu, userButton, notifButton } = getHeaderElements();
  userMenu?.classList.remove("is-open");
  notifMenu?.classList.remove("is-open");
  userButton?.setAttribute("aria-expanded", "false");
  notifButton?.setAttribute("aria-expanded", "false");
};

const toggleMenu = (type) => {
  const { userMenu, notifMenu, userButton, notifButton } = getHeaderElements();
  const isUser = type === "user";
  const menuToToggle = isUser ? userMenu : notifMenu;
  const otherMenu = isUser ? notifMenu : userMenu;
  const trigger = isUser ? userButton : notifButton;
  const otherTrigger = isUser ? notifButton : userButton;

  if (!menuToToggle || !trigger) return;

  otherMenu?.classList.remove("is-open");
  otherTrigger?.setAttribute("aria-expanded", "false");

  const isOpen = menuToToggle.classList.toggle("is-open");
  trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
};

function initHeaderMenuDelegation() {
  if (window.__headerMenuDelegationInitialized) return;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!target) return;

    if (closest(target, ".open_user_links")) {
      event.preventDefault();
      toggleMenu("user");
      return;
    }
    if (closest(target, ".notification")) {
      event.preventDefault();
      toggleMenu("notification");
      return;
    }
    if (
      closest(target, ".user_info_links") ||
      closest(target, ".notification_hover")
    ) return;

    closeMenus();
  });

  window.__headerMenuDelegationInitialized = true;
  window.__headerCloseMenus = closeMenus;
}

function bindNamedHandler(element, handlerKey, handler) {
  if (!element) return;
  if (element[handlerKey]) element.removeEventListener("click", element[handlerKey]);
  element.addEventListener("click", handler);
  element[handlerKey] = handler;
}

/* ----------------- Auth Manager ----------------- */
class HeaderAuthManager {
  static getAccessToken() { return localStorage.getItem('access_token'); }
  static getRefreshToken() { return localStorage.getItem('refresh_token'); }
  static isAuthenticated() { return !!this.getAccessToken(); }

  static async getCurrentUser() {
    const token = this.getAccessToken();
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/users/me`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) return await response.json();
      if (response.status === 401) {
        const newToken = await this.refreshToken();
        return newToken ? this.getCurrentUser() : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  static async refreshToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) { this.logout(); return null; }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/jwt/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('access_token', data.access);
        return data.access;
      }
      this.logout();
      return null;
    } catch {
      this.logout();
      return null;
    }
  }

  static logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
    window.location.href = '/register/login.html';
  }

  static async getWalletBalance() {
    const token = this.getAccessToken();
    if (!token) return '۰ تومان';

    try {
      const response = await fetch(`${API_BASE_URL}/api/wallet/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        return data.balance ? this.formatBalance(data.balance) : '۰ تومان';
      }
      return '۰ تومان';
    } catch {
      return '۰ تومان';
    }
  }

  static formatBalance(balance) {
    return new Intl.NumberFormat('fa-IR').format(balance) + ' تومان';
  }
}

/* ----------------- Header UI ----------------- */
function createUserInfoSection(userData) {
  return `
    <div class="user-menu-header">
      <div class="user-menu-avatar">
        <div class="user-menu-name">${userData.username || 'کاربر'}</div>
      </div>
    </div>
    <div class="user-menu-divider"></div>
  `;
}

async function initHeaderAndSidebar({ skipData = false } = {}) {
  const els = {
    headerUserLoggedIn: document.querySelector('.user_islogin_to_register'),
    headerRegister: document.querySelector('.register'),
    sidebarUserLoggedIn: document.querySelector('.user_info_islogin'),
    sidebarUserNotLoggedIn: document.querySelector('.user_info_isnontlogin'),
    exitButton: document.querySelector('.exit_account'),
    sidebarLoginButton: document.querySelector('.login2_btn'),
    sidebarSigninButton: document.querySelector('.signin_btn'),
    userName: document.querySelector('.user_info_name'),
    userPhone: document.querySelector('.user_info_phone'),
    walletInfo: document.querySelector('.wallet_info span'),
    userMenu: document.querySelector('.user_info_links')
  };

  // ---- UI Init سریع ----
  bindNamedHandler(els.sidebarLoginButton, "__headerLoginHandler", e => {
    e.preventDefault(); window.location.href = '/register/login.html';
  });
  bindNamedHandler(els.sidebarSigninButton, "__headerSigninHandler", e => {
    e.preventDefault(); window.location.href = '/register/signup.html';
  });
  bindNamedHandler(els.exitButton, "__headerLogoutHandler", e => {
    e.preventDefault(); HeaderAuthManager.logout();
  });
  bindNamedHandler(document.querySelector('.wallet_info'), "__headerWalletHandler", e => {
    e.preventDefault(); window.location.href = '/wallet.html';
  });
  document.querySelectorAll('.user_info_links a').forEach(link => {
    bindNamedHandler(link, "__headerUserMenuHandler", () => closeMenus());
  });

  // Mobile menu
  const menuOpenButton = document.querySelector('.hidden_menu_btn');
  const menuCloseButton = document.querySelector('.close_btn');
  const overlay = document.querySelector('.mobile_overlay');
  const body = document.body;
  const sidebar = document.querySelector('.mobile_sidbar');

  const openSidebar = () => {
    overlay && (overlay.style.display = 'block');
    sidebar && sidebar.classList.add('active');
    body.style.overflow = 'hidden';
  };
  const closeSidebar = () => {
    overlay && (overlay.style.display = 'none');
    sidebar && sidebar.classList.remove('active');
    body.style.overflow = '';
  };

  bindNamedHandler(menuOpenButton, "__headerMenuOpenHandler", openSidebar);
  bindNamedHandler(menuCloseButton, "__headerMenuCloseHandler", closeSidebar);
  bindNamedHandler(overlay, "__headerOverlayHandler", closeSidebar);

  closeMenus();
  initHeaderMenuDelegation();

  // ---- Data Init (async) ----
  if (!skipData) {
    const cachedUser = JSON.parse(localStorage.getItem('user_data'));
    if (cachedUser) renderUserInfo(cachedUser);

    if (HeaderAuthManager.isAuthenticated()) {
      try {
        const [userData, walletBalance] = await Promise.all([
          HeaderAuthManager.getCurrentUser(),
          HeaderAuthManager.getWalletBalance()
        ]);

        if (userData) {
          renderUserInfo(userData);
          localStorage.setItem('user_data', JSON.stringify(userData));
          updateWallet(walletBalance);
          showLoggedInState();
        } else {
          showLoggedOutState();
        }
      } catch {
        showLoggedOutState();
      }
    } else {
      showLoggedOutState();
    }
  }

  function renderUserInfo(userData) {
    els.userName.textContent = userData.username || 'کاربر';
    els.userPhone.textContent = userData.phone_number || 'شماره تماس ثبت نشده';

    if (els.userMenu) {
      els.userMenu.querySelector('.user-menu-header')?.remove();
      els.userMenu.querySelector('.user-menu-divider')?.remove();
      els.userMenu.insertAdjacentHTML('afterbegin', createUserInfoSection(userData));
    }
  }

  function updateWallet(balance) {
    if (els.walletInfo) els.walletInfo.textContent = balance;
  }

  function showLoggedInState() {
    els.headerUserLoggedIn?.classList.remove('hidden');
    els.headerRegister?.classList.add('hidden');
    els.sidebarUserLoggedIn?.classList.remove('hidden');
    els.sidebarUserNotLoggedIn?.classList.add('hidden');
    els.exitButton?.classList.remove('hidden');
  }

  function showLoggedOutState() {
    els.headerUserLoggedIn?.classList.add('hidden');
    els.headerRegister?.classList.remove('hidden');
    els.sidebarUserLoggedIn?.classList.add('hidden');
    els.sidebarUserNotLoggedIn?.classList.remove('hidden');
    els.exitButton?.classList.add('hidden');

    els.walletInfo.textContent = '۰ تومان';
    els.userName.textContent = 'کاربر';
    els.userPhone.textContent = 'شماره تماس';
  }
}

/* ----------------- Expose ----------------- */
function checkAuthStatus() { return HeaderAuthManager.isAuthenticated(); }
async function getUserData() { return HeaderAuthManager.getCurrentUser(); }
async function updateHeader() { await initHeaderAndSidebar(); }



document.addEventListener("DOMContentLoaded", () => {
  const logoutLink = document.getElementById("logoutLink");
  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();

      // پاک کردن توکن‌ها
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user_data");

      // ریدایرکت به صفحه لاگین
      window.location.href = "/register/login.html";
    });
  }
});
