# Stock Master Files Guide

## 개요

한국투자증권 API를 사용하여 국내 및 해외 주식 정보를 조회할 수 있습니다. 이 시스템은 마스터 파일을 사용하여 주식 종목 코드와 이름을 빠르게 검색합니다.

## 지원 시장

현재 다음 시장을 지원합니다:

- **국내**: KOSPI, KOSDAQ
- **미국**: NASDAQ, NYSE, AMEX

## 마스터 파일 다운로드

### 자동 다운로드 (권장)

마스터 파일을 자동으로 다운로드하는 스크립트가 제공됩니다:

```bash
cd apps/backend

# 모든 마스터 파일 다운로드 (국내 + 미국)
npm run download-master-files all

# 미국 시장만 다운로드
npm run download-master-files us

# 특정 시장만 다운로드
npm run download-master-files nasdaq
npm run download-master-files nyse
npm run download-master-files amex
```

### 수동 다운로드

마스터 파일은 한국투자증권 서버에서 직접 다운로드할 수 있습니다:

**미국 주식:**

- NASDAQ: `https://new.real.download.dws.co.kr/common/master/nasmst.cod.zip`
- NYSE: `https://new.real.download.dws.co.kr/common/master/nysmst.cod.zip`
- AMEX: `https://new.real.download.dws.co.kr/common/master/amsmst.cod.zip`

다운로드 후 압축을 해제하여 `apps/backend/src/data/` 디렉토리에 저장하세요.

## 마스터 파일 구조

### 국내 주식 (kospi_code.mst, kosdaq_code.mst)

고정폭 형식:

- 위치 0-5: 종목코드 (6자리)
- 위치 6~: 한글 종목명

### 해외 주식 (nasmst.cod, nysmst.cod, amsmst.cod)

탭으로 구분된 형식:

- Column 0: 국가코드
- Column 1: 거래소 ID
- Column 2: 거래소 코드
- Column 3: 거래소명
- Column 4: **Symbol (티커)**
- Column 5: 실시간 심볼
- Column 6: **한글 종목명**
- Column 7: **영문 종목명**
- Column 8: 증권 유형 (1:지수, 2:주식, 3:ETP(ETF), 4:워런트)
- Column 9-23: 기타 필드

## API 사용법

### 주식 검색

```typescript
GET /api/stocks/search?query=삼성&market=DOMESTIC
GET /api/stocks/search?query=AAPL&market=US
```

응답:

```json
{
  "success": true,
  "data": [
    {
      "ticker": "005930",
      "name": "삼성전자",
      "nameEn": "Samsung Electronics",
      "market": "DOMESTIC"
    }
  ]
}
```

### 인기 종목 조회

```typescript
GET /api/stocks/popular?market=DOMESTIC&limit=30
GET /api/stocks/popular?market=US&limit=30
```

### 종목 상세 정보

```typescript
GET /api/stocks/:ticker/detail?market=DOMESTIC
```

## StockMasterParser 사용법

```typescript
import { stockMasterParser } from "./util/StockMasterParser";

// 종목 검색
const results = stockMasterParser.search("삼성", "DOMESTIC");
const usResults = stockMasterParser.search("APPLE", "US");

// 티커로 종목 조회
const stock = stockMasterParser.getByTicker("005930", "DOMESTIC");
const usStock = stockMasterParser.getByTicker("AAPL", "US");

// 모든 종목 조회
const allKoreanStocks = stockMasterParser.getAll("DOMESTIC");
const allUSStocks = stockMasterParser.getAll("US");
```

## 마스터 파일 업데이트

마스터 파일은 정기적으로 업데이트해야 합니다. 신규 상장 종목이나 종목명 변경 사항을 반영하려면:

1. 기존 마스터 파일 삭제:

   ```bash
   rm apps/backend/src/data/*.cod
   rm apps/backend/src/data/*.mst
   ```

2. 새 마스터 파일 다운로드:

   ```bash
   npm run download-master-files all
   ```

3. 서버 재시작

## 문제 해결

### 마스터 파일을 찾을 수 없음

```
Master file not found: /path/to/nasmst.cod
```

**해결책**: 마스터 파일을 다운로드하세요:

```bash
npm run download-master-files all
```

### 검색 결과가 없음

**확인 사항**:

1. 마스터 파일이 올바르게 다운로드되었는지 확인
2. 시장 파라미터가 올바른지 확인 (DOMESTIC 또는 US)
3. 검색어가 1자 이상인지 확인

### 파일 인코딩 문제

국내 마스터 파일은 EUC-KR 인코딩을 사용할 수 있습니다. StockMasterParser는 이를 자동으로 처리합니다.

## 해외주식 기간별시세 API

### 개요

해외주식의 일별/주별/월별 가격 데이터를 조회합니다. 페이지네이션을 지원하여 모든 과거 데이터를 자동으로 가져옵니다.

### API 파라미터

```typescript
async getOverseasDailyPrices(
  ticker: string,              // 종목코드 (예: "TSLA", "AAPL")
  exchangeCode: string,        // 거래소코드 (HKS, NYS, NAS, AMS, TSE, SHS, SZS, HSX, HNX)
  period: "0" | "1" | "2",    // 기간구분 (0:일, 1:주, 2:월)
  baseDate: string,            // 조회기준일자 (YYYYMMDD, 빈 문자열이면 오늘)
  adjustPrice: "0" | "1",     // 수정주가반영 (0:미반영, 1:반영)
  maxDepth: number = 10        // 최대 페이지 수 (기본값: 10)
): Promise<any>
```

### 거래소 코드

- **HKS**: 홍콩
- **NYS**: 뉴욕 (NYSE)
- **NAS**: 나스닥 (NASDAQ)
- **AMS**: 아멕스 (AMEX)
- **TSE**: 도쿄
- **SHS**: 상해
- **SZS**: 심천
- **SHI**: 상해지수
- **SZI**: 심천지수
- **HSX**: 호치민
- **HNX**: 하노이

### 사용 예시

```typescript
import { KISApiFactory } from "./infrastructure/api/KISApiFactory";

const factory = KISApiFactory.getInstance();
const kisApi = factory.create();

// TSLA 일별 데이터 (수정주가 반영)
const dailyData = await kisApi.getOverseasDailyPrices(
  "TSLA",
  "NAS",
  "0", // 일별
  "", // 오늘 기준
  "1" // 수정주가 반영
);

// AAPL 월별 데이터
const monthlyData = await kisApi.getOverseasDailyPrices(
  "AAPL",
  "NAS",
  "2", // 월별
  "",
  "1"
);

// 특정 날짜 기준 조회
const historicalData = await kisApi.getOverseasDailyPrices(
  "MSFT",
  "NYS",
  "0",
  "20240101", // 2024년 1월 1일 기준
  "1"
);
```

### 응답 형식

```typescript
{
  output1: [
    {
      rsym: "실시간조회종목코드",
      xymd: "일자(YYYYMMDD)",
      clos: "종가",
      sign: "대비기호",
      diff: "대비",
      rate: "등락율",
      open: "시가",
      high: "고가",
      low: "저가",
      tvol: "거래량",
      tamt: "거래대금"
    },
    // ... more data
  ],
  output2: [ /* 추가 데이터 */ ],
  rt_cd: "0",
  msg_cd: "MCA00000",
  msg1: "정상처리 되었습니다."
}
```

### 테스트

```bash
cd apps/backend

# 해외주식 기간별시세 API 테스트
npm run test:overseas-price
```

## 참고 자료

- [한국투자증권 Open API 문서](https://apiportal.koreainvestment.com/)
- Python 참고 코드는 한국투자증권에서 제공한 샘플을 기반으로 작성되었습니다.
- TR ID: HHDFS76240000 (실전/모의투자 공통)
