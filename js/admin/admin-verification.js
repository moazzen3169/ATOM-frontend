import { API_BASE_URL } from "../config.js";

const verificationsList = document.getElementById("verifications-list");

// Fetch all user verification requests
async function fetchAllVerifications() {
  try {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
      alert("لطفا ابتدا وارد شوید.");
      window.location.href = "/register/login.html";
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/verification/list_all/`, {
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
    });
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("access_token");
      alert("نشست شما منقضی شده است. لطفا مجددا وارد شوید.");
      window.location.href = "/register/login.html";
      return;
    }
    if (!response.ok) throw new Error("خطا در دریافت درخواست‌ها");
    const data = await response.json();
    renderVerifications(data);
  } catch (error) {
    console.error(error);
    verificationsList.innerHTML = "<p>خطا در بارگذاری درخواست‌ها.</p>";
  }
}

// Render the list of verifications
function renderVerifications(verifications) {
  if (!verifications || verifications.length === 0) {
    verificationsList.innerHTML = "<p>درخواستی برای احراز هویت وجود ندارد.</p>";
    return;
  }
  verificationsList.innerHTML = "";
  verifications.forEach((item) => {
    const div = document.createElement("div");
    div.className = "verification-item";

    div.innerHTML = `
      <p>کاربر: ${item.user}</p>
      <p>سطح: ${item.level}</p>
      <p>تاریخ ارسال: ${new Date(item.created_at).toLocaleString()}</p>
      <p>وضعیت: ${item.is_verified ? "تایید شده" : "در انتظار بررسی"}</p>
      <button class="approve-btn" data-id="${item.id}" ${item.is_verified ? "disabled" : ""}>تایید</button>
    `;

    verificationsList.appendChild(div);
  });

  // Add event listeners to approve buttons
  document.querySelectorAll(".approve-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-id");
      await approveVerification(id);
    });
  });
}

// Approve a verification request
async function approveVerification(id) {
  try {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
      alert("لطفا ابتدا وارد شوید.");
      window.location.href = "/register/login.html";
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/verification/${id}/approve/`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("access_token");
      alert("نشست شما منقضی شده است. لطفا مجددا وارد شوید.");
      window.location.href = "/register/login.html";
      return;
    }
    if (!response.ok) throw new Error("خطا در تایید درخواست");
    alert("درخواست با موفقیت تایید شد.");
    fetchAllVerifications();
  } catch (error) {
    console.error(error);
    alert("خطا در تایید درخواست.");
  }
}

// Initial load
fetchAllVerifications();
