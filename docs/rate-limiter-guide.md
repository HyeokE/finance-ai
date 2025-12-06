# Rate Limiter 구현 가이드

## 🎯 목표

KIS API의 rate limit (초당 2-3 요청)을 준수하는 Rate Limiter를 구현하여 "초당 거래건수를 초과하였습니다" 에러를 방지합니다.

## 📝 구현 과제

**파일**: `apps/backend/src/util/rateLimiter.ts`
**함수**: `waitIfNeeded()`
**코드량**: 약 8-12줄

## 🔍 현재 문제 상황

로그에서 볼 수 있듯이:

```json
{"timestamp":"2025-12-06T11:27:28.579Z","message":"Collecting stock prices..."}
{"timestamp":"2025-12-06T11:27:28.720Z","message":"KIS API Error Response","msg1":"초당 거래건수를 초과"}
{"timestamp":"2025-12-06T11:27:28.781Z","message":"KIS API Error Response","msg1":"초당 거래건수를 초과"}
```

3개 요청이 141ms, 61ms 간격으로 발생 → KIS API가 거부

**필요한 것**: 최소 500ms 간격 (초당 2 요청)

## 💡 구현 방법

### Step 1: 시간 계산

```typescript
async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    // elapsed: 마지막 요청 이후 경과 시간 (ms)
    // this.minDelayMs: 최소 대기 시간 (500ms)
```

### Step 2: 조건 판단

**질문**: 언제 기다려야 할까요?
- A) 항상 기다린다
- B) `elapsed < this.minDelayMs`일 때만
- C) 첫 요청인 경우 (`this.lastRequestTime === 0`)는?

<details>
<summary>💡 정답 보기</summary>

**B가 정답입니다!**

```typescript
if (this.lastRequestTime > 0 && elapsed < this.minDelayMs) {
    // 기다려야 함
}
```

첫 요청은 `lastRequestTime === 0`이므로 바로 실행해야 합니다.
</details>

### Step 3: 대기 시간 계산

**질문**: 얼마나 기다려야 할까요?
- 만약 `minDelayMs = 500ms`이고 `elapsed = 200ms`라면?

<details>
<summary>💡 정답 보기</summary>

```typescript
const remainingDelay = this.minDelayMs - elapsed; // 500 - 200 = 300ms
```

300ms를 더 기다려야 총 500ms가 됩니다.
</details>

### Step 4: 실제 대기

JavaScript에서 비동기로 대기하는 방법:

```typescript
await new Promise(resolve => setTimeout(resolve, delayMs));
```

### Step 5: 상태 업데이트

대기 후 반드시:
1. `this.lastRequestTime = Date.now()` - 현재 시간 업데이트
2. `this.requestCount++` - 요청 카운트 증가

## 🎓 완성된 코드 예시

<details>
<summary>🚨 스포일러 주의! 직접 구현 후에만 보세요</summary>

### 방법 1: 단순하고 안전한 버전

```typescript
async waitIfNeeded(): Promise<void> {
    const now = Date.now();

    // 첫 요청이 아니면 항상 최소 delay만큼 대기
    if (this.lastRequestTime > 0) {
        const elapsed = now - this.lastRequestTime;
        if (elapsed < this.minDelayMs) {
            const delay = this.minDelayMs - elapsed;
            logger.debug(`⏱️ Rate limiter waiting ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
}
```

### 방법 2: 로깅 추가 버전

```typescript
async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (this.lastRequestTime > 0 && elapsed < this.minDelayMs) {
        const delay = this.minDelayMs - elapsed;

        logger.debug(`⏱️ Rate limiter waiting ${delay}ms`, {
            elapsed_ms: elapsed,
            min_delay_ms: this.minDelayMs,
            request_count: this.requestCount,
        });

        await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;

    if (this.requestCount % 10 === 0) {
        logger.info(`📊 Rate limiter stats`, this.getStats());
    }
}
```

### 방법 3: 토큰 버킷 알고리즘 (고급)

```typescript
// 더 정교한 버전 - 짧은 burst 허용하면서 평균 rate 제한
private tokens: number = this.maxRequestsPerSecond;
private lastRefillTime: number = Date.now();

async waitIfNeeded(): Promise<void> {
    // Refill tokens based on time passed
    const now = Date.now();
    const timePassed = now - this.lastRefillTime;
    const tokensToAdd = (timePassed / 1000) * this.maxRequestsPerSecond;

    this.tokens = Math.min(this.maxRequestsPerSecond, this.tokens + tokensToAdd);
    this.lastRefillTime = now;

    // If no tokens available, wait
    if (this.tokens < 1) {
        const waitTime = ((1 - this.tokens) / this.maxRequestsPerSecond) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.tokens = 1;
    }

    this.tokens -= 1;
    this.requestCount++;
}
```
</details>

## 🧪 테스트 방법

### 방법 1: 직접 테스트

```typescript
// test.ts
import { RateLimiter } from './rateLimiter';

const limiter = new RateLimiter(2); // 초당 2 요청

async function test() {
    console.log('Request 1:', new Date().toISOString());
    await limiter.waitIfNeeded();

    console.log('Request 2:', new Date().toISOString());
    await limiter.waitIfNeeded();

    console.log('Request 3:', new Date().toISOString());
    await limiter.waitIfNeeded();

    console.log('Stats:', limiter.getStats());
}

test();
```

**예상 출력**:
```
Request 1: 2025-12-06T11:30:00.000Z  (즉시)
Request 2: 2025-12-06T11:30:00.500Z  (500ms 후)
Request 3: 2025-12-06T11:30:01.000Z  (500ms 후)
Stats: { totalRequests: 3, averageDelayMs: 500 }
```

### 방법 2: DataCollector에 통합

```typescript
// DataCollector.ts
import { kisRateLimiter } from '@util/rateLimiter';

async getCurrentPrice(ticker: string): Promise<number> {
    await kisRateLimiter.waitIfNeeded(); // ← 추가

    const response = await this.kisClient.getCurrentPrice(ticker);
    return response.price;
}

async getStockHistory(ticker: string, days: number): Promise<HistoryData[]> {
    await kisRateLimiter.waitIfNeeded(); // ← 추가

    const response = await this.kisClient.getDailyPrice(ticker, days);
    return response.data;
}
```

## ✅ 성공 지표

구현이 성공하면 다음을 볼 수 있습니다:

**Before (현재)**:
```json
{"message":"📊 Feature generation summary","success":0,"failures":2,"success_rate":"0.0%"}
{"message":"KIS API Error Response","msg1":"초당 거래건수를 초과"}
```

**After (구현 후)**:
```json
{"message":"⏱️ Rate limiter waiting 450ms"}
{"message":"📊 Feature generation summary","success":2,"failures":0,"success_rate":"100.0%"}
{"message":"✅ Market compression complete","output_features":2}
{"message":"🤖 AI decisions received","total_decisions":2}
```

## 🎯 다음 단계

1. `rateLimiter.ts`의 `waitIfNeeded()` 구현
2. 위 테스트 코드로 동작 확인
3. `DataCollector.ts`에 통합
4. 배치 실행하여 rate limit 에러 사라지는지 확인

질문이 있거나 구현이 완료되면 알려주세요! 🚀
