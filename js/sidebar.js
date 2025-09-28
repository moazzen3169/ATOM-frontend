
// سایدبار رو لود کن
const sidebarElement = document.getElementById("sidebar");
if (sidebarElement) {
  fetch("../user-dashboard/user-sidebar.html")
    .then(res => res.text())
    .then(data => {
      sidebarElement.innerHTML = data;

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
    });
}
