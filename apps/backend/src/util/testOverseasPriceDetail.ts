/**
 * Test script for overseas stock price detail API
 * 해외주식 현재가상세 테스트 스크립트
 *
 * Usage:
 *   tsx src/util/testOverseasPriceDetail.ts
 */

import { KISApiFactory } from "../infrastructure/api/KISApiFactory";
import { logger } from "./logger";

async function testOverseasPriceDetail() {
  try {
    logger.info("=== 해외주식 현재가상세 테스트 시작 ===");

    const factory = KISApiFactory.getInstance();
    const kisApi = factory.create();

    logger.info("테스트 파라미터: TSLA (NASDAQ)");

    const result = await kisApi.getOverseasPriceDetail("TSLA", "NAS");

    logger.info("API 응답 수신 완료", {
      output_length: result.output?.length || 0,
      rt_cd: result.rt_cd,
      msg1: result.msg1,
    });

    if (result.output && result.output.length > 0) {
      logger.info("=== 현재가 상세 정보 ===");
      const data = result.output[0];

      logger.info("기본 정보", {
        종목코드: data.rsym,
        종목명: data.name,
        현재가: data.last,
        전일종가: data.base,
        시가: data.open,
        고가: data.high,
        저가: data.low,
      });

      logger.info("거래 정보", {
        거래량: data.tvol,
        거래대금: data.tamt,
        체결시각: data.ttyp,
      });

      logger.info("호가 정보", {
        매수호가: data.pbid,
        매도호가: data.pask,
        매수호가잔량: data.vbid,
        매도호가잔량: data.vask,
      });

      logger.info("변동 정보", {
        대비: data.diff,
        등락율: data.rate,
        대비기호: data.sign,
      });

      logger.info("시장 정보", {
        거래소코드: data.excd,
        통화단위: data.curr,
        시장상태: data.mtyp,
      });

      // 모든 필드 출력
      logger.info("전체 데이터", data);
    }

    logger.info("=== 다양한 종목 테스트 ===");

    const testTickers = [
      { ticker: "AAPL", exchange: "NAS", name: "Apple" },
      { ticker: "MSFT", exchange: "NYS", name: "Microsoft" },
      { ticker: "GOOGL", exchange: "NAS", name: "Google" },
      { ticker: "AMZN", exchange: "NAS", name: "Amazon" },
      { ticker: "META", exchange: "NAS", name: "Meta" },
    ];

    for (const test of testTickers) {
      logger.info(`${test.name} (${test.ticker}) 조회 중...`);

      const tickerResult = await kisApi.getOverseasPriceDetail(
        test.ticker,
        test.exchange
      );

      if (tickerResult.output && tickerResult.output.length > 0) {
        const data = tickerResult.output[0];
        logger.info(`${test.name} 현재가 정보`, {
          종목코드: test.ticker,
          현재가: data.last,
          대비: data.diff,
          등락율: data.rate,
          거래량: data.tvol,
        });
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    logger.info("=== 다양한 거래소 테스트 ===");

    const exchanges = [
      { code: "NYS", name: "뉴욕", ticker: "JPM" },
      { code: "NAS", name: "나스닥", ticker: "NVDA" },
      { code: "AMS", name: "아멕스", ticker: "SPY" },
    ];

    for (const exchange of exchanges) {
      logger.info(`${exchange.name} 거래소 (${exchange.code}) 테스트...`);

      const exchangeResult = await kisApi.getOverseasPriceDetail(
        exchange.ticker,
        exchange.code
      );

      if (exchangeResult.output && exchangeResult.output.length > 0) {
        const data = exchangeResult.output[0];
        logger.info(`${exchange.name} 데이터`, {
          ticker: exchange.ticker,
          현재가: data.last,
          거래량: data.tvol,
          output_length: exchangeResult.output.length,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    logger.info("=== 테스트 완료 ===");
  } catch (error) {
    logger.error("테스트 실패", { error });
    throw error;
  }
}

if (require.main === module) {
  testOverseasPriceDetail()
    .then(() => {
      logger.info("프로그램 정상 종료");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("프로그램 오류 발생", { error });
      process.exit(1);
    });
}

export { testOverseasPriceDetail };
