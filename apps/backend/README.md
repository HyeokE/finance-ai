# Auto Finance Backend

한국투자증권 Open API를 활용한 자동 트레이딩 시스템의 백엔드입니다.

## 주요 기능

- 🤖 **AI 기반 의사결정**: OpenAI/DeepSeek를 활용한 자동 매매 판단
- 📊 **실시간 시세 조회**: 국내/해외 주식 현재가 및 차트 데이터
- 📰 **뉴스 기반 트레이딩**: 해외 주식 속보를 자동 수집하여 AI 의사결정에 활용
- 💼 **포트폴리오 관리**: 계좌 잔고 및 보유 종목 관리
- 🔄 **자동 매매 실행**: 스케줄러 기반 자동 거래

## 시작하기

### 설치

```bash
npm install
```

### 환경 설정

`.env` 파일 생성:

```env
# 한국투자증권 API
KIS_APP_KEY=your_app_key
KIS_APP_SECRET=your_app_secret
KIS_ACCOUNT_NUMBER=your_account_number
MODE=paper  # paper: 모의투자, live: 실전투자

# AI Provider
OPENAI_API_KEY=your_openai_key
# 또는
DEEPSEEK_API_KEY=your_deepseek_key

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Server
PORT=3001
```

### 개발 모드 실행

```bash
npm run dev
```

### 프로덕션 빌드

```bash
npm run build
npm start
```

## 프로젝트 구조

```
src/
├── agents/              # AI 의사결정 엔진
│   ├── AIDecisionEngine.ts
│   ├── BatchOrchestrator.ts
│   └── SystemPrompt.ts
├── controller/          # API 컨트롤러
│   ├── BatchController.ts
│   ├── OrderExecutor.ts
│   ├── SettingsController.ts
│   ├── StockController.ts
│   └── WatchlistController.ts
├── infrastructure/      # 외부 서비스 연동
│   ├── api/
│   │   ├── KISApiClient.ts
│   │   ├── KISApiFactory.ts
│   │   └── OpenAIClient.ts
│   └── database/
│       ├── DatabaseRepository.ts
│       └── SettingsRepository.ts
├── model/              # 도메인 모델
│   ├── AI.ts
│   ├── Market.ts
│   ├── MarketSettings.ts
│   └── Trading.ts
├── module/             # 비즈니스 로직
│   ├── ContextCompressor.ts
│   ├── DataCollector.ts
│   └── RiskValidator.ts
├── util/               # 유틸리티
│   ├── downloadMasterFiles.ts
│   ├── StockMasterParser.ts
│   ├── logger.ts
│   └── retry.ts
├── scheduler.ts        # 스케줄러
└── server.ts          # Express 서버
```

## 주요 API

### 해외주식 API

```typescript
import { KISApiFactory } from "./infrastructure/api/KISApiFactory";

const factory = KISApiFactory.getInstance();
const kisApi = factory.create();

// 현재가 조회
const price = await kisApi.getOverseasPrice("TSLA", "NAS");

// 기간별 시세 (일/주/월)
const daily = await kisApi.getOverseasDailyPrices("AAPL", "NAS", "0", "", "1");

// 현재가 상세
const detail = await kisApi.getOverseasPriceDetail("MSFT", "NYS");

// 속보 뉴스
const news = await kisApi.getOverseasBreakingNews("0", "11801");
```

자세한 내용은 [해외주식 API 가이드](../../docs/overseas-stock-api-guide.md) 참조

### 국내주식 API

```typescript
// 현재가 조회
const price = await kisApi.getCurrentPrice("005930");

// 일별 가격
const history = await kisApi.getDailyPrices("005930", startDate, endDate);

// 매수/매도
await kisApi.buyOrder(accountNumber, "005930", 10, 70000);
await kisApi.sellOrder(accountNumber, "005930", 10, 75000);
```

## 종목 마스터 파일

### 다운로드

```bash
# 모든 마스터 파일 다운로드 (국내 + 미국)
npm run download-master-files all

# 미국 시장만 다운로드
npm run download-master-files us

# 특정 시장
npm run download-master-files nasdaq
```

### 사용법

```typescript
import { stockMasterParser } from "./util/StockMasterParser";

// 종목 검색
const results = stockMasterParser.search("삼성", "DOMESTIC");
const usResults = stockMasterParser.search("APPLE", "US");

// 티커로 조회
const stock = stockMasterParser.getByTicker("005930", "DOMESTIC");
```

자세한 내용은 [마스터 파일 가이드](../../docs/stock-master-files-guide.md) 참조

## 테스트

```bash
# 해외주식 기간별시세 테스트
npm run test:overseas-price

# 해외주식 현재가상세 테스트
npm run test:overseas-price-detail

# 해외속보 뉴스 테스트
npm run test:overseas-news
```

## 스케줄러

자동 매매는 다음 시간에 실행됩니다:

- **국내장**: 평일 09:00 (장 시작)
- **미국장**: 평일 22:30 (미국 장 시작, 한국 시간)

```typescript
// scheduler.ts에서 설정
cron.schedule("0 9 * * 1-5", async () => {
  // 국내장 자동 매매
});

cron.schedule("30 22 * * 1-5", async () => {
  // 미국장 자동 매매
});
```

## API 엔드포인트

### 주식 관련

- `GET /api/stocks/search` - 종목 검색
- `GET /api/stocks/popular` - 인기 종목
- `GET /api/stocks/:ticker/detail` - 종목 상세

### 매매 관련

- `GET /api/orders` - 주문 내역
- `GET /api/orders/:id` - 주문 상세
- `GET /api/decisions` - AI 의사결정 내역

### 설정 관련

- `GET /api/settings` - 전체 설정 조회
- `PUT /api/settings/:key` - 설정 업데이트

### 관심종목

- `GET /api/watchlist` - 관심종목 조회
- `POST /api/watchlist` - 관심종목 추가
- `DELETE /api/watchlist/:ticker` - 관심종목 삭제

## 환경 변수

| 변수명               | 설명                | 기본값  |
| -------------------- | ------------------- | ------- |
| `KIS_APP_KEY`        | 한국투자증권 앱 키  | -       |
| `KIS_APP_SECRET`     | 한국투자증권 시크릿 | -       |
| `KIS_ACCOUNT_NUMBER` | 계좌번호            | -       |
| `MODE`               | 실전/모의 구분      | `paper` |
| `OPENAI_API_KEY`     | OpenAI API 키       | -       |
| `DEEPSEEK_API_KEY`   | DeepSeek API 키     | -       |
| `PORT`               | 서버 포트           | `3001`  |

## 로깅

Winston을 사용하여 로그를 관리합니다:

```typescript
import { logger } from "./util/logger";

logger.info("정보 로그");
logger.warn("경고 로그");
logger.error("에러 로그", { error });
```

## 트러블슈팅

### API 호출 실패

```
Error: 401 Unauthorized
```

**해결**: `.env` 파일의 API 키를 확인하세요.

- OpenAI 사용 시: `OPENAI_API_KEY`
- DeepSeek 사용 시: `DEEPSEEK_API_KEY`

### AI API 응답 없음

```
Error: No response from OpenAI API
```

**원인**: 여러 가지 이유가 있을 수 있습니다:

1. 입력 데이터가 너무 큼
2. max_tokens 설정이 부족
3. API 서버 응답 지연

**해결**:

1. 로그에서 입력 크기 확인:

   ```
   📊 AI Input Size: { total_size_kb: '45.2' }
   ```

2. DeepSeek 사용 시 자동으로 max_tokens가 8000으로 설정됨
3. 관심종목 수를 줄여서 입력 크기 감소
4. 뉴스 수집을 일시적으로 비활성화:
   ```typescript
   // BatchOrchestrator.ts
   const breakingNews: any[] = []; // 임시로 비활성화
   ```

### DeepSeek API 사용 시 주의사항

**설정**:

```env
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_MODEL=deepseek-chat  # 또는 deepseek-coder
AI_PROVIDER=deepseek
```

**차이점**:

- DeepSeek는 큰 컨텍스트 지원 (max_tokens: 8000)
- JSON 모드 지원
- OpenAI 호환 API 사용

**디버깅**:
로그에서 다음을 확인:

```
🤖 AI Provider Config {
  model: 'deepseek-chat',
  isDeepSeek: true,
  maxTokens: 8000,
  temperature: 0.7
}
```

### Rate Limiting

```
Error: 429 Too Many Requests
```

**해결**: `kisRateLimiter`가 자동으로 대기 시간을 추가합니다. 잠시 기다리세요.

### 마스터 파일 없음

```
Master file not found
```

**해결**:

```bash
npm run download-master-files all
```

### Context Length Exceeded

```
Error: context_length_exceeded
```

**해결**:

1. 관심종목 수를 줄이기
2. 뉴스 수집 개수를 줄이기 (기본 20개)
3. AI 모델을 더 큰 컨텍스트 지원 모델로 변경

## 기여

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 라이선스

MIT License

## 참고 자료

- [한국투자증권 Open API](https://apiportal.koreainvestment.com/)
- [해외주식 API 가이드](../../docs/overseas-stock-api-guide.md)
- [마스터 파일 가이드](../../docs/stock-master-files-guide.md)
- [Rate Limiter 가이드](../../docs/rate-limiter-guide.md)
- [AI Provider 가이드](../../docs/ai-provider-guide.md)
