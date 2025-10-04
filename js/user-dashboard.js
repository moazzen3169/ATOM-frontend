import { API_BASE_URL } from "../js/config.js";

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

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("ابتدا وارد حساب کاربری شوید");
    window.location.href = "../register/login.html";
    return;
  }

  // 📌 1. گرفتن اطلاعات پروفایل
  fetch(`${API_BASE_URL}/api/users/dashboard/`, {
    headers: { "Authorization": "Bearer " + token }
  })
  .then(res => res.json())
  .then(data => {
    console.log("Dashboard Data:", data);

    document.getElementById("header_user_name").textContent = data.username || "-";
    document.getElementById("user_name").textContent = data.username || "-";
    document.getElementById("user_email").textContent = data.email || "-";
    document.getElementById("user_rank").textContent = data.rank || "-";
    document.getElementById("user_score").textContent = data.score || "0";
    document.getElementById("user_tournaments_played").textContent = data.tournaments_count || "0";
    document.getElementById("user_teams").textContent = data.teams_count || "0";
    document.getElementById("user_add_date").textContent = data.join_date || "-";

    if (data.avatar) {
      document.getElementById("header_user_avatar").src = data.avatar;
      document.getElementById("user_avatar").src = data.avatar;
    }

    // تاریخچه تورنومنت
    loadTournaments(data.id, token);
  })
  .catch(err => console.error("خطا در دریافت پروفایل:", err));

  // 📌 2. گرفتن تیم‌ها
  fetch(`${API_BASE_URL}/api/users/teams/`, {
    headers: { "Authorization": "Bearer " + token }
  })
  .then(res => res.json())
  .then(teams => {
    console.log("Teams:", teams);

    const container = document.getElementById("teams_container");
    container.innerHTML = "";
    teams.forEach(team => {
      container.innerHTML += `
        <div class="team_item">
          <div class="team_buttons">
            ${team.is_captain ? `
              <button class="team_btn"><img src="../img/icons/delete.svg" alt="delete"></button>
              <button class="team_btn"><img src="../img/icons/edit2.svg" alt="edit"></button>
              <button class="team_btn"><img src="../img/icons/add-user.svg" alt="add user"></button>
            ` : `
              <button class="team_btn"><img src="../img/icons/exit2.svg" alt="exit"></button>
            `}
          </div>
          <div class="team_info">
            <div class="team_picturse">
              <img src="${team.picture || "../img/profile.jpg"}" alt="team profile">
            </div>
            <div class="team_detail">
              <div class="team_name"><span>${team.name}</span></div>
              <div class="team_member_count">
                <span> : تعداد اعضا</span><span>${team.members_count} عضو</span>
              </div>
            </div>
          </div>
        </div>`;
    });
  })
  .catch(err => console.error("خطا در دریافت تیم‌ها:", err));

  // 📌 3. تاریخچه تورنومنت‌ها
  function loadTournaments(userId, token) {
    fetch(`${API_BASE_URL}/api/users/users/${userId}/tournaments/`, {
      headers: { "Authorization": "Bearer " + token }
    })
    .then(res => res.json())
    .then(history => {
      console.log("Tournaments:", history);

      const tbody = document.getElementById("tournaments_history_body");
      tbody.innerHTML = "";
      history.forEach(item => {
        tbody.innerHTML += `
          <tr>
            <td>${item.score || "-"}</td>
            <td>${item.rank || "-"}</td>
            <td>${item.date || "-"}</td>
            <td>${item.team_name || "-"}</td>
            <td>${item.game || "-"}</td>
            <td>${item.tournament_name || "-"}</td>
          </tr>`;
      });
    })
    .catch(err => console.error("خطا در دریافت تاریخچه تورنومنت‌ها:", err));
  }
});
