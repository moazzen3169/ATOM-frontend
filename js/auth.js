// auth.js - مدیریت احراز هویت
import { API_BASE_URL } from "/js/config.js";

// ذخیره توکن‌ها
function setTokens(accessToken, refreshToken) {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
}

// دریافت توکن دسترسی
function getAccessToken() {
    return localStorage.getItem('access_token');
}

// دریافت توکن رفرش
function getRefreshToken() {
    return localStorage.getItem('refresh_token');
}

// بررسی وجود توکن
function isAuthenticated() {
    return !!getAccessToken();
}

// خروج کاربر
function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = 'login.html';
}

// رفرش توکن
async function refreshToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
        logout();
        return null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/jwt/refresh/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh: refreshToken })
        });

        if (response.ok) {
            const data = await response.json();
            setTokens(data.access, refreshToken);
            return data.access;
        } else {
            logout();
            return null;
        }
    } catch (error) {
        console.error('Error refreshing token:', error);
        logout();
        return null;
    }
}

// درخواست با احراز هویت
async function authFetch(url, options = {}) {
    let token = getAccessToken();
    
    if (!options.headers) {
        options.headers = {};
    }
    
    options.headers['Authorization'] = `Bearer ${token}`;
    
    let response = await fetch(url, options);
    
    // اگر توکن منقضی شده بود، رفرش کن و دوباره تلاش کن
    if (response.status === 401) {
        const newToken = await refreshToken();
        if (newToken) {
            options.headers['Authorization'] = `Bearer ${newToken}`;
            response = await fetch(url, options);
        }
    }
    
    return response;
}

// دریافت اطلاعات کاربر جاری
async function getCurrentUser() {
    try {
        const response = await authFetch(`${API_BASE_URL}/auth/users/me/`);
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error('Error fetching current user:', error);
        return null;
    }
}