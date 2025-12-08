import { IAIProvider } from "../infrastructure/api/IAIProvider";
import { OpenAIFactory } from "../infrastructure/api/OpenAIFactory";
import { GeminiApiFactory } from "../infrastructure/api/GeminiApiFactory";
import { DeepSeekApiFactory } from "../infrastructure/api/DeepSeekApiFactory";
import { AIInput, AIOutput, Decision } from "../model/AI";
import { getSystemPrompt } from "./SystemPrompt";
import { logger } from "../util/logger";
import { AIError } from "../util/errors";
import { retryWithBackoff } from "../util/retry";

type AIProviderType = "openai" | "gemini" | "deepseek";

/**
 * AI Decision Engine
 * Uses AI providers (OpenAI GPT, Google Gemini, or DeepSeek) to make trading decisions
 */
export class AIDecisionEngine {
  private aiProvider: IAIProvider;
  private providerType: AIProviderType;

  constructor() {
    this.providerType = this.getProviderFromEnv();
    this.aiProvider = this.createProvider(this.providerType);

    logger.info(
      `AI Decision Engine initialized with ${this.providerType} provider`
    );
  }

  /**
   * Get AI provider type from environment
   */
  private getProviderFromEnv(): AIProviderType {
    const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();

    if (
      provider !== "openai" &&
      provider !== "gemini" &&
      provider !== "deepseek"
    ) {
      logger.warn(`Invalid AI_PROVIDER: ${provider}, defaulting to openai`);
      return "openai";
    }

    return provider as AIProviderType;
  }

  /**
   * Create AI provider instance based on type
   */
  private createProvider(type: AIProviderType): IAIProvider {
    switch (type) {
      case "openai":
        const openaiFactory = new OpenAIFactory();
        return openaiFactory.create();

      case "gemini":
        const geminiFactory = new GeminiApiFactory();
        return geminiFactory.create();

      case "deepseek":
        const deepseekFactory = new DeepSeekApiFactory();
        return deepseekFactory.create();

      default:
        throw new AIError(`Unknown AI provider type: ${type}`);
    }
  }

  /**
   * Get trading decisions from GPT-4o
   */
  async getDecisions(input: AIInput): Promise<AIOutput> {
    try {
      logger.info("Requesting AI decisions...", {
        stock_count: input.stocks.length,
        portfolio_equity: input.portfolio.total_equity,
      });

      const systemPrompt = getSystemPrompt();
      const userContext = this.formatInputContext(input);

      // Log detailed input data for debugging
      logger.info("📊 AI Input Data Summary", {
        portfolio: {
          total_equity: userContext.portfolio.total_equity,
          cash: userContext.portfolio.cash,
          cash_ratio: userContext.portfolio.cash_ratio,
          positions_count: userContext.portfolio.positions.length,
          positions: userContext.portfolio.positions.map((p: any) => ({
            ticker: p.ticker,
            name: p.name,
            quantity: p.quantity,
            market_value: p.market_value,
            weight: p.weight,
            pnl_pct: p.unrealized_pnl_pct,
          })),
        },
        market: {
          kospi: userContext.market.kospi,
          kosdaq: userContext.market.kosdaq,
          sentiment: {
            foreign_net_buy: userContext.market.sentiment.foreign_net_buy,
            institution_net_buy:
              userContext.market.sentiment.institution_net_buy,
            fear_greed_index: userContext.market.sentiment.fear_greed_index,
            vix: userContext.market.sentiment.vix,
          },
          exchange_rates: userContext.market.exchange_rates,
        },
        stocks: {
          count: userContext.stocks.length,
          sample: userContext.stocks.slice(0, 3).map((s: any) => ({
            ticker: s.ticker,
            name: s.name,
            price: s.price,
            intraday_return: s.intraday_return,
            intraday_return_pct: `${((s.intraday_return || 0) * 100).toFixed(
              2
            )}%`,
            volume_ratio: s.volume_ratio,
            today_volume: s.today_volume,
            average_volume_30d: s.average_volume_30d,
            has_volume_data: (s.today_volume || 0) > 0,
            volatility: s.volatility,
            ema5_position: s.ema5_position,
            ema20_position: s.ema20_position,
            history_7d_count: s.history_7d?.length || 0,
            history_30d_count: s.history_30d?.length || 0,
            history_7d_sample: s.history_7d?.slice(0, 3) || [],
            history_30d_sample: s.history_30d?.slice(0, 3) || [],
          })),
          stocks_with_history: userContext.stocks.filter(
            (s: any) => s.history_7d && s.history_7d.length > 0
          ).length,
          stocks_without_history: userContext.stocks.filter(
            (s: any) => !s.history_7d || s.history_7d.length === 0
          ).length,
          stocks_with_volume: userContext.stocks.filter(
            (s: any) => (s.today_volume || 0) > 0
          ).length,
          stocks_without_volume: userContext.stocks.filter(
            (s: any) => !s.today_volume || s.today_volume === 0
          ).length,
        },
        constraints: userContext.constraints,
      });

      // Log detailed stock data including history and metrics
      logger.info("📊 AI Input - Stock Data Details", {
        total_stocks: userContext.stocks.length,
        stocks_detail: userContext.stocks.map((s: any) => ({
          ticker: s.ticker,
          name: s.name,
          price: s.price,
          intraday_return: s.intraday_return,
          intraday_return_pct: `${((s.intraday_return || 0) * 100).toFixed(
            2
          )}%`,
          volume_ratio: s.volume_ratio,
          today_volume: s.today_volume,
          average_volume_30d: s.average_volume_30d,
          has_volume_data: (s.today_volume || 0) > 0,
          has_intraday_data:
            s.intraday_return !== undefined && s.intraday_return !== null,
          history_7d_length: s.history_7d?.length || 0,
          history_30d_length: s.history_30d?.length || 0,
          history_7d_first: s.history_7d?.[0],
          history_7d_last: s.history_7d?.[s.history_7d?.length - 1],
          history_30d_first: s.history_30d?.[0],
          history_30d_last: s.history_30d?.[s.history_30d?.length - 1],
        })),
        summary: {
          stocks_with_history: userContext.stocks.filter(
            (s: any) => s.history_7d && s.history_7d.length > 0
          ).length,
          stocks_without_history: userContext.stocks.filter(
            (s: any) => !s.history_7d || s.history_7d.length === 0
          ).length,
          stocks_with_volume: userContext.stocks.filter(
            (s: any) => (s.today_volume || 0) > 0
          ).length,
          stocks_without_volume: userContext.stocks.filter(
            (s: any) => !s.today_volume || s.today_volume === 0
          ).length,
          stocks_with_intraday: userContext.stocks.filter(
            (s: any) =>
              s.intraday_return !== undefined &&
              s.intraday_return !== null &&
              s.intraday_return !== 0
          ).length,
        },
      });

      // Log input size
      const inputSize = JSON.stringify(userContext).length;
      logger.info("📊 AI Input Size", {
        total_size_bytes: inputSize,
        total_size_kb: (inputSize / 1024).toFixed(2),
        breaking_news_count: userContext.market?.breaking_news?.length || 0,
        breaking_news_size_kb: userContext.market?.breaking_news
          ? (
              JSON.stringify(userContext.market.breaking_news).length / 1024
            ).toFixed(2)
          : 0,
        stocks_count: userContext.stocks?.length || 0,
      });

      logger.debug("AI decision full input payload", { ai_input: userContext });

      // Call AI provider with retry logic
      const responseText = await retryWithBackoff(
        () => this.aiProvider.getTradingDecision(systemPrompt, userContext),
        3,
        2000
      );

      // Parse JSON response
      const output = this.parseAIResponse(responseText);

      logger.info("🤖 AI Decisions Received", {
        total_decisions: output.decisions.length,
        market_view: output.market_view,
        risk_level: output.risk_level,
        missing_data: output.missing_data || [],
        decisions_breakdown: {
          BUY: output.decisions.filter((d) => d.action === "BUY").length,
          SELL: output.decisions.filter((d) => d.action === "SELL").length,
          HOLD: output.decisions.filter((d) => d.action === "HOLD").length,
        },
        position_summary: output.position_summary,
        risk_check: output.risk_check,
        decisions: output.decisions.map((d) => ({
          ticker: d.ticker,
          name: d.name,
          action: d.action,
          confidence: d.confidence,
          reason: d.reason,
        })),
      });

      if (output.missing_data && output.missing_data.length > 0) {
        logger.warn("⚠️ AI requested additional data", {
          missing_data: output.missing_data,
          note: "Consider adding these data points to improve decision quality",
        });
      }

      if (output.risk_check && output.risk_check.warnings.length > 0) {
        logger.warn("⚠️ AI identified risk concerns", {
          warnings: output.risk_check.warnings,
          constraints_satisfied: output.risk_check.constraints_satisfied,
          cash_ratio_after_trades: `${(
            output.risk_check.cash_ratio_after_trades * 100
          ).toFixed(1)}%`,
        });
      }

      logger.debug("AI decision full output payload", { ai_output: output });

      // Validate output
      this.validateOutput(output);

      return output;
    } catch (error) {
      logger.error("AI decision engine failed", { error });
      throw new AIError("Failed to get AI decisions", undefined, error);
    }
  }

  /**
   * Format input context for GPT
   */
  private formatInputContext(input: AIInput): any {
    // Calculate market and currency exposure
    const byMarket: Record<string, number> = {
      KR: 0,
      US: 0,
      HK: 0,
      JP: 0,
      CN: 0,
    };
    const byCurrency: Record<string, number> = {
      KRW: 0,
      USD: 0,
      HKD: 0,
      JPY: 0,
      CNY: 0,
    };

    const totalEquity = input.portfolio.total_equity;
    for (const position of input.portfolio.positions) {
      const weight = position.market_value / totalEquity;

      // Market exposure
      if (position.market) {
        const marketKey =
          position.market === "DOMESTIC"
            ? "KR"
            : position.market === "US"
            ? "US"
            : position.market === "HK"
            ? "HK"
            : position.market === "JP"
            ? "JP"
            : position.market === "CN"
            ? "CN"
            : "KR";
        byMarket[marketKey] = (byMarket[marketKey] || 0) + weight;
      } else {
        byMarket["KR"] = (byMarket["KR"] || 0) + weight;
      }

      // Currency exposure
      if (position.currency) {
        byCurrency[position.currency] =
          (byCurrency[position.currency] || 0) + weight;
      } else {
        byCurrency["KRW"] = (byCurrency["KRW"] || 0) + weight;
      }
    }

    return {
      portfolio: {
        total_equity: input.portfolio.total_equity,
        cash: input.portfolio.cash,
        cash_ratio: input.portfolio.cash / input.portfolio.total_equity,
        positions: input.portfolio.positions.map((p) => ({
          ticker: p.ticker,
          name: p.name,
          quantity: p.quantity,
          avg_price: p.avg_price,
          current_price: p.current_price,
          market_value: p.market_value,
          unrealized_pnl: p.unrealized_pnl,
          unrealized_pnl_pct: p.unrealized_pnl_pct,
          weight: p.weight,
        })),
        by_market: byMarket,
        by_currency: byCurrency,
      },
      market: {
        kospi: {
          price: input.market.index.KOSPI.price,
          change_pct: input.market.index.KOSPI.change_pct,
        },
        kosdaq: {
          price: input.market.index.KOSDAQ.price,
          change_pct: input.market.index.KOSDAQ.change_pct,
        },
        ...(input.market.index.SP500 && {
          sp500: {
            price: input.market.index.SP500.price,
            change_pct: input.market.index.SP500.change_pct,
          },
        }),
        ...(input.market.index.NASDAQ && {
          nasdaq: {
            price: input.market.index.NASDAQ.price,
            change_pct: input.market.index.NASDAQ.change_pct,
          },
        }),
        ...(input.market.index.HANG_SENG && {
          hang_seng: {
            price: input.market.index.HANG_SENG.price,
            change_pct: input.market.index.HANG_SENG.change_pct,
          },
        }),
        ...(input.market.index.NIKKEI && {
          nikkei: {
            price: input.market.index.NIKKEI.price,
            change_pct: input.market.index.NIKKEI.change_pct,
          },
        }),
        sentiment: {
          foreign_net_buy: input.market.sentiment.foreign_net_buy_krw,
          institution_net_buy: input.market.sentiment.institution_net_buy_krw,
          fear_greed_index: input.market.sentiment.fear_greed_index,
          vix: input.market.sentiment.vix,
          short_selling_ratio: input.market.sentiment.short_selling_ratio,
          credit_balance_change_pct:
            input.market.sentiment.credit_balance_change_pct,
        },
        exchange_rates: input.market.exchange_rates || {
          USD: 1300,
          HKD: 170,
          JPY: 9.5,
          CNY: 180,
        },
      },
      stocks: input.stocks.map((s) => {
        // Find if this stock is in current portfolio
        const position = input.portfolio.positions.find(
          (p) => p.ticker === s.ticker
        );

        return {
          ticker: s.ticker,
          name: s.name,
          price: s.price,
          prev_close: s.prev_close,
          open: s.open,
          high: s.high,
          low: s.low,
          intraday_return: s.intraday_return,
          from_prev_close_return: s.from_prev_close_return,
          volume_ratio: s.volume_ratio,
          today_volume: s.today_volume,
          average_volume_30d: s.average_volume_30d,
          volatility: s.volatility_20d,
          atr_14d: s.atr_14d,
          ema5_position: s.ema5_position,
          ema20_position: s.ema20_position,
          sector: s.sector,
          history_7d: s.history_7d,
          history_30d: s.history_30d,
          ...(position && {
            position: {
              quantity: position.quantity,
              avg_price: position.avg_price,
              unrealized_pnl_pct: position.unrealized_pnl_pct,
              weight: position.weight,
            },
          }),
        };
      }),
      constraints: input.constraints,
    };
  }

  /**
   * Parse AI response JSON
   */
  private parseAIResponse(responseText: string): AIOutput {
    try {
      // Remove markdown code blocks if present
      let cleanText = responseText.trim();
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      }

      const parsed = JSON.parse(cleanText);

      return {
        decisions: parsed.decisions || [],
        market_view: parsed.market_view || "",
        risk_level: parsed.risk_level || "medium",
      };
    } catch (error) {
      logger.error("Failed to parse AI response", { responseText, error });
      throw new AIError("Invalid AI response format", undefined, error);
    }
  }

  /**
   * Validate AI output structure
   */
  private validateOutput(output: AIOutput): void {
    if (!Array.isArray(output.decisions)) {
      throw new AIError("Decisions must be an array");
    }

    if (!output.market_view || typeof output.market_view !== "string") {
      throw new AIError("Market view must be a string");
    }

    if (!["low", "medium", "high"].includes(output.risk_level)) {
      throw new AIError("Risk level must be low, medium, or high");
    }

    // Validate each decision
    for (const decision of output.decisions) {
      this.validateDecision(decision);
    }
  }

  /**
   * Validate single decision
   */
  private validateDecision(decision: Decision): void {
    if (!decision.ticker || typeof decision.ticker !== "string") {
      throw new AIError("Decision must have a valid ticker");
    }

    if (!["BUY", "SELL", "HOLD"].includes(decision.action)) {
      throw new AIError(`Invalid action: ${decision.action}`);
    }

    if (
      typeof decision.confidence !== "number" ||
      decision.confidence < 0 ||
      decision.confidence > 1
    ) {
      throw new AIError(`Invalid confidence: ${decision.confidence}`);
    }

    if (!decision.reason || typeof decision.reason !== "string") {
      throw new AIError("Decision must have a reason");
    }

    // Validate action-specific fields
    if (decision.action === "BUY" && !decision.amount_krw) {
      throw new AIError("BUY decision must have amount_krw");
    }

    if (decision.action === "SELL" && !decision.quantity) {
      throw new AIError("SELL decision must have quantity");
    }
  }

  /**
   * Test AI connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.aiProvider.testConnection();
      return true;
    } catch (error) {
      logger.error("AI connection test failed", { error });
      return false;
    }
  }

  /**
   * Get current provider type
   */
  getProviderType(): AIProviderType {
    return this.providerType;
  }
}
