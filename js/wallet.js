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

function toEnglishDigits(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));
}

function parseAmountValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const numeric = Number(toEnglishDigits(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function normaliseCardNumber(value) {
  if (!value) return "";
  const digits = toEnglishDigits(value).replace(/\D/g, "");
  return digits.slice(0, 16);
}

function normaliseIban(value) {
  if (!value) return "";
  let normalized = toEnglishDigits(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalized) return "";
  while (normalized.startsWith("IR")) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith("I")) {
    normalized = normalized.slice(1);
  }
  if (normalized.startsWith("R")) {
    normalized = normalized.slice(1);
  }
  normalized = `IR${normalized}`;
  return normalized.slice(0, 26);
}

function extractErrorMessage(detail) {
  if (!detail) return null;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map(extractErrorMessage).filter(Boolean);
    return parts.join(" ") || null;
  }
  if (typeof detail === "object") {
    if (detail.detail) {
      return extractErrorMessage(detail.detail);
    }
    const [firstKey] = Object.keys(detail);
    if (firstKey) {
      return extractErrorMessage(detail[firstKey]);
    }
  }
  return null;
}

function clearInlineMessage(container) {
  if (container) {
    container.innerHTML = "";
  }
}

function showInlineMessage(container, key, overrides) {
  if (!container) return;
  renderInlineMessage(container, key, overrides || {});
}

function setFieldValidity(field, isValid = true) {
  if (!field) return;
  if (isValid) {
    field.classList.remove("is-invalid");
  } else {
    field.classList.add("is-invalid");
  }
}

function selectMetadata(transaction) {
  if (!transaction) return DEFAULT_TRANSACTION_METADATA;
  const typeKey = (transaction.transaction_type_display || transaction.transaction_type || "")
    .toString()
    .toLowerCase();
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
  if (amount === null || amount === undefined || amount === "") {
    return fallback;
  }
  const numeric = parseAmountValue(amount);
  if (numeric === null) {
    return typeof amount === "string" ? amount : fallback;
  }
  return new Intl.NumberFormat("fa-IR").format(numeric);
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
  const depositMessages = document.getElementById("deposit-form-messages");
  const withdrawMessages = document.getElementById("withdraw-form-messages");
  const withdrawCardInput = document.getElementById("withdraw-card-number");
  const withdrawIbanInput = document.getElementById("withdraw-iban");
  const withdrawCardHolderInput = document.getElementById("withdraw-card-holder");
  const transactionFilterButtons = document.querySelectorAll(".filter_item");
  const orderingSelect = document.getElementById("ordering");
  const depositAmountInput = depositForm?.querySelector("[name='amount']");
  const withdrawAmountInput = withdrawForm?.querySelector("[name='amount']");

  const service = new WalletService({});
  if (!service.accessToken) {
    showAppNotification("loginRequired");
    window.location.href = "../register/login.html";
    return;
  }

  const state = {
    walletId: null,
    wallet: null,
    currentFilter: "all",
    ordering: "-timestamp",
    transactions: [],
    totalBalance: 0,
    withdrawableBalance: 0,
  };

  updateWithdrawButtonState();

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

  function updateWithdrawButtonState() {
    if (!withdrawBtn) return;
    const disabled = !state.withdrawableBalance || state.withdrawableBalance <= 0;
    withdrawBtn.disabled = disabled;
    withdrawBtn.classList.toggle("is-disabled", disabled);
  }

  function updateWalletSummary(wallet) {
    if (!wallet) return;

    state.wallet = wallet;
    if (wallet.id) {
      state.walletId = wallet.id;
    }

    const totalNumeric =
      parseAmountValue(wallet.total_balance) ??
      parseAmountValue(wallet.total_balance_display) ??
      parseAmountValue(wallet.display_total_balance);
    const withdrawableNumeric =
      parseAmountValue(wallet.withdrawable_balance) ??
      parseAmountValue(wallet.withdrawable_balance_display) ??
      parseAmountValue(wallet.display_withdrawable_balance);

    state.totalBalance = totalNumeric ?? 0;
    state.withdrawableBalance = withdrawableNumeric ?? 0;

    const totalBalanceDisplay =
      wallet.display_total_balance ||
      wallet.total_balance_display ||
      formatAmount(state.totalBalance);
    const withdrawableDisplay =
      wallet.display_withdrawable_balance ||
      wallet.withdrawable_balance_display ||
      formatAmount(state.withdrawableBalance);

    if (walletBalanceSpan) {
      walletBalanceSpan.textContent = totalBalanceDisplay;
    }
    if (withdrawableSpan) {
      withdrawableSpan.textContent = withdrawableDisplay;
    }
    if (withdrawableBalanceSpan) {
      withdrawableBalanceSpan.textContent = `${withdrawableDisplay} تومان`;
    }

    updateWithdrawButtonState();
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
    if (!state.walletId) {
      transactionsContainer.innerHTML = "";
      return;
    }
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

  function resetFormState(form, messagesContainer) {
    if (form) {
      form.reset();
      form.querySelectorAll(".is-invalid").forEach((element) => element.classList.remove("is-invalid"));
    }
    if (messagesContainer) {
      clearInlineMessage(messagesContainer);
    }
  }

  if (withdrawCardInput) {
    withdrawCardInput.addEventListener("input", () => {
      const normalized = normaliseCardNumber(withdrawCardInput.value);
      const grouped = normalized.replace(/(\d{4})(?=\d)/g, "$1 ");
      withdrawCardInput.value = grouped;
    });
  }

  if (withdrawIbanInput) {
    withdrawIbanInput.addEventListener("input", () => {
      const normalized = normaliseIban(withdrawIbanInput.value);
      const grouped = normalized.replace(/(.{4})(?=.)/g, "$1 ");
      withdrawIbanInput.value = grouped;
    });
  }

  if (depositBtn && depositModal) {
    depositBtn.addEventListener("click", () => {
      resetFormState(depositForm, depositMessages);
      depositModal.classList.add("show");
    });
  }

  if (withdrawBtn && withdrawModal) {
    withdrawBtn.addEventListener("click", () => {
      if (withdrawBtn.disabled) {
        return;
      }
      resetFormState(withdrawForm, withdrawMessages);
      if (withdrawableBalanceSpan) {
        const display = formatAmount(state.withdrawableBalance);
        withdrawableBalanceSpan.textContent = `${display} تومان`;
      }
      withdrawModal.classList.add("show");
    });
  }

  [depositModal, withdrawModal].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (event) => {
      if (
        event.target.classList.contains("modal-close") ||
        event.target.classList.contains("btn-cancel") ||
        event.target === modal
      ) {
        modal.classList.remove("show");
        if (modal.contains(depositForm)) {
          resetFormState(depositForm, depositMessages);
        }
        if (modal.contains(withdrawForm)) {
          resetFormState(withdrawForm, withdrawMessages);
        }
      }
    });
  });

  if (depositForm) {
    depositForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearInlineMessage(depositMessages);
      setFieldValidity(depositAmountInput, true);

      const submitButton = depositForm.querySelector(".btn-submit");
      const amountValue = parseAmountValue(depositAmountInput?.value);
      const normalizedAmount = amountValue !== null ? Math.floor(amountValue) : null;
      const description = depositForm.querySelector("[name='description']")?.value?.trim();

      if (!normalizedAmount || normalizedAmount < 1000) {
        setFieldValidity(depositAmountInput, false);
        showAppNotification("invalidDepositAmount");
        showInlineMessage(depositMessages, "invalidDepositAmount");
        depositAmountInput?.focus();
        return;
      }

      if (!state.walletId) {
        showAppNotification("walletLoadFailed");
        showInlineMessage(depositMessages, "walletLoadFailed");
        return;
      }

      try {
        if (submitButton) submitButton.disabled = true;
        const response = await service.createTransaction("deposit", {
          amount: String(normalizedAmount),
          description,
          walletId: state.walletId,
        });
        if (response?.payment_url) {
          window.location.href = response.payment_url;
          return;
        }
        showAppNotification("depositSuccess");
        resetFormState(depositForm, depositMessages);
        depositModal?.classList.remove("show");
        await refreshWalletData();
      } catch (error) {
        console.error("Deposit request failed", error);
        const detail = error?.detail;
        const friendlyMessage = extractErrorMessage(detail) || extractErrorMessage(error?.message);
        let notificationKey = "depositFailed";
        let inlineKey = "depositFailed";
        let overrides;

        if (detail && typeof detail === "object" && !Array.isArray(detail) && detail.amount) {
          notificationKey = "invalidDepositAmount";
          inlineKey = "invalidDepositAmount";
          overrides = { message: extractErrorMessage(detail.amount), hint: null };
          setFieldValidity(depositAmountInput, false);
        } else if (friendlyMessage) {
          overrides = { message: friendlyMessage, hint: null };
        }

        showAppNotification(notificationKey);
        showInlineMessage(depositMessages, inlineKey, overrides);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  if (withdrawForm) {
    withdrawForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearInlineMessage(withdrawMessages);
      setFieldValidity(withdrawAmountInput, true);
      setFieldValidity(withdrawCardInput, true);
      setFieldValidity(withdrawIbanInput, true);

      const submitButton = withdrawForm.querySelector(".btn-submit");
      const amountValue = parseAmountValue(withdrawAmountInput?.value);
      const normalizedAmount = amountValue !== null ? Math.floor(amountValue) : null;
      const description = withdrawForm.querySelector("[name='description']")?.value?.trim();
      const cardNumber = normaliseCardNumber(withdrawCardInput?.value);
      const iban = normaliseIban(withdrawIbanInput?.value);
      const cardHolderName = withdrawCardHolderInput?.value?.trim();

      if (!normalizedAmount || normalizedAmount < 1000) {
        setFieldValidity(withdrawAmountInput, false);
        showAppNotification("invalidWithdrawAmount");
        showInlineMessage(withdrawMessages, "invalidWithdrawAmount");
        withdrawAmountInput?.focus();
        return;
      }

      if (
        state.withdrawableBalance !== null &&
        normalizedAmount > Number(state.withdrawableBalance || 0)
      ) {
        setFieldValidity(withdrawAmountInput, false);
        showAppNotification("withdrawMoreThanBalance");
        showInlineMessage(withdrawMessages, "withdrawMoreThanBalance");
        withdrawAmountInput?.focus();
        return;
      }

      if (!state.walletId) {
        showAppNotification("walletLoadFailed");
        showInlineMessage(withdrawMessages, "walletLoadFailed");
        return;
      }

      if (!cardNumber || cardNumber.length !== 16) {
        setFieldValidity(withdrawCardInput, false);
        showAppNotification("withdrawInvalidCard");
        showInlineMessage(withdrawMessages, "withdrawInvalidCard");
        withdrawCardInput?.focus();
        return;
      }

      if (!iban || iban.length !== 26) {
        setFieldValidity(withdrawIbanInput, false);
        showAppNotification("withdrawInvalidIban");
        showInlineMessage(withdrawMessages, "withdrawInvalidIban");
        withdrawIbanInput?.focus();
        return;
      }

      try {
        if (submitButton) submitButton.disabled = true;
        await service.createTransaction("withdrawal", {
          amount: String(normalizedAmount),
          description,
          walletId: state.walletId,
          card_number: cardNumber,
          iban,
          card_holder_name: cardHolderName || undefined,
        });
        showAppNotification("withdrawSuccess");
        resetFormState(withdrawForm, withdrawMessages);
        withdrawModal?.classList.remove("show");
        await refreshWalletData();
      } catch (error) {
        console.error("Withdraw request failed", error);
        const detail = error?.detail;
        const friendlyMessage = extractErrorMessage(detail) || extractErrorMessage(error?.message);
        let notificationKey = "withdrawFailed";
        let inlineKey = "withdrawFailed";
        let overrides;

        if (detail && typeof detail === "object" && !Array.isArray(detail)) {
          if (detail.card_number) {
            notificationKey = "withdrawInvalidCard";
            inlineKey = "withdrawInvalidCard";
            overrides = { message: extractErrorMessage(detail.card_number), hint: null };
            setFieldValidity(withdrawCardInput, false);
          } else if (detail.iban) {
            notificationKey = "withdrawInvalidIban";
            inlineKey = "withdrawInvalidIban";
            overrides = { message: extractErrorMessage(detail.iban), hint: null };
            setFieldValidity(withdrawIbanInput, false);
          } else if (detail.amount || detail.withdrawable_balance) {
            notificationKey = "withdrawMoreThanBalance";
            inlineKey = "withdrawMoreThanBalance";
            overrides = {
              message: extractErrorMessage(detail.amount || detail.withdrawable_balance),
              hint: null,
            };
            setFieldValidity(withdrawAmountInput, false);
          }
        }

        if (!overrides && friendlyMessage) {
          overrides = { message: friendlyMessage, hint: null };
          if (/موجودی|balance/i.test(friendlyMessage)) {
            notificationKey = "withdrawMoreThanBalance";
            inlineKey = "withdrawMoreThanBalance";
            setFieldValidity(withdrawAmountInput, false);
          } else if (notificationKey === "withdrawFailed") {
            notificationKey = "withdrawValidationFailed";
            inlineKey = "withdrawValidationFailed";
          }
        }

        showAppNotification(notificationKey);
        showInlineMessage(withdrawMessages, inlineKey, overrides);
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
