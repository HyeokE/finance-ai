/**
 * Test script for overseas stock daily prices API
 * 해외주식 기간별시세 테스트 스크립트
 *
 * Usage:
 *   tsx src/util/testOverseasDailyPrice.ts
 */

import { KISApiFactory } from "../infrastructure/api/KISApiFactory";
import { logger } from "./logger";

interface DailyPriceItem {
  rsym?: string;
  zdiv?: string;
  nrec?: string;
  xymd?: string;
  clos?: string;
  sign?: string;
  diff?: string;
  rate?: string;
  open?: string;
  high?: string;
  low?: string;
  tvol?: string;
  tamt?: string;
}

async function testOverseasDailyPrice() {
  try {
    logger.info("=== 해외주식 기간별시세 테스트 시작 ===");

    const factory = KISApiFactory.getInstance();
    const kisApi = factory.create();

    logger.info("테스트 파라미터: TSLA (NASDAQ), 월별(2), 수정주가 반영");

    const result = await kisApi.getOverseasDailyPrices(
      "TSLA",
      "NAS",
      "2",
      "",
      "1"
    );

    logger.info("API 응답 수신 완료", {
      output1_length: result.output1?.length || 0,
      output2_length: result.output2?.length || 0,
      rt_cd: result.rt_cd,
      msg1: result.msg1,
    });

    if (result.output1 && result.output1.length > 0) {
      logger.info("=== output1 결과 (최근 5개) ===");
      const recentData = result.output1.slice(0, 5);

      recentData.forEach((item: DailyPriceItem, index: number) => {
        logger.info(`[${index + 1}] ${item.xymd}`, {
          종가: item.clos,
          대비: item.diff,
          등락율: item.rate,
          시가: item.open,
          고가: item.high,
          저가: item.low,
          거래량: item.tvol,
        });
      });
    }

    if (result.output2 && result.output2.length > 0) {
      logger.info("=== output2 결과 (최근 5개) ===");
      const recentData = result.output2.slice(0, 5);

      recentData.forEach((item: DailyPriceItem, index: number) => {
        logger.info(`[${index + 1}] ${item.xymd}`, {
          종가: item.clos,
          대비: item.diff,
          등락율: item.rate,
          시가: item.open,
          고가: item.high,
          저가: item.low,
          거래량: item.tvol,
        });
      });
    }

    logger.info("=== 다양한 기간 유형 테스트 ===");

    logger.info("일별(0) 데이터 조회...");
    const dailyResult = await kisApi.getOverseasDailyPrices(
      "AAPL",
      "NAS",
      "0",
      "",
      "1"
    );
    logger.info("일별 데이터", {
      output1_length: dailyResult.output1?.length || 0,
      output2_length: dailyResult.output2?.length || 0,
    });

    logger.info("주별(1) 데이터 조회...");
    const weeklyResult = await kisApi.getOverseasDailyPrices(
      "AAPL",
      "NAS",
      "1",
      "",
      "1"
    );
    logger.info("주별 데이터", {
      output1_length: weeklyResult.output1?.length || 0,
      output2_length: weeklyResult.output2?.length || 0,
    });

    logger.info("=== 다양한 거래소 테스트 ===");

    const exchanges = [
      { code: "NYS", name: "뉴욕", ticker: "MSFT" },
      { code: "NAS", name: "나스닥", ticker: "GOOGL" },
      { code: "AMS", name: "아멕스", ticker: "SPY" },
    ];

    for (const exchange of exchanges) {
      logger.info(`${exchange.name} 거래소 (${exchange.code}) 테스트...`);
      const exchangeResult = await kisApi.getOverseasDailyPrices(
        exchange.ticker,
        exchange.code,
        "0",
        "",
        "1"
      );
      logger.info(`${exchange.name} 데이터`, {
        ticker: exchange.ticker,
        output1_length: exchangeResult.output1?.length || 0,
        output2_length: exchangeResult.output2?.length || 0,
      });
    }

    logger.info("=== 테스트 완료 ===");
  } catch (error) {
    logger.error("테스트 실패", { error });
    throw error;
  }
}

if (require.main === module) {
  testOverseasDailyPrice()
    .then(() => {
      logger.info("프로그램 정상 종료");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("프로그램 오류 발생", { error });
      process.exit(1);
    });
}

export { testOverseasDailyPrice };
