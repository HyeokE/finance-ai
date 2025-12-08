import { PortfolioAggregator } from "../module/PortfolioAggregator";
import { Position, Market, Currency } from "../model/Trading";

/**
 * PortfolioAggregator Test Suite
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

async function runPortfolioAggregatorTests() {
  console.log("\n🧪 Starting PortfolioAggregator Tests\n");

  const aggregator = new PortfolioAggregator();

  // Test 1: Market allocation calculation
  console.log("📋 Test 1: Market allocation calculation");
  {
    const positions: Position[] = [
      {
        ticker: "005930",
        name: "Samsung Electronics",
        quantity: 10,
        avg_price: 70000,
        current_price: 75000,
        market_value: 750000,
        unrealized_pnl: 50000,
        unrealized_pnl_pct: 0.0714,
        weight: 0.5,
        market: Market.DOMESTIC,
      },
      {
        ticker: "AAPL",
        name: "Apple Inc",
        quantity: 5,
        avg_price: 170,
        current_price: 180,
        market_value: 900,
        unrealized_pnl: 50,
        unrealized_pnl_pct: 0.0588,
        weight: 0.5,
        market: Market.US,
      },
    ];

    const byMarket = aggregator.calculateByMarket(positions);

    assert(Object.keys(byMarket).length > 0, "Should return market allocation");
    assertClose(
      byMarket.DOMESTIC,
      750000 / (750000 + 900),
      0.01,
      "DOMESTIC allocation should be ~99.9%"
    );
    assertClose(
      byMarket.US,
      900 / (750000 + 900),
      0.01,
      "US allocation should be ~0.1%"
    );
  }

  // Test 2: Currency allocation calculation
  console.log("\n📋 Test 2: Currency allocation calculation");
  {
    const positions: Position[] = [
      {
        ticker: "005930",
        name: "Samsung Electronics",
        quantity: 10,
        avg_price: 70000,
        current_price: 75000,
        market_value: 750000, // KRW
        unrealized_pnl: 50000,
        unrealized_pnl_pct: 0.0714,
        weight: 0.6,
        market: Market.DOMESTIC,
        currency: Currency.KRW,
      },
      {
        ticker: "AAPL",
        name: "Apple Inc",
        quantity: 5,
        avg_price: 170,
        current_price: 180,
        market_value: 900, // USD
        unrealized_pnl: 50,
        unrealized_pnl_pct: 0.0588,
        weight: 0.4,
        market: Market.US,
        currency: Currency.USD,
      },
    ];

    const exchangeRates = {
      KRW: 1,
      USD: 1300, // 1 USD = 1300 KRW
      HKD: 165,
      JPY: 9,
      CNY: 180,
    };

    const byCurrency = aggregator.calculateByCurrency(positions, exchangeRates);

    assert(Object.keys(byCurrency).length > 0, "Should return currency allocation");
    
    // Total: 750000 KRW + 900 USD * 1300 = 750000 + 1170000 = 1920000 KRW
    const totalKRW = 750000 + 900 * 1300;
    assertClose(
      byCurrency.KRW,
      750000 / totalKRW,
      0.01,
      "KRW allocation should be ~39%"
    );
    assertClose(
      byCurrency.USD,
      (900 * 1300) / totalKRW,
      0.01,
      "USD allocation should be ~61%"
    );
  }

  // Test 3: Empty portfolio
  console.log("\n📋 Test 3: Empty portfolio handling");
  {
    const positions: Position[] = [];

    const byMarket = aggregator.calculateByMarket(positions);
    const byCurrency = aggregator.calculateByCurrency(positions, {
      KRW: 1,
      USD: 1300,
      HKD: 165,
      JPY: 9,
      CNY: 180,
    });

    assert(
      !byMarket.DOMESTIC || byMarket.DOMESTIC === 0,
      "Empty portfolio should have no domestic allocation"
    );
    assert(
      !byMarket.US || byMarket.US === 0,
      "Empty portfolio should have no US allocation"
    );
    assert(
      !byCurrency.KRW || byCurrency.KRW === 0,
      "Empty portfolio should have no KRW allocation"
    );
    assert(
      !byCurrency.USD || byCurrency.USD === 0,
      "Empty portfolio should have no USD allocation"
    );
  }

  // Test 4: Daily return calculation
  console.log("\n📋 Test 4: Daily return calculation");
  {
    const currentEquity = 11000000;
    const previousEquity = 10000000;

    const dailyReturn = aggregator.calculateDailyReturn(currentEquity, previousEquity);

    assertClose(dailyReturn, 0.1, 0.0001, "Daily return should be 10%");
  }

  // Test 5: Enrich positions with market and currency
  console.log("\n📋 Test 5: Enrich positions with market and currency info");
  {
    const positions: Position[] = [
      {
        ticker: "005930",
        name: "Samsung Electronics",
        quantity: 10,
        avg_price: 70000,
        current_price: 75000,
        market_value: 750000,
        unrealized_pnl: 50000,
        unrealized_pnl_pct: 0.0714,
        weight: 0.5,
      },
      {
        ticker: "AAPL",
        name: "Apple Inc",
        quantity: 5,
        avg_price: 170,
        current_price: 180,
        market_value: 900,
        unrealized_pnl: 50,
        unrealized_pnl_pct: 0.0588,
        weight: 0.5,
      },
    ];

    const enriched = aggregator.enrichPositions(positions);

    assert(enriched.length === 2, "Should return all positions");
    assert(enriched[0].market === Market.DOMESTIC, "Samsung should be DOMESTIC market");
    assert(enriched[0].currency === Currency.KRW, "Samsung should be KRW currency");
    assert(enriched[1].market === Market.US, "Apple should be US market");
    assert(enriched[1].currency === Currency.USD, "Apple should be USD currency");
  }

  // Test 6: Multi-market portfolio allocation (DOMESTIC and US)
  console.log("\n📋 Test 6: Multi-market portfolio allocation (DOMESTIC and US)");
  {
    const positions: Position[] = [
      {
        ticker: "005930",
        name: "Samsung",
        quantity: 10,
        avg_price: 70000,
        current_price: 75000,
        market_value: 750000,
        unrealized_pnl: 50000,
        unrealized_pnl_pct: 0.0714,
        weight: 0.45,
        market: Market.DOMESTIC,
      },
      {
        ticker: "AAPL",
        name: "Apple",
        quantity: 5,
        avg_price: 170,
        current_price: 180,
        market_value: 900000, // USD converted to KRW
        unrealized_pnl: 50000,
        unrealized_pnl_pct: 0.0588,
        weight: 0.55,
        market: Market.US,
      },
    ];

    const byMarket = aggregator.calculateByMarket(positions);

    const total = 750000 + 900000;
    assertClose(byMarket.DOMESTIC, 750000 / total, 0.01, "DOMESTIC ~45.5%");
    assertClose(byMarket.US, 900000 / total, 0.01, "US ~54.5%");
  }

  // Test 7: Zero division handling
  console.log("\n📋 Test 7: Zero division handling in daily return");
  {
    const dailyReturn = aggregator.calculateDailyReturn(11000000, 0);
    assert(dailyReturn === 0, "Should return 0 when previous equity is 0");
  }

  console.log("\n✅ All PortfolioAggregator tests passed!\n");
}

// Run tests
runPortfolioAggregatorTests().catch((error) => {
  console.error("\n❌ Test failed:", error.message);
  console.error(error.stack);
  process.exit(1);
});

