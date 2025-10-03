import { API_BASE_URL } from "/js/config.js";

const SEND_OTP_URL = `${API_BASE_URL}/api/users/users/send_otp/`;
const VERIFY_OTP_URL = `${API_BASE_URL}/api/users/users/verify_otp/`;

// ---- گرفتن پارامترها + fallback از localStorage
const qs = new URL(window.location.href).searchParams;

function readPurpose() {
  // ترتیب اولویت: query -> otp_purpose -> pending_purpose
  return (qs.get('purpose')
    || localStorage.getItem('otp_purpose')
    || localStorage.getItem('pending_purpose')
    || ''
  ).trim();
}
function readIdentifier() {
  // ترتیب اولویت: query -> otp_identifier -> pending_identifier -> identifier
  return (qs.get('identifier')
    || localStorage.getItem('otp_identifier')
    || localStorage.getItem('pending_identifier')
    || localStorage.getItem('identifier')
    || ''
  ).trim();
}

let purpose = readPurpose();
let identifier = readIdentifier();

// اگر از QueryString آمده، برای اطمینان در localStorage هم ذخیره کن
if (qs.get('purpose')) localStorage.setItem('otp_purpose', purpose);
if (qs.get('identifier')) localStorage.setItem('otp_identifier', identifier);

const otpInputs = document.querySelectorAll('.otp-input');
const otpForm = document.getElementById('otpForm');
const submitBtn = document.getElementById('submitBtn');
const messageDiv = document.getElementById('message');
const resendLink = document.getElementById('resend-link');
const timerSpan = document.getElementById('timer');
const changeNumberLink = document.getElementById('change-number-link');

let countdown = 120;
let countdownInterval = null;
let busy = false;

if (!purpose) showMessage('حالت عملیات مشخص نیست (login / signup / forgot).', 'error');
if (!identifier) showMessage('شناسه کاربر پیدا نشد. لطفاً از صفحه‌ی قبل مجدداً وارد شوید.', 'error');

// فوکوس اولیه
if (otpInputs.length) otpInputs[0].focus();

// --- مدیریت Paste: اگر کاربر 6 رقم را پیست کرد
otpInputs[0].addEventListener('paste', (e) => {
  const text = (e.clipboardData || window.clipboardData).getData('text') || '';
  const digits = text.replace(/\D/g, '').slice(0, 6);
  if (digits.length) {
    e.preventDefault();
    for (let i = 0; i < otpInputs.length; i++) {
      otpInputs[i].value = digits[i] || '';
    }
    if (digits.length === 6) otpForm.requestSubmit();
  }
});

// --- جابه‌جایی خودکار بین خانه‌ها
otpInputs.forEach((input, index) => {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^0-9]/g, '');
    if (input.value && index < otpInputs.length - 1) otpInputs[index + 1].focus();
    if (getOtpCode().length === 6 && !busy) otpForm.requestSubmit();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && index > 0) otpInputs[index - 1].focus();
  });
});

// --- تایمر
startCountdown();

// --- Submit: تایید کد
otpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy) return;

  const otpCode = getOtpCode();
  if (otpCode.length !== 6) return showMessage('لطفاً کد ۶ رقمی را کامل وارد کنید', 'error');
  if (!identifier) return showMessage('شناسه کاربر (ایمیل یا شماره) موجود نیست', 'error');

  console.log('Identifier being sent:', identifier);
  console.log('OTP code being sent:', otpCode);

  try {
    busy = true; submitBtn.disabled = true;

    const resp = await fetch(VERIFY_OTP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, code: otpCode })
    });

    let data = {};
    try { data = await resp.json(); } catch {}

    if (!resp.ok) {
      throw new Error(data?.error || 'کد تایید اشتباه یا منقضی شده است');
    }
    handleVerificationSuccess(data);
  } catch (err) {
    console.error(err);
    showMessage(err.message || 'خطای نامشخص رخ داده است', 'error');
  } finally {
    busy = false; submitBtn.disabled = false;
  }
});

// --- ارسال مجدد
resendLink.addEventListener('click', async () => {
  if (resendLink.classList.contains('disabled') || busy) return;
  if (!identifier) return showMessage('شناسه کاربر (ایمیل یا شماره) موجود نیست', 'error');

  console.log('Identifier for resend:', identifier);

  try {
    busy = true; resendLink.classList.add('disabled');

    const resp = await fetch(SEND_OTP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier })
    });

    let data = {};
    try { data = await resp.json(); } catch {}

    if (!resp.ok) {
      throw new Error(data?.error || 'خطا در ارسال کد');
    }

    showMessage('کد تایید مجدداً ارسال شد', 'success');
    clearOtpInputs();
    startCountdown();
  } catch (err) {
    console.error(err);
    showMessage(err.message || 'خطا در ارسال کد', 'error');
    resendLink.classList.remove('disabled');
  } finally {
    busy = false;
  }
});

// --- تغییر شناسه
changeNumberLink.addEventListener('click', (e) => {
  e.preventDefault();
  if (purpose === 'login') window.location.href = 'login.html';
  else if (purpose === 'signup') window.location.href = 'signup.html';
  else if (purpose === 'forgot') window.location.href = 'forget-password.html';
  else window.location.href = 'login.html';
});

// ======= توابع کمکی =======
function getOtpCode() { return Array.from(otpInputs).map(i => i.value).join(''); }
function clearOtpInputs() { otpInputs.forEach(i => i.value = ''); if (otpInputs.length) otpInputs[0].focus(); }
function startCountdown() {
  clearInterval(countdownInterval);
  countdown = 120; updateTimer();
  resendLink.classList.add('disabled');
  countdownInterval = setInterval(() => {
    countdown--; updateTimer();
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      resendLink.classList.remove('disabled');
      timerSpan.textContent = '';
    }
  }, 1000);
}
function updateTimer() {
  const m = String(Math.floor(countdown / 60)).padStart(2, '0');
  const s = String(countdown % 60).padStart(2, '0');
  timerSpan.textContent = `(${m}:${s})`;
}
function showMessage(msg, type) {
  messageDiv.textContent = msg;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = 'block';
}
function handleVerificationSuccess(data) {
  // برای سازگاری، شناسه را نگه می‌داریم
  localStorage.setItem('identifier', identifier);

  if (purpose === 'login' || purpose === 'signup') {
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);

    // پاک‌سازی کلیدهای موقت
    localStorage.removeItem('otp_purpose');
    localStorage.removeItem('otp_identifier');
    localStorage.removeItem('pending_purpose');
    localStorage.removeItem('pending_identifier');

    showMessage(purpose === 'login' ? 'ورود موفقیت‌آمیز!' : 'حساب کاربری فعال شد!', 'success');
    setTimeout(() => window.location.href = '../index.html', 1200);
  } else if (purpose === 'forgot') {
    const { uid, token } = data;
    if (!uid || !token) return showMessage('اطلاعات بازنشانی رمز ناقص است', 'error');
    window.location.href = `reset_password_confirm.html?uid=${encodeURIComponent(uid)}&token=${encodeURIComponent(token)}`;
  } else {
    showMessage('وضعیت درخواست نامعتبر است', 'error');
  }
}
