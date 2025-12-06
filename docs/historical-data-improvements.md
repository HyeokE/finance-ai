# Historical Data 개선 사항

## 📋 개요

Historical data가 비어있는 문제를 해결하기 위해 `DataCollector.getStockHistory()` 메서드를 개선했습니다.

## ✅ 구현된 개선사항

### 1. output2 Fallback 지원

```typescript
// output이 비어있으면 output2 시도
let dataArray = output;
if (output.length === 0 && output2.length > 0) {
    logger.info(`📊 Using output2 for ${ticker} (output was empty)`);
    dataArray = output2;
}
```

**이유**: KIS API는 때때로 데이터를 `output2` 필드에 반환할 수 있습니다.

### 2. 자동 재시도 (30일 → 7일)

```typescript
// 30일 데이터가 비어있으면 자동으로 7일로 재시도
if (dataArray.length === 0 && days > 7) {
    logger.warn(`⚠️ Empty history data, retrying with 7 days for ${ticker}`);
    const shortStartDate = getDaysAgo(7);

    await kisRateLimiter.waitIfNeeded();
    const retryData = await retryWithBackoff(() =>
        this.kisApi.getDailyPrices(ticker, shortStartDate, endDate)
    );

    dataArray = retryData.output || retryData.output2 || [];
}
```

**이유**:
- 마감 후에는 당일 데이터가 없을 수 있음
- 7일 전 데이터는 확실히 존재함
- 최소 2개 데이터만 있으면 feature 생성 가능

### 3. 필드명 Fallback

```typescript
return dataArray.map((item: any) => ({
    close: parseFloat(item.stck_clpr || item.stck_prpr || 0),
    volume: parseFloat(item.acml_vol || item.acml_tr_pbmn || 0),
}));
```

**이유**: KIS API 응답 형식이 다양할 수 있음
- `stck_clpr`: 종가 (close price)
- `stck_prpr`: 현재가 (present price)
- `acml_vol`: 누적 거래량 (accumulated volume)
- `acml_tr_pbmn`: 누적 거래대금 (accumulated trading value)

### 4. 상세한 원인 로깅

```typescript
if (dataArray.length === 0) {
    logger.warn(`⚠️ No history data available for ${ticker}`, {
        ticker,
        startDate,
        endDate,
        days,
        possible_reasons: [
            'Market closed (requires 09:00-15:30 KST)',
            'Paper trading mode limitation',
            'Invalid ticker or delisted stock',
            'Weekend/holiday (no trading data)'
        ],
    });
    return [];
}
```

**이유**: 디버깅을 위해 가능한 원인을 명확히 표시

## 🎯 효과

### Before (개선 전)
```json
{"message":"📊 Fetching history for 005930","days":30}
{"message":"📈 History API response","output_length":0}
{"message":"📉 Insufficient history data","history_length":0}
{"message":"📊 Feature generation summary","success":0,"failures":2}
```

### After (개선 후 - 시나리오 A: 자동 재시도 성공)
```json
{"message":"📊 Fetching history for 005930","days":30}
{"message":"📈 History API response","output_length":0}
{"message":"⚠️ Empty history data, retrying with 7 days"}
{"message":"📈 Retry with 7 days result","length":7}
{"message":"✅ Feature generated for 005930"}
{"message":"📊 Feature generation summary","success":2,"success_rate":"100.0%"}
```

### After (개선 후 - 시나리오 B: 개장 시간)
```json
{"message":"📊 Fetching history for 005930","days":30}
{"message":"📈 History API response","output_length":30}
{"message":"✅ Feature generated for 005930"}
{"message":"📊 Feature generation summary","success":2,"success_rate":"100.0%"}
```

## 🔍 디버깅 향상

추가된 로그 정보:
- `response_keys`: API 응답에 포함된 모든 필드 목록
- `possible_reasons`: 데이터가 없을 때 가능한 원인 4가지
- `output2_length`: output2 배열 길이
- 재시도 결과 로그

## 🚀 다음 단계

1. **개장 시간에 테스트**: 09:05-15:00 사이에 배치 실행
2. **로그 확인**: 자동 재시도가 성공하는지 확인
3. **결과 분석**:
   - 7일 데이터로도 실패하면 → Paper mode 제한일 가능성
   - 성공하면 → 문제 해결!

## 📝 관련 파일

- [DataCollector.ts:204-289](../apps/backend/src/module/DataCollector.ts) - 개선된 `getStockHistory()` 메서드
- [troubleshooting-guide.md](troubleshooting-guide.md) - 업데이트된 트러블슈팅 가이드

## 💡 기술적 의사결정

1. **왜 자동 재시도?**
   - 사용자가 수동으로 날짜 범위를 조정할 필요 없음
   - 대부분의 경우 7일 데이터만 있으면 충분
   - Rate limiter가 있어서 추가 API 호출도 안전

2. **왜 7일?**
   - 최소 필요: 2일 (ContextCompressor 요구사항)
   - 7일: 충분한 데이터로 안정적인 feature 생성 가능
   - 너무 짧으면 (2-3일) 변동성 계산이 부정확할 수 있음

3. **왜 output2도 확인?**
   - KIS API 문서가 명확하지 않음
   - 다른 엔드포인트들은 다양한 응답 형식 사용
   - 방어적 프로그래밍 - 더 많은 경우 처리

## ✅ 체크리스트

- [x] output2 fallback 구현
- [x] 자동 재시도 구현 (30일 → 7일)
- [x] 필드명 fallback 구현
- [x] 상세한 로깅 추가
- [x] Rate limiter 적용 확인
- [x] 트러블슈팅 가이드 업데이트
- [ ] 개장 시간에 실제 테스트
- [ ] 성공 여부 확인
