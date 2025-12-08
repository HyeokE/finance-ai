# 해외주식 API 가이드

## 개요

한국투자증권 Open API를 사용하여 해외주식 데이터를 조회하는 방법을 설명합니다. 이 가이드는 Python 샘플 코드를 TypeScript로 변환한 내용을 포함합니다.

## 빠른 시작

### 설치

```bash
cd apps/backend
npm install
```

### 환경 설정

`.env` 파일에 한국투자증권 API 인증 정보 설정:

```env
KIS_APP_KEY=your_app_key
KIS_APP_SECRET=your_app_secret
KIS_ACCOUNT_NUMBER=your_account_number
MODE=paper  # 또는 live
```

### 기본 사용법

```typescript
import { KISApiFactory } from "./infrastructure/api/KISApiFactory";

// API 클라이언트 생성
const factory = KISApiFactory.getInstance();
const kisApi = factory.create();

// 해외주식 현재가 조회
const price = await kisApi.getOverseasPrice("TSLA", "NAS");
console.log("Tesla 현재가:", price.output.last);

// 해외주식 기간별시세 조회
const history = await kisApi.getOverseasDailyPrices(
  "AAPL",
  "NAS",
  "0",
  "",
  "1"
);
console.log("Apple 일별 데이터:", history.output1.length, "건");

// 해외속보 뉴스 조회
const news = await kisApi.getOverseasBreakingNews("0", "11801");
console.log("최신 뉴스:", news.output.length, "건");
```

### 테스트 실행

```bash
# 해외주식 기간별시세 테스트
npm run test:overseas-price

# 해외주식 현재가상세 테스트
npm run test:overseas-price-detail

# 해외속보 뉴스 테스트
npm run test:overseas-news
```

## 구현된 API 목록

### 시세 조회 API

1. **해외주식 현재가** (`getOverseasPrice`)

   - TR ID: HHDFS76950200 / HHDFS00000300
   - 기본적인 현재가 정보 조회

2. **해외주식 현재가상세** (`getOverseasPriceDetail`)

   - TR ID: HHDFS76200200
   - 상세한 호가 및 시장 정보 조회 (페이지네이션 지원)

3. **해외주식 기간별시세** (`getOverseasDailyPrices`)
   - TR ID: HHDFS76240000
   - 일별/주별/월별 가격 데이터 조회 (페이지네이션 지원)

### 뉴스 API

4. **해외속보(제목)** (`getOverseasBreakingNews`)
   - TR ID: FHKST01011801
   - 해외 주식 관련 속보 뉴스 조회 (최대 100건)

### 계좌 및 거래 API

5. **해외주식 잔고조회** (`getOverseasAccountBalance`)
6. **해외주식 매수 주문** (`buyOverseasOrder`)
7. **해외주식 매도 주문** (`sellOverseasOrder`)
8. **해외주식 주문체결조회** (`getOverseasOrderHistory`)

### 기타 API

9. **해외주식 인기종목** (`getOverseasPopularStocks`)
10. **환율 조회** (`getExchangeRate`)

## 해외주식 기간별시세 API

### API 정보

- **TR ID**: `HHDFS76240000` (실전/모의투자 공통)
- **URL**: `/uapi/overseas-price/v1/quotations/dailyprice`
- **용도**: 해외주식의 일별/주별/월별 가격 데이터 조회

### TypeScript 구현

```typescript
async getOverseasDailyPrices(
  ticker: string,              // 종목코드 (예: "TSLA")
  exchangeCode: string,        // 거래소코드 (예: "NAS")
  period: "0" | "1" | "2",    // 0:일, 1:주, 2:월
  baseDate: string,            // 조회기준일자 (YYYYMMDD)
  adjustPrice: "0" | "1",     // 0:미반영, 1:반영
  maxDepth: number = 10        // 최대 페이지 수
): Promise<any>
```

### 주요 특징

1. **자동 페이지네이션**: tr_cont 헤더를 확인하여 모든 데이터를 자동으로 가져옴
2. **실전/모의투자 공통 TR ID**: 동일한 TR ID 사용 (HHDFS76240000)
3. **Rate Limiting**: 연속 요청 시 100ms 대기
4. **에러 처리**: 최대 재귀 깊이 제한으로 무한 루프 방지

### Python vs TypeScript 비교

#### Python 코드 (한국투자증권 샘플)

```python
def dailyprice(
    auth: str,
    excd: str,  # 거래소코드
    symb: str,  # 종목코드
    gubn: str,  # 0:일, 1:주, 2:월
    bymd: str,  # 조회기준일자
    modp: str,  # 0:미반영, 1:반영
    env_dv: str = "real",
    dataframe1: Optional[pd.DataFrame] = None,
    dataframe2: Optional[pd.DataFrame] = None,
    tr_cont: str = "",
    depth: int = 0,
    max_depth: int = 10
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    # TR ID 설정
    tr_id = "HHDFS76240000"

    params = {
        "AUTH": auth,
        "EXCD": excd,
        "SYMB": symb,
        "GUBN": gubn,
        "BYMD": bymd,
        "MODP": modp,
    }

    res = ka._url_fetch(API_URL, tr_id, tr_cont, params)

    # output1, output2 처리
    # tr_cont가 "M" 또는 "F"이면 다음 페이지 조회
    if tr_cont in ["M", "F"]:
        return dailyprice(..., tr_cont="N", depth + 1, max_depth)
```

#### TypeScript 코드 (변환 후)

```typescript
async getOverseasDailyPrices(
  ticker: string,
  exchangeCode: string = "NAS",
  period: "0" | "1" | "2" = "0",
  baseDate: string = "",
  adjustPrice: "0" | "1" = "1",
  maxDepth: number = 10
): Promise<any> {
  const allOutput1: any[] = [];
  const allOutput2: any[] = [];

  const fetchPage = async (
    trCont: string = "",
    depth: number = 0
  ): Promise<void> => {
    if (depth >= maxDepth) return;

    const trId = "HHDFS76240000";

    const response = await this.http.get(
      "/uapi/overseas-price/v1/quotations/dailyprice",
      {
        headers: {
          tr_id: trId,
          ...(trCont && { tr_cont: trCont }),
        },
        params: {
          AUTH: "",
          EXCD: exchangeCode,
          SYMB: ticker,
          GUBN: period,
          BYMD: baseDate,
          MODP: adjustPrice,
        },
      }
    );

    // output1, output2 수집
    if (data.output1) allOutput1.push(...data.output1);
    if (data.output2) allOutput2.push(...data.output2);

    // 페이지네이션 처리
    const nextTrCont = response.headers?.tr_cont || "";
    if (nextTrCont === "M" || nextTrCont === "F") {
      await new Promise(resolve => setTimeout(resolve, 100));
      await fetchPage("N", depth + 1);
    }
  };

  await fetchPage();

  return {
    output1: allOutput1,
    output2: allOutput2,
    rt_cd: "0",
    msg_cd: "MCA00000",
    msg1: "정상처리 되었습니다.",
  };
}
```

### 거래소 코드 매핑

| 코드 | 거래소 | 지원 여부                          |
| ---- | ------ | ---------------------------------- |
| NAS  | NASDAQ | ✅ 지원                            |
| NYS  | NYSE   | ✅ 지원                            |
| AMS  | AMEX   | ✅ 지원                            |
| HKS  | 홍콩   | ⚠️ 코드만 지원 (마스터파일 미지원) |
| TSE  | 도쿄   | ⚠️ 코드만 지원 (마스터파일 미지원) |
| SHS  | 상해   | ⚠️ 코드만 지원 (마스터파일 미지원) |
| SZS  | 심천   | ⚠️ 코드만 지원 (마스터파일 미지원) |
| HSX  | 호치민 | ⚠️ 코드만 지원 (마스터파일 미지원) |
| HNX  | 하노이 | ⚠️ 코드만 지원 (마스터파일 미지원) |

## 사용 예시

### 기본 사용법

```typescript
import { KISApiFactory } from "./infrastructure/api/KISApiFactory";

const factory = KISApiFactory.getInstance();
const kisApi = factory.create();

// Tesla 일별 데이터 조회
const result = await kisApi.getOverseasDailyPrices(
  "TSLA", // 종목코드
  "NAS", // NASDAQ
  "0", // 일별
  "", // 오늘 기준
  "1" // 수정주가 반영
);

console.log(`총 ${result.output1.length}개 데이터 조회됨`);
```

### 다양한 기간 유형

```typescript
// 일별 데이터
const daily = await kisApi.getOverseasDailyPrices("AAPL", "NAS", "0", "", "1");

// 주별 데이터
const weekly = await kisApi.getOverseasDailyPrices("AAPL", "NAS", "1", "", "1");

// 월별 데이터
const monthly = await kisApi.getOverseasDailyPrices(
  "AAPL",
  "NAS",
  "2",
  "",
  "1"
);
```

### 특정 날짜 기준 조회

```typescript
// 2024년 1월 1일 기준으로 과거 데이터 조회
const historical = await kisApi.getOverseasDailyPrices(
  "MSFT",
  "NYS",
  "0",
  "20240101", // YYYYMMDD 형식
  "1"
);
```

### DataCollector에서 사용

```typescript
// DataCollector 내부에서 자동으로 호출됨
const historyData = await this.kisApi.getOverseasDailyPrices(
  ticker,
  exchangeCode,
  "0", // 일별
  endDate, // 조회 종료일
  "1" // 수정주가 반영
);
```

## 응답 데이터 구조

### output1

```typescript
{
  rsym: "실시간조회종목코드",
  zdiv: "소수점자리수",
  nrec: "전일종가",
  xymd: "일자(YYYYMMDD)",
  clos: "종가",
  sign: "대비기호",
  diff: "대비",
  rate: "등락율",
  open: "시가",
  high: "고가",
  low: "저가",
  tvol: "거래량",
  tamt: "거래대금",
  pbid: "매수호가",
  vbid: "매수호가잔량",
  pask: "매도호가",
  vask: "매도호가잔량"
}
```

### 컬럼 매핑

Python 샘플 코드의 컬럼 매핑:

```python
COLUMN_MAPPING = {
    'rsym': '실시간조회종목코드',
    'zdiv': '소수점자리수',
    'nrec': '전일종가',
    'xymd': '일자(YYYYMMDD)',
    'clos': '종가',
    'sign': '대비기호',
    'diff': '대비',
    'rate': '등락율',
    'open': '시가',
    'high': '고가',
    'low': '저가',
    'tvol': '거래량',
    'tamt': '거래대금',
}
```

## 테스트

### 테스트 스크립트 실행

```bash
cd apps/backend
npm run test:overseas-price
```

### 테스트 코드 위치

- `src/util/testOverseasDailyPrice.ts`

### 테스트 내용

1. TSLA 월별 데이터 조회
2. AAPL 일별/주별 데이터 조회
3. 다양한 거래소(NYS, NAS, AMS) 테스트

## 주의사항

1. **Rate Limiting**: API 호출 시 한국투자증권의 rate limit을 준수해야 합니다
2. **페이지네이션**: maxDepth 파라미터로 최대 페이지 수를 제한할 수 있습니다
3. **날짜 형식**: baseDate는 "YYYYMMDD" 형식이어야 합니다 (예: "20240101")
4. **수정주가**: adjustPrice="1"을 사용하면 주식 분할 등이 반영된 가격을 받습니다

## 문제 해결

### API 호출 실패

```
API call failed: EGW00133 - 잘못된 거래소 코드
```

**해결**: 지원되는 거래소 코드를 확인하세요 (NAS, NYS, AMS 등)

### 빈 응답

```
No data available for ticker
```

**해결**:

1. 종목 코드가 올바른지 확인
2. 거래소 코드가 종목과 일치하는지 확인
3. 날짜 범위가 유효한지 확인

### 페이지네이션 무한 루프

```
Maximum pagination depth reached
```

**해결**: maxDepth 파라미터를 조정하거나, API 응답을 확인하세요

## 해외주식 현재가상세 API

### API 정보

- **TR ID**: `HHDFS76200200`
- **URL**: `/uapi/overseas-price/v1/quotations/price-detail`
- **용도**: 해외주식의 상세한 현재가 정보 조회

### TypeScript 구현

```typescript
async getOverseasPriceDetail(
  ticker: string,              // 종목코드 (예: "TSLA")
  exchangeCode: string,        // 거래소코드 (예: "NAS")
  maxDepth: number = 10        // 최대 페이지 수
): Promise<any>
```

### 주요 특징

1. **자동 페이지네이션**: tr_cont 헤더를 확인하여 모든 상세 데이터 자동 수집
2. **상세 정보 제공**: 현재가, 호가, 거래량, 시장상태 등 상세 정보
3. **Rate Limiting**: 연속 요청 시 100ms 대기

### Python vs TypeScript 비교

#### Python 코드 (한국투자증권 샘플)

```python
def price_detail(
    auth: str,
    excd: str,  # 거래소명
    symb: str,  # 종목코드
    tr_cont: str = "",
    dataframe: Optional[pd.DataFrame] = None,
    depth: int = 0,
    max_depth: int = 10
) -> Optional[pd.DataFrame]:
    tr_id = "HHDFS76200200"

    params = {
        "AUTH": auth,
        "EXCD": excd,
        "SYMB": symb,
    }

    res = ka._url_fetch(API_URL, tr_id, tr_cont, params)

    # output 처리
    # tr_cont가 "M"이면 다음 페이지 조회
    if tr_cont == "M":
        return price_detail(..., "N", dataframe, depth + 1, max_depth)
```

#### TypeScript 코드 (변환 후)

```typescript
async getOverseasPriceDetail(
  ticker: string,
  exchangeCode: string = "NAS",
  maxDepth: number = 10
): Promise<any> {
  const allOutput: any[] = [];

  const fetchPage = async (
    trCont: string = "",
    depth: number = 0
  ): Promise<void> => {
    if (depth >= maxDepth) return;

    const trId = "HHDFS76200200";

    const response = await this.http.get(
      "/uapi/overseas-price/v1/quotations/price-detail",
      {
        headers: {
          tr_id: trId,
          ...(trCont && { tr_cont: trCont }),
        },
        params: {
          AUTH: "",
          EXCD: exchangeCode,
          SYMB: ticker,
        },
      }
    );

    // output 수집
    if (data.output) allOutput.push(...data.output);

    // 페이지네이션 처리
    const nextTrCont = response.headers?.tr_cont || "";
    if (nextTrCont === "M") {
      await new Promise(resolve => setTimeout(resolve, 100));
      await fetchPage("N", depth + 1);
    }
  };

  await fetchPage();

  return {
    output: allOutput,
    rt_cd: "0",
    msg_cd: "MCA00000",
    msg1: "정상처리 되었습니다.",
  };
}
```

### 사용 예시

```typescript
import { KISApiFactory } from "./infrastructure/api/KISApiFactory";

const factory = KISApiFactory.getInstance();
const kisApi = factory.create();

// TSLA 현재가 상세 조회
const result = await kisApi.getOverseasPriceDetail("TSLA", "NAS");

if (result.output && result.output.length > 0) {
  const data = result.output[0];

  console.log("현재가:", data.last);
  console.log("대비:", data.diff);
  console.log("등락율:", data.rate);
  console.log("거래량:", data.tvol);
  console.log("매수호가:", data.pbid);
  console.log("매도호가:", data.pask);
}
```

### 응답 데이터 구조

```typescript
{
  output: [
    {
      rsym: "실시간조회종목코드",
      name: "종목명",
      last: "현재가",
      base: "전일종가",
      open: "시가",
      high: "고가",
      low: "저가",
      diff: "대비",
      rate: "등락율",
      sign: "대비기호",
      tvol: "거래량",
      tamt: "거래대금",
      pbid: "매수호가",
      pask: "매도호가",
      vbid: "매수호가잔량",
      vask: "매도호가잔량",
      excd: "거래소코드",
      curr: "통화단위",
      mtyp: "시장상태",
      ttyp: "체결시각",
      // ... 기타 필드
    }
  ],
  rt_cd: "0",
  msg_cd: "MCA00000",
  msg1: "정상처리 되었습니다."
}
```

### 테스트

```bash
cd apps/backend

# 해외주식 현재가상세 API 테스트
npm run test:overseas-price-detail
```

## API 비교

### 해외주식 현재가 vs 현재가상세

| 항목         | 현재가 (price)                             | 현재가상세 (price-detail)                         |
| ------------ | ------------------------------------------ | ------------------------------------------------- |
| URL          | `/uapi/overseas-price/v1/quotations/price` | `/uapi/overseas-price/v1/quotations/price-detail` |
| TR ID        | HHDFS76950200 / HHDFS00000300              | HHDFS76200200                                     |
| 정보량       | 기본 정보                                  | 상세 정보                                         |
| 페이지네이션 | 미지원                                     | 지원                                              |
| 사용 시기    | 간단한 가격 조회                           | 상세한 시장 데이터 필요 시                        |

## 해외속보(제목) API

### API 정보

- **TR ID**: `FHKST01011801`
- **URL**: `/uapi/overseas-price/v1/quotations/brknews-title`
- **용도**: 해외 주식 관련 속보 뉴스 제목 조회
- **제한**: 최대 100건 조회 가능

### TypeScript 구현

```typescript
async getOverseasBreakingNews(
  newsProviderCode: string = "0",      // 뉴스제공업체코드 (0: 전체)
  screenDivCode: string = "11801",     // 조건화면분류코드
  marketClassCode: string = "",        // 조건시장구분코드
  ticker: string = "",                 // 종목코드
  titleContent: string = "",           // 제목내용 검색
  inputDate: string = "",              // 입력날짜 (YYYYMMDD)
  inputHour: string = "",              // 입력시간 (HHMMSS)
  rankSortCode: string = "",           // 순위정렬구분코드
  serialNumber: string = ""            // 입력일련번호
): Promise<any>
```

### 주요 특징

1. **실시간 뉴스 조회**: 해외 주식 관련 최신 속보 제공
2. **다양한 필터**: 종목, 날짜, 키워드로 검색 가능
3. **페이지네이션 미지원**: 최대 100건까지만 조회

### Python vs TypeScript 비교

#### Python 코드 (한국투자증권 샘플)

```python
def brknews_title(
    fid_news_ofer_entp_code: str,  # [필수] 뉴스제공업체코드
    fid_cond_scr_div_code: str,    # [필수] 조건화면분류코드
    fid_cond_mrkt_cls_code: str = "",
    fid_input_iscd: str = "",
    fid_titl_cntt: str = "",
    fid_input_date_1: str = "",
    fid_input_hour_1: str = "",
    fid_rank_sort_cls_code: str = "",
    fid_input_srno: str = ""
) -> pd.DataFrame:
    tr_id = "FHKST01011801"

    api_url = "/uapi/overseas-price/v1/quotations/brknews-title"

    params = {
        "FID_NEWS_OFER_ENTP_CODE": fid_news_ofer_entp_code,
        "FID_COND_SCR_DIV_CODE": fid_cond_scr_div_code,
        "FID_COND_MRKT_CLS_CODE": fid_cond_mrkt_cls_code,
        "FID_INPUT_ISCD": fid_input_iscd,
        "FID_TITL_CNTT": fid_titl_cntt,
        "FID_INPUT_DATE_1": fid_input_date_1,
        "FID_INPUT_HOUR_1": fid_input_hour_1,
        "FID_RANK_SORT_CLS_CODE": fid_rank_sort_cls_code,
        "FID_INPUT_SRNO": fid_input_srno
    }

    res = ka._url_fetch(api_url, tr_id, "", params)

    if res.isOK():
        return pd.DataFrame(res.getBody().output)
```

#### TypeScript 코드 (변환 후)

```typescript
async getOverseasBreakingNews(
  newsProviderCode: string = "0",
  screenDivCode: string = "11801",
  marketClassCode: string = "",
  ticker: string = "",
  titleContent: string = "",
  inputDate: string = "",
  inputHour: string = "",
  rankSortCode: string = "",
  serialNumber: string = ""
): Promise<any> {
  const trId = "FHKST01011801";

  const response = await this.http.get(
    "/uapi/overseas-price/v1/quotations/brknews-title",
    {
      headers: { tr_id: trId },
      params: {
        FID_NEWS_OFER_ENTP_CODE: newsProviderCode,
        FID_COND_SCR_DIV_CODE: screenDivCode,
        FID_COND_MRKT_CLS_CODE: marketClassCode,
        FID_INPUT_ISCD: ticker,
        FID_TITL_CNTT: titleContent,
        FID_INPUT_DATE_1: inputDate,
        FID_INPUT_HOUR_1: inputHour,
        FID_RANK_SORT_CLS_CODE: rankSortCode,
        FID_INPUT_SRNO: serialNumber,
      },
    }
  );
  return response.data;
}
```

### 사용 예시

#### 전체 뉴스 조회

```typescript
import { KISApiFactory } from "./infrastructure/api/KISApiFactory";

const factory = KISApiFactory.getInstance();
const kisApi = factory.create();

// 전체 뉴스 조회
const result = await kisApi.getOverseasBreakingNews("0", "11801");

if (result.output && result.output.length > 0) {
  console.log(`총 ${result.output.length}건의 뉴스`);

  result.output.forEach((news: any) => {
    console.log(`${news.stck_bsop_date} ${news.stck_bsop_hour}`);
    console.log(`${news.hts_kor_isnm}: ${news.brk_news_titl}`);
  });
}
```

#### 특정 종목 뉴스 검색

```typescript
// Tesla 관련 뉴스
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
```

#### 키워드로 검색

```typescript
// "AI" 키워드가 포함된 뉴스
const aiNews = await kisApi.getOverseasBreakingNews(
  "0",
  "11801",
  "",
  "",
  "AI", // 제목 내용 검색
  "",
  "",
  "",
  ""
);
```

#### 날짜별 뉴스 조회

```typescript
// 오늘 날짜의 뉴스
const today = new Date().toISOString().split("T")[0].replace(/-/g, "");

const todayNews = await kisApi.getOverseasBreakingNews(
  "0",
  "11801",
  "",
  "",
  "",
  today, // YYYYMMDD 형식
  "",
  "",
  ""
);
```

### 응답 데이터 구조

```typescript
{
  output: [
    {
      stck_bsop_date: "영업일자 (YYYYMMDD)",
      stck_bsop_hour: "영업시간 (HHMMSS)",
      stck_shrn_iscd: "종목단축코드",
      hts_kor_isnm: "HTS한글종목명",
      brk_news_titl: "속보뉴스제목",
      brk_news_clas_code: "속보뉴스구분코드",
      brk_news_clas_name: "속보뉴스구분명",
      news_srno: "뉴스일련번호"
    },
    // ... more items (max 100)
  ],
  rt_cd: "0",
  msg_cd: "MCA00000",
  msg1: "정상처리 되었습니다."
}
```

### 테스트

```bash
cd apps/backend

# 해외속보(제목) API 테스트
npm run test:overseas-news
```

### 활용 사례

1. **실시간 뉴스 모니터링**: 특정 종목의 최신 뉴스 추적
2. **키워드 알림**: 특정 키워드(예: "earnings", "merger") 뉴스 감지
3. **시장 동향 파악**: 전체 뉴스 분석으로 시장 트렌드 파악
4. **AI 트레이딩 통합**: 뉴스 데이터를 AI 트레이딩 판단에 활용 ✅ **구현 완료**

## AI 트레이딩 통합

뉴스 데이터는 자동으로 AI 의사결정 엔진에 전달됩니다.

### 자동 통합 프로세스

```typescript
// BatchOrchestrator.ts에서 자동 실행
const breakingNews = await dataCollector.collectBreakingNews(20);

const aiInput = {
  portfolio,
  market: {
    index: indexInfo,
    sentiment,
    exchange_rates: exchangeRates,
    breaking_news: breakingNews, // 자동으로 AI에게 전달
  },
  stocks: compressedMarket.universe_features,
  constraints: DEFAULT_CONSTRAINTS,
};
```

### AI가 뉴스를 활용하는 방법

AI는 다음과 같이 뉴스 데이터를 의사결정에 활용합니다:

1. **종목별 뉴스 매칭**: 뉴스의 ticker와 매칭하여 해당 종목 분석 강화
2. **감성 분석**: 뉴스 제목에서 긍정/부정 신호 추출
3. **신호 검증**: 기술적 분석 신호와 뉴스 감성이 일치하는지 확인
4. **리스크 관리**: 부정적 뉴스가 있는 종목은 매수 자제 또는 매도 고려

### AI 프롬프트 가이드

SystemPrompt에 포함된 뉴스 활용 지침:

```
• Breaking news (if provided):
  • Recent market news and company-specific announcements
  • Pay special attention to news about stocks in the watchlist
  • Consider news sentiment (positive/negative) and potential impact on stock prices
  • Use news to validate or question technical signals
  • Be cautious with stocks that have negative news (earnings misses, regulatory issues, etc.)
```

### 뉴스 수집 설정

```typescript
// DataCollector에서 뉴스 수집
const news = await dataCollector.collectBreakingNews(
  20, // 최대 20개 뉴스
  "TSLA" // 특정 종목 필터 (선택사항)
);
```

### 예시: AI 의사결정에 뉴스 반영

```json
{
  "ticker": "TSLA",
  "action": "HOLD",
  "confidence": 0.5,
  "reason": "Strong technicals (+2.3%, volume 2x) but negative earnings news, waiting for clarity"
}
```

AI는 기술적 신호가 긍정적이더라도 부정적 뉴스가 있으면 신중하게 접근합니다.

## 참고 자료

- [한국투자증권 Open API](https://apiportal.koreainvestment.com/)
- [API 문서 - 해외주식 기간별시세](https://apiportal.koreainvestment.com/apiservice/apiservice-domestic-stock#L_aade4c72-5fb7-4c01-a164-9a6f13954cdf)
- Python 샘플 코드: 한국투자증권 제공
