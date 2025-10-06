// payment-success.js
import { API_BASE_URL } from "/js/config.js";

document.addEventListener("DOMContentLoaded", async () => {
    const token = setupToken();
    if (!token) return;

    try {
        // دریافت اطلاعات کیف پول کاربر
        const wallets = await fetchData(`${API_BASE_URL}/api/wallet/wallets/`, token);

        if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
            document.getElementById('current-balance').textContent = 'کیف پول یافت نشد';
            return;
        }

        const currentWallet = wallets[0];
        const balance = currentWallet.total_balance || 0;
        document.getElementById('current-balance').textContent = balance.toLocaleString('fa-IR') + ' تومان';

    } catch (error) {
        console.error("Error fetching wallet data:", error);
        document.getElementById('current-balance').textContent = 'خطا در دریافت موجودی';
    }
});

// تابع برای بررسی و تنظیم توکن
function setupToken() {
    let token = localStorage.getItem('token') || localStorage.getItem('access_token');

    if (!token) {
        alert("ابتدا وارد حساب کاربری شوید");
        window.location.href = "../register/login.html";
        return null;
    }

    return token;
}

// تابع درخواست با توکن
async function fetchData(url, token) {
    const response = await fetch(url, {
        headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
        },
    });

    if (response.status === 401) {
        // توکن منقضی، refresh
        await refreshToken();
        const newToken = localStorage.getItem('token') || localStorage.getItem('access_token');
        return fetchData(url, newToken);
    }

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
}

// تابع برای refresh توکن
async function refreshToken() {
    try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
            throw new Error('Refresh token not found');
        }

        const response = await fetch(`${API_BASE_URL}/auth/jwt/refresh/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                refresh: refreshToken
            })
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.access);
            localStorage.setItem('access_token', data.access);
            console.log('Token refreshed successfully');
        } else {
            throw new Error('Failed to refresh token');
        }
    } catch (error) {
        console.error('Error refreshing token:', error);
        localStorage.clear();
        window.location.href = "../register/login.html";
    }
}
