// wallet.js

document.addEventListener("DOMContentLoaded", async () => {
    const walletContainer = document.querySelector(".wallet_container");
  
    try {
      // درخواست مستقیم به ولت با آیدی 5
      const wallet = await fetchData("https://atom-game.ir/api/wallet/wallets/9/");
  
      if (!wallet || !wallet.id) {
        walletContainer.innerHTML = `<p>خطا در دریافت اطلاعات کیف پول</p>`;
        return;
      }
  
      // جایگذاری اطلاعات کیف پول
      updateWalletInfo(wallet);
  
      // گرفتن 5 تراکنش اخیر برای همین ولت
      const transactions = await fetchData(
        `https://atom-game.ir/api/wallet/transactions/5/?limit=5`
      );
  
      if (transactions && Array.isArray(transactions)) {
        updateTransactions(transactions);
      }
    } catch (error) {
      console.error("Error fetching wallet data:", error);
      walletContainer.innerHTML = `<p>مشکلی در ارتباط با سرور پیش آمد</p>`;
    }
  
    // تابع درخواست ساده بدون توکن
    async function fetchData(url) {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return await response.json();
    }
  
    // بروزرسانی بخش کیف پول
    function updateWalletInfo(wallet) {
      document.querySelector(".Wallet_balance span").textContent =
        wallet.total_balance + " تومان";
      document.querySelector(
        ".Withdrawable_wallet_balance span:last-child"
      ).textContent = wallet.withdrawable_balance + " تومان";
    }
  
    // بروزرسانی لیست تراکنش‌ها
    function updateTransactions(transactions) {
      const container = document.querySelector(".Transactions_container");
      container.innerHTML = ""; // پاک کردن نمونه‌های قبلی
  
      transactions.forEach((tx) => {
        const typeClass =
          tx.transaction_type === "deposit"
            ? "Deposit"
            : tx.transaction_type === "withdraw"
            ? "Withdraw"
            : "Spending";
  
        const statusClass = tx.status === "done" ? "done" : "Not_done";
  
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
                <span>${tx.amount}</span><span>تومان</span>
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
  
    // توابع کمکی
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
      const date = new Date(isoDate);
      return date.toLocaleString("fa-IR", {
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
  });
  