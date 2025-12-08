import axios from "axios";
import type {
  MarketBatchSettings,
  MarketRiskSettings,
  Decision,
} from "@auto-finance/shared";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8888";

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 600000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export interface Position {
  ticker: string;
  name: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  weight: number;
}

export interface DashboardOverview {
  today_runs: number;
  today_orders: number;
  success_rate_30d: number;
  latest_run: {
    started_at: string;
    status: string;
  } | null;
  account?: {
    total_equity: number;
    cash: number;
    investment_amount: number;
    initial_equity: number;
    total_return: number;
    return_rate: number;
  };
  positions?: Position[];
  pnl_trend?: Array<{
    created_at: string;
    total_equity: number;
    daily_pnl: number;
    total_pnl: number;
  }>;
  fear_greed_index?: number; // Fear & Greed Index (0-100)
}

export interface Order {
  id: string;
  run_id?: string;
  ticker: string;
  name?: string;
  direction: "buy" | "sell";
  order_type?: string;
  requested_qty: number;
  requested_price?: number;
  filled_qty: number;
  avg_filled_price?: number;
  status:
    | "pending"
    | "filled"
    | "failed"
    | "cancelled"
    | "requested"
    | "partial_filled"
    | "canceled";
  broker_order_id?: string;
  error_code?: string;
  error_message?: string;
  created_at: string;
  updated_at?: string;
  runs: { started_at: string; status: string; market: string };
}

export interface DecisionResponse extends Decision {
  id: string;
  name?: string; // Stock name (e.g., "Apple", "삼성전자")
  created_at: string;
  runs: { started_at: string; status: string; market?: string };
}

// ===================
// Market Settings
// ===================

export const marketSettingsApi = {
  getAllBatchSettings: async (): Promise<MarketBatchSettings[]> => {
    const res = await apiClient.get("/api/settings/markets");
    return res.data.data;
  },

  getBatchSettings: async (market: string): Promise<MarketBatchSettings> => {
    const res = await apiClient.get(`/api/settings/markets/${market}/batch`);
    return res.data.data;
  },

  updateBatchSettings: async (
    market: string,
    settings: Partial<MarketBatchSettings>
  ): Promise<MarketBatchSettings> => {
    const res = await apiClient.put(
      `/api/settings/markets/${market}/batch`,
      settings
    );
    return res.data.data;
  },

  getRiskSettings: async (market: string): Promise<MarketRiskSettings> => {
    const res = await apiClient.get(`/api/settings/markets/${market}/risk`);
    return res.data.data;
  },

  updateRiskSettings: async (
    market: string,
    settings: Partial<MarketRiskSettings>
  ): Promise<MarketRiskSettings> => {
    const res = await apiClient.put(
      `/api/settings/markets/${market}/risk`,
      settings
    );
    return res.data.data;
  },
};

// ===================
// Batch Operations
// ===================

export const batchApi = {
  runBatch: async (
    market: string
  ): Promise<{ run_id: string; status: string }> => {
    // Use longer timeout for batch operations (60 seconds)
    const res = await apiClient.post(
      `/api/batch/run/${market}`,
      {},
      {
        timeout: 60000, // 60 seconds
      }
    );
    return res.data;
  },

  getStatus: async (
    runId: string
  ): Promise<{
    run: { id: string; status: string; started_at: string; market?: string };
    decision_count: number;
    decisions: DecisionResponse[];
  }> => {
    const res = await apiClient.get(`/api/batch/status/${runId}`);
    return res.data;
  },

  getMarketStatus: async (): Promise<{
    currentTime: string;
    markets: Array<{
      market: string;
      isOpen: boolean;
      tradingHours: string;
      currentTime: string;
    }>;
  }> => {
    const res = await apiClient.get("/api/batch/market-status");
    return res.data.data;
  },
};

// ===================
// Dashboard Data
// ===================

export const dashboardApi = {
  getOverview: async (): Promise<DashboardOverview> => {
    const res = await apiClient.get("/api/dashboard/overview");
    return res.data.data;
  },

  getRecentDecisions: async (
    limit: number = 50
  ): Promise<DecisionResponse[]> => {
    const res = await apiClient.get(
      `/api/dashboard/recent-decisions?limit=${limit}`
    );
    return res.data.data;
  },

  getRecentOrders: async (limit: number = 100): Promise<Order[]> => {
    const res = await apiClient.get(
      `/api/dashboard/recent-orders?limit=${limit}`
    );
    return res.data.data;
  },
};

// ===================
// Watchlist
// ===================

export interface WatchlistItem {
  id: string;
  market: string;
  ticker: string;
  name: string;
  enabled: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  detailed_data?: {
    current_price: number;
    prev_close: number;
    open: number;
    high: number;
    low: number;
    intraday_return: number;
    from_prev_close_return: number;
    today_volume: number;
    average_volume_30d: number;
    volume_ratio: number;
    volatility_20d: number;
    atr_14d: number;
    ema5: number;
    ema20: number;
    ema5_position: number;
    ema20_position: number;
    history_length: number;
  } | null;
}

export const watchlistApi = {
  getAll: async (): Promise<WatchlistItem[]> => {
    const res = await apiClient.get("/api/watchlist");
    return res.data.data;
  },

  getByMarket: async (market: string): Promise<WatchlistItem[]> => {
    const res = await apiClient.get(`/api/watchlist/${market}`);
    return res.data.data;
  },

  getDetailedByMarket: async (market: string): Promise<WatchlistItem[]> => {
    const res = await apiClient.get(`/api/watchlist/${market}/detailed`);
    return res.data.data;
  },

  add: async (item: {
    market: string;
    ticker: string;
    name: string;
    notes?: string;
  }): Promise<WatchlistItem> => {
    const res = await apiClient.post("/api/watchlist", item);
    return res.data.data;
  },

  update: async (
    id: string,
    updates: { name?: string; enabled?: boolean; notes?: string }
  ): Promise<WatchlistItem> => {
    const res = await apiClient.put(`/api/watchlist/${id}`, updates);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/watchlist/${id}`);
  },

  toggle: async (id: string, enabled: boolean): Promise<WatchlistItem> => {
    const res = await apiClient.patch(`/api/watchlist/${id}/toggle`, {
      enabled,
    });
    return res.data.data;
  },
};

// ===================
// Stock Search
// ===================

export interface StockSearchResult {
  ticker: string;
  name: string;
  nameEn?: string;
  market: string;
  price?: number;
  change_pct?: number;
  volume?: number;
}

export const stocksApi = {
  search: async (
    query: string,
    market: string = "DOMESTIC"
  ): Promise<StockSearchResult[]> => {
    const res = await apiClient.get("/api/stocks/search", {
      params: { query, market },
    });
    return res.data.data;
  },

  getPopular: async (
    market: string = "DOMESTIC",
    limit: number = 30
  ): Promise<StockSearchResult[]> => {
    const res = await apiClient.get("/api/stocks/popular", {
      params: { market, limit },
    });
    return res.data.data;
  },

  getDetail: async (
    ticker: string,
    market: string = "DOMESTIC"
  ): Promise<StockSearchResult> => {
    const res = await apiClient.get(`/api/stocks/${ticker}`, {
      params: { market },
    });
    return res.data.data;
  },

  getHistory: async (
    ticker: string,
    market: string = "DOMESTIC",
    days: number = 30
  ): Promise<{ close: number; volume: number }[]> => {
    const res = await apiClient.get(`/api/stocks/${ticker}/history`, {
      params: { market, days },
    });
    return res.data.data;
  },
};

export default apiClient;
