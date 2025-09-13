

const editUserBtn = document.querySelector(".edit_user_btn");
const closeBtn = document.querySelector(".close_user_btn");
const userInfo_editForm = document.querySelector(".user_info_edit_form");

editUserBtn.addEventListener("click", function() {
    userInfo_editForm.classList.add("show");
});

closeBtn.addEventListener("click", function() {
    userInfo_editForm.classList.remove("show");
});
