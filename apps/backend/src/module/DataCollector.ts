import axios from "axios";
import { KISApiClient } from "../infrastructure/api/KISApiClient";
import { KISApiFactory } from "../infrastructure/api/KISApiFactory";
import {
  AccountBalance,
  Position,
  StockFeature,
  Market,
  EXCHANGE_CODES,
} from "../model/Trading";
import { IndexInfo, Sentiment, NewsItem } from "../model/AI";
import { logger } from "../util/logger";
import { retryWithBackoff } from "../util/retry";
import { ApiError } from "../util/errors";
import { getToday, getDaysAgo } from "../util/formatters";
import { kisRateLimiter } from "../util/rateLimiter";

export interface PriceData {
  current: number;
  prev_close: number;
  open: number;
  high: number;
  low: number;
}

/**
 * Data Collector Module
 * Collects market data, account info, and sentiment indicators from KIS API
 */
export class DataCollector {
  private kisApi: KISApiClient;
  private accountNumber: string;

  constructor() {
    // Use singleton factory to share access token
    const factory = KISApiFactory.getInstance();
    this.kisApi = factory.create({
      baseURL: process.env.KIS_BASE_URL || "",
    });
    this.accountNumber = process.env.KIS_ACCOUNT_NUMBER || "";
  }

  /**
   * Collect account balance and positions
   */
  async collectAccountData(): Promise<AccountBalance> {
    try {
      logger.info("Collecting account data...");

      await kisRateLimiter.waitIfNeeded();
      const balanceData = await retryWithBackoff(() =>
        this.kisApi.getAccountBalance(this.accountNumber)
      );

      // Parse KIS API response
      const output = balanceData.output1 || [];
      const output2 = balanceData.output2?.[0] || {};

      const positions: Position[] = output.map((item: any) => ({
        ticker: item.pdno,
        name: item.prdt_name,
        quantity: parseInt(item.hldg_qty),
        avg_price: parseFloat(item.pchs_avg_pric),
        current_price: parseFloat(item.prpr),
        market_value: parseFloat(item.evlu_amt),
        unrealized_pnl: parseFloat(item.evlu_pfls_amt),
        unrealized_pnl_pct: parseFloat(item.evlu_pfls_rt) / 100,
        weight: 0, // Will be calculated
      }));

      const totalEquity = parseFloat(output2.tot_evlu_amt || 0);
      const cash = parseFloat(output2.prvs_rcdl_excc_amt || 0);

      // Calculate position weights
      positions.forEach((pos) => {
        pos.weight = totalEquity > 0 ? pos.market_value / totalEquity : 0;
      });

      const accountBalance: AccountBalance = {
        account_number: this.accountNumber,
        total_equity: totalEquity,
        cash,
        securities_value: totalEquity - cash,
        positions,
        buyable_cash: parseFloat(output2.nass_amt || 0),
      };

      logger.info("Account data collected", {
        total_equity: totalEquity,
        position_count: positions.length,
      });

      return accountBalance;
    } catch (error) {
      logger.error("Failed to collect account data", { error });
      throw new ApiError("Failed to collect account data", undefined, error);
    }
  }

  /**
   * Collect exchange rates for major currencies
   * Uses public API (exchangerate-api.com) as KIS API doesn't provide reliable exchange rate endpoint
   */
  async collectExchangeRates(): Promise<Record<string, number>> {
    try {
      logger.info("Collecting exchange rates...");
      const rates: Record<string, number> = {};

      // Fallback rates (approximate KRW rates)
      const fallbackRates: Record<string, number> = {
        USD: 1300,
        HKD: 170,
        JPY: 9.5,
        CNY: 180,
      };

      // Try to fetch from public API first
      try {
        // Using exchangerate-api.com (free tier allows 1500 requests/month)
        const apiUrl = "https://api.exchangerate-api.com/v4/latest/KRW";
        logger.debug("📡 Fetching exchange rates from public API", {
          api_url: apiUrl,
        });

        const { data } = await axios.get(apiUrl, {
          timeout: 5000,
          headers: {
            "User-Agent": "Mozilla/5.0",
          },
        });

        if (data && data.rates) {
          // Convert from KRW base to currency base (inverse)
          // API returns: 1 KRW = X USD, we need: 1 USD = Y KRW
          const currencies = ["USD", "HKD", "JPY", "CNY"];
          for (const currency of currencies) {
            const krwToCurrency = data.rates[currency];
            if (krwToCurrency && krwToCurrency > 0) {
              // Convert: 1 USD = 1 / (1 KRW in USD) KRW
              rates[currency] = 1 / krwToCurrency;
              logger.debug(
                `Exchange rate collected: ${currency}KRW = ${rates[currency]}`
              );
            } else {
              rates[currency] = fallbackRates[currency];
              logger.warn(
                `Exchange rate not found for ${currency}, using fallback`
              );
            }
          }

          logger.info("✅ Exchange rates collected from public API", { rates });
          return rates;
        }
      } catch (error: any) {
        logger.warn("Failed to fetch exchange rates from public API", {
          error: error?.message || String(error),
          error_code: error?.code,
        });
      }

      // If public API fails, try KIS API (but it's unreliable)
      const currencies = ["USD", "HKD", "JPY", "CNY"];
      let kisSuccessCount = 0;

      for (const currency of currencies) {
        // Skip KIS API for now as it's causing 500 errors
        // Use fallback rates directly
        rates[currency] = fallbackRates[currency];
        logger.debug(`Using fallback rate for ${currency}: ${rates[currency]}`);
      }

      logger.info("Exchange rates collected (using fallback)", {
        rates,
        note: "KIS API exchange rate endpoint is unreliable, using fallback rates",
      });
      return rates;
    } catch (error) {
      logger.error("Failed to collect exchange rates", { error });
      // Return fallback rates
      const fallbackRates = {
        USD: 1300,
        HKD: 170,
        JPY: 9.5,
        CNY: 180,
      };
      logger.warn("Using fallback exchange rates due to error", {
        fallback_rates: fallbackRates,
      });
      return fallbackRates;
    }
  }

  /**
   * Collect market index information
   */
  async collectIndexInfo(): Promise<IndexInfo> {
    try {
      logger.info("Collecting index info...");

      // Fetch indices sequentially with rate limiting
      await kisRateLimiter.waitIfNeeded();
      const kospiData = await retryWithBackoff(() =>
        this.kisApi.getIndexInfo("0001")
      ); // KOSPI

      await kisRateLimiter.waitIfNeeded();
      const kosdaqData = await retryWithBackoff(() =>
        this.kisApi.getIndexInfo("1001")
      ); // KOSDAQ

      const kospiOutput = kospiData.output || {};
      const kosdaqOutput = kosdaqData.output || {};

      const indexInfo: IndexInfo = {
        KOSPI: {
          price: parseFloat(kospiOutput.bstp_nmix_prpr || 0),
          change_pct:
            parseFloat(kospiOutput.bstp_nmix_prdy_vrss_sign || 0) / 100,
          volume: parseFloat(kospiOutput.acml_vol || 0),
        },
        KOSDAQ: {
          price: parseFloat(kosdaqOutput.bstp_nmix_prpr || 0),
          change_pct:
            parseFloat(kosdaqOutput.bstp_nmix_prdy_vrss_sign || 0) / 100,
          volume: parseFloat(kosdaqOutput.acml_vol || 0),
        },
      };

      // Collect global indices (optional, non-blocking)
      try {
        const globalIndices = await this.collectGlobalIndices();
        Object.assign(indexInfo, globalIndices);
      } catch (error) {
        logger.warn(
          "Failed to collect global indices, continuing without them",
          { error }
        );
      }

      logger.info("Index info collected", {
        KOSPI: indexInfo.KOSPI.price,
        SP500: indexInfo.SP500?.price,
        NASDAQ: indexInfo.NASDAQ?.price,
      });

      return indexInfo;
    } catch (error) {
      logger.error("Failed to collect index info", { error });
      throw new ApiError("Failed to collect index info", undefined, error);
    }
  }

  /**
   * Collect market sentiment indicators
   */
  async collectSentiment(): Promise<Sentiment> {
    try {
      logger.info("Collecting sentiment data...");

      const sentiment: Sentiment = {
        foreign_net_buy_krw: 0,
        institution_net_buy_krw: 0,
      };

      const fearGreedIndex = await this.fetchFearGreedIndex();
      if (fearGreedIndex !== undefined) {
        sentiment.fear_greed_index = fearGreedIndex;
      }

      logger.info("Sentiment data collected", {
        fear_greed_index: sentiment.fear_greed_index,
      });

      return sentiment;
    } catch (error) {
      logger.error("Failed to collect sentiment", { error });
      throw new ApiError("Failed to collect sentiment", undefined, error);
    }
  }

  /**
   * Collect breaking news for overseas stocks
   * @param maxItems Maximum number of news items to return (default: 20)
   * @param tickerFilter Optional ticker to filter news (e.g., "TSLA")
   * @returns Array of breaking news items
   */
  async collectBreakingNews(
    maxItems: number = 20,
    tickerFilter?: string
  ): Promise<any[]> {
    try {
      logger.info("Collecting breaking news...", {
        maxItems,
        tickerFilter,
      });

      await kisRateLimiter.waitIfNeeded();

      const result = await retryWithBackoff(() =>
        this.kisApi.getOverseasBreakingNews(
          "0",
          "11801",
          "",
          tickerFilter || "",
          "",
          "",
          "",
          "",
          ""
        )
      );

      if (!result.output || result.output.length === 0) {
        logger.warn("No breaking news available");
        return [];
      }

      const newsItems = result.output
        .slice(0, maxItems)
        .map((item: any) => ({
          date: item.stck_bsop_date || "",
          time: item.stck_bsop_hour || "",
          ticker: item.stck_shrn_iscd || "",
          stock_name: item.hts_kor_isnm || "",
          title: item.brk_news_titl || "",
          category: item.brk_news_clas_name || "",
          serial_number: item.news_srno || "",
        }))
        .filter((item: any) => item.title);

      logger.info("Breaking news collected", {
        total: newsItems.length,
        with_ticker: newsItems.filter((n: any) => n.ticker).length,
      });

      return newsItems;
    } catch (error) {
      logger.error("Failed to collect breaking news", { error });
      return [];
    }
  }

  /**
   * Collect global market indices (S&P500, NASDAQ, Hang Seng, Nikkei)
   * Uses Yahoo Finance API or similar public data source
   */
  async collectGlobalIndices(): Promise<Partial<IndexInfo>> {
    try {
      logger.info("Collecting global indices...");

      const indices: Partial<IndexInfo> = {};

      // Using a simple approach: Yahoo Finance CSV API or similar
      // For production, consider using a proper financial data API
      const symbols = {
        SP500: "^GSPC",
        NASDAQ: "^IXIC",
        HANG_SENG: "^HSI",
        NIKKEI: "^N225",
        VIX: "^VIX",
      };

      for (const [key, symbol] of Object.entries(symbols)) {
        try {
          // Yahoo Finance query API (simplified)
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
          const response = await axios.get(url, {
            timeout: 5000,
            headers: {
              "User-Agent": "Mozilla/5.0",
            },
          });

          const result = response.data?.chart?.result?.[0];
          if (result) {
            const meta = result.meta;
            const currentPrice = meta.regularMarketPrice || 0;
            const previousClose =
              meta.chartPreviousClose || meta.previousClose || 0;
            const changePct =
              previousClose > 0
                ? ((currentPrice - previousClose) / previousClose) * 100
                : 0;

            indices[key as keyof IndexInfo] = {
              price: currentPrice,
              change_pct: changePct,
            } as any;

            logger.debug(`✅ Collected ${key}`, {
              symbol,
              price: currentPrice,
              change_pct: `${changePct.toFixed(2)}%`,
            });
          }
        } catch (error: any) {
          logger.warn(`Failed to collect ${key}`, {
            symbol,
            error: error.message,
          });
        }
      }

      logger.info("Global indices collected", {
        collected: Object.keys(indices),
      });

      return indices;
    } catch (error) {
      logger.error("Failed to collect global indices", { error });
      return {};
    }
  }

  /**
   * Fetch CNN Fear & Greed index (or fallback to env override)
   */
  private async fetchFearGreedIndex(): Promise<number | undefined> {
    const apiUrl =
      process.env.FEAR_GREED_API_URL ||
      "https://production.dataviz.cnn.io/index/fearandgreed/";
    const fallbackEnv = process.env.FEAR_GREED_INDEX;
    const fallback =
      fallbackEnv !== undefined ? parseFloat(fallbackEnv) : undefined;

    logger.info("🔍 Fetching Fear & Greed Index", {
      api_url: apiUrl,
      fallback_value: fallback,
      has_fallback: fallback !== undefined,
    });

    // Try multiple endpoints and headers
    const endpoints = [
      {
        url: apiUrl,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://www.cnn.com/",
          Origin: "https://www.cnn.com",
        },
      },
      {
        url: apiUrl,
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "*/*",
        },
      },
      {
        url: "https://api.alternative.me/fng/",
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
        },
      },
    ];

    for (const endpoint of endpoints) {
      try {
        logger.debug("📡 Calling Fear & Greed API", {
          url: endpoint.url,
          headers: Object.keys(endpoint.headers),
        });
        const { data, status, statusText } = await axios.get(endpoint.url, {
          timeout: 10000,
          headers: endpoint.headers,
          validateStatus: (status) => status < 500, // Accept 4xx but log them
        });

        logger.info("✅ Fear & Greed API Response Received", {
          url: endpoint.url,
          status,
          statusText,
          response_type: typeof data,
          response_keys: data ? Object.keys(data) : [],
          response_sample: data
            ? JSON.stringify(data).substring(0, 500)
            : "null",
        });

        if (status >= 400) {
          logger.warn("⚠️ API returned error status", {
            url: endpoint.url,
            status,
            statusText,
            response_data: data,
          });
          continue; // Try next endpoint
        }

        // Parse response - handle different API formats
        let parsed: number | undefined;
        if (endpoint.url.includes("alternative.me")) {
          // Alternative.me API format: { data: [{ value: "45", ... }] }
          parsed = this.parseAlternativeMeResponse(data);
        } else {
          // CNN API format
          parsed = this.parseFearGreedResponse(data);
        }

        if (parsed !== undefined) {
          logger.info("✅ Fear & Greed Index Parsed Successfully", {
            index: parsed,
            source: endpoint.url.includes("alternative.me")
              ? "Alternative.me API"
              : "CNN API",
            endpoint_url: endpoint.url,
          });
          return parsed;
        }

        logger.warn("⚠️ Failed to parse Fear & Greed Index from response", {
          api_url: endpoint.url,
          response_structure: data ? Object.keys(data) : [],
          response_sample: data
            ? JSON.stringify(data).substring(0, 500)
            : "null",
        });
      } catch (error: any) {
        logger.warn("❌ Failed to fetch from endpoint", {
          endpoint_url: endpoint.url,
          error_message: error?.message || String(error),
          error_code: error?.code,
          error_status: error?.response?.status,
          error_statusText: error?.response?.statusText,
        });
        // Continue to next endpoint
        continue;
      }
    }

    // All endpoints failed
    logger.warn("⚠️ All Fear & Greed Index endpoints failed");

    if (Number.isFinite(fallback)) {
      logger.warn(
        "Using fallback Fear & Greed Index from environment variable",
        {
          fallback_value: fallback,
        }
      );
      return fallback;
    }

    logger.warn("No fallback available for Fear & Greed Index");
    return undefined;
  }

  /**
   * Parse Alternative.me Fear & Greed Index API response
   */
  private parseAlternativeMeResponse(payload: any): number | undefined {
    try {
      if (
        payload?.data &&
        Array.isArray(payload.data) &&
        payload.data.length > 0
      ) {
        const value = payload.data[0].value;
        if (value !== undefined && value !== null) {
          const parsed = typeof value === "string" ? parseFloat(value) : value;
          if (typeof parsed === "number" && Number.isFinite(parsed)) {
            return Math.max(0, Math.min(100, parsed));
          }
        }
      }
    } catch (error) {
      logger.debug("Failed to parse Alternative.me response", { error });
    }
    return undefined;
  }

  /**
   * Parse fear/greed score from various API response shapes
   */
  private parseFearGreedResponse(payload: any): number | undefined {
    logger.debug("🔍 Parsing Fear & Greed Index response", {
      payload_type: typeof payload,
      payload_keys: payload ? Object.keys(payload) : [],
      is_array: Array.isArray(payload),
    });

    const candidates = [
      { path: "fear_and_greed.score", value: payload?.fear_and_greed?.score },
      {
        path: "fear_and_greed.now.score",
        value: payload?.fear_and_greed?.now?.score,
      },
      {
        path: "fear_and_greed.now.value",
        value: payload?.fear_and_greed?.now?.value,
      },
      { path: "fearAndGreed.score", value: payload?.fearAndGreed?.score },
      { path: "fgi.now.value", value: payload?.fgi?.now?.value },
      { path: "now.value", value: payload?.now?.value },
      { path: "score", value: payload?.score },
      { path: "value", value: payload?.value },
      {
        path: "data[0].score",
        value: Array.isArray(payload?.data)
          ? payload.data[0]?.score
          : undefined,
      },
      {
        path: "data[0].value",
        value: Array.isArray(payload?.data)
          ? payload.data[0]?.value
          : undefined,
      },
    ];

    for (const candidate of candidates) {
      if (candidate.value === undefined || candidate.value === null) {
        continue;
      }

      const parsed =
        typeof candidate.value === "string"
          ? parseFloat(candidate.value)
          : candidate.value;

      if (typeof parsed === "number" && Number.isFinite(parsed)) {
        const clamped = Math.max(0, Math.min(100, parsed));
        logger.info("✅ Found Fear & Greed Index", {
          path: candidate.path,
          raw_value: candidate.value,
          parsed_value: parsed,
          clamped_value: clamped,
        });
        return clamped;
      }
    }

    logger.warn("⚠️ Could not find Fear & Greed Index in response", {
      tried_paths: candidates.map((c) => c.path),
      payload_sample: payload
        ? JSON.stringify(payload).substring(0, 1000)
        : "null",
    });

    return undefined;
  }

  /**
   * Collect top stocks by volume
   */
  async collectTopStocksByVolume(limit: number = 50): Promise<string[]> {
    try {
      logger.info("Collecting top stocks by volume...", { limit });

      const rankingData = await retryWithBackoff(() =>
        this.kisApi.getVolumeRanking(limit)
      );

      const output = rankingData.output || [];
      const tickers = output
        .map((item: any) => item.mksc_shrn_iscd)
        .filter(Boolean);

      logger.info("Top stocks collected", { count: tickers.length });

      return tickers.slice(0, limit);
    } catch (error) {
      logger.error("Failed to collect top stocks", { error });
      throw new ApiError("Failed to collect top stocks", undefined, error);
    }
  }

  /**
   * Collect current prices for multiple stocks
   */
  async collectStockPrices(
    tickers: string[],
    market: Market = Market.DOMESTIC
  ): Promise<Map<string, number>> {
    try {
      logger.info("Collecting stock prices...", {
        count: tickers.length,
        market,
      });

      const prices = new Map<string, number>();
      const exchangeCode = EXCHANGE_CODES[market];

      // Batch requests with rate limiting
      for (const ticker of tickers) {
        try {
          await kisRateLimiter.waitIfNeeded();

          let price = 0;

          if (market === Market.DOMESTIC) {
            // Domestic stock
            const priceData = await this.kisApi.getCurrentPrice(ticker);
            const output = priceData.output || {};
            price = parseFloat(output.stck_prpr || 0);
          } else {
            // Overseas stock
            const priceData = await this.kisApi.getOverseasPrice(
              ticker,
              exchangeCode
            );

            // Check for API errors
            if (priceData.rt_cd !== "0") {
              logger.warn("KIS API error for overseas stock", {
                ticker,
                exchangeCode,
                rt_cd: priceData.rt_cd,
                msg_cd: priceData.msg_cd,
                msg1: priceData.msg1,
              });
              throw new Error(
                `KIS API error: ${priceData.msg1 || priceData.msg_cd}`
              );
            }

            const output = priceData.output || {};

            // KIS API response format for overseas stocks
            // Response can be array or object
            if (Array.isArray(output) && output.length > 0) {
              const stock = output[0];
              price = parseFloat(
                stock.last || stock.LAST || stock.xymd_cls_prc || 0
              );
            } else if (output && typeof output === "object") {
              price = parseFloat(
                output.last || output.LAST || output.xymd_cls_prc || 0
              );
            }

            if (price === 0) {
              logger.debug("Overseas stock price response", {
                ticker,
                exchangeCode,
                output,
                response_keys: Object.keys(priceData),
              });
            }
          }

          if (price > 0) {
            prices.set(ticker, price);
          } else {
            logger.warn("Price is 0 or invalid", {
              ticker,
              market,
              exchangeCode,
            });
          }
        } catch (error) {
          logger.warn("Failed to get price for ticker", {
            ticker,
            market,
            error,
          });
        }
      }

      logger.info("Stock prices collected", { count: prices.size, market });

      return prices;
    } catch (error) {
      logger.error("Failed to collect stock prices", { error, market });
      throw new ApiError("Failed to collect stock prices", undefined, error);
    }
  }

  /**
   * Collect detailed price data with OHLC for multiple tickers
   */
  async collectDetailedPrices(
    tickers: string[],
    market: Market = Market.DOMESTIC
  ): Promise<Map<string, PriceData>> {
    try {
      logger.info("Collecting detailed price data (OHLC)...", {
        count: tickers.length,
        market,
      });

      const priceData = new Map<string, PriceData>();
      const exchangeCode = EXCHANGE_CODES[market];

      for (const ticker of tickers) {
        try {
          await kisRateLimiter.waitIfNeeded();

          if (market === Market.DOMESTIC) {
            const data = await this.kisApi.getCurrentPrice(ticker);
            const output = data.output || {};

            const current = parseFloat(output.stck_prpr || 0);
            const prev_close = parseFloat(
              output.stck_prdy_clpr || output.stck_sdpr || 0
            );
            const open = parseFloat(output.stck_oprc || 0);
            const high = parseFloat(output.stck_hgpr || 0);
            const low = parseFloat(output.stck_lwpr || 0);

            if (current > 0) {
              priceData.set(ticker, {
                current,
                prev_close: prev_close || current,
                open: open || current,
                high: high || current,
                low: low || current,
              });
            }
          } else {
            const data = await this.kisApi.getOverseasPrice(
              ticker,
              exchangeCode
            );

            if (data.rt_cd !== "0") {
              logger.warn("KIS API error for overseas stock OHLC", {
                ticker,
                exchangeCode,
                rt_cd: data.rt_cd,
                msg_cd: data.msg_cd,
                msg1: data.msg1,
              });
              continue;
            }

            const output = data.output || {};
            const stockData = Array.isArray(output) ? output[0] : output;

            logger.debug(`Overseas price data for ${ticker}`, {
              ticker,
              exchangeCode,
              output_is_array: Array.isArray(output),
              output_keys: Object.keys(stockData || {}),
              stockData_sample: stockData,
            });

            if (stockData) {
              const current = parseFloat(
                stockData.last ||
                  stockData.LAST ||
                  stockData.curr ||
                  stockData.stck_prpr ||
                  stockData.t_xprc ||
                  0
              );
              const prev_close = parseFloat(
                stockData.base ||
                  stockData.BASE ||
                  stockData.prev_close ||
                  stockData.stck_prdy_clpr ||
                  stockData.t_xsgn ||
                  0
              );
              const open = parseFloat(
                stockData.open ||
                  stockData.OPEN ||
                  stockData.oprc ||
                  stockData.stck_oprc ||
                  0
              );
              const high = parseFloat(
                stockData.high ||
                  stockData.HIGH ||
                  stockData.hgpr ||
                  stockData.stck_hgpr ||
                  0
              );
              const low = parseFloat(
                stockData.low ||
                  stockData.LOW ||
                  stockData.lwpr ||
                  stockData.stck_lwpr ||
                  0
              );

              logger.info(`Parsed overseas price for ${ticker}`, {
                ticker,
                current,
                prev_close,
                open,
                high,
                low,
              });

              if (current > 0) {
                priceData.set(ticker, {
                  current,
                  prev_close: prev_close || current,
                  open: open || current,
                  high: high || current,
                  low: low || current,
                });
              } else {
                logger.warn(`Current price is 0 for overseas stock ${ticker}`, {
                  ticker,
                  stockData_keys: Object.keys(stockData),
                });
              }
            }
          }
        } catch (error) {
          logger.warn("Failed to get detailed price for ticker", {
            ticker,
            market,
            error,
          });
        }
      }

      logger.info("Detailed price data collected", {
        count: priceData.size,
        market,
      });

      return priceData;
    } catch (error) {
      logger.error("Failed to collect detailed prices", { error });
      throw error;
    }
  }

  /**
   * Get daily candles for a stock
   */
  async getStockHistory(
    ticker: string,
    days: number = 30,
    market: Market = Market.DOMESTIC
  ): Promise<{ close: number; volume: number }[]> {
    try {
      const endDate = getToday();
      const startDate = getDaysAgo(days);
      const exchangeCode = EXCHANGE_CODES[market];

      logger.info(`📊 Fetching history for ${ticker}`, {
        ticker,
        market,
        exchangeCode,
        startDate,
        endDate,
        requested_days: days,
        note: "Requesting historical data (weekends/holidays excluded)",
      });

      await kisRateLimiter.waitIfNeeded();

      let historyData: any;
      if (market === Market.DOMESTIC) {
        historyData = await retryWithBackoff(() =>
          this.kisApi.getDailyPrices(ticker, startDate, endDate)
        );
      } else {
        historyData = await retryWithBackoff(() =>
          this.kisApi.getOverseasDailyPrices(
            ticker,
            exchangeCode,
            "0",
            endDate,
            "1"
          )
        );
      }

      let dataArray: any[] = [];

      if (market === Market.DOMESTIC) {
        const output = historyData.output || [];
        const output2 = historyData.output2 || [];

        logger.info(`📈 History API response for ${ticker}`, {
          ticker,
          requested_days: days,
          output_length: output.length,
          output2_length: output2.length,
          total_data_points: output.length + output2.length,
          rt_cd: historyData.rt_cd,
          msg_cd: historyData.msg_cd,
          msg1: historyData.msg1,
          note:
            output.length > 0 || output2.length > 0
              ? `Received ${
                  output.length || output2.length
                } trading days (weekends/holidays excluded)`
              : "No data received",
        });

        // Try output first, fallback to output2 if empty
        dataArray = output;
        if (output.length === 0 && output2.length > 0) {
          logger.info(`📊 Using output2 for ${ticker} (output was empty)`, {
            output2_length: output2.length,
          });
          dataArray = output2;
        }

        // If still empty, try a shorter date range (7 days)
        if (dataArray.length === 0 && days > 7) {
          logger.warn(
            `⚠️ Empty history data, retrying with 7 days for ${ticker}`
          );
          const shortStartDate = getDaysAgo(7);

          await kisRateLimiter.waitIfNeeded();
          const retryData = await retryWithBackoff(() =>
            this.kisApi.getDailyPrices(ticker, shortStartDate, endDate)
          );

          dataArray = retryData.output || retryData.output2 || [];
          logger.debug(`📈 Retry with 7 days result`, {
            ticker,
            length: dataArray.length,
            rt_cd: retryData.rt_cd,
            msg_cd: retryData.msg_cd,
          });
        }
      } else {
        // Overseas stock history
        // Check for API errors first
        if (historyData.rt_cd !== "0") {
          logger.warn("KIS API error for overseas history", {
            ticker,
            market,
            exchangeCode,
            rt_cd: historyData.rt_cd,
            msg_cd: historyData.msg_cd,
            msg1: historyData.msg1,
          });
        }

        // ⚠️ getOverseasDailyPrices returns output1 and output2, not output
        const output1 = historyData.output1 || [];
        const output2 = historyData.output2 || [];

        // Try output2 first (contains main data), fallback to output1
        dataArray =
          Array.isArray(output2) && output2.length > 0
            ? output2
            : Array.isArray(output1)
            ? output1
            : [];

        logger.info(`📈 Overseas history API response for ${ticker}`, {
          ticker,
          market,
          exchangeCode,
          requested_days: days,
          output1_length: output1.length,
          output2_length: output2.length,
          used_output:
            dataArray.length === output2.length ? "output2" : "output1",
          total_data_length: dataArray.length,
          rt_cd: historyData.rt_cd,
          msg_cd: historyData.msg_cd,
          msg1: historyData.msg1,
          response_keys: Object.keys(historyData),
          output_sample: dataArray.length > 0 ? dataArray.slice(0, 2) : [],
          note:
            dataArray.length === 0
              ? "No history data received - may need different API endpoint or parameters"
              : `Received ${dataArray.length} trading days`,
        });

        // If still empty, try without date range (get recent data)
        if (dataArray.length === 0 && days > 7) {
          logger.warn(
            `⚠️ Empty overseas history data, retrying without date range for ${ticker}`
          );
          await kisRateLimiter.waitIfNeeded();
          const retryData = await retryWithBackoff(() =>
            this.kisApi.getOverseasDailyPrices(
              ticker,
              exchangeCode,
              "0",
              "",
              "1"
            )
          );

          if (retryData.rt_cd === "0") {
            // ⚠️ Use output1/output2, not output
            const retryOutput1 = retryData.output1 || [];
            const retryOutput2 = retryData.output2 || [];
            dataArray = retryOutput2.length > 0 ? retryOutput2 : retryOutput1;

            logger.debug(`📈 Retry without date range result`, {
              ticker,
              output1_length: retryOutput1.length,
              output2_length: retryOutput2.length,
              used_length: dataArray.length,
              rt_cd: retryData.rt_cd,
            });
          }
        }
      }

      if (dataArray.length === 0) {
        logger.warn(`⚠️ No history data available for ${ticker}`, {
          ticker,
          market,
          exchangeCode,
          startDate,
          endDate,
          requested_days: days,
          possible_reasons: [
            "Market closed (requires 09:00-15:30 KST)",
            "Paper trading mode limitation",
            "Invalid ticker or delisted stock",
            "Weekend/holiday (no trading data)",
            "KIS API may not return data for certain periods",
          ],
        });
        return [];
      }

      logger.info(`✅ History data collected for ${ticker}`, {
        ticker,
        requested_days: days,
        received_trading_days: dataArray.length,
        data_coverage: `${((dataArray.length / days) * 100).toFixed(1)}%`,
        note:
          dataArray.length < days
            ? `Received ${dataArray.length} days instead of ${days} (weekends/holidays excluded)`
            : `Received full ${dataArray.length} days`,
      });

      // Parse data based on market type
      let parsedData: { close: number; volume: number }[] = [];

      if (market === Market.DOMESTIC) {
        parsedData = dataArray.map((item: any) => ({
          close: parseFloat(item.stck_clpr || item.stck_prpr || 0),
          volume: parseFloat(item.acml_vol || item.acml_tr_pbmn || 0),
        }));
      } else {
        // Overseas stock format - try multiple field names
        parsedData = dataArray.map((item: any) => {
          // Try comprehensive field names for close price
          const close = parseFloat(
            item.clos ||
              item.clos_pric ||
              item.xymd_cls_prc ||
              item.ovrs_clos ||
              item.stck_clpr ||
              item.close ||
              item.CLOSE ||
              item.last ||
              item.LAST ||
              item.curr_pric ||
              item.curr ||
              0
          );

          // Try comprehensive field names for volume
          const volume = parseFloat(
            item.acml_vol ||
              item.ovrs_tvol ||
              item.tvol ||
              item.TVOL ||
              item.volume ||
              item.VOLUME ||
              item.vol ||
              item.VOL ||
              0
          );

          // Log if we can't find data
          if (close === 0 || volume === 0) {
            logger.debug(
              `⚠️ Missing data in overseas history item for ${ticker}`,
              {
                ticker,
                item_keys: Object.keys(item),
                item_sample: item,
                attempted_close_fields: [
                  "clos",
                  "clos_pric",
                  "xymd_cls_prc",
                  "ovrs_clos",
                  "stck_clpr",
                  "close",
                  "CLOSE",
                  "last",
                  "LAST",
                  "curr_pric",
                  "curr",
                ],
                attempted_volume_fields: [
                  "acml_vol",
                  "ovrs_tvol",
                  "tvol",
                  "TVOL",
                  "volume",
                  "VOLUME",
                  "vol",
                  "VOL",
                ],
              }
            );
          }

          return { close, volume };
        });
      }

      // Filter out invalid data points
      const validData = parsedData.filter((d) => d.close > 0);

      logger.info(`✅ Parsed history data for ${ticker}`, {
        ticker,
        market,
        raw_data_points: dataArray.length,
        valid_data_points: validData.length,
        invalid_data_points: parsedData.length - validData.length,
        sample_data: validData.slice(0, 3),
      });

      // If we have no valid data for overseas stocks, try to get at least current price as fallback
      if (validData.length === 0 && market !== Market.DOMESTIC) {
        logger.warn(
          `⚠️ No valid history data for overseas ${ticker}, attempting to use current price as fallback`
        );
        try {
          await kisRateLimiter.waitIfNeeded();
          const currentPriceData = await retryWithBackoff(() =>
            this.kisApi.getOverseasPrice(ticker, exchangeCode)
          );

          if (
            currentPriceData?.output?.last ||
            currentPriceData?.output?.stck_prpr
          ) {
            const currentPrice = parseFloat(
              currentPriceData.output.last || currentPriceData.output.stck_prpr
            );
            const currentVolume = parseFloat(
              currentPriceData.output.tvol ||
                currentPriceData.output.acml_vol ||
                0
            );

            if (currentPrice > 0) {
              logger.info(`✅ Using current price as fallback for ${ticker}`, {
                ticker,
                current_price: currentPrice,
                current_volume: currentVolume,
              });
              // Create a minimal history with current price
              return [{ close: currentPrice, volume: currentVolume }];
            }
          }
        } catch (error: any) {
          logger.error(
            `❌ Failed to get current price fallback for ${ticker}`,
            {
              ticker,
              error: error.message,
            }
          );
        }
      }

      return validData;
    } catch (error) {
      logger.warn("Failed to get stock history", { ticker, error });
      return [];
    }
  }

  /**
   * Collect supply/demand data (foreign/institution net buy)
   * 투자자별 순매수 데이터 수집
   */
  async collectSupplyDemand(
    tickers: string[],
    market: Market
  ): Promise<
    Map<string, { foreign_net_buy: number; institution_net_buy: number }>
  > {
    const supplyDemandMap = new Map<
      string,
      { foreign_net_buy: number; institution_net_buy: number }
    >();

    if (market !== Market.DOMESTIC) {
      // Only supported for domestic stocks
      logger.info("Supply/demand data only available for domestic market");
      return supplyDemandMap;
    }

    logger.info("Collecting supply/demand data", {
      ticker_count: tickers.length,
    });

    for (const ticker of tickers) {
      try {
        await kisRateLimiter.waitIfNeeded();
        const data = await retryWithBackoff(() =>
          this.kisApi.getInvestorTrends(ticker)
        );

        // Parse KIS API response for investor trends
        // output structure: array of daily data with stck_bsop_date, frgn_ntby_qty, etc.
        const output = data.output || [];
        if (output.length > 0) {
          const latestData = output[0]; // Most recent day

          // Foreign net buy (외국인 순매수)
          const foreignNetBuy = parseFloat(latestData.frgn_ntby_qty || 0);

          // Institution net buy (기관 순매수)
          // Sum of various institution types
          const institutionNetBuy =
            parseFloat(latestData.orgn_ntby_qty || 0) + // 기관계
            parseFloat(latestData.fund_ntby_qty || 0) + // 투신
            parseFloat(latestData.etc_orgt_ntby_qty || 0); // 기타법인

          supplyDemandMap.set(ticker, {
            foreign_net_buy: foreignNetBuy,
            institution_net_buy: institutionNetBuy,
          });

          logger.debug(`✅ Collected supply/demand for ${ticker}`, {
            ticker,
            foreign_net_buy: foreignNetBuy,
            institution_net_buy: institutionNetBuy,
          });
        } else {
          logger.warn(`No supply/demand data for ${ticker}`);
          supplyDemandMap.set(ticker, {
            foreign_net_buy: 0,
            institution_net_buy: 0,
          });
        }
      } catch (error: any) {
        logger.warn(`Failed to collect supply/demand for ${ticker}`, {
          ticker,
          error: error.message,
        });
        supplyDemandMap.set(ticker, {
          foreign_net_buy: 0,
          institution_net_buy: 0,
        });
      }
    }

    logger.info("Supply/demand data collected", {
      total: tickers.length,
      collected: supplyDemandMap.size,
    });

    return supplyDemandMap;
  }

  /**
   * Collect sector/industry information
   * 섹터/산업 정보 수집
   */
  async collectSectorInfo(
    tickers: string[],
    market: Market
  ): Promise<Map<string, { sector: string; industry: string }>> {
    const sectorMap = new Map<string, { sector: string; industry: string }>();

    logger.info("Collecting sector/industry info", {
      ticker_count: tickers.length,
      market,
    });

    if (market === Market.DOMESTIC) {
      // For domestic stocks, get sector from getCurrentPrice response
      for (const ticker of tickers) {
        try {
          await kisRateLimiter.waitIfNeeded();
          const priceData = await retryWithBackoff(() =>
            this.kisApi.getCurrentPrice(ticker)
          );

          const output = priceData.output || {};
          // bstp_kor_isnm contains the industry name (업종명)
          const industry = output.bstp_kor_isnm || "Unknown";

          // Map industry to broader sector
          // This is a simplified mapping - can be enhanced with more detailed taxonomy
          const sector = this.mapIndustryToSector(industry);

          sectorMap.set(ticker, { sector, industry });

          logger.debug(`✅ Collected sector info for ${ticker}`, {
            ticker,
            sector,
            industry,
          });
        } catch (error: any) {
          logger.warn(`Failed to collect sector info for ${ticker}`, {
            ticker,
            error: error.message,
          });
          sectorMap.set(ticker, { sector: "Unknown", industry: "Unknown" });
        }
      }
    } else {
      // For overseas stocks, use static mapping from sector-mapping.ts
      // This will be imported and used
      const sectorMapping = await import("../data/sector-mapping");
      for (const ticker of tickers) {
        const sectorInfo = sectorMapping.getSectorInfo(ticker);
        sectorMap.set(ticker, sectorInfo);

        logger.debug(`✅ Mapped sector info for ${ticker}`, {
          ticker,
          sector: sectorInfo.sector,
          industry: sectorInfo.industry,
        });
      }
    }

    logger.info("Sector/industry info collected", {
      total: tickers.length,
      collected: sectorMap.size,
    });

    return sectorMap;
  }

  /**
   * Map Korean industry name to broader sector category
   * 한국 업종명을 더 넓은 섹터 카테고리로 매핑
   */
  private mapIndustryToSector(industry: string): string {
    // Simplified sector mapping based on Korean industry names
    if (industry.includes("전기") || industry.includes("전자")) {
      return "Technology";
    } else if (industry.includes("화학") || industry.includes("제약")) {
      return "Healthcare";
    } else if (
      industry.includes("금융") ||
      industry.includes("은행") ||
      industry.includes("증권")
    ) {
      return "Financials";
    } else if (industry.includes("자동차")) {
      return "Consumer Cyclical";
    } else if (industry.includes("식품") || industry.includes("음료")) {
      return "Consumer Defensive";
    } else if (industry.includes("건설") || industry.includes("부동산")) {
      return "Real Estate";
    } else if (industry.includes("철강") || industry.includes("금속")) {
      return "Basic Materials";
    } else if (
      industry.includes("에너지") ||
      industry.includes("전력") ||
      industry.includes("가스")
    ) {
      return "Energy";
    } else if (industry.includes("통신") || industry.includes("미디어")) {
      return "Communication Services";
    } else if (industry.includes("운송") || industry.includes("물류")) {
      return "Industrials";
    } else {
      return "Unknown";
    }
  }
}
