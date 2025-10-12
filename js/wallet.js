import { renderInlineMessage, showAppNotification } from "/js/app-errors.js";
import WalletService from "/js/services/wallet-service.js";

const TRANSACTION_TYPE_METADATA = {
  deposit: { iconClass: "Deposit_icon", rowClass: "Deposit", label: "واریز", sign: "+" },
  withdrawal: { iconClass: "Withdraw_icon", rowClass: "Withdraw", label: "برداشت", sign: "-" },
  entry_fee: { iconClass: "EntryFee_icon", rowClass: "EntryFee", label: "هزینه ورود", sign: "-" },
  prize: { iconClass: "Prize_icon", rowClass: "Prize", label: "جایزه", sign: "+" },
  spending: { iconClass: "Spending_icon", rowClass: "Spending", label: "خرج شده", sign: "-" },
};

const DEFAULT_TRANSACTION_METADATA = { iconClass: "Deposit_icon", rowClass: "Deposit", label: "تراکنش", sign: "+" };

const STATUS_LABELS = {
  success: "انجام شده",
  done: "انجام شده",
  pending: "در انتظار",
  failed: "ناموفق",
  rejected: "ناموفق",
};

const STATUS_CLASSNAMES = {
  success: "done",
  done: "done",
  pending: "pending",
  failed: "Not_done",
  rejected: "Not_done",
};

function selectMetadata(transaction) {
  if (!transaction) return DEFAULT_TRANSACTION_METADATA;
  const typeKey = (transaction.transaction_type_display || transaction.transaction_type || "").toString().toLowerCase();
  return TRANSACTION_TYPE_METADATA[typeKey] || DEFAULT_TRANSACTION_METADATA;
}

function resolveStatusLabel(transaction) {
  if (!transaction) return STATUS_LABELS.success;
  const statusKey = (transaction.status_display || transaction.status || "success").toString().toLowerCase();
  return STATUS_LABELS[statusKey] || "نامشخص";
}

function resolveStatusClass(transaction) {
  if (!transaction) return STATUS_CLASSNAMES.success;
  const statusKey = (transaction.status_display || transaction.status || "success").toString().toLowerCase();
  return STATUS_CLASSNAMES[statusKey] || "Not_done";
}

function formatAmount(amount, fallback = "0") {
  if (!amount && amount !== 0) return fallback;
  if (typeof amount === "number") {
    return new Intl.NumberFormat("fa-IR").format(amount);
  }
  const numeric = Number(String(amount).replace(/,/g, ""));
  if (Number.isFinite(numeric)) {
    return new Intl.NumberFormat("fa-IR").format(numeric);
  }
  return amount;
}

function formatTimestamp(timestamp, fallback = "تاریخ نامشخص") {
  if (!timestamp) return fallback;
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return timestamp;
    }
    return new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch (error) {
    console.error("Failed to format timestamp", error);
    return fallback;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const walletContainer = document.querySelector(".wallet_container");
  const walletBalanceSpan = document.querySelector(".Wallet_balance_value");
  const withdrawableSpan = document.querySelector(".Withdrawable_wallet_balance_value");
  const withdrawableBalanceSpan = document.getElementById("withdrawable-balance");
  const transactionsContainer = document.querySelector(".Transactions_container");
  const depositModal = document.querySelector(".Deposit_modal");
  const withdrawModal = document.querySelector(".Withdraw_modal");
  const depositBtn = document.querySelector(".Deposit_btn");
  const withdrawBtn = document.querySelector(".Withdraw_btn");
  const depositForm = document.getElementById("deposit-form");
  const withdrawForm = document.getElementById("withdraw-form");
  const transactionFilterButtons = document.querySelectorAll(".filter_item");
  const orderingSelect = document.getElementById("ordering");

  const service = new WalletService({});
  if (!service.accessToken) {
    showAppNotification("loginRequired");
    window.location.href = "../register/login.html";
    return;
  }

  const state = {
    walletId: null,
    currentFilter: "all",
    ordering: "-timestamp",
    transactions: [],
  };

  if (orderingSelect) {
    state.ordering = resolveOrderingValue(orderingSelect.value);
  }

  async function initialiseWallet() {
    try {
      if (transactionsContainer) {
        renderInlineMessage(transactionsContainer, "transactionsEmpty", {
          title: "در حال بارگذاری",
          message: "در حال آماده‌سازی اطلاعات کیف پول...",
          hint: "لطفاً چند لحظه صبر کنید.",
        });
      }
      const wallet = await service.getWalletSummary();
      if (!wallet || !wallet.id) {
        renderInlineMessage(walletContainer, "walletNotFound");
        showAppNotification("walletNotFound");
        return;
      }
      state.walletId = wallet.id;
      updateWalletSummary(wallet);
      await loadTransactions();
    } catch (error) {
      console.error("Failed to initialise wallet", error);
      renderInlineMessage(walletContainer, "walletLoadFailed");
      showAppNotification("walletLoadFailed");
    }
  }

  function updateWalletSummary(wallet) {
    const totalBalanceDisplay = wallet.display_total_balance || wallet.total_balance_display || formatAmount(wallet.total_balance || 0);
    const withdrawableDisplay = wallet.display_withdrawable_balance || wallet.withdrawable_balance_display || formatAmount(wallet.withdrawable_balance || 0);

    if (walletBalanceSpan) {
      walletBalanceSpan.textContent = totalBalanceDisplay;
    }
    if (withdrawableSpan) {
      withdrawableSpan.textContent = withdrawableDisplay;
    }
    if (withdrawableBalanceSpan) {
      withdrawableBalanceSpan.textContent = `${withdrawableDisplay} تومان`;
    }
  }

  function resolveOrderingValue(value) {
    switch (value) {
      case "start":
        return "timestamp";
      case "end":
        return "-timestamp";
      case "last":
      default:
        return "-timestamp";
    }
  }

  async function loadTransactions() {
    if (!transactionsContainer) return;
    try {
      renderInlineMessage(transactionsContainer, "transactionsEmpty", {
        title: "در حال بارگذاری",
        message: "در حال دریافت فهرست تراکنش‌ها هستیم.",
        hint: "این فرآیند ممکن است چند ثانیه زمان ببرد.",
      });
      const response = await service.getTransactions(state.walletId, {
        transactionType: state.currentFilter,
        ordering: state.ordering,
        pageSize: 50,
      });
      state.transactions = response.results || [];
      if (!state.transactions.length) {
        renderInlineMessage(transactionsContainer, "transactionsEmpty");
        return;
      }
      renderTransactions(state.transactions);
    } catch (error) {
      console.error("Failed to load transactions", error);
      renderInlineMessage(transactionsContainer, "transactionsLoadFailed");
      showAppNotification("transactionsLoadFailed");
    }
  }

  function renderTransactions(transactions) {
    if (!transactionsContainer) return;
    transactionsContainer.innerHTML = "";

    transactions.forEach((transaction) => {
      const metadata = selectMetadata(transaction);
      const statusLabel = resolveStatusLabel(transaction);
      const statusClass = resolveStatusClass(transaction);
      const amountDisplay = transaction.display_amount || formatAmount(transaction.amount);
      const timestampDisplay = transaction.display_timestamp || formatTimestamp(transaction.timestamp);
      const sign = transaction.display_sign || metadata.sign || "";

      const template = document.createElement("div");
      template.className = `Transaction_item ${metadata.rowClass}`;
      template.innerHTML = `
        <div class="icon_container">
          <div class="${metadata.iconClass}"></div>
        </div>
        <div class="Transaction_mode_date">
          <span>${transaction.display_label || metadata.label}</span>
          <div class="date">${timestampDisplay}</div>
        </div>
        <div class="Transaction_prise_status">
          <div class="prise">
            <span>${sign}${amountDisplay}</span><span>تومان</span>
          </div>
          <div class="status ${statusClass}">
            <span>${statusLabel}</span>
          </div>
        </div>
      `;
      transactionsContainer.appendChild(template);
    });
  }

  async function refreshWalletData() {
    try {
      const wallet = await service.getWalletSummary();
      if (wallet) {
        updateWalletSummary(wallet);
      }
      await loadTransactions();
      showAppNotification("walletRefreshed");
    } catch (error) {
      console.error("Failed to refresh wallet", error);
      showAppNotification("walletLoadFailed");
    }
  }

  if (depositBtn && depositModal) {
    depositBtn.addEventListener("click", () => depositModal.classList.add("show"));
  }

  if (withdrawBtn && withdrawModal) {
    withdrawBtn.addEventListener("click", () => {
      if (withdrawableBalanceSpan && withdrawableSpan) {
        withdrawableBalanceSpan.textContent = `${withdrawableSpan.textContent} تومان`;
      }
      withdrawModal.classList.add("show");
    });
  }

  [depositModal, withdrawModal].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (event) => {
      if (event.target.classList.contains("modal-close") || event.target.classList.contains("btn-cancel") || event.target === modal) {
        modal.classList.remove("show");
        const form = modal.querySelector("form");
        if (form) {
          form.reset();
        }
      }
    });
  });

  if (depositForm) {
    depositForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = depositForm.querySelector(".btn-submit");
      const amount = depositForm.amount?.value?.trim();
      const description = depositForm.querySelector("[name='description']")?.value?.trim();

      if (!amount) {
        showAppNotification("invalidDepositAmount");
        return;
      }

      try {
        if (submitButton) submitButton.disabled = true;
        const response = await service.createTransaction("deposit", { amount, description });
        if (response?.payment_url) {
          window.location.href = response.payment_url;
          return;
        }
        showAppNotification("depositSuccess");
        depositModal?.classList.remove("show");
        depositForm.reset();
        await refreshWalletData();
      } catch (error) {
        console.error("Deposit request failed", error);
        showAppNotification("depositFailed");
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  if (withdrawForm) {
    withdrawForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = withdrawForm.querySelector(".btn-submit");
      const amount = withdrawForm.amount?.value?.trim();
      const description = withdrawForm.querySelector("[name='description']")?.value?.trim();

      if (!amount) {
        showAppNotification("invalidWithdrawAmount");
        return;
      }

      try {
        if (submitButton) submitButton.disabled = true;
        await service.createTransaction("withdrawal", { amount, description });
        showAppNotification("withdrawSuccess");
        withdrawModal?.classList.remove("show");
        withdrawForm.reset();
        await refreshWalletData();
      } catch (error) {
        console.error("Withdraw request failed", error);
        showAppNotification("withdrawFailed");
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  transactionFilterButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      transactionFilterButtons.forEach((item) => {
        item.classList.remove("active_sort");
        item.classList.add("none_active");
      });
      button.classList.add("active_sort");
      button.classList.remove("none_active");
      state.currentFilter = button.dataset.filter || "all";
      await loadTransactions();
    });
  });

  if (orderingSelect) {
    orderingSelect.addEventListener("change", async () => {
      state.ordering = resolveOrderingValue(orderingSelect.value);
      await loadTransactions();
    });
  }

  await initialiseWallet();
});
