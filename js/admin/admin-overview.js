import {
  buildApiUrl,
  fetchJsonList,
  fetchWithAuth,
  formatCurrency,
  formatDateTime,
  formatNumber,
  toQueryString,
} from "./admin-api.js";

const metricElements = new Map();
const listTargets = {
  topTournaments: document.querySelector("[data-list=\"top-tournaments\"]"),
  topPlayers: document.querySelector("[data-list=\"top-players\"]"),
};
const operationsTargets = {
  pendingVerifications: document.querySelector("[data-field=\"pending-verifications\"]"),
  pendingWithdrawals: document.querySelector("[data-field=\"pending-withdrawals\"]"),
  upcomingTournaments: document.querySelector("[data-field=\"upcoming-tournaments\"]"),
  avgResponse: document.querySelector("[data-field=\"avg-response\"]"),
};
const chartPlaceholder = document.querySelector("[data-chart=\"revenue\"]");
const revenueLegend = document.querySelector("[data-role=\"revenue-legend\"]");

const METRIC_SELECTORS = [
  "total-players",
  "active-tournaments",
  "prize-pool",
  "support-load",
];

METRIC_SELECTORS.forEach((metric) => {
  const el = document.querySelector(
    `[data-metric=\"${metric}\"] [data-field=\"value\"]`
  );
  if (el) {
    metricElements.set(metric, el);
  }
});

const ACTION_HANDLERS = {
  "refresh-dashboard": () => loadDashboard(),
  "download-report": () =>
    window.open(buildApiUrl("/api/reporting/financial/?format=csv"), "_blank"),
  "export-revenue": () =>
    window.open(buildApiUrl("/api/reporting/revenue/?format=csv"), "_blank"),
  "manage-tournaments": () =>
    window.location.assign("tournaments-management.html"),
  "view-leaderboard": () => window.location.assign("../leaderBoard.html"),
};

bindActionButtons();
loadDashboard().catch((error) =>
  console.error("Failed to load dashboard data", error)
);

function bindActionButtons() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    const action = button.getAttribute("data-action");
    const handler = ACTION_HANDLERS[action];
    if (handler) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        handler(button);
      });
    }
  });
}

async function loadDashboard() {
  await Promise.all([
    loadSummaryMetrics(),
    loadTopTournaments(),
    loadTopPlayers(),
    loadOperationsSummary(),
    loadRevenueTrend(),
  ]);
}

async function loadSummaryMetrics() {
  try {
    const [players, tournaments, prizePool, tickets] = await Promise.all([
      fetchNumber("/api/users/total-players/"),
      fetchNumber("/api/tournaments/total-tournaments/"),
      fetchNumber("/api/tournaments/total-prize-money/"),
      fetchJsonList("/api/support/tickets/" + toQueryString({ status: "open" })),
    ]);

    updateMetric("total-players", formatNumber(players));
    updateMetric("active-tournaments", formatNumber(tournaments));
    updateMetric(
      "prize-pool",
      prizePool ? formatCurrency(prizePool, "fa-IR", "IRR") : "--"
    );
    updateMetric(
      "support-load",
      tickets ? formatNumber(tickets.length || tickets.count || 0) : "0"
    );

    const inboxCounter = document.querySelector("[data-role=\"inbox-count\"]");
    if (inboxCounter) {
      inboxCounter.textContent = formatNumber(tickets?.length || 0);
    }
  } catch (error) {
    console.error("Failed to load summary metrics", error);
  }
}

async function loadTopTournaments() {
  const listEl = listTargets.topTournaments;
  if (!listEl) return;
  listEl.innerHTML = "<li>در حال بارگذاری...</li>";
  try {
    const tournaments = await fetchJsonList(
      "/api/tournaments/tournaments/" +
        toQueryString({ ordering: "-prize_pool", limit: 5 })
    );
    if (!tournaments.length) {
      listEl.innerHTML = "<li>تورنی وجود ندارد.</li>";
      return;
    }
    listEl.innerHTML = tournaments
      .map((item) => {
        const name = escapeHtml(item.name) || "بدون عنوان";
        const prize = formatCurrency(item.prize_pool || 0);
        const start = formatDateTime(item.start_date);
        const gameName = escapeHtml(item?.game?.name || item?.game_name || "بازی نامشخص");
        return `<li><strong>${name}</strong><span>${gameName} — شروع ${start}</span><span>جایزه کل: ${prize}</span></li>`;
      })
      .join("");
  } catch (error) {
    listEl.innerHTML = "<li>خطا در دریافت اطلاعات</li>";
  }
}

async function loadTopPlayers() {
  const listEl = listTargets.topPlayers;
  if (!listEl) return;
  listEl.innerHTML = "<li>در حال بارگذاری...</li>";
  try {
    const players = await fetchJsonList(
      "/api/users/users/" + toQueryString({ ordering: "-score", limit: 5 })
    );
    if (!players.length) {
      listEl.innerHTML = "<li>بازیکنی یافت نشد.</li>";
      return;
    }
    listEl.innerHTML = players
      .map((player) => {
        const name = escapeHtml(
          [player.first_name, player.last_name].filter(Boolean).join(" ") ||
            player.username ||
            "بازیکن"
        );
        const score = formatNumber(player.score || 0);
        const rank = formatNumber(player.rank || "-");
        return `<li><strong>${name}</strong><span>امتیاز: ${score}</span><span>رتبه: ${rank}</span></li>`;
      })
      .join("");
  } catch (error) {
    listEl.innerHTML = "<li>خطا در دریافت بازیکنان</li>";
  }
}

async function loadOperationsSummary() {
  try {
    const [verifications, withdrawals, tournaments, tickets] = await Promise.all([
      fetchJsonList("/api/verification/list_all/" + toQueryString({ status: "pending" })),
      fetchJsonList("/api/wallet/transactions/"),
      fetchJsonList(
        "/api/tournaments/tournaments/" +
          toQueryString({ ordering: "start_date", limit: 20 })
      ),
      fetchJsonList("/api/support/tickets/"),
    ]);

    setText(
      operationsTargets.pendingVerifications,
      formatNumber(verifications.length)
    );

    const pendingWithdrawals = withdrawals.filter(
      (tx) =>
        (tx.transaction_type || tx.type) === "withdrawal" &&
        !hasCompletedFlag(tx.description)
    );
    setText(
      operationsTargets.pendingWithdrawals,
      formatNumber(pendingWithdrawals.length)
    );

    const upcomingCount = tournaments.filter((item) => {
      const start = item.start_date ? new Date(item.start_date) : null;
      return start && start.getTime() > Date.now();
    }).length;
    setText(operationsTargets.upcomingTournaments, formatNumber(upcomingCount));

    const avgResponseMinutes = calculateAverageResponseMinutes(tickets);
    setText(
      operationsTargets.avgResponse,
      avgResponseMinutes ? `${avgResponseMinutes} دقیقه` : "--"
    );
  } catch (error) {
    console.error("Failed to load operational summary", error);
  }
}

async function loadRevenueTrend() {
  if (!chartPlaceholder) return;
  try {
    const transactions = await fetchJsonList("/api/wallet/transactions/");
    if (!transactions.length) {
      chartPlaceholder.innerHTML =
        '<div class="trend-chart__placeholder">اطلاعاتی برای نمایش وجود ندارد.</div>';
      return;
    }
    const series = buildRevenueSeries(transactions);
    renderRevenueTrend(series);
  } catch (error) {
    chartPlaceholder.innerHTML =
      '<div class="trend-chart__placeholder">خطا در دریافت اطلاعات مالی</div>';
    console.error("Failed to load revenue trend", error);
  }
}

function buildRevenueSeries(transactions) {
  const results = new Map();
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  transactions.forEach((tx) => {
    const timestamp = tx.timestamp || tx.created_at || tx.date;
    const date = timestamp ? new Date(timestamp) : null;
    if (!date || date.getTime() < thirtyDaysAgo) return;
    const dayKey = date.toISOString().slice(0, 10);
    if (!results.has(dayKey)) {
      results.set(dayKey, { income: 0, withdrawal: 0, prize: 0 });
    }
    const bucket = results.get(dayKey);
    const amount = Number(tx.amount || tx.value || 0);
    const type = tx.transaction_type || tx.type;
    if (type === "deposit") {
      bucket.income += amount;
    } else if (type === "withdrawal") {
      bucket.withdrawal += Math.abs(amount);
    } else if (type === "prize") {
      bucket.prize += Math.abs(amount);
    }
  });

  return Array.from(results.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, values]) => ({ date, ...values }));
}

function renderRevenueTrend(series) {
  if (!series.length) {
    chartPlaceholder.innerHTML =
      '<div class="trend-chart__placeholder">اطلاعات کافی موجود نیست.</div>';
    return;
  }

  const maxValue = Math.max(
    ...series.map((item) => Math.max(item.income, item.withdrawal, item.prize))
  );
  const scale = maxValue || 1;

  const chartBars = series
    .map((item) => {
      const incomeHeight = Math.round((item.income / scale) * 100);
      const withdrawHeight = Math.round((item.withdrawal / scale) * 100);
      const prizeHeight = Math.round((item.prize / scale) * 100);
      return `
        <div class="trend-column" title="${formatDateTime(item.date)}">
          <div class="trend-bars">
            <span class="trend-bar trend-bar--income" style="height:${incomeHeight}%"></span>
            <span class="trend-bar trend-bar--withdraw" style="height:${withdrawHeight}%"></span>
            <span class="trend-bar trend-bar--prize" style="height:${prizeHeight}%"></span>
          </div>
          <span class="trend-column__label">${formatDay(item.date)}</span>
        </div>`;
    })
    .join("");

  chartPlaceholder.innerHTML = `<div class="trend-columns">${chartBars}</div>`;

  if (revenueLegend) {
    revenueLegend.setAttribute("aria-hidden", "false");
  }
}

async function fetchNumber(path) {
  try {
    const result = await fetchWithAuth(path);
    if (result === null || result === undefined) return 0;
    if (typeof result === "number") return result;
    if (typeof result === "string") {
      const numeric = Number(result.replace(/[^\d.-]+/g, ""));
      return Number.isNaN(numeric) ? 0 : numeric;
    }
    if (typeof result === "object") {
      const candidate =
        result.total ||
        result.count ||
        result.sum ||
        result.value ||
        result.total_players ||
        result.total_tournaments ||
        result.total_prize_money;
      return candidate ? Number(candidate) : 0;
    }
    return 0;
  } catch (error) {
    console.warn("Failed to fetch numeric value", path, error);
    return 0;
  }
}

function updateMetric(metric, value) {
  const el = metricElements.get(metric);
  if (el) {
    el.textContent = value;
  }
}

function setText(element, text) {
  if (!element) return;
  element.textContent = text;
}

function calculateAverageResponseMinutes(tickets = []) {
  if (!tickets.length) return 0;
  const durations = [];
  tickets.forEach((ticket) => {
    const created = ticket.created_at ? new Date(ticket.created_at) : null;
    const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
    const firstReply = messages
      .filter((msg) => msg.user && msg.user !== ticket.user)
      .map((msg) => new Date(msg.created_at))
      .find((date) => !Number.isNaN(date));
    if (created && firstReply && !Number.isNaN(created)) {
      const diff = Math.max(0, firstReply.getTime() - created.getTime());
      durations.push(Math.round(diff / (60 * 1000)));
    }
  });
  if (!durations.length) return 0;
  const sum = durations.reduce((total, value) => total + value, 0);
  return Math.round(sum / durations.length);
}

function hasCompletedFlag(description) {
  if (!description) return false;
  const normalized = description.toString().toLowerCase();
  return (
    normalized.includes("paid") ||
    normalized.includes("done") ||
    normalized.includes("پرداخت") ||
    normalized.includes("واریز شد")
  );
}

function escapeHtml(value) {
  return value
    ? value
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
    : "";
}

function formatDay(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" }).format(
      date
    );
  } catch (error) {
    return date.toLocaleDateString();
  }
}
