import { API_BASE_URL } from "/js/config.js";

const RESET_CONFIRM_URL = `${API_BASE_URL}/auth/users/reset_password_confirm/`;

const resetForm = document.getElementById('resetForm');
const messageDiv = document.getElementById('message');

// گرفتن uid و token از URL
const params = new URLSearchParams(window.location.search);
const uid = params.get("uid");
const token = params.get("token");

if (!uid || !token) {
  showMessage("لینک بازنشانی معتبر نیست", "error");
  resetForm.style.display = "none";
}

resetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const new_password = document.getElementById('new_password').value;
  const re_new_password = document.getElementById('re_new_password').value;

  if (new_password !== re_new_password) {
    showMessage("رمز عبور و تکرار آن مطابقت ندارند", "error");
    return;
  }

  try {
    const response = await fetch(RESET_CONFIRM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, token, new_password, re_new_password })
    });

    const data = await response.json();

    if (response.ok) {
      showMessage("رمز عبور با موفقیت تغییر کرد. حالا می‌توانید وارد شوید.", "success");
      setTimeout(() => window.location.href = "login.html", 2000);
    } else {
      throw new Error(data.error || "خطا در تغییر رمز عبور");
    }
  } catch (err) {
    showMessage(err.message, "error");
  }
});

function showMessage(msg, type) {
  messageDiv.textContent = msg;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = "block";
}
