import { getSupabaseClient } from "./SupabaseClient";
import { logger } from "../../util/logger";
import { DatabaseError } from "../../util/errors";
import {
  MarketBatchSettings,
  MarketRiskSettings,
} from "../../model/MarketSettings";
import { Market } from "../../model/Trading";

/**
 * Settings stored in database
 */
export interface BatchSettings {
  id?: string;
  enabled: boolean;
  mode: "paper" | "live" | "backtest";
  schedule_times: string[]; // ["09:05", "10:30", ...]
  supported_markets: string[]; // ["DOMESTIC", "US", ...]
  created_at?: Date;
  updated_at?: Date;
}

export interface RiskSettings {
  id?: string;
  max_position_weight_domestic: number;
  max_position_weight_overseas: number;
  max_total_investment: number;
  max_overseas_total: number;
  min_cash_reserve: number;
  stop_loss_pct: number;
  take_profit_pct: number;
  min_confidence: number;
  max_trades_per_batch: number;
  min_order_amount: number;
  currency_limits: Record<string, number>;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Repository for settings management
 */
export class SettingsRepository {
  private db = getSupabaseClient();

  /**
   * Get batch settings
   */
  async getBatchSettings(): Promise<BatchSettings> {
    try {
      const { data, error } = await this.db
        .from("batch_settings")
        .select("*")
        .limit(1)
        .single();

      if (error) throw error;

      return data as BatchSettings;
    } catch (error) {
      logger.error("Failed to get batch settings", { error });
      throw new DatabaseError("Failed to get batch settings", undefined, error);
    }
  }

  /**
   * Update batch settings
   */
  async updateBatchSettings(
    settings: Partial<BatchSettings>
  ): Promise<BatchSettings> {
    try {
      // Get current settings first
      const current = await this.getBatchSettings();

      const { data, error } = await this.db
        .from("batch_settings")
        .update(settings)
        .eq("id", current.id!)
        .select()
        .single();

      if (error) throw error;

      logger.info("Batch settings updated", { settings });

      return data as BatchSettings;
    } catch (error) {
      logger.error("Failed to update batch settings", { error });
      throw new DatabaseError(
        "Failed to update batch settings",
        undefined,
        error
      );
    }
  }

  /**
   * Get risk settings
   */
  async getRiskSettings(): Promise<RiskSettings> {
    try {
      const { data, error } = await this.db
        .from("risk_settings")
        .select("*")
        .limit(1)
        .single();

      if (error) throw error;

      return data as RiskSettings;
    } catch (error) {
      logger.error("Failed to get risk settings", { error });
      throw new DatabaseError("Failed to get risk settings", undefined, error);
    }
  }

  /**
   * Update risk settings
   */
  async updateRiskSettings(
    settings: Partial<RiskSettings>
  ): Promise<RiskSettings> {
    try {
      // Get current settings first
      const current = await this.getRiskSettings();

      const { data, error } = await this.db
        .from("risk_settings")
        .update(settings)
        .eq("id", current.id!)
        .select()
        .single();

      if (error) throw error;

      logger.info("Risk settings updated", { settings });

      return data as RiskSettings;
    } catch (error) {
      logger.error("Failed to update risk settings", { error });
      throw new DatabaseError(
        "Failed to update risk settings",
        undefined,
        error
      );
    }
  }

  /**
   * Get dashboard overview data
   */
  async getDashboardOverview(): Promise<any> {
    try {
      // Get latest run
      const { data: latestRun } = await this.db
        .from("runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      // Get count of runs today
      const today = new Date().toISOString().split("T")[0];
      const { count: todayRunsCount } = await this.db
        .from("runs")
        .select("*", { count: "exact", head: true })
        .gte("started_at", `${today}T00:00:00`)
        .lte("started_at", `${today}T23:59:59`);

      // Get success rate (last 30 days)
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      const { data: recentRuns } = await this.db
        .from("runs")
        .select("status")
        .gte("started_at", thirtyDaysAgo);

      const totalRuns = recentRuns?.length || 0;
      const successRuns =
        recentRuns?.filter((r) => r.status === "success").length || 0;
      const successRate = totalRuns > 0 ? successRuns / totalRuns : 0;

      // Get total orders today
      const { count: todayOrdersCount } = await this.db
        .from("orders")
        .select("*", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

      // Get latest portfolio snapshot for account info
      // Use maybeSingle() to handle case when no data exists
      const { data: latestPortfolio } = await this.db
        .from("portfolio_snapshots")
        .select("total_equity, cash, positions, total_pnl, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get first portfolio snapshot (initial investment)
      const { data: firstPortfolio } = await this.db
        .from("portfolio_snapshots")
        .select("total_equity, created_at")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      // If no portfolio snapshot exists, try to get real-time account data
      let currentEquity = latestPortfolio?.total_equity || 0;
      let cash = latestPortfolio?.cash || 0;
      let positions = latestPortfolio?.positions || [];

      // If no snapshot data, fetch real-time account balance
      if (!latestPortfolio || currentEquity === 0) {
        try {
          const { DataCollector } = await import("../../module/DataCollector");
          const dataCollector = new DataCollector();
          const accountData = await dataCollector.collectAccountData();
          currentEquity = accountData.total_equity;
          cash = accountData.cash;
          positions = accountData.positions;
          logger.info("Fetched real-time account data for dashboard", {
            total_equity: currentEquity,
            cash: cash,
            positions_count: positions.length,
          });
        } catch (error) {
          logger.warn(
            "Failed to fetch real-time account data, using snapshot data",
            { error }
          );
        }
      }

      // Calculate investment amount and return
      const investmentAmount = currentEquity - cash; // 투자 금액 = 총 자산 - 현금
      const initialEquity = firstPortfolio?.total_equity || currentEquity;
      const totalReturn = currentEquity - initialEquity;
      const returnRate =
        initialEquity > 0 ? (totalReturn / initialEquity) * 100 : 0;

      // Get PnL trend for last 30 days
      const { data: pnlTrend } = await this.db
        .from("portfolio_snapshots")
        .select("created_at, total_equity, daily_pnl, total_pnl")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: true });

      // Get latest market snapshot for fear & greed index
      const { data: latestMarketSnapshot } = await this.db
        .from("market_snapshots")
        .select("sentiment, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let fearGreedIndex: number | undefined;
      if (latestMarketSnapshot?.sentiment) {
        const sentiment = latestMarketSnapshot.sentiment as any;
        fearGreedIndex = sentiment.fear_greed_index;
        logger.info("Fear & Greed index from snapshot", {
          index: fearGreedIndex,
          snapshot_date: latestMarketSnapshot.created_at,
        });
      } else {
        logger.debug("No market snapshot found for fear & greed index");
      }

      // If no snapshot data, try to fetch real-time sentiment
      if (fearGreedIndex === undefined) {
        try {
          logger.info("Fetching real-time fear & greed index for dashboard");
          const { DataCollector } = await import("../../module/DataCollector");
          const dataCollector = new DataCollector();
          const sentiment = await dataCollector.collectSentiment();
          fearGreedIndex = sentiment.fear_greed_index;
          logger.info("Fear & Greed index from real-time", {
            index: fearGreedIndex,
          });
        } catch (error) {
          logger.warn(
            "Failed to fetch real-time sentiment data for dashboard",
            { error }
          );
        }
      }

      return {
        latest_run: latestRun,
        today_runs: todayRunsCount || 0,
        today_orders: todayOrdersCount || 0,
        success_rate_30d: successRate,
        account: {
          total_equity: currentEquity,
          cash: cash,
          investment_amount: investmentAmount,
          initial_equity: initialEquity,
          total_return: totalReturn,
          return_rate: returnRate,
        },
        positions: positions || [],
        pnl_trend: pnlTrend || [],
        fear_greed_index: fearGreedIndex,
      };
    } catch (error) {
      logger.error("Failed to get dashboard overview", { error });
      throw new DatabaseError(
        "Failed to get dashboard overview",
        undefined,
        error
      );
    }
  }

  /**
   * Get recent decisions
   */
  async getRecentDecisions(limit: number = 20): Promise<any[]> {
    try {
      const { data, error } = await this.db
        .from("decisions")
        .select("*, runs(started_at, status)")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error("Failed to get recent decisions", { error });
      throw new DatabaseError(
        "Failed to get recent decisions",
        undefined,
        error
      );
    }
  }

  // ========================================
  // WATCHLIST
  // ========================================

  async getWatchlist(market?: string): Promise<any[]> {
    try {
      let query = this.db
        .from("watchlist")
        .select("*")
        .order("created_at", { ascending: false });

      if (market) {
        query = query.eq("market", market);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error("Failed to get watchlist", { market, error });
      throw new DatabaseError("Failed to get watchlist", undefined, error);
    }
  }

  async addWatchlistItem(item: {
    market: string;
    ticker: string;
    name: string;
    notes?: string;
  }): Promise<any> {
    try {
      const { data, error } = await this.db
        .from("watchlist")
        .insert({
          market: item.market,
          ticker: item.ticker,
          name: item.name,
          notes: item.notes,
        })
        .select()
        .single();

      if (error) throw error;

      logger.info("Added watchlist item", {
        ticker: item.ticker,
        market: item.market,
      });

      return data;
    } catch (error) {
      logger.error("Failed to add watchlist item", { item, error });
      throw new DatabaseError("Failed to add watchlist item", undefined, error);
    }
  }

  async updateWatchlistItem(
    id: string,
    updates: { name?: string; enabled?: boolean; notes?: string }
  ): Promise<any> {
    try {
      const { data, error } = await this.db
        .from("watchlist")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      logger.info("Updated watchlist item", { id, updates });

      return data;
    } catch (error) {
      logger.error("Failed to update watchlist item", { id, error });
      throw new DatabaseError(
        "Failed to update watchlist item",
        undefined,
        error
      );
    }
  }

  async deleteWatchlistItem(id: string): Promise<void> {
    try {
      const { error } = await this.db.from("watchlist").delete().eq("id", id);

      if (error) throw error;

      logger.info("Deleted watchlist item", { id });
    } catch (error) {
      logger.error("Failed to delete watchlist item", { id, error });
      throw new DatabaseError(
        "Failed to delete watchlist item",
        undefined,
        error
      );
    }
  }

  async toggleWatchlistItem(id: string, enabled: boolean): Promise<any> {
    try {
      const { data, error } = await this.db
        .from("watchlist")
        .update({ enabled })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      logger.info("Toggled watchlist item", { id, enabled });

      return data;
    } catch (error) {
      logger.error("Failed to toggle watchlist item", { id, error });
      throw new DatabaseError(
        "Failed to toggle watchlist item",
        undefined,
        error
      );
    }
  }

  // ================== Market-Specific Settings ==================

  /**
   * Get all market batch settings
   */
  async getAllMarketBatchSettings(): Promise<MarketBatchSettings[]> {
    try {
      const { data, error } = await this.db
        .from("market_batch_settings")
        .select("*")
        .order("market");

      if (error) throw error;

      return (data || []) as MarketBatchSettings[];
    } catch (error) {
      logger.error("Failed to get all market batch settings", { error });
      throw new DatabaseError(
        "Failed to get all market batch settings",
        undefined,
        error
      );
    }
  }

  /**
   * Get batch settings for specific market
   */
  async getMarketBatchSettings(market: Market): Promise<MarketBatchSettings> {
    try {
      const { data, error } = await this.db
        .from("market_batch_settings")
        .select("*")
        .eq("market", market)
        .single();

      if (error) throw error;

      return data as MarketBatchSettings;
    } catch (error) {
      logger.error("Failed to get market batch settings", { market, error });
      throw new DatabaseError(
        `Failed to get ${market} batch settings`,
        undefined,
        error
      );
    }
  }

  /**
   * Update market batch settings
   */
  async updateMarketBatchSettings(
    market: Market,
    settings: Partial<MarketBatchSettings>
  ): Promise<MarketBatchSettings> {
    try {
      const { data, error } = await this.db
        .from("market_batch_settings")
        .update(settings)
        .eq("market", market)
        .select()
        .single();

      if (error) throw error;

      logger.info("Market batch settings updated", { market, settings });

      return data as MarketBatchSettings;
    } catch (error) {
      logger.error("Failed to update market batch settings", { market, error });
      throw new DatabaseError(
        `Failed to update ${market} batch settings`,
        undefined,
        error
      );
    }
  }

  /**
   * Get risk settings for specific market
   */
  async getMarketRiskSettings(market: Market): Promise<MarketRiskSettings> {
    try {
      const { data, error } = await this.db
        .from("market_risk_settings")
        .select("*")
        .eq("market", market)
        .single();

      if (error) throw error;

      return data as MarketRiskSettings;
    } catch (error) {
      logger.error("Failed to get market risk settings", { market, error });
      throw new DatabaseError(
        `Failed to get ${market} risk settings`,
        undefined,
        error
      );
    }
  }

  /**
   * Update market risk settings
   */
  async updateMarketRiskSettings(
    market: Market,
    settings: Partial<MarketRiskSettings>
  ): Promise<MarketRiskSettings> {
    try {
      const { data, error } = await this.db
        .from("market_risk_settings")
        .update(settings)
        .eq("market", market)
        .select()
        .single();

      if (error) throw error;

      logger.info("Market risk settings updated", { market, settings });

      return data as MarketRiskSettings;
    } catch (error) {
      logger.error("Failed to update market risk settings", { market, error });
      throw new DatabaseError(
        `Failed to update ${market} risk settings`,
        undefined,
        error
      );
    }
  }

  /**
   * Get enabled markets
   */
  async getEnabledMarkets(): Promise<MarketBatchSettings[]> {
    try {
      const { data, error } = await this.db
        .from("market_batch_settings")
        .select("*")
        .eq("enabled", true)
        .order("market");

      if (error) throw error;

      return (data || []) as MarketBatchSettings[];
    } catch (error) {
      logger.error("Failed to get enabled markets", { error });
      throw new DatabaseError(
        "Failed to get enabled markets",
        undefined,
        error
      );
    }
  }
}
