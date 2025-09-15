

const editUserBtn = document.querySelector(".edit_user_btn");
const closeBtn = document.querySelector(".close_user_btn");
const userInfo_editForm = document.querySelector(".user_info_edit_form");

editUserBtn.addEventListener("click", function() {
    userInfo_editForm.classList.add("show");
});

closeBtn.addEventListener("click", function() {
    userInfo_editForm.classList.remove("show");
});



    // سایدبار رو لود کن
    fetch("user-sidebar.html")
      .then(res => res.text())
      .then(data => {
        document.getElementById("sidebar").innerHTML = data;
      });





    //   کد های سایدبار مخفی



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
          });ent.querySelector(".close_btn").addEventListener("click", closeSidebar);
  