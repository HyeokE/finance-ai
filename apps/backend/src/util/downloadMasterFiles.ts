import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { pipeline } from "stream/promises";
import { logger } from "./logger";

const BASE_URL = "https://new.real.download.dws.co.kr/common/master";

const MARKET_CODES = {
  nasdaq: "nas",
  nyse: "nys",
  amex: "ams",
} as const;

type MarketCode = keyof typeof MARKET_CODES;

export class MasterFileDownloader {
  private readonly dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(__dirname, "../data");
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private async downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      https
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(`Failed to download: ${response.statusCode} ${url}`)
            );
            return;
          }

          const fileStream = fs.createWriteStream(destPath);
          response.pipe(fileStream);

          fileStream.on("finish", () => {
            fileStream.close();
            resolve();
          });

          fileStream.on("error", reject);
        })
        .on("error", reject);
    });
  }

  private async extractZip(zipPath: string, destDir: string): Promise<void> {
    const zipContent = fs.readFileSync(zipPath);
    const unzipped = zlib.unzipSync(zipContent);

    const fileName = path.basename(zipPath, ".zip");
    const extractPath = path.join(destDir, fileName);

    fs.writeFileSync(extractPath, unzipped);
    logger.info("Extracted file", { extractPath });
  }

  async downloadMarketFile(marketCode: MarketCode): Promise<void> {
    const code = MARKET_CODES[marketCode];
    const fileName = `${code}mst.cod`;
    const url = `${BASE_URL}/${fileName}.zip`;
    const zipPath = path.join(this.dataDir, `${fileName}.zip`);
    const extractedPath = path.join(this.dataDir, fileName);

    try {
      logger.info("Downloading master file", { marketCode, url });
      await this.downloadFile(url, zipPath);

      logger.info("Extracting master file", { zipPath });
      await this.extractZip(zipPath, this.dataDir);

      fs.unlinkSync(zipPath);

      logger.info("Successfully downloaded and extracted", {
        marketCode,
        file: extractedPath,
      });
    } catch (error) {
      logger.error("Failed to download master file", { marketCode, error });
      throw error;
    }
  }

  async downloadAll(): Promise<void> {
    const markets = Object.keys(MARKET_CODES) as MarketCode[];

    logger.info("Starting download of all master files", {
      count: markets.length,
    });

    const results: { market: MarketCode; success: boolean; error?: string }[] =
      [];

    for (const market of markets) {
      try {
        await this.downloadMarketFile(market);
        results.push({ market, success: true });
      } catch (error) {
        results.push({
          market,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    logger.info("Download completed", {
      total: markets.length,
      success: successCount,
      failed: failCount,
      results,
    });

    if (failCount > 0) {
      const failedMarkets = results
        .filter((r) => !r.success)
        .map((r) => r.market);
      logger.warn("Some downloads failed", { failedMarkets });
    }
  }

  async downloadUSStocks(): Promise<void> {
    const usMarkets: MarketCode[] = ["nasdaq", "nyse", "amex"];

    logger.info("Starting download of US stock master files", {
      count: usMarkets.length,
    });

    for (const market of usMarkets) {
      try {
        await this.downloadMarketFile(market);
      } catch (error) {
        logger.error("Failed to download US market", { market, error });
      }
    }
  }
}

if (require.main === module) {
  const downloader = new MasterFileDownloader();

  const args = process.argv.slice(2);
  const command = args[0] || "all";

  (async () => {
    try {
      if (command === "all") {
        await downloader.downloadAll();
      } else if (command === "us") {
        await downloader.downloadUSStocks();
      } else if (command in MARKET_CODES) {
        await downloader.downloadMarketFile(command as MarketCode);
      } else {
        console.log("Usage:");
        console.log(
          "  npm run download-master-files all     - Download all US market files"
        );
        console.log(
          "  npm run download-master-files us      - Download US market files only"
        );
        console.log(
          `  npm run download-master-files <market> - Download specific market`
        );
        console.log(
          `\nAvailable markets: ${Object.keys(MARKET_CODES).join(", ")}`
        );
        process.exit(1);
      }

      logger.info("Master file download script completed");
      process.exit(0);
    } catch (error) {
      logger.error("Master file download script failed", { error });
      process.exit(1);
    }
  })();
}
