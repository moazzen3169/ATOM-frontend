
// سایدبار رو لود کن
const sidebarElement = document.getElementById("sidebar");
if (sidebarElement) {
  fetch("../user-dashboard/user-sidebar.html")
    .then(res => res.text())
    .then(data => {
      sidebarElement.innerHTML = data;

      // تنظیم کلاس active برای لینک فعلی
      const currentPage = window.location.pathname.split('/').pop();
      const links = document.querySelectorAll('.sidebar_link');
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href === currentPage) {
          link.classList.add('active');
        }
      });

      // کد های سایدبار مخفی بعد از لود شدن
      function openSidebar() {
        document.getElementById("rightSidebar").classList.add("active");
      }

      function closeSidebar() {
        document.getElementById("rightSidebar").classList.remove("active");
      }

      // بستن با کلیک روی overlay
      document.getElementById("rightSidebar").addEventListener("click", function(e) {
        if (e.target.id === "rightSidebar") {
          closeSidebar();
        }
      });

      // بستن با دکمه close
      document.querySelector(".close_btn").addEventListener("click", closeSidebar);

      // باز کردن سایدبار از طریق دکمه در HTML
      window.openSidebar = openSidebar;

      // اضافه کردن event listener برای خروج از حساب
      const exitLink = document.querySelector('.sidebar_link.exit');
      if (exitLink) {
        exitLink.addEventListener('click', (e) => {
          e.preventDefault();
          // پاک کردن توکن‌ها از localStorage
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_data');
          // ریدایرکت به صفحه لاگین
          window.location.href = '/register/login.html';
        });
      }
    });
}
