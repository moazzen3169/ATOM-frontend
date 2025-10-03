import { API_BASE_URL } from "/js/config.js";

const SEND_OTP_URL = `${API_BASE_URL}/api/users/users/send_otp/`;

const forgotForm = document.getElementById('forgotForm');
const messageDiv = document.getElementById('message');

forgotForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  const identifier = document.getElementById('identifier').value.trim();

  try {
    const response = await fetch(SEND_OTP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier })
    });

    const data = await response.json();

    if (response.ok) {
      showMessage('کد تأیید ارسال شد. در حال انتقال...', 'success');
      setTimeout(() => {
        window.location.href = `otp.html?purpose=forgot&identifier=${encodeURIComponent(identifier)}`;
      }, 1500);
    } else {
      throw new Error(data.error || 'خطا در ارسال کد');
    }
  } catch (error) {
    showMessage(error.message, 'error');
  }
});

function showMessage(msg, type) {
  messageDiv.textContent = msg;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = 'block';
}
