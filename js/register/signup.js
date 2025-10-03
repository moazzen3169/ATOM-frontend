import { API_BASE_URL } from "/js/config.js";

const SIGNUP_URL = `${API_BASE_URL}/api/users/users/`;
const SEND_OTP_URL = `${API_BASE_URL}/api/users/users/send_otp/`;

const signupForm = document.getElementById('signupForm');
const messageDiv = document.getElementById('message');

let userData = {};
let countdown;
let countdownTime = 0;
const resendOtpLink = null; // Placeholder if needed later

// تبدیل به فرمت صحیح (+98)
function convertToCorrectFormat(phoneNumber) {
    let cleaned = phoneNumber.replace(/\D/g, '');

    if (cleaned.startsWith('989') && cleaned.length === 12) {
        return '+' + cleaned;
    }

    if (cleaned.startsWith('9') && cleaned.length === 10) {
        return '+98' + cleaned;
    }

    if (cleaned.startsWith('09') && cleaned.length === 11) {
        return '+98' + cleaned.substring(1);
    }

    // Default
    return '+98' + cleaned.replace(/^0/, '');
}

// اعتبارسنجی شماره تلفن
function isValidIranianPhone(number) {
    const normalized = convertToCorrectFormat(number);
    return normalized.startsWith('+98') && normalized.length === 13;
}

// ارسال OTP
async function sendOtp(email) {
    try {
        const response = await fetch(SEND_OTP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: email })
        });

        const data = await response.json();

        if (response.ok) {
            return { success: true, message: 'کد تایید ارسال شد' };
        } else {
            return { success: false, message: data.error || 'خطا در ارسال کد' };
        }
    } catch (error) {
        return { success: false, message: 'خطا در ارتباط با سرور' };
    }
}

// شروع تایمر
function startCountdown() {
    clearInterval(countdown);
    countdownTime = 120;
    updateCountdown();

    countdown = setInterval(() => {
        countdownTime--;
        updateCountdown();

        if (countdownTime <= 0) {
            clearInterval(countdown);
            document.getElementById('timer')?.classList.add('hidden');
            resendOtpLink?.classList.remove('hidden');
        }
    }, 1000);
}

function updateCountdown() {
    const countdownElem = document.getElementById('countdown');
    if (countdownElem) {
        countdownElem.textContent = countdownTime;
    }
}

// نمایش پیام
function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
}

// بازنشانی دکمه
function resetButton(button, originalText) {
    button.value = originalText;
    button.classList.remove('loading');
}

// مرحله ۱: ثبت نام
signupForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.value;

    submitBtn.value = 'در حال ثبت نام...';
    submitBtn.classList.add('loading');

    const rawPhoneNumber = document.getElementById('phone_number').value.trim();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // تبدیل به فرمت صحیح
    const correctPhoneNumber = convertToCorrectFormat(rawPhoneNumber);

    // اعتبارسنجی اولیه
    if (!isValidIranianPhone(rawPhoneNumber)) {
        showMessage('شماره تلفن معتبر نیست. لطفا شماره را با 09 وارد کنید', 'error');
        resetButton(submitBtn, originalText);
        return;
    }

    const confirmPassword = document.getElementById('confirm_password').value;
    if (password !== confirmPassword) {
        showMessage('رمز عبور و تکرار آن مطابقت ندارند', 'error');
        resetButton(submitBtn, originalText);
        return;
    }

    if (password.length < 8) {
        showMessage('رمز عبور باید حداقل ۸ کاراکتر باشد', 'error');
        resetButton(submitBtn, originalText);
        return;
    }

    userData = {
        username: username,
        email: email,
        phone_number: correctPhoneNumber,
        password: password
    };

    try {
        const response = await fetch(SIGNUP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (response.status === 201) {
            showMessage('✅ ثبت نام موفقیت‌آمیز بود! در حال ارسال کد تایید...', 'success');

            // ارسال OTP به ایمیل کاربر
            const otpResult = await sendOtp(email);

            if (otpResult.success) {
                showMessage('✅ کد تایید ارسال شد. در حال انتقال...', 'success');
                setTimeout(() => {
                    window.location.href = `otp.html?purpose=signup&identifier=${encodeURIComponent(email)}`;
                }, 1500);
            } else {
                showMessage(`❌ ${otpResult.message}`, 'error');
            }

        } else if (response.status === 400) {
            if (data.phone_number && data.phone_number[0].includes('already exists')) {
                showMessage('❌ این شماره تلفن قبلاً ثبت شده است. اگر مالک این شماره هستید، از قسمت "ورود" استفاده کنید.', 'error');
            } else if (data.username) {
                showMessage(`نام کاربری: ${data.username[0]}`, 'error');
            } else if (data.email) {
                showMessage(`ایمیل: ${data.email[0]}`, 'error');
            } else if (data.phone_number) {
                showMessage(`شماره تلفن: ${data.phone_number[0]}`, 'error');
            } else if (data.password) {
                showMessage(`رمز عبور: ${data.password[0]}`, 'error');
            } else {
                showMessage('خطا در ثبت نام. لطفا اطلاعات را بررسی کنید.', 'error');
            }
        } else {
            showMessage('خطا در ارتباط با سرور', 'error');
        }

    } catch (error) {
        console.error('❌ خطای شبکه:', error);
        showMessage('خطا در ارتباط با سرور', 'error');
    } finally {
        resetButton(submitBtn, originalText);
    }
});

// سیستم هوشمند ورود شماره تلفن
document.getElementById('phone_number').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');

    if (value.length > 11) {
        value = value.substring(0, 11);
    }

    e.target.value = value;

    if (value.length > 0) {
        if (isValidIranianPhone(value)) {
            e.target.classList.remove('input-error');
            const converted = convertToCorrectFormat(value);
        } else {
            e.target.classList.add('input-error');
            if (value.length === 11 && !value.startsWith('09')) {
                showMessage('شماره تلفن باید با 09 شروع شود', 'error');
            }
        }
    } else {
        e.target.classList.remove('input-error');
        document.getElementById('message').style.display = 'none';
    }
});

// بررسی تطابق رمز عبور در لحظه
document.getElementById('confirm_password').addEventListener('input', function() {
    const password = document.getElementById('password').value;
    const confirmPassword = this.value;

    if (confirmPassword.length > 0) {
        if (password !== confirmPassword) {
            showMessage('رمز عبور و تکرار آن مطابقت ندارند', 'error');
            this.classList.add('input-error');
        } else {
            showMessage('رمز عبورها مطابقت دارند', 'success');
            this.classList.remove('input-error');
        }
    } else {
        document.getElementById('message').style.display = 'none';
        this.classList.remove('input-error');
    }
});

// پر کردن خودکار برای تست
document.getElementById('phone_number').addEventListener('focus', function() {
    if (!this.value) {
        this.value = '';
        const event = new Event('input', { bubbles: true });
        this.dispatchEvent(event);
    }
});

// اگر قبلا لاگین شده، مستقیماً به صفحه اصلی برود
if (localStorage.getItem('access_token')) {
    window.location.href = '/index.html';
}
