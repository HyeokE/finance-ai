import { Position, Market, Currency } from "../model/Trading";
import { logger } from "../util/logger";

/**
 * PortfolioAggregator Module
 * Calculates portfolio statistics and risk metrics
 */
export class PortfolioAggregator {
  /**
   * Calculate portfolio allocation by market
   * Returns percentage allocation for each market (DOMESTIC, US, HK, JP, CN)
   */
  calculateByMarket(positions: Position[]): Record<string, number> {
    const totalEquity = positions.reduce(
      (sum, pos) => sum + pos.market_value,
      0
    );

    if (totalEquity === 0) {
      return { DOMESTIC: 0, US: 0 };
    }

    const byMarket: Record<string, number> = {
      DOMESTIC: 0,
      US: 0,
    };

    for (const position of positions) {
      const market = this.determineMarket(position);
      byMarket[market] = (byMarket[market] || 0) + position.market_value;
    }

    // Convert to percentages
    for (const market in byMarket) {
      byMarket[market] = byMarket[market] / totalEquity;
    }

    logger.debug("Portfolio allocation by market", { byMarket });
    return byMarket;
  }

  /**
   * Calculate portfolio allocation by currency
   * Returns percentage allocation for each currency (KRW, USD, HKD, JPY, CNY)
   */
  calculateByCurrency(
    positions: Position[],
    exchangeRates: Record<string, number>
  ): Record<string, number> {
    const totalEquity = positions.reduce(
      (sum, pos) => sum + pos.market_value,
      0
    );

    if (totalEquity === 0) {
      return { KRW: 0, USD: 0 };
    }

    const byCurrency: Record<string, number> = {
      KRW: 0,
      USD: 0,
    };

    for (const position of positions) {
      const currency = this.determineCurrency(position);
      const marketValueKRW = this.convertToKRW(
        position.market_value,
        currency,
        exchangeRates
      );
      byCurrency[currency] = (byCurrency[currency] || 0) + marketValueKRW;
    }

    // Convert to percentages
    const totalKRW = Object.values(byCurrency).reduce((sum, val) => sum + val, 0);
    for (const currency in byCurrency) {
      byCurrency[currency] = totalKRW > 0 ? byCurrency[currency] / totalKRW : 0;
    }

    logger.debug("Portfolio allocation by currency", { byCurrency });
    return byCurrency;
  }

  /**
   * Calculate realized P/L for today
   * This would require accessing daily execution data from KIS API
   * For now, returns 0 as placeholder
   */
  calculateRealizedPLToday(accountNumber: string): number {
    // TODO: Implement by calling KIS API for daily execution history
    // /uapi/domestic-stock/v1/trading/inquire-daily-ccld
    logger.debug("Realized P/L calculation not yet implemented", {
      accountNumber,
    });
    return 0;
  }

  /**
   * Calculate daily return
   * (current_equity - previous_equity) / previous_equity
   */
  calculateDailyReturn(
    currentEquity: number,
    previousEquity: number
  ): number {
    if (previousEquity === 0) return 0;
    return (currentEquity - previousEquity) / previousEquity;
  }

  /**
   * Determine market from position
   * Uses ticker pattern and market field if available
   */
  private determineMarket(position: Position): string {
    if (position.market) {
      return position.market;
    }

    // Heuristic based on ticker format
    const ticker = position.ticker;

    // Korean stocks are typically 6 digits
    if (/^\d{6}$/.test(ticker)) {
      return Market.DOMESTIC;
    }

    // US stocks are typically letters
    if (/^[A-Z]+$/.test(ticker)) {
      return Market.US;
    }

    // Default to DOMESTIC
    return Market.DOMESTIC;
  }

  /**
   * Determine currency from position
   * Uses market to infer currency
   */
  private determineCurrency(position: Position): string {
    if (position.currency) {
      return position.currency;
    }

    // Determine market first
    const market = this.determineMarket(position);

    switch (market) {
      case Market.DOMESTIC:
        return Currency.KRW;
      case Market.US:
        return Currency.USD;
      default:
        return Currency.KRW;
    }
  }

  /**
   * Convert value to KRW based on currency
   */
  private convertToKRW(
    value: number,
    currency: string,
    exchangeRates: Record<string, number>
  ): number {
    if (currency === Currency.KRW) {
      return value;
    }

    // Exchange rates should be in format: USD: 1300 (meaning 1 USD = 1300 KRW)
    const rate = exchangeRates[currency] || 1;
    return value * rate;
  }

  /**
   * Enrich positions with market and currency information
   */
  enrichPositions(positions: Position[]): Position[] {
    return positions.map((pos) => ({
      ...pos,
      market: (this.determineMarket(pos) as Market) || pos.market,
      currency: (this.determineCurrency(pos) as Currency) || pos.currency,
    }));
  }
}

