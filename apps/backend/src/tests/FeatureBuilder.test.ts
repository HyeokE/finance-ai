import { FeatureBuilder } from "../module/FeatureBuilder";
import { PriceData } from "../module/DataCollector";
import { OHLCVolumePoint } from "../model/Trading";

/**
 * FeatureBuilder Test Suite
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion failed: ${message}`);
  }
  console.log(`✅ ${message}`);
}

function assertClose(actual: number, expected: number, tolerance: number, message: string) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(`❌ ${message}: expected ${expected}, got ${actual} (diff: ${diff})`);
  }
  console.log(`✅ ${message}`);
}

async function runFeatureBuilderTests() {
  console.log("\n🧪 Starting FeatureBuilder Tests\n");

  const featureBuilder = new FeatureBuilder();

  // Test 1: Basic feature building with complete data
  console.log("📋 Test 1: Basic feature building with complete data");
  {
    const priceData = new Map<string, PriceData>();
    priceData.set("005930", {
      current: 75000,
      prev_close: 74000,
      open: 74500,
      high: 75500,
      low: 74000,
    });

    const historyData = new Map<string, OHLCVolumePoint[]>();
    const history: OHLCVolumePoint[] = [
      { close: 75000, volume: 1000000, open: 74500, high: 75500, low: 74000 },
      { close: 74000, volume: 900000, open: 73500, high: 74500, low: 73000 },
      { close: 73000, volume: 800000, open: 72500, high: 73500, low: 72000 },
      { close: 72000, volume: 850000, open: 71500, high: 72500, low: 71000 },
      { close: 71000, volume: 900000, open: 70500, high: 71500, low: 70000 },
    ];
    historyData.set("005930", history);

    const sectorData = new Map();
    sectorData.set("005930", { sector: "Technology", industry: "Semiconductors" });

    const supplyData = new Map();
    supplyData.set("005930", { foreign_net_buy: 100000, institution_net_buy: 50000 });

    const features = featureBuilder.buildStockFeatures(
      ["005930"],
      priceData,
      historyData,
      sectorData,
      supplyData
    );

    assert(features.length === 1, "Should generate 1 feature");
    assert(features[0].ticker === "005930", "Ticker should be 005930");
    assert(features[0].price === 75000, "Price should be 75000");
    assertClose(
      features[0].intraday_return,
      (75000 - 74500) / 74500,
      0.0001,
      "Intraday return should be correct"
    );
    assertClose(
      features[0].from_prev_close_return,
      (75000 - 74000) / 74000,
      0.0001,
      "From prev close return should be correct"
    );
    assert(features[0].sector === "Technology - Semiconductors", "Sector should be set");
    assert(features[0].foreign_net_buy === 100000, "Foreign net buy should be set");
    assert(features[0].institution_net_buy === 50000, "Institution net buy should be set");
    assert(features[0].rsi_14d !== undefined, "RSI should be calculated");
  }

  // Test 2: Volume ratio calculation
  console.log("\n📋 Test 2: Volume ratio calculation");
  {
    const priceData = new Map<string, PriceData>();
    priceData.set("AAPL", {
      current: 180,
      prev_close: 178,
      open: 179,
      high: 181,
      low: 178,
    });

    const historyData = new Map<string, OHLCVolumePoint[]>();
    const history: OHLCVolumePoint[] = [];
    // Create 20 days of history with average volume of 1M
    for (let i = 0; i < 20; i++) {
      history.push({
        close: 180 - i,
        volume: 1000000,
        open: 179 - i,
        high: 181 - i,
        low: 178 - i,
      });
    }
    // Today's volume is 2M (2x average)
    history[0].volume = 2000000;
    historyData.set("AAPL", history);

    const features = featureBuilder.buildStockFeatures(
      ["AAPL"],
      priceData,
      historyData,
      new Map(),
      new Map()
    );

    assert(features.length === 1, "Should generate 1 feature");
    assertClose(
      features[0].volume_ratio,
      2.0,
      0.1,
      "Volume ratio should be approximately 2.0"
    );
    assertClose(
      features[0].average_volume_30d,
      1050000,
      100000,
      "Average volume should be correct"
    );
  }

  // Test 3: EMA calculation
  console.log("\n📋 Test 3: EMA calculation");
  {
    const priceData = new Map<string, PriceData>();
    priceData.set("MSFT", {
      current: 400,
      prev_close: 390,
      open: 395,
      high: 405,
      low: 390,
    });

    const historyData = new Map<string, OHLCVolumePoint[]>();
    const history: OHLCVolumePoint[] = [];
    // Create 30 days of ascending prices
    for (let i = 0; i < 30; i++) {
      history.push({
        close: 400 - i * 2,
        volume: 1000000,
        open: 399 - i * 2,
        high: 401 - i * 2,
        low: 398 - i * 2,
      });
    }
    historyData.set("MSFT", history);

    const features = featureBuilder.buildStockFeatures(
      ["MSFT"],
      priceData,
      historyData,
      new Map(),
      new Map()
    );

    assert(features.length === 1, "Should generate 1 feature");
    assert(features[0].ema5_position > 0, "EMA5 position should be positive");
    assert(features[0].ema20_position > 0, "EMA20 position should be positive");
    // Current price (400) should be above historical prices, so position > 1
    assert(features[0].ema5_position >= 1, "Price should be above EMA5 (uptrend)");
    assert(features[0].ema20_position >= 1, "Price should be above EMA20 (uptrend)");
  }

  // Test 4: Volatility calculation
  console.log("\n📋 Test 4: Volatility calculation");
  {
    const priceData = new Map<string, PriceData>();
    priceData.set("TSLA", {
      current: 250,
      prev_close: 240,
      open: 245,
      high: 255,
      low: 240,
    });

    const historyData = new Map<string, OHLCVolumePoint[]>();
    const history: OHLCVolumePoint[] = [];
    // Create highly volatile price data
    for (let i = 0; i < 20; i++) {
      history.push({
        close: 250 + (i % 2 === 0 ? 10 : -10) * (i + 1),
        volume: 1000000,
        open: 245 + (i % 2 === 0 ? 10 : -10) * (i + 1),
        high: 255 + (i % 2 === 0 ? 10 : -10) * (i + 1),
        low: 240 + (i % 2 === 0 ? 10 : -10) * (i + 1),
      });
    }
    historyData.set("TSLA", history);

    const features = featureBuilder.buildStockFeatures(
      ["TSLA"],
      priceData,
      historyData,
      new Map(),
      new Map()
    );

    assert(features.length === 1, "Should generate 1 feature");
    assert(features[0].volatility_20d > 0, "Volatility should be positive");
    assert(features[0].atr_14d > 0, "ATR should be positive");
  }

  // Test 5: Missing data handling
  console.log("\n📋 Test 5: Missing data handling");
  {
    const priceData = new Map<string, PriceData>();
    priceData.set("TEST", {
      current: 100,
      prev_close: 0,
      open: 0,
      high: 0,
      low: 0,
    });

    const historyData = new Map<string, OHLCVolumePoint[]>();
    historyData.set("TEST", []); // No history

    const features = featureBuilder.buildStockFeatures(
      ["TEST"],
      priceData,
      historyData,
      new Map(),
      new Map()
    );

    assert(features.length === 1, "Should generate 1 feature even with missing data");
    assert(features[0].price === 100, "Price should be set");
    assert(features[0].history_7d.length === 0, "History should be empty");
    assert(features[0].history_30d.length === 0, "History should be empty");
  }

  // Test 6: Multiple stocks
  console.log("\n📋 Test 6: Multiple stocks feature building");
  {
    const tickers = ["005930", "000660", "035420"];
    const priceData = new Map<string, PriceData>();
    const historyData = new Map<string, OHLCVolumePoint[]>();

    tickers.forEach((ticker, idx) => {
      priceData.set(ticker, {
        current: 100000 + idx * 10000,
        prev_close: 99000 + idx * 10000,
        open: 99500 + idx * 10000,
        high: 101000 + idx * 10000,
        low: 98000 + idx * 10000,
      });

      const history: OHLCVolumePoint[] = [];
      for (let i = 0; i < 10; i++) {
        history.push({
          close: 100000 + idx * 10000 - i * 100,
          volume: 1000000,
          open: 99500 + idx * 10000 - i * 100,
          high: 101000 + idx * 10000 - i * 100,
          low: 98000 + idx * 10000 - i * 100,
        });
      }
      historyData.set(ticker, history);
    });

    const features = featureBuilder.buildStockFeatures(
      tickers,
      priceData,
      historyData,
      new Map(),
      new Map()
    );

    assert(features.length === 3, "Should generate 3 features");
    assert(features[0].ticker === "005930", "First ticker should be 005930");
    assert(features[1].ticker === "000660", "Second ticker should be 000660");
    assert(features[2].ticker === "035420", "Third ticker should be 035420");
  }

  console.log("\n✅ All FeatureBuilder tests passed!\n");
}

// Run tests
runFeatureBuilderTests().catch((error) => {
  console.error("\n❌ Test failed:", error.message);
  console.error(error.stack);
  process.exit(1);
});

