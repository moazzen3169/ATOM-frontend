// wallet.js
import { API_BASE_URL } from "/js/config.js";

document.addEventListener("DOMContentLoaded", async () => {
    const walletContainer = document.querySelector(".wallet_container");

    const token = setupToken();
    if (!token) return;

    let currentWallet = null;

    try {
        // دریافت کیف پول کاربر - آدرس اصلاح شده
        const wallets = await fetchData(`${API_BASE_URL}/api/wallet/wallets/`, token);

        if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
            walletContainer.innerHTML = `<p>کیف پول یافت نشد</p>`;
            return;
        }

        // اولین کیف پول کاربر (فرض بر اینکه هر کاربر یک کیف پول دارد)
        currentWallet = wallets[0];

        if (!currentWallet || !currentWallet.id) {
            walletContainer.innerHTML = `<p>کیف پول یافت نشد</p>`;
            return;
        }

        // جایگذاری اطلاعات کیف پول
        updateWalletInfo(currentWallet);

        // اگر تراکنش‌ها موجود نیستند، جداگانه دریافت کنیم
        if (!currentWallet.transactions || !Array.isArray(currentWallet.transactions) || currentWallet.transactions.length === 0) {
            await loadTransactions(currentWallet.id, token);
        } else {
            updateTransactions(currentWallet.transactions);
        }

    } catch (error) {
        console.error("Error fetching wallet data:", error);
        walletContainer.innerHTML = `<p>مشکلی در ارتباط با سرور پیش آمد: ${error.message}</p>`;
    }

    // Modal elements
    const depositModal = document.querySelector(".Deposit_modal");
    const withdrawModal = document.querySelector(".Withdraw_modal");

    // Buttons
    const depositBtn = document.querySelector(".Deposit_btn");
    const withdrawBtn = document.querySelector(".Withdraw_btn");

    // Forms
    const depositForm = document.getElementById("deposit-form");
    const withdrawForm = document.getElementById("withdraw-form");

    // Withdrawable balance span in withdraw modal
    const withdrawableBalanceSpan = document.getElementById("withdrawable-balance");

    // Show modals on button click
    depositBtn.addEventListener("click", () => {
        depositModal.classList.add("show");
    });

    withdrawBtn.addEventListener("click", () => {
        if (currentWallet) {
            withdrawableBalanceSpan.textContent = (currentWallet.withdrawable_balance || 0) + " تومان";
        }
        withdrawModal.classList.add("show");
    });

    // Close modals on close button, cancel button, or outside click
    [depositModal, withdrawModal].forEach(modal => {
        modal.addEventListener("click", (e) => {
            if (e.target.classList.contains("modal-close") || e.target.classList.contains("btn-cancel") || e.target === modal) {
                modal.classList.remove("show");
                const form = modal.querySelector("form");
                if (form) form.reset();
            }
        });
    });

    // Handle deposit form submission
    depositForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const amount = parseFloat(depositForm.amount.value);
        const description = depositForm.description.value.trim();

        if (isNaN(amount) || amount < 1000) {
            alert("لطفا مبلغ معتبر و حداقل ۱۰۰۰ تومان وارد کنید.");
            return;
        }

        try {
            depositForm.querySelector(".btn-submit").disabled = true;

            const response = await fetch(`${API_BASE_URL}/api/wallet/deposit/`, {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    amount: amount,
                    description: description
                }),
            });

            if (!response.ok) {
                let errorText = await response.text();
                try {
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.detail || "خطا در واریز");
                } catch {
                    throw new Error(errorText || "خطا در واریز");
                }
            }

            alert("واریز با موفقیت انجام شد.");
            depositModal.classList.remove("show");
            clearForm(depositForm);

            // Refresh wallet info and transactions
            await refreshWalletData();

        } catch (error) {
            alert(error.message);
        } finally {
            depositForm.querySelector(".btn-submit").disabled = false;
        }
    });

    // Handle withdraw form submission
    withdrawForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const amount = parseFloat(withdrawForm.amount.value);
        const description = withdrawForm.description.value.trim();

        if (isNaN(amount) || amount < 1000) {
            alert("لطفا مبلغ معتبر و حداقل ۱۰۰۰ تومان وارد کنید.");
            return;
        }

        if (currentWallet && amount > currentWallet.withdrawable_balance) {
            alert("مبلغ برداشت نمی‌تواند بیشتر از موجودی قابل برداشت باشد.");
            return;
        }

        try {
            withdrawForm.querySelector(".btn-submit").disabled = true;

            const response = await fetch(`${API_BASE_URL}/api/wallet/withdraw/`, {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    amount: amount,
                    description: description
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "خطا در برداشت");
            }

            alert("برداشت با موفقیت انجام شد.");
            withdrawModal.classList.remove("show");
            clearForm(withdrawForm);

            // Refresh wallet info and transactions
            await refreshWalletData();

        } catch (error) {
            alert(error.message);
        } finally {
            withdrawForm.querySelector(".btn-submit").disabled = false;
        }
    });

    // Clear form inputs
    function clearForm(form) {
        if (!form) return;
        form.reset();
    }

    // Refresh wallet info and transactions after deposit/withdraw
    async function refreshWalletData() {
        try {
            const wallets = await fetchData(`${API_BASE_URL}/api/wallet/wallets/`, token);
            if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
                walletContainer.innerHTML = `<p>کیف پول یافت نشد</p>`;
                return;
            }
            currentWallet = wallets[0];
            updateWalletInfo(currentWallet);
            await loadTransactions(currentWallet.id, token);
        } catch (error) {
            console.error("Error refreshing wallet data:", error);
        }
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
