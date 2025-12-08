import { DataCollector } from "../module/DataCollector";
import { ContextCompressor } from "../module/ContextCompressor";
import { FeatureBuilder } from "../module/FeatureBuilder";
import { PortfolioAggregator } from "../module/PortfolioAggregator";
import { RiskValidator } from "../module/RiskValidator";
import { AIDecisionEngine } from "./AIDecisionEngine";
import { OrderExecutor } from "../controller/OrderExecutor";
import { DatabaseRepository } from "../infrastructure/database/DatabaseRepository";
import { SettingsRepository } from "../infrastructure/database/SettingsRepository";
import { DEFAULT_CONSTRAINTS, AIInput } from "../model/AI";
import { Portfolio, Market } from "../model/Trading";
import { logger } from "../util/logger";
import { formatKRW } from "../util/formatters";

/**
 * Batch Orchestrator Agent
 * Coordinates the entire trading batch process
 */
export class BatchOrchestrator {
  private dataCollector: DataCollector;
  private contextCompressor: ContextCompressor;
  private featureBuilder: FeatureBuilder;
  private portfolioAggregator: PortfolioAggregator;
  private riskValidator: RiskValidator;
  private aiEngine: AIDecisionEngine;
  private orderExecutor: OrderExecutor;
  private db: DatabaseRepository;
  private settingsRepo: SettingsRepository;

  constructor() {
    this.dataCollector = new DataCollector();
    this.contextCompressor = new ContextCompressor(this.dataCollector);
    this.featureBuilder = new FeatureBuilder();
    this.portfolioAggregator = new PortfolioAggregator();
    this.riskValidator = new RiskValidator(DEFAULT_CONSTRAINTS);
    this.aiEngine = new AIDecisionEngine();
    this.orderExecutor = new OrderExecutor();
    this.db = new DatabaseRepository();
    this.settingsRepo = new SettingsRepository();
  }

  /**
   * Run a complete batch cycle for a specific market
   */
  async runBatch(
    market: Market
  ): Promise<{ runId: string; status: "success" | "failed" | "partial" }> {
    const mode = (process.env.MODE as "live" | "paper" | "backtest") || "paper";
    let runId = "";
    let status: "success" | "failed" | "partial" = "failed";

    try {
      // Load market-specific settings
      const marketSettings = await this.settingsRepo.getMarketBatchSettings(
        market
      );
      const riskSettings = await this.settingsRepo.getMarketRiskSettings(
        market
      );

      if (!marketSettings.enabled) {
        logger.warn(`Market ${market} is disabled, skipping batch`, { market });
        throw new Error(`Market ${market} is disabled`);
      }

      logger.info("Starting batch run", {
        market,
        mode,
        max_stocks: marketSettings.max_stocks,
      });

      // Inform about mode
      if (mode === "paper") {
        logger.info(
          "📝 PAPER MODE: Using virtual account (모의투자) - Real API calls to KIS virtual trading server",
          {
            mode,
            note: "Orders will be executed in virtual account, not real account",
          }
        );
      } else if (mode === "live") {
        logger.warn(
          "🔴 LIVE MODE: Real trades will be executed with real money!",
          {
            mode,
            warning: "This will use real money from your account",
          }
        );
      }

      // Load watchlist for this market
      const watchlist = await this.settingsRepo.getWatchlist(market);
      const enabledWatchlist = watchlist.filter((w: any) => w.enabled);

      if (enabledWatchlist.length > 0) {
        logger.info(
          `📋 Using watchlist with ${enabledWatchlist.length} stocks`,
          {
            market,
            tickers: enabledWatchlist.map((w: any) => w.ticker),
          }
        );
      } else {
        logger.info(
          `📊 Watchlist empty, will scan top ${marketSettings.max_stocks} stocks`,
          { market }
        );
      }

      // Step 1: Create run record with market
      runId = await this.db.createRun(mode, market);
      logger.info("Created run", { runId, market });

      // Step 2: Collect account and market data
      logger.info("📊 Step 1/6: Collecting data...");
      const accountBalance = await this.dataCollector.collectAccountData();
      const indexInfo = await this.dataCollector.collectIndexInfo();
      const globalIndices = await this.dataCollector.collectGlobalIndices();
      const sentiment = await this.dataCollector.collectSentiment();
      const exchangeRates = await this.dataCollector.collectExchangeRates();

      // Merge global indices into indexInfo
      Object.assign(indexInfo, globalIndices);

      // Collect breaking news for overseas markets
      let breakingNews: any[] = [];
      if (market === Market.US) {
        breakingNews = await this.dataCollector.collectBreakingNews(20);
        logger.info("Breaking news collected", {
          total: breakingNews.length,
          sample: breakingNews.slice(0, 3).map((n) => n.title),
        });
      }

      // Build portfolio
      const portfolio: Portfolio = {
        total_equity: accountBalance.total_equity,
        cash: accountBalance.cash,
        positions: accountBalance.positions,
        total_market_value: accountBalance.securities_value,
        cash_weight: accountBalance.cash / accountBalance.total_equity,
      };

      // Enrich portfolio with market/currency allocation
      const enrichedPositions = this.portfolioAggregator.enrichPositions(
        portfolio.positions
      );
      portfolio.positions = enrichedPositions;
      portfolio.by_market =
        this.portfolioAggregator.calculateByMarket(enrichedPositions);
      portfolio.by_currency = this.portfolioAggregator.calculateByCurrency(
        enrichedPositions,
        exchangeRates
      );

      logger.info("Portfolio loaded", {
        equity: formatKRW(portfolio.total_equity),
        cash: formatKRW(portfolio.cash),
        positions: portfolio.positions.length,
      });

      // Save portfolio snapshot
      await this.db.savePortfolioSnapshot(runId, portfolio);

      // Step 3: Collect stock universe and compress
      logger.info("🔍 Step 2/6: Analyzing market...");

      // Get stock universe based on watchlist
      let universe: string[];
      if (enabledWatchlist.length > 0) {
        // Use watchlist tickers
        universe = enabledWatchlist.map((w: any) => w.ticker);
      } else {
        // Collect top stocks by volume
        const topTickers = await this.dataCollector.collectTopStocksByVolume(
          100
        );
        const heldTickers = portfolio.positions.map((p) => p.ticker);
        universe = this.contextCompressor.filterStockUniverse(
          topTickers,
          heldTickers,
          marketSettings.max_stocks
        );
      }

      logger.info("🔄 Starting feature generation", {
        universe_size: universe.length,
        universe_sample: universe.slice(0, 5),
      });

      // Collect detailed prices (OHLC)
      const priceData = await this.dataCollector.collectDetailedPrices(
        universe,
        market
      );

      // Collect historical data
      const historyData = new Map();
      for (const ticker of universe) {
        const history = await this.dataCollector.getStockHistory(
          ticker,
          30,
          market
        );
        historyData.set(ticker, history);
      }

      // Collect sector info
      const sectorData = await this.dataCollector.collectSectorInfo(
        universe,
        market
      );

      // Collect supply/demand data (domestic only)
      const supplyData = await this.dataCollector.collectSupplyDemand(
        universe,
        market
      );

      // Build stock features
      const stockFeatures = this.featureBuilder.buildStockFeatures(
        universe,
        priceData,
        historyData,
        sectorData,
        supplyData
      );

      logger.info("✅ Feature generation complete", {
        input_tickers: universe.length,
        output_features: stockFeatures.length,
        success_rate: `${(
          (stockFeatures.length / universe.length) *
          100
        ).toFixed(1)}%`,
      });

      // Create compressed market for database compatibility
      const compressedMarket = {
        index: indexInfo,
        sentiment,
        universe_features: stockFeatures,
        breaking_news: breakingNews.length > 0 ? breakingNews : undefined,
      };

      // Save market snapshot
      await this.db.saveMarketSnapshot(runId, compressedMarket);

      // Save portfolio snapshot
      await this.db.savePortfolioSnapshot(runId, portfolio);

      // Step 4: Get AI decisions
      logger.info("🤖 Step 3/6: Getting AI decisions...");
      const aiInput: AIInput = {
        portfolio,
        market: {
          index: indexInfo,
          sentiment,
          exchange_rates: exchangeRates,
          breaking_news: compressedMarket.breaking_news,
        },
        stocks: compressedMarket.universe_features,
        constraints: DEFAULT_CONSTRAINTS,
      };

      logger.info("🔍 AI Input prepared", {
        provider: this.aiEngine.getProviderType(),
        stocks_to_analyze: aiInput.stocks.length,
        breaking_news_count: aiInput.market.breaking_news?.length || 0,
        portfolio_cash_pct: (portfolio.cash_weight * 100).toFixed(1) + "%",
        portfolio_positions: portfolio.positions.length,
        current_holdings: portfolio.positions.map((p) => ({
          ticker: p.ticker,
          name: p.name,
          quantity: p.quantity,
          avg_price: p.avg_price,
          current_price: p.current_price,
          pnl_pct: (p.unrealized_pnl_pct * 100).toFixed(2) + "%",
          weight: (p.weight * 100).toFixed(1) + "%",
        })),
        stocks_sample: aiInput.stocks.slice(0, 3).map((s) => ({
          ticker: s.ticker,
          price: s.price,
          return: (s.intraday_return * 100).toFixed(2) + "%",
        })),
      });

      if (aiInput.stocks.length === 0) {
        logger.warn(
          "⚠️ No stocks to analyze! AI will likely make no decisions."
        );
      }

      const aiOutput = await this.aiEngine.getDecisions(aiInput);

      logger.info("🤖 AI decisions received", {
        total_decisions: aiOutput.decisions.length,
        market_view: aiOutput.market_view.substring(0, 100) + "...",
        risk_level: aiOutput.risk_level,
        missing_data: aiOutput.missing_data || [],
        decisions_breakdown: {
          BUY: aiOutput.decisions.filter((d) => d.action === "BUY").length,
          SELL: aiOutput.decisions.filter((d) => d.action === "SELL").length,
          HOLD: aiOutput.decisions.filter((d) => d.action === "HOLD").length,
        },
      });

      if (aiOutput.missing_data && aiOutput.missing_data.length > 0) {
        logger.warn("⚠️ AI requested additional data for better decisions", {
          missing_data: aiOutput.missing_data,
          note: "Consider enhancing data collection to include these data points",
        });
      }

      if (aiOutput.decisions.length === 0) {
        logger.warn("⚠️ AI made zero decisions", {
          possible_reasons: [
            "No stocks provided to analyze",
            "Market conditions not favorable",
            "Risk constraints too tight",
            "AI chose to stay in cash",
          ],
        });
      }

      // Save decisions
      if (aiOutput.decisions.length > 0) {
        await this.db.saveDecisions(runId, aiOutput.decisions);
        logger.info("💾 Saved decisions to database", {
          count: aiOutput.decisions.length,
        });
      } else {
        logger.info("💾 No decisions to save (AI chose not to trade)");
      }

      // Step 5: Validate decisions
      logger.info("✅ Step 4/6: Validating decisions...");
      const validatedDecisions = this.riskValidator.validateDecisions(
        aiOutput.decisions,
        portfolio
      );

      logger.info("Decisions validated", {
        input: aiOutput.decisions.length,
        output: validatedDecisions.length,
        filtered: aiOutput.decisions.length - validatedDecisions.length,
      });

      // Step 6: Execute orders
      logger.info("💰 Step 5/6: Executing orders...");
      const orderResults = await this.orderExecutor.executeDecisions(
        runId,
        validatedDecisions,
        market
      );

      const successCount = orderResults.filter(
        (r) => r.status === "filled"
      ).length;
      const failCount = orderResults.filter(
        (r) => r.status === "failed"
      ).length;

      logger.info("Orders executed", {
        total: orderResults.length,
        success: successCount,
        failed: failCount,
      });

      // Step 7: Finalize
      logger.info("📝 Step 6/6: Finalizing...");

      // Determine final status based on order execution results
      // Only mark as success if there are orders and all succeeded
      if (orderResults.length === 0) {
        // No orders to execute (AI made no decisions or all were HOLD)
        status = "success";
      } else if (failCount === 0 && successCount > 0) {
        // All orders succeeded
        status = "success";
      } else if (successCount > 0) {
        // Some succeeded, some failed
        status = "partial";
      } else {
        // All orders failed
        status = "failed";
      }

      const summary = `Completed with ${successCount} successful orders, ${failCount} failed. Market: ${aiOutput.market_view}`;

      await this.db.updateRunStatus(runId, status, summary);

      logger.info("✅ Batch execution completed", { run_id: runId, status });

      return { runId, status };
    } catch (error) {
      logger.error("❌ Batch execution failed", { run_id: runId, error });

      if (runId) {
        await this.db.updateRunStatus(
          runId,
          "failed",
          undefined,
          error instanceof Error ? error.message : String(error)
        );
      }

      return { runId, status: "failed" };
    }
  }

  /**
   * Get batch run status
   */
  async getRunStatus(runId: string): Promise<any> {
    const run = await this.db.getRun(runId);
    const decisions = await this.db.getDecisions(runId);

    return {
      run,
      decision_count: decisions.length,
      decisions: decisions.slice(0, 10), // First 10 for preview
    };
  }

  /**
   * Get performance analytics
   */
  async getAnalytics(): Promise<any> {
    const [pnlTrend, orderStats] = await Promise.all([
      this.db.getDailyPnLTrend(30),
      this.db.getOrderStats(),
    ]);

    return {
      pnl_trend: pnlTrend,
      order_stats: orderStats,
    };
  }
}
