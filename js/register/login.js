import { API_BASE_URL } from "/js/config.js";

const SEND_OTP_URL = `${API_BASE_URL}/api/users/users/send_otp/`;

const sendOtpForm = document.getElementById('sendOtpForm');
const messageDiv = document.getElementById('message');

sendOtpForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const identifier = document.getElementById('identifier').value;

    try {
        const response = await fetch(SEND_OTP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: identifier })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('کد تایید ارسال شد. در حال انتقال...', 'success');
            setTimeout(() => {
                window.location.href = `otp.html?purpose=login&identifier=${encodeURIComponent(identifier)}`;
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

const STORED_ACCESS = localStorage.getItem('access_token');
if (isValidJwtToken(STORED_ACCESS) && !isJwtExpired(STORED_ACCESS)) {
    window.location.href = '/index.html';
} else if (typeof STORED_ACCESS === 'string' && STORED_ACCESS.trim()) {
    // مقدار نامعتبر را پاکسازی کن تا منطق ورود به اشتباه فعال نشود
    clearStoredTokens();
}

function isValidJwtToken(token) {
    if (typeof token !== 'string') return false;
    const trimmed = token.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return false;
    const parts = trimmed.split('.');
    return parts.length === 3 && parts.every(Boolean);
}

function isJwtExpired(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (!payload || typeof payload.exp !== 'number') return false;
        const nowInSeconds = Math.floor(Date.now() / 1000);
        return payload.exp <= nowInSeconds;
    } catch (err) {
        // اگر نتوانستیم پارس کنیم، آن را نامعتبر در نظر می‌گیریم
        return true;
    }
}

function clearStoredTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
}
