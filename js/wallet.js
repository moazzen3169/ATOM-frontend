// wallet.js
import { API_BASE_URL } from "/js/config.js";

document.addEventListener("DOMContentLoaded", async () => {
    const walletContainer = document.querySelector(".wallet_container");

    const token = setupToken();
    if (!token) return;

    let currentWallet = null;

    try {
        const wallets = await fetchData(`${API_BASE_URL}/api/wallet/wallets/`, token);

        if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
            walletContainer.innerHTML = `<p>کیف پول یافت نشد</p>`;
            return;
        }

        currentWallet = wallets[0];
        if (!currentWallet || !currentWallet.id) {
            walletContainer.innerHTML = `<p>کیف پول یافت نشد</p>`;
            return;
        }

        updateWalletInfo(currentWallet);

        if (!currentWallet.transactions || !Array.isArray(currentWallet.transactions) || currentWallet.transactions.length === 0) {
            await loadTransactions(currentWallet.id, token);
        } else {
            updateTransactions(currentWallet.transactions);
        }

    } catch (error) {
        console.error("Error fetching wallet data:", error);
        walletContainer.innerHTML = `<p>مشکلی در ارتباط با سرور پیش آمد: ${error.message}</p>`;
    }

    // Modals
    const depositModal = document.querySelector(".Deposit_modal");
    const withdrawModal = document.querySelector(".Withdraw_modal");

    // Buttons
    const depositBtn = document.querySelector(".Deposit_btn");
    const withdrawBtn = document.querySelector(".Withdraw_btn");

    // Forms
    const depositForm = document.getElementById("deposit-form");
    const withdrawForm = document.getElementById("withdraw-form");

    // Withdrawable balance span
    const withdrawableBalanceSpan = document.getElementById("withdrawable-balance");

    // Show modals
    depositBtn.addEventListener("click", () => depositModal.classList.add("show"));
    withdrawBtn.addEventListener("click", () => {
        if (currentWallet) {
            withdrawableBalanceSpan.textContent = (currentWallet.withdrawable_balance || 0) + " تومان";
        }
        withdrawModal.classList.add("show");
    });

    // Close modals
    [depositModal, withdrawModal].forEach(modal => {
        modal.addEventListener("click", (e) => {
            if (e.target.classList.contains("modal-close") || e.target.classList.contains("btn-cancel") || e.target === modal) {
                modal.classList.remove("show");
                const form = modal.querySelector("form");
                if (form) form.reset();
            }
        });
    });

    // ----------------------------
    // Handle deposit form
    // ----------------------------
    depositForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const amount = parseFloat(depositForm.amount.value);

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
                    amount: amount.toFixed(2).toString() // اطمینان از رعایت الگو اعشاری
                }),
            });

            // لاگ کامل پاسخ سرور
            const rawText = await response.text();
            console.log("📌 Deposit API Raw Response:", rawText);

            if (!response.ok) {
                try {
                    const errorData = JSON.parse(rawText);
                    throw new Error(errorData.error || errorData.detail || "خطا در واریز");
                } catch {
                    throw new Error(rawText || "خطا در واریز");
                }
            }

            const data = JSON.parse(rawText);
            console.log("📌 Parsed Deposit Response:", data);

            const paymentUrl = data.payment_url;
            if (!paymentUrl) {
                throw new Error("لینک پرداخت دریافت نشد");
            }

            // Redirect به درگاه پرداخت
            window.location.href = paymentUrl;

        } catch (error) {
            alert(error.message);
        } finally {
            depositForm.querySelector(".btn-submit").disabled = false;
        }
    });

    // ----------------------------
    // Handle withdraw form
    // ----------------------------
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
                    amount: amount.toFixed(2).toString(),
                    description: description
                }),
            });

            const rawText = await response.text();
            console.log("📌 Withdraw API Raw Response:", rawText);

            if (!response.ok) {
                try {
                    const errorData = JSON.parse(rawText);
                    throw new Error(errorData.error || errorData.detail || "خطا در برداشت");
                } catch {
                    throw new Error(rawText || "خطا در برداشت");
                }
            }

            const data = JSON.parse(rawText);
            alert(data.message || "برداشت با موفقیت انجام شد.");
            withdrawModal.classList.remove("show");
            clearForm(withdrawForm);

            await refreshWalletData();

        } catch (error) {
            alert(error.message);
        } finally {
            withdrawForm.querySelector(".btn-submit").disabled = false;
        }
    });

    // ----------------------------
    // Helper functions
    // ----------------------------
    function clearForm(form) {
        if (!form) return;
        form.reset();
    }

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

    async function loadTransactions(walletId, token) {
        try {
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

    function setupToken() {
        let token = localStorage.getItem('token') || localStorage.getItem('access_token');
        if (!token) {
            alert("ابتدا وارد حساب کاربری شوید");
            window.location.href = "../register/login.html";
            return null;
        }
        return token;
    }

    async function fetchData(url, token) {
        const response = await fetch(url, {
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json",
            },
        });

        if (response.status === 401) {
            await refreshToken();
            const newToken = localStorage.getItem('token') || localStorage.getItem('access_token');
            return fetchData(url, newToken);
        }

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    }

    async function refreshToken() {
        try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (!refreshToken) throw new Error('Refresh token not found');

            const response = await fetch(`${API_BASE_URL}/auth/jwt/refresh/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh: refreshToken })
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

    function updateWalletInfo(wallet) {
        document.querySelector(".Wallet_balance span").textContent =
            (wallet.total_balance || 0) + " تومان";
        document.querySelector(".Withdrawable_wallet_balance span:last-child").textContent =
            (wallet.withdrawable_balance || 0) + " تومان";
    }

    function updateTransactions(transactions) {
        const container = document.querySelector(".Transactions_container");
        container.innerHTML = "";

        if (!transactions || transactions.length === 0) {
            container.innerHTML = "<p>تراکنشی یافت نشد</p>";
            return;
        }

        transactions.forEach((tx) => {
            const typeClass = getTransactionTypeClass(tx.transaction_type);
            const statusClass = "done";

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

    function getTransactionTypeClass(type) {
        switch (type) {
            case "deposit": return "Deposit";
            case "withdraw": return "Withdraw";
            case "spending": return "Spending";
            default: return "Deposit";
        }
    }

    function translateType(type) {
        switch (type) {
            case "deposit": return "واریز";
            case "withdraw": return "برداشت";
            case "spending": return "خرج شده";
            default: return "نامشخص";
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
