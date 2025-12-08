import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";

export interface StockMasterItem {
  ticker: string;
  name: string;
  nameEn?: string;
  market: string;
  exchangeCode?: string;
  securityType?: string;
}

class StockMasterParser {
  private kospiStocks: StockMasterItem[] = [];
  private kosdaqStocks: StockMasterItem[] = [];
  private nasdaqStocks: StockMasterItem[] = [];
  private nysStocks: StockMasterItem[] = [];
  private amsStocks: StockMasterItem[] = [];
  private loaded = false;

  /**
   * Load all master files
   */
  load(): void {
    if (this.loaded) return;

    try {
      const dataDir = path.join(__dirname, "../data");

      this.kospiStocks = this.parseKoreanMasterFile(
        path.join(dataDir, "kospi_code.mst")
      );
      this.kosdaqStocks = this.parseKoreanMasterFile(
        path.join(dataDir, "kosdaq_code.mst")
      );

      this.nasdaqStocks = this.parseOverseasMasterFile(
        path.join(dataDir, "nasmst.cod"),
        "US"
      );
      this.nysStocks = this.parseOverseasMasterFile(
        path.join(dataDir, "nysmst.cod"),
        "US"
      );
      this.amsStocks = this.parseOverseasMasterFile(
        path.join(dataDir, "amsmst.cod"),
        "US"
      );

      this.loaded = true;

      logger.info("Stock master files loaded", {
        kospi: this.kospiStocks.length,
        kosdaq: this.kosdaqStocks.length,
        nasdaq: this.nasdaqStocks.length,
        nys: this.nysStocks.length,
        ams: this.amsStocks.length,
      });
    } catch (error) {
      logger.error("Failed to load stock master files", { error });
    }
  }

  /**
   * Parse Korean master file (KOSPI/KOSDAQ)
   * Format: Fixed-width format
   * - Position 0-5: Ticker (6 chars, alphanumeric)
   * - After ticker: Korean name (EUC-KR encoding)
   */
  private parseKoreanMasterFile(filePath: string): StockMasterItem[] {
    try {
      // Read file as buffer first, then try to decode
      const buffer = fs.readFileSync(filePath);
      // Try UTF-8 first, if that fails use latin1 (preserves bytes)
      let content: string;
      try {
        content = buffer.toString("utf-8");
      } catch {
        content = buffer.toString("latin1");
      }

      const lines = content.split("\n");
      const stocks: StockMasterItem[] = [];

      for (const line of lines) {
        if (!line || line.length < 6) continue;

        // Extract ticker (first 6 characters, trim spaces)
        const ticker = line.substring(0, 6).trim();
        if (!ticker) continue;

        // Skip if ticker doesn't match pattern (6 alphanumeric chars)
        if (!/^[A-Z0-9]{6}$/.test(ticker)) continue;

        // Extract Korean name - find text after ticker
        let nameStart = 6;
        while (
          nameStart < line.length &&
          (line[nameStart] === " " || line[nameStart] === "\t")
        ) {
          nameStart++;
        }

        // Extract name until we hit control characters or too many spaces
        let name = "";
        let i = nameStart;
        let consecutiveSpaces = 0;

        while (i < Math.min(line.length, nameStart + 60)) {
          const char = line[i];
          const charCode = char.charCodeAt(0);

          // Stop if we hit control characters (except tab)
          if (charCode < 32 && charCode !== 9) break;

          // Stop if we hit too many consecutive spaces
          if (char === " ") {
            consecutiveSpaces++;
            if (consecutiveSpaces > 2) break;
          } else {
            consecutiveSpaces = 0;
          }

          name += char;
          i++;
        }

        name = name.trim();
        name = name.replace(/\s+/g, " ").trim();

        // Only add if we have a meaningful name (at least 2 characters)
        if (name && name.length >= 2) {
          stocks.push({
            ticker,
            name,
            market: "DOMESTIC",
          });
        }
      }

      return stocks;
    } catch (error) {
      logger.error("Failed to parse Korean master file", { filePath, error });
      return [];
    }
  }

  /**
   * Parse overseas master file (US markets)
   * Format: Tab-separated
   * Columns based on Python code:
   * 0: National code
   * 1: Exchange id
   * 2: Exchange code
   * 3: Exchange name
   * 4: Symbol (ticker)
   * 5: realtime symbol
   * 6: Korea name
   * 7: English name
   * 8: Security type (1:Index,2:Stock,3:ETP(ETF),4:Warrant)
   * 9-23: Other fields
   */
  private parseOverseasMasterFile(
    filePath: string,
    market: string
  ): StockMasterItem[] {
    try {
      if (!fs.existsSync(filePath)) {
        logger.warn("Master file not found", { filePath });
        return [];
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      const stocks: StockMasterItem[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;

        const columns = line.split("\t");
        if (columns.length < 9) continue;

        const ticker = columns[4]?.trim();
        const koreanName = columns[6]?.trim() || "";
        const englishName = columns[7]?.trim() || "";
        const securityType = columns[8]?.trim();
        const exchangeCode = columns[2]?.trim();

        if (ticker && (koreanName || englishName)) {
          stocks.push({
            ticker,
            name: koreanName || englishName,
            nameEn: englishName || undefined,
            market,
            exchangeCode,
            securityType,
          });
        }
      }

      return stocks;
    } catch (error) {
      logger.error("Failed to parse overseas master file", { filePath, error });
      return [];
    }
  }

  /**
   * Search stocks by query
   */
  search(query: string, market: string): StockMasterItem[] {
    if (!this.loaded) {
      this.load();
    }

    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return [];

    let stocks: StockMasterItem[] = [];

    if (market === "DOMESTIC") {
      stocks = [...this.kospiStocks, ...this.kosdaqStocks];
    } else if (market === "US") {
      stocks = [...this.nasdaqStocks, ...this.nysStocks, ...this.amsStocks];
    }

    const results = stocks.filter(
      (stock) =>
        stock.ticker.toLowerCase().includes(lowerQuery) ||
        stock.name.toLowerCase().includes(lowerQuery) ||
        stock.nameEn?.toLowerCase().includes(lowerQuery)
    );

    return results.slice(0, 50);
  }

  /**
   * Get stock by ticker
   */
  getByTicker(ticker: string, market: string): StockMasterItem | null {
    if (!this.loaded) {
      this.load();
    }

    const lowerTicker = ticker.toLowerCase().trim();
    let stocks: StockMasterItem[] = [];

    if (market === "DOMESTIC") {
      stocks = [...this.kospiStocks, ...this.kosdaqStocks];
    } else if (market === "US") {
      stocks = [...this.nasdaqStocks, ...this.nysStocks, ...this.amsStocks];
    }

    return stocks.find((s) => s.ticker.toLowerCase() === lowerTicker) || null;
  }

  /**
   * Get all stocks for a market
   */
  getAll(market: string): StockMasterItem[] {
    if (!this.loaded) {
      this.load();
    }

    if (market === "DOMESTIC") {
      return [...this.kospiStocks, ...this.kosdaqStocks];
    } else if (market === "US") {
      return [...this.nasdaqStocks, ...this.nysStocks, ...this.amsStocks];
    }

    return [];
  }
}

// Singleton instance
export const stockMasterParser = new StockMasterParser();
