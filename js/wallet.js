// wallet.js
import { API_BASE_URL } from "/js/config.js";

document.addEventListener("DOMContentLoaded", async () => {
    const walletContainer = document.querySelector(".wallet_container");

    const token = setupToken();
    if (!token) return;

    try {
        // دریافت کیف پول کاربر - آدرس اصلاح شده
        const wallets = await fetchData(`${API_BASE_URL}/api/wallet/wallets/`, token);

        if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
            walletContainer.innerHTML = `<p>کیف پول یافت نشد</p>`;
            return;
        }

        // اولین کیف پول کاربر (فرض بر اینکه هر کاربر یک کیف پول دارد)
        const wallet = wallets[0];

        if (!wallet || !wallet.id) {
            walletContainer.innerHTML = `<p>کیف پول یافت نشد</p>`;
            return;
        }

        // جایگذاری اطلاعات کیف پول
        updateWalletInfo(wallet);

        // اگر تراکنش‌ها موجود نیستند، جداگانه دریافت کنیم
        if (!wallet.transactions || !Array.isArray(wallet.transactions) || wallet.transactions.length === 0) {
            await loadTransactions(wallet.id, token);
        } else {
            updateTransactions(wallet.transactions);
        }

    } catch (error) {
        console.error("Error fetching wallet data:", error);
        walletContainer.innerHTML = `<p>مشکلی در ارتباط با سرور پیش آمد: ${error.message}</p>`;
    }

    // تابع برای دریافت تراکنش‌ها
    async function loadTransactions(walletId, token) {
        try {
            // اگر API جداگانه برای دریافت تراکنش‌ها دارید
            // const transactions = await fetchData(`${API_BASE_URL}/api/wallet/transactions/?wallet=${walletId}`, token);
            
            // یا از API کیف پول استفاده کنید
            const walletDetail = await fetchData(`${API_BASE_URL}/api/wallet/wallets/${walletId}/`, token);
            
            if (walletDetail.transactions && Array.isArray(walletDetail.transactions)) {
                updateTransactions(walletDetail.transactions);
            } else {
                document.querySelector(".Transactions_container").innerHTML = "<p>تراکنشی یافت نشد</p>";
            }
        } catch (error) {
            console.error("Error loading transactions:", error);
            document.querySelector(".Transactions_container").innerHTML = "<p>خطا در دریافت تراکنش‌ها</p>";
        }
    }

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

    // بروزرسانی بخش کیف پول
    function updateWalletInfo(wallet) {
        document.querySelector(".Wallet_balance span").textContent =
            (wallet.total_balance || 0) + " تومان";
        document.querySelector(
            ".Withdrawable_wallet_balance span:last-child"
        ).textContent = (wallet.withdrawable_balance || 0) + " تومان";
    }

    // بروزرسانی لیست تراکنش‌ها
    function updateTransactions(transactions) {
        const container = document.querySelector(".Transactions_container");
        container.innerHTML = ""; // پاک کردن نمونه‌های قبلی

        if (!transactions || transactions.length === 0) {
            container.innerHTML = "<p>تراکنشی یافت نشد</p>";
            return;
        }

        transactions.forEach((tx) => {
            const typeClass = getTransactionTypeClass(tx.transaction_type);
            const statusClass = "done"; // فرض بر انجام شدن همه تراکنش‌ها

            const item = `
                <div class="Transaction_item ${typeClass}">
                    <div class="icon_container">
                        <div class="${typeClass}_icon"></div>
                    </div>
                    <div class="Transaction_mode_date">
                        <span>${translateType(tx.transaction_type)}</span>
                        <div class="date">${formatDate(tx.timestamp)}</div>
                    </div>
                    <div class="Transaction_prise_status">
                        <div class="prise">
                            <span>${tx.amount || 0}</span><span>تومان</span>
                        </div>
                        <div class="status ${statusClass}">
                            <span>${translateStatus("done")}</span>
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML("beforeend", item);
        });
    }

    // توابع کمکی
    function getTransactionTypeClass(type) {
        switch (type) {
            case "deposit":
                return "Deposit";
            case "withdraw":
                return "Withdraw";
            case "spending":
                return "Spending";
            default:
                return "Deposit";
        }
    }

    function translateType(type) {
        switch (type) {
            case "deposit":
                return "واریز";
            case "withdraw":
                return "برداشت";
            case "spending":
                return "خرج شده";
            default:
                return "نامشخص";
        }
    }

    function translateStatus(status) {
        return status === "done" ? "انجام شده" : "انجام نشده";
    }

    function formatDate(isoDate) {
        if (!isoDate) return "تاریخ نامشخص";
        
        try {
            const date = new Date(isoDate);
            return date.toLocaleString("fa-IR", {
                hour: "2-digit",
                minute: "2-digit",
                day: "numeric",
                month: "long",
                year: "numeric",
            });
        } catch (error) {
            console.error("Error formatting date:", error);
            return "تاریخ نامشخص";
        }
    }
});