document.addEventListener("DOMContentLoaded", function () {
  fetch("../header.html")
    .then(response => response.text())
    .then(data => {
      document.getElementById("header").innerHTML = data;

      // بعد از لود شدن هدر، بقیه کدها رو اجرا کن
      initHeaderAndSidebar();

      // اسکرول به بالای صفحه
      window.scrollTo(0, 0);
    })
    .catch(error => console.error("خطا در بارگذاری هدر:", error));
});

function initHeaderAndSidebar() {
  const headerUserLoggedIn = document.querySelector('.user_islogin_to_register');
  const headerRegister = document.querySelector('.register');
  const sidebarUserLoggedIn = document.querySelector('.user_info_islogin');
  const sidebarUserNotLoggedIn = document.querySelector('.user_info_isnontlogin');
  const exitButton = document.querySelector('.exit_account');
  const sidebarLoginButton = document.querySelector('.login2_btn');

  const userToken = localStorage.getItem('userAuthToken');

  // نمایش بر اساس وضعیت لاگین
  if (userToken) {
    if (headerUserLoggedIn) headerUserLoggedIn.style.display = 'flex';
    if (headerRegister) headerRegister.style.display = 'none';
    if (sidebarUserLoggedIn) sidebarUserLoggedIn.style.display = 'flex';
    if (sidebarUserNotLoggedIn) sidebarUserNotLoggedIn.style.display = 'none';
    if (exitButton) exitButton.style.display = 'block';
  } else {
    if (headerUserLoggedIn) headerUserLoggedIn.style.display = 'none';
    if (headerRegister) headerRegister.style.display = 'flex';
    if (sidebarUserLoggedIn) sidebarUserLoggedIn.style.display = 'none';
    if (sidebarUserNotLoggedIn) sidebarUserNotLoggedIn.style.display = 'flex';
    if (exitButton) exitButton.style.display = 'none';
  }

  // ورود آزمایشی
  if (sidebarLoginButton) {
    sidebarLoginButton.addEventListener('click', function (event) {
      event.preventDefault();
      localStorage.setItem('userAuthToken', 'DUMMY_LOGGED_IN_TOKEN_12345');
      location.reload();
    });
  }

  // خروج از حساب
  if (exitButton) {
    exitButton.addEventListener('click', function (event) {
      event.preventDefault();
      localStorage.removeItem('userAuthToken');
      location.reload();
    });
  }

  // کنترل منو موبایل
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

  // کنترل منوهای کاربر و نوتیفیکیشن
  const userButton = document.querySelector(".open_user_links");
  const userMenu = document.querySelector(".user_info_links");
  const notifButton = document.querySelector(".notification");
  const notifMenu = document.querySelector(".notification_hover");

  if (userMenu) userMenu.style.display = "none";
  if (notifMenu) notifMenu.style.display = "none";

  function toggleMenu(menuToToggle, otherMenu) {
      if (menuToToggle && menuToToggle.style.display === "none") {
          // منوی دیگر را ببند
          if (otherMenu) otherMenu.style.display = "none";
          // منوی مورد نظر را باز کن
          menuToToggle.style.display = "block";
      } else if (menuToToggle) {
          menuToToggle.style.display = "none";
      }
  }

  // کلیک روی دکمه کاربر
  if (userButton) {
    userButton.addEventListener("click", function(e) {
        e.stopPropagation(); // جلوگیری از بسته شدن منو توسط کلیک روی سند
        toggleMenu(userMenu, notifMenu);
    });
  }

  // کلیک روی دکمه نوتیفیکیشن
  if (notifButton) {
    notifButton.addEventListener("click", function(e) {
        e.stopPropagation();
        toggleMenu(notifMenu, userMenu);
    });
  }

  // کلیک بیرون از منوها باعث بسته شدن آنها می‌شود
  document.addEventListener("click", function() {
      if (userMenu) userMenu.style.display = "none";
      if (notifMenu) notifMenu.style.display = "none";
  });

  // جلوگیری از بسته شدن منو هنگام کلیک روی خود منوها
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
}
