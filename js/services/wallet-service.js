import { API_BASE_URL } from "/js/config.js";

const WALLET_ENDPOINT = "/api/wallet/wallets/";
const TRANSACTIONS_ENDPOINT = "/api/wallet/transactions/";
const DEPOSIT_ENDPOINT = "/api/wallet/deposit/";
const WITHDRAW_ENDPOINT = "/api/wallet/withdraw/";

function buildQuery(query) {
  if (!query || typeof query !== "object") {
    return "";
  }
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== "") {
          params.append(key, item);
        }
      });
      return;
    }
    params.append(key, value);
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export class WalletService {
  constructor({ storage = window.localStorage } = {}) {
    this.storage = storage;
    this.activeRequests = new Map();
  }

  get accessToken() {
    return this.storage.getItem("token") || this.storage.getItem("access_token");
  }

  set accessToken(value) {
    if (value) {
      this.storage.setItem("token", value);
      this.storage.setItem("access_token", value);
    }
  }

  get refreshToken() {
    return this.storage.getItem("refresh_token");
  }

  async fetchJson(path, { method = "GET", body, query, signal } = {}) {
    const controller = signal ? null : new AbortController();
    const finalSignal = signal || controller?.signal;

    const key = `${method}:${path}:${JSON.stringify(query || {})}`;
    if (method === "GET" && this.activeRequests.has(key)) {
      this.activeRequests.get(key).abort();
      this.activeRequests.delete(key);
    }

    const queryString = buildQuery(query);
    const url = new URL(path + queryString, API_BASE_URL);

    const headers = new Headers({ "Content-Type": "application/json" });
    const token = this.accessToken;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const requestInit = {
      method,
      headers,
      signal: finalSignal,
    };

    if (body !== undefined) {
      requestInit.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    if (method === "GET" && controller) {
      this.activeRequests.set(key, controller);
    }

    let response = await fetch(url, requestInit);

    if (response.status === 401 && this.refreshToken) {
      await this.refreshAccessToken();
      headers.set("Authorization", `Bearer ${this.accessToken}`);
      response = await fetch(url, requestInit);
    }

    if (method === "GET" && this.activeRequests.has(key)) {
      this.activeRequests.delete(key);
    }

    if (!response.ok) {
      const error = new Error("REQUEST_FAILED");
      error.status = response.status;
      try {
        error.detail = await response.json();
      } catch (err) {
        error.detail = await response.text();
      }
      throw error;
    }

    if (response.status === 204) {
      return null;
    }

    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      console.warn("Invalid JSON received from", url.toString(), text);
      throw error;
    }
  }

  async refreshAccessToken() {
    const refresh = this.refreshToken;
    if (!refresh) {
      throw new Error("REFRESH_TOKEN_NOT_FOUND");
    }

    const response = await fetch(`${API_BASE_URL}/auth/jwt/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    if (!response.ok) {
      this.storage.clear();
      throw new Error("TOKEN_REFRESH_FAILED");
    }

    const data = await response.json();
    if (!data?.access) {
      this.storage.clear();
      throw new Error("TOKEN_REFRESH_FAILED");
    }

    this.accessToken = data.access;
    return data.access;
  }

  async getWalletSummary() {
    const wallets = await this.fetchJson(WALLET_ENDPOINT, {
      query: { include: "summary" },
    });
    if (Array.isArray(wallets) && wallets.length > 0) {
      return wallets[0];
    }
    return null;
  }

  async getWalletDetail(walletId, options = {}) {
    if (!walletId) return null;
    return this.fetchJson(`${WALLET_ENDPOINT}${walletId}/`, options);
  }

  async getTransactions(walletId, { transactionType, ordering, page, pageSize } = {}) {
    const query = {};
    if (walletId) {
      query.wallet = walletId;
    }
    if (transactionType && transactionType !== "all") {
      query.transaction_type = transactionType;
    }
    if (ordering) {
      query.ordering = ordering;
    }
    if (page) {
      query.page = page;
    }
    if (pageSize) {
      query.page_size = pageSize;
    }

    const response = await this.fetchJson(TRANSACTIONS_ENDPOINT, { query });
    if (response && typeof response === "object" && Array.isArray(response.results)) {
      return response;
    }
    return { results: Array.isArray(response) ? response : [], count: Array.isArray(response) ? response.length : 0 };
  }

  async createTransaction(transactionType, { amount, description } = {}) {
    if (!transactionType) {
      throw new Error("TRANSACTION_TYPE_REQUIRED");
    }
    const payload = {};
    let endpoint = TRANSACTIONS_ENDPOINT;

    if (transactionType === "deposit") {
      endpoint = DEPOSIT_ENDPOINT;
    } else if (transactionType === "withdrawal") {
      endpoint = WITHDRAW_ENDPOINT;
    } else {
      payload.transaction_type = transactionType;
    }

    if (amount !== undefined) {
      payload.amount = amount;
    }

    if (description && endpoint === TRANSACTIONS_ENDPOINT) {
      payload.description = description;
    }

    return this.fetchJson(endpoint, {
      method: "POST",
      body: payload,
    });
  }
}

export default WalletService;
