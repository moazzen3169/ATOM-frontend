document.addEventListener("DOMContentLoaded", function () {
  const headerContainer = document.getElementById("header");

  if (!headerContainer) {
    initHeaderMenuDelegation();
    initHeaderAndSidebar();
    return;
  }

  fetch("header.html")
    .then(response => response.text())
    .then(data => {
      headerContainer.innerHTML = data;

      // After loading header, initialize functions
      initHeaderAndSidebar();

      // Scroll to top
      window.scrollTo(0, 0);
    })
    .catch(error => console.error("Error loading header:", error));
});

const closest = (element, selector) => {
  if (!element || typeof element.closest !== "function") {
    return null;
  }

  return element.closest(selector);
};

const getHeaderElements = () => ({
  userButton: document.querySelector(".open_user_links"),
  userMenu: document.querySelector(".user_info_links"),
  notifButton: document.querySelector(".notification"),
  notifMenu: document.querySelector(".notification_hover")
});

const closeMenus = () => {
  const { userMenu, notifMenu, userButton, notifButton } = getHeaderElements();

  if (userMenu) userMenu.classList.remove("is-open");
  if (notifMenu) notifMenu.classList.remove("is-open");
  if (userButton) userButton.setAttribute("aria-expanded", "false");
  if (notifButton) notifButton.setAttribute("aria-expanded", "false");
};

const toggleMenu = (type) => {
  const {
    userMenu,
    notifMenu,
    userButton,
    notifButton
  } = getHeaderElements();

  const isUser = type === "user";
  const menuToToggle = isUser ? userMenu : notifMenu;
  const otherMenu = isUser ? notifMenu : userMenu;
  const trigger = isUser ? userButton : notifButton;
  const otherTrigger = isUser ? notifButton : userButton;

  if (!menuToToggle || !trigger) return;

  if (otherMenu) {
    otherMenu.classList.remove("is-open");
  }

  if (otherTrigger) {
    otherTrigger.setAttribute("aria-expanded", "false");
  }

  const isOpen = menuToToggle.classList.toggle("is-open");
  trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
};

function initHeaderMenuDelegation() {
  if (window.__headerMenuDelegationInitialized) {
    return;
  }

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!target) return;

    const userToggle = closest(target, ".open_user_links");
    if (userToggle) {
      event.preventDefault();
      toggleMenu("user");
      return;
    }

    const notifToggle = closest(target, ".notification");
    if (notifToggle) {
      event.preventDefault();
      toggleMenu("notification");
      return;
    }

    if (
      closest(target, ".user_info_links") ||
      closest(target, ".notification_hover")
    ) {
      return;
    }

    closeMenus();
  });

  window.__headerMenuDelegationInitialized = true;
  window.__headerCloseMenus = closeMenus;
}

function bindNamedHandler(element, handlerKey, handler) {
  if (!element) return;

  if (element[handlerKey]) {
    element.removeEventListener("click", element[handlerKey]);
  }

  element.addEventListener("click", handler);
  element[handlerKey] = handler;
}

function initHeaderAndSidebar() {
  const headerUserLoggedIn = document.querySelector('.user_islogin_to_register');
  const headerRegister = document.querySelector('.register');
  const sidebarUserLoggedIn = document.querySelector('.user_info_islogin');
  const sidebarUserNotLoggedIn = document.querySelector('.user_info_isnontlogin');
  const exitButton = document.querySelector('.exit_account');
  const sidebarLoginButton = document.querySelector('.login2_btn');

  const userToken = localStorage.getItem('userAuthToken');

  // Show/hide based on login status
  if (userToken) {
    if (headerUserLoggedIn) headerUserLoggedIn.classList.remove('hidden');
    if (headerRegister) headerRegister.classList.add('hidden');
    if (sidebarUserLoggedIn) sidebarUserLoggedIn.classList.remove('hidden');
    if (sidebarUserNotLoggedIn) sidebarUserNotLoggedIn.classList.add('hidden');
    if (exitButton) exitButton.classList.remove('hidden');
  } else {
    if (headerUserLoggedIn) headerUserLoggedIn.classList.add('hidden');
    if (headerRegister) headerRegister.classList.remove('hidden');
    if (sidebarUserLoggedIn) sidebarUserLoggedIn.classList.add('hidden');
    if (sidebarUserNotLoggedIn) sidebarUserNotLoggedIn.classList.remove('hidden');
    if (exitButton) exitButton.classList.add('hidden');
  }

  // Test login button
  bindNamedHandler(sidebarLoginButton, "__headerLoginHandler", function (event) {
    event.preventDefault();
    localStorage.setItem('userAuthToken', 'DUMMY_LOGGED_IN_TOKEN_12345');
    location.reload();
  });

  // Logout button
  bindNamedHandler(exitButton, "__headerLogoutHandler", function (event) {
    event.preventDefault();
    localStorage.removeItem('userAuthToken');
    location.reload();
  });

  // Mobile menu control
  const menuOpenButton = document.querySelector('.hidden_menu_btn');
  const menuCloseButton = document.querySelector('.close_btn');
  const overlay = document.querySelector('.mobile_overlay');
  const body = document.body;
  const sidebar = document.querySelector('.mobile_sidbar');

  const openSidebar = () => {
    if (overlay) overlay.style.display = 'block';
    if (sidebar) sidebar.classList.add('active');
    body.style.overflow = 'hidden';
  };

  const closeSidebar = () => {
    if (overlay) overlay.style.display = 'none';
    if (sidebar) sidebar.classList.remove('active');
    body.style.overflow = '';
  };

  bindNamedHandler(menuOpenButton, "__headerMenuOpenHandler", openSidebar);
  bindNamedHandler(menuCloseButton, "__headerMenuCloseHandler", closeSidebar);
  bindNamedHandler(overlay, "__headerOverlayHandler", closeSidebar);

  // Always ensure menus start in a closed state and handlers are ready
  closeMenus();
  initHeaderMenuDelegation();
}
