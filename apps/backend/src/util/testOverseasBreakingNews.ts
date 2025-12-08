/**
 * Test script for overseas breaking news API
 * 해외속보(제목) 테스트 스크립트
 *
 * Usage:
 *   tsx src/util/testOverseasBreakingNews.ts
 */

import { KISApiFactory } from "../infrastructure/api/KISApiFactory";
import { logger } from "./logger";

interface BreakingNewsItem {
  stck_bsop_date?: string;
  stck_bsop_hour?: string;
  stck_shrn_iscd?: string;
  hts_kor_isnm?: string;
  brk_news_titl?: string;
  brk_news_clas_code?: string;
  brk_news_clas_name?: string;
  news_srno?: string;
  [key: string]: any;
}

async function testOverseasBreakingNews() {
  try {
    logger.info("=== 해외속보(제목) 테스트 시작 ===");

    const factory = KISApiFactory.getInstance();
    const kisApi = factory.create();

    logger.info("테스트 파라미터: 전체 뉴스 조회");

    // 전체 뉴스 조회
    const result = await kisApi.getOverseasBreakingNews(
      "0", // 0: 전체 조회
      "11801" // 조건화면분류코드
    );

    logger.info("API 응답 수신 완료", {
      output_length: result.output?.length || 0,
      rt_cd: result.rt_cd,
      msg1: result.msg1,
    });

    if (result.output && result.output.length > 0) {
      logger.info(`=== 최근 해외속보 (${result.output.length}건) ===`);

      // 최근 10건 출력
      const recentNews = result.output.slice(0, 10);

      recentNews.forEach((item: BreakingNewsItem, index: number) => {
        logger.info(
          `[${index + 1}] ${item.stck_bsop_date} ${item.stck_bsop_hour}`,
          {
            종목코드: item.stck_shrn_iscd,
            종목명: item.hts_kor_isnm,
            제목: item.brk_news_titl,
            뉴스분류: item.brk_news_clas_name,
          }
        );
      });

      // 뉴스 분류별 통계
      const newsByClass = result.output.reduce(
        (acc: any, item: BreakingNewsItem) => {
          const className = item.brk_news_clas_name || "미분류";
          acc[className] = (acc[className] || 0) + 1;
          return acc;
        },
        {}
      );

      logger.info("=== 뉴스 분류별 통계 ===", newsByClass);

      // 종목별 뉴스 개수
      const newsByStock = result.output.reduce(
        (acc: any, item: BreakingNewsItem) => {
          if (item.stck_shrn_iscd && item.stck_shrn_iscd.trim()) {
            const key = `${item.stck_shrn_iscd}(${item.hts_kor_isnm})`;
            acc[key] = (acc[key] || 0) + 1;
          }
          return acc;
        },
        {}
      );

      logger.info("=== 종목별 뉴스 개수 (Top 10) ===");
      Object.entries(newsByStock)
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([stock, count]) => {
          logger.info(`${stock}: ${count}건`);
        });
    }

    logger.info("=== 특정 종목 뉴스 검색 ===");

    // Tesla 뉴스 검색
    const teslaNews = await kisApi.getOverseasBreakingNews(
      "0",
      "11801",
      "",
      "TSLA", // 종목코드
      "",
      "",
      "",
      "",
      ""
    );

    if (teslaNews.output && teslaNews.output.length > 0) {
      logger.info(`Tesla 관련 뉴스 ${teslaNews.output.length}건 발견`);
      teslaNews.output
        .slice(0, 5)
        .forEach((item: BreakingNewsItem, index: number) => {
          logger.info(`[TSLA ${index + 1}]`, {
            날짜: item.stck_bsop_date,
            시간: item.stck_bsop_hour,
            제목: item.brk_news_titl,
          });
        });
    } else {
      logger.info("Tesla 관련 뉴스가 없습니다.");
    }

    logger.info("=== 제목 키워드 검색 ===");

    // 특정 키워드 검색 (예: AI, Tech)
    const keywords = ["AI", "Tech", "Market", "Fed"];

    for (const keyword of keywords) {
      const keywordNews = await kisApi.getOverseasBreakingNews(
        "0",
        "11801",
        "",
        "",
        keyword, // 제목 내용 검색
        "",
        "",
        "",
        ""
      );

      if (keywordNews.output && keywordNews.output.length > 0) {
        logger.info(`"${keyword}" 키워드 뉴스: ${keywordNews.output.length}건`);
        const firstNews = keywordNews.output[0];
        logger.info(`  → ${firstNews.brk_news_titl}`);
      } else {
        logger.info(`"${keyword}" 키워드 뉴스: 없음`);
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    logger.info("=== 날짜별 뉴스 조회 ===");

    // 오늘 날짜 (YYYYMMDD 형식)
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");

    const todayNews = await kisApi.getOverseasBreakingNews(
      "0",
      "11801",
      "",
      "",
      "",
      dateStr, // 오늘 날짜
      "",
      "",
      ""
    );

    if (todayNews.output && todayNews.output.length > 0) {
      logger.info(`오늘(${dateStr}) 뉴스: ${todayNews.output.length}건`);

      // 시간대별 분포
      const hourlyDist = todayNews.output.reduce(
        (acc: any, item: BreakingNewsItem) => {
          if (item.stck_bsop_hour) {
            const hour = item.stck_bsop_hour.substring(0, 2);
            acc[hour] = (acc[hour] || 0) + 1;
          }
          return acc;
        },
        {}
      );

      logger.info("시간대별 뉴스 분포", hourlyDist);
    }

    logger.info("=== 테스트 완료 ===");
  } catch (error) {
    logger.error("테스트 실패", { error });
    throw error;
  }
}

if (require.main === module) {
  testOverseasBreakingNews()
    .then(() => {
      logger.info("프로그램 정상 종료");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("프로그램 오류 발생", { error });
      process.exit(1);
    });
}

export { testOverseasBreakingNews };
