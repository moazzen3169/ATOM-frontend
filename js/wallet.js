// wallet.js
import { API_BASE_URL } from "/js/config.js";
import { renderInlineMessage, showAppNotification } from "/js/app-errors.js";

document.addEventListener("DOMContentLoaded", async () => {
    const walletContainer = document.querySelector(".wallet_container");
    const withdrawableBalanceSpan = document.getElementById("withdrawable-balance");

    const TRANSACTION_TYPE_DETAILS = [
        {
            aliases: ["deposit"],
            className: "Deposit",
            iconClass: "Deposit_icon",
            label: "واریز",
            sign: "+",
            filter: "deposit",
        },
        {
            aliases: ["withdraw", "withdrawal"],
            className: "Withdraw",
            iconClass: "Withdraw_icon",
            label: "برداشت",
            sign: "-",
            filter: "withdraw",
        },
        {
            aliases: ["spending"],
            className: "Spending",
            iconClass: "Spending_icon",
            label: "خرج شده",
            sign: "-",
            filter: "spending",
        },
        {
            aliases: ["entry_fee", "entryfee"],
            className: "EntryFee",
            iconClass: "EntryFee_icon",
            label: "هزینه ورود",
            sign: "-",
            filter: "entry_fee",
        },
        {
            aliases: ["prize", "reward"],
            className: "Prize",
            iconClass: "Prize_icon",
            label: "جایزه",
            sign: "+",
            filter: "prize",
        },
    ];

    const DEFAULT_TRANSACTION_TYPE = {
        className: "Deposit",
        iconClass: "Deposit_icon",
        label: "نامشخص",
        sign: "+",
        filter: "",
    };

    const token = setupToken();
    if (!token) return;

    let currentWallet = null;
    let allTransactions = [];
    let currentFilter = "all";
    let currentOrdering = "last";

    try {
        const wallets = await fetchData(`${API_BASE_URL}/api/wallet/wallets/`, token);

        if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
            renderInlineMessage(walletContainer, "walletNotFound");
            showAppNotification("walletNotFound");
            return;
        }

        currentWallet = wallets[0];
        if (!currentWallet || !currentWallet.id) {
            renderInlineMessage(walletContainer, "walletNotFound");
            showAppNotification("walletNotFound");
            return;
        }

        updateWalletInfo(currentWallet);

        if (!currentWallet.transactions || !Array.isArray(currentWallet.transactions) || currentWallet.transactions.length === 0) {
            await loadTransactions(currentWallet.id, token);
        } else {
            setTransactions(currentWallet.transactions);
        }

    } catch (error) {
        console.error("Error fetching wallet data:", error);
        renderInlineMessage(walletContainer, "walletLoadFailed");
        showAppNotification("walletLoadFailed");
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
    const transactionFilterButtons = document.querySelectorAll(".filter_item");
    const orderingSelect = document.getElementById("ordering");

    transactionFilterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            transactionFilterButtons.forEach((btn) => {
                btn.classList.remove("active_sort");
                btn.classList.add("none_active");
            });
            button.classList.add("active_sort");
            button.classList.remove("none_active");
            currentFilter = button.dataset.filter || "all";
            renderTransactions();
        });
    });

    if (orderingSelect) {
        orderingSelect.addEventListener("change", () => {
            currentOrdering = orderingSelect.value;
            renderTransactions();
        });
    }

    // Show modals
    depositBtn.addEventListener("click", () => depositModal.classList.add("show"));
    withdrawBtn.addEventListener("click", () => {
        if (currentWallet) {
            withdrawableBalanceSpan.textContent =
                formatCurrency(currentWallet.withdrawable_balance || 0) + " تومان";
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
        const descriptionField = depositForm.querySelector("[name='description']");
        const description = descriptionField ? descriptionField.value.trim() : "";

        if (isNaN(amount) || amount < 1000) {
            showAppNotification("invalidDepositAmount");
            return;
        }

        try {
            depositForm.querySelector(".btn-submit").disabled = true;

            const payload = {
                amount: amount.toFixed(2).toString(),
            };

            if (description) {
                payload.description = description;
            }

            const response = await fetch(`${API_BASE_URL}/api/wallet/deposit/`, {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
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
            console.error("Deposit request failed:", error);
            showAppNotification("depositFailed");
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
        const descriptionField = withdrawForm.querySelector("[name='description']");
        const description = descriptionField ? descriptionField.value.trim() : "";

        if (isNaN(amount) || amount < 1000) {
            showAppNotification("invalidWithdrawAmount");
            return;
        }

        if (currentWallet && amount > currentWallet.withdrawable_balance) {
            showAppNotification("withdrawMoreThanBalance");
            return;
        }

        try {
            withdrawForm.querySelector(".btn-submit").disabled = true;

            const payload = {
                amount: amount.toFixed(2).toString(),
            };

            if (description) {
                payload.description = description;
            }

            const response = await fetch(`${API_BASE_URL}/api/wallet/withdraw/`, {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
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
            console.info("Withdraw response:", data);
            showAppNotification("withdrawSuccess");
            withdrawModal.classList.remove("show");
            clearForm(withdrawForm);

            await refreshWalletData();

        } catch (error) {
            console.error("Withdraw request failed:", error);
            showAppNotification("withdrawFailed");
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
                renderInlineMessage(walletContainer, "walletNotFound");
                return;
            }
            currentWallet = wallets[0];
            updateWalletInfo(currentWallet);
            await loadTransactions(currentWallet.id, token);
        } catch (error) {
            console.error("Error refreshing wallet data:", error);
            showAppNotification("walletLoadFailed");
        }
    }

    async function loadTransactions(walletId, token) {
        try {
            const walletDetail = await fetchData(`${API_BASE_URL}/api/wallet/wallets/${walletId}/`, token);
            if (walletDetail.transactions && Array.isArray(walletDetail.transactions)) {
                setTransactions(walletDetail.transactions);
            } else {
                const txContainer = document.querySelector(".Transactions_container");
                renderInlineMessage(txContainer, "transactionsEmpty");
            }
        } catch (error) {
            console.error("Error loading transactions:", error);
            const txContainer = document.querySelector(".Transactions_container");
            renderInlineMessage(txContainer, "transactionsLoadFailed");
            showAppNotification("transactionsLoadFailed");
        }
    }

    function setTransactions(transactions) {
        allTransactions = Array.isArray(transactions) ? [...transactions] : [];
        renderTransactions();
    }

    function setupToken() {
        let token = localStorage.getItem('token') || localStorage.getItem('access_token');
        if (!token) {
            showAppNotification("loginRequired");
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
            const error = new Error("REQUEST_FAILED");
            error.status = response.status;
            throw error;
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
        const walletBalanceSpan = document.querySelector(".Wallet_balance_value");
        const withdrawableSpan = document.querySelector(".Withdrawable_wallet_balance_value");

        if (walletBalanceSpan) {
            walletBalanceSpan.textContent = formatCurrency(wallet.total_balance || 0);
        }

        if (withdrawableSpan) {
            withdrawableSpan.textContent = formatCurrency(wallet.withdrawable_balance || 0);
        }

        if (withdrawableBalanceSpan) {
            withdrawableBalanceSpan.textContent =
                formatCurrency(wallet.withdrawable_balance || 0) + " تومان";
        }

        currentWallet = { ...(currentWallet || {}), ...wallet };

        if (currentWallet) {
            currentWallet.total_balance = wallet.total_balance;
            currentWallet.withdrawable_balance = wallet.withdrawable_balance;
        }
    }

    function renderTransactions() {
        const container = document.querySelector(".Transactions_container");
        container.innerHTML = "";

        const transactionsToRender = prepareTransactions();

        if (!transactionsToRender || transactionsToRender.length === 0) {
            renderInlineMessage(container, "transactionsEmpty");
            return;
        }

        transactionsToRender.forEach((tx) => {
            const typeInfo = getTransactionTypeInfo(tx.transaction_type);
            const typeClass = typeInfo.className;
            const statusClass = getStatusClass(tx.status);
            const amountValue = normalizeAmount(tx.amount);
            const sign = typeInfo.sign;
            const formattedAmount = formatCurrency(Math.abs(amountValue));

            const item = `
                <div class="Transaction_item ${typeClass}">
                    <div class="icon_container">
                        <div class="${typeInfo.iconClass}"></div>
                    </div>
                    <div class="Transaction_mode_date">
                        <span>${typeInfo.label}</span>
                        <div class="date">${formatDate(tx.timestamp)}</div>
                    </div>
                    <div class="Transaction_prise_status">
                        <div class="prise">
                            <span>${sign}${formattedAmount}</span><span>تومان</span>
                        </div>
                        <div class="status ${statusClass}">
                            <span>${translateStatus(tx.status)}</span>
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML("beforeend", item);
        });
    }

    function prepareTransactions() {
        if (!allTransactions || allTransactions.length === 0) return [];

        const filtered = allTransactions.filter((tx) => {
            if (currentFilter === "all") return true;
            const info = getTransactionTypeInfo(tx.transaction_type);
            return info.filter === currentFilter;
        });

        return filtered.sort((a, b) => sortTransactions(a, b));
    }

    function sortTransactions(a, b) {
        if (currentOrdering === "start") {
            return getTimestamp(a) - getTimestamp(b);
        }

        if (currentOrdering === "end" || currentOrdering === "last") {
            return getTimestamp(b) - getTimestamp(a);
        }

        return 0;
    }

    function getTimestamp(transaction) {
        if (!transaction || !transaction.timestamp) return 0;
        const time = new Date(transaction.timestamp).getTime();
        return Number.isNaN(time) ? 0 : time;
    }

    function getTransactionTypeInfo(type) {
        const normalized = (type || "").toLowerCase();
        const match = TRANSACTION_TYPE_DETAILS.find((detail) =>
            detail.aliases.some((alias) => alias.toLowerCase() === normalized)
        );

        return match || DEFAULT_TRANSACTION_TYPE;
    }

    function getStatusClass(status) {
        const normalized = (status || "done").toLowerCase();
        return normalized === "done" || normalized === "success" ? "done" : "Not_done";
    }

    function translateStatus(status) {
        switch ((status || "done").toLowerCase()) {
            case "done":
            case "success":
                return "انجام شده";
            case "pending":
                return "در انتظار";
            case "failed":
            case "rejected":
                return "ناموفق";
            default:
                return "نامشخص";
        }
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

    function formatCurrency(amount) {
        const numericAmount = normalizeAmount(amount);
        return numericAmount.toLocaleString("fa-IR");
    }

    function normalizeAmount(amount) {
        const numericAmount = Number(typeof amount === "string" ? amount.replace(/,/g, "") : amount);
        return Number.isNaN(numericAmount) ? 0 : numericAmount;
    }

});
