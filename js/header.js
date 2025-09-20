document.addEventListener("DOMContentLoaded", function () {
  fetch("header.html")
    .then(response => response.text())
    .then(data => {
      document.getElementById("header").innerHTML = data;

      // After loading header, initialize functions
      initHeaderAndSidebar();

      // Scroll to top
      window.scrollTo(0, 0);
    })
    .catch(error => console.error("Error loading header:", error));
});

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
  if (sidebarLoginButton) {
    sidebarLoginButton.addEventListener('click', function (event) {
      event.preventDefault();
      localStorage.setItem('userAuthToken', 'DUMMY_LOGGED_IN_TOKEN_12345');
      location.reload();
    });
  }

  // Logout button
  if (exitButton) {
    exitButton.addEventListener('click', function (event) {
      event.preventDefault();
      localStorage.removeItem('userAuthToken');
      location.reload();
    });
  }

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

  if (menuOpenButton) menuOpenButton.addEventListener('click', openSidebar);
  if (menuCloseButton) menuCloseButton.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // User and notification menu control
  const userButton = document.querySelector(".open_user_links");
  const userMenu = document.querySelector(".user_info_links");
  const notifButton = document.querySelector(".notification");
  const notifMenu = document.querySelector(".notification_hover");

  const toggleMenu = (menuToToggle, otherMenu, trigger, otherTrigger) => {
    if (!menuToToggle) return;

    const isOpen = menuToToggle.classList.toggle("is-open");

    if (trigger) {
      trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }

    if (otherMenu) {
      otherMenu.classList.remove("is-open");
    }

    if (otherTrigger) {
      otherTrigger.setAttribute("aria-expanded", "false");
    }
  };

  const closeMenus = () => {
    if (userMenu) userMenu.classList.remove("is-open");
    if (notifMenu) notifMenu.classList.remove("is-open");
    if (userButton) userButton.setAttribute("aria-expanded", "false");
    if (notifButton) notifButton.setAttribute("aria-expanded", "false");
  };

  // Always ensure menus start in a closed state on each init call
  closeMenus();

  const menusReady = userButton || notifButton;

  if (!window.__headerMenuEventsBound && menusReady) {
    if (userButton) {
      userButton.addEventListener("click", function(e) {
        e.stopPropagation();
        toggleMenu(userMenu, notifMenu, userButton, notifButton);
      });
    }

    if (notifButton) {
      notifButton.addEventListener("click", function(e) {
        e.stopPropagation();
        toggleMenu(notifMenu, userMenu, notifButton, userButton);
      });
    }

    document.addEventListener("click", closeMenus);

    if (userMenu) {
      userMenu.addEventListener("click", function(e) {
        e.stopPropagation();
      });
    }

    if (notifMenu) {
      notifMenu.addEventListener("click", function(e) {
        e.stopPropagation();
      });
    }

    window.__headerMenuEventsBound = true;
    window.__headerCloseMenus = closeMenus;
  } else if (typeof window.__headerCloseMenus === "function") {
    // Subsequent calls should still collapse any open state without re-binding listeners
    window.__headerCloseMenus();
  }
}
