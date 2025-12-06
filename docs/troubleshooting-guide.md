# Troubleshooting Guide

## 🎉 Rate Limiter 성공!

Rate Limiter 구현 후:
- ✅ Rate limit 에러 완전히 사라짐
- ✅ 주식 가격 수집 100% 성공 (2/2)
- ✅ API 호출이 순조롭게 진행

## 🔍 현재 문제: Historical Data 빈 응답 ✅ 개선됨!

### 증상 (이전)
```json
{"message":"📉 Insufficient history data for 005930","history_length":0,"required":2}
{"message":"📊 Feature generation summary","success":0,"failures":2,"failure_breakdown":{"insufficient_history":2}}
```

### ✅ 구현된 개선사항

**DataCollector.getStockHistory()** 메서드에 다음 기능이 추가되었습니다:

1. **output2 fallback**: `output`이 비어있으면 `output2` 사용 시도
2. **자동 재시도**: 30일 데이터가 비어있으면 자동으로 7일로 재시도
3. **필드명 fallback**: 다양한 API 응답 형식 지원 (`stck_clpr` or `stck_prpr`)
4. **상세한 원인 로깅**: 데이터가 없을 때 가능한 원인 4가지 표시

### 가능한 원인 (우선순위 순)

1. **시장 마감 시간** ⭐ 가장 가능성 높음
   - 한국 주식 시장: 09:00-15:30
   - 현재 시간이 마감 이후라면 당일 데이터가 없을 수 있음
   - **해결**: 시장 개장 시간(09:05-15:00)에 테스트
   - 코드 개선: 자동으로 7일로 재시도하여 과거 데이터 확보 시도

2. **Paper Trading 모드 제한** ⭐ 두 번째로 가능성 높음
   - KIS API의 가상투자(Paper) 모드는 일부 historical data가 제한될 수 있음
   - **해결**: 실제 계좌 모드에서 테스트 (주의: 실제 거래 발생 가능)
   - 코드 개선: output2도 확인하여 더 많은 응답 형식 지원

3. **주말/공휴일**
   - 거래일이 아닌 날에는 데이터가 없음
   - **해결**: 평일 거래 시간에 테스트

4. **잘못된 종목코드 또는 상장폐지**
   - 존재하지 않는 종목이나 상장폐지된 종목
   - **해결**: 종목코드 확인 (005930 = 삼성전자는 정상)

## 🔧 디버그 방법

### 1. Debug 로그 활성화

`.env` 파일에서:
```bash
LOG_LEVEL=DEBUG  # INFO에서 DEBUG로 변경
```

재시작 후 더 자세한 로그 확인:
```json
{"message":"📊 Fetching history for 005930","ticker":"005930","startDate":"20251106","endDate":"20251206"}
{"message":"📈 History API response for 005930","output_length":0,"rt_cd":"0","msg_cd":"..."}
{"message":"⚠️ Empty history data from API for 005930","response_keys":["rt_cd","msg_cd","output"]}
```

### 2. 시장 개장 시간에 테스트

```bash
# 09:05 (첫 번째 배치 시간)
curl -X POST http://localhost:3000/api/batch/run
```

### 3. 더 짧은 기간으로 테스트 ✅ 자동화됨

**이제 자동으로 처리됩니다!**
- 30일 데이터가 비어있으면 자동으로 7일로 재시도
- 수동 수정 불필요
- 로그에서 `⚠️ Empty history data, retrying with 7 days` 확인 가능

### 4. API Raw Response 확인

KIS API 응답을 직접 확인:
```bash
# KIS API 콘솔에서 직접 테스트
# https://apiportal.koreainvestment.com/
```

## 📊 예상 해결 시나리오

### 시나리오 A: 시장 개장 시간 문제 (가장 가능성 높음)
**증상**: 마감 후 30일 데이터 요청 시 빈 응답
**자동 해결**: 7일로 자동 재시도하여 과거 데이터 확보
**예상 로그**:
```json
{"message":"📊 Fetching history for 005930","days":30}
{"message":"📈 History API response for 005930","output_length":0}
{"message":"⚠️ Empty history data, retrying with 7 days for 005930"}
{"message":"📈 Retry with 7 days result","length":7}
{"message":"✅ Feature generated for 005930"}
{"message":"📊 Feature generation summary","success":2,"success_rate":"100.0%"}
```

### 시나리오 B: 개장 시간 중 실행 (완벽한 시나리오)
**증상**: 없음
**결과**: 30일 데이터 즉시 수신
**예상 로그**:
```json
{"message":"📊 Fetching history for 005930","days":30}
{"message":"📈 History API response for 005930","output_length":30}
{"message":"✅ Feature generated for 005930"}
{"message":"📊 Feature generation summary","success":2,"success_rate":"100.0%"}
```

### 시나리오 C: Paper Mode에서도 데이터 없음
**증상**: 7일 재시도에도 여전히 빈 응답
**해결**: LOG_LEVEL=DEBUG로 설정하고 `response_keys` 확인
**예상 로그**:
```json
{"message":"⚠️ No history data available for 005930","possible_reasons":[...]}
```
이 경우 Live mode 테스트 필요 (주의!)

## ✅ 성공 지표

Historical data 문제 해결 후:
```json
{"message":"📈 History API response for 005930","output_length":30}
{"message":"📊 Processing 005930 with 30 days of data"}
{"message":"✅ Feature generated for 005930","intraday_return":"0.0123","volume_ratio":"1.45"}
{"message":"📊 Feature generation summary","success":2,"failures":0,"success_rate":"100.0%"}
{"message":"✅ Market compression complete","output_features":2,"compression_rate":"100.0%"}
{"message":"🤖 AI decisions received","total_decisions":2}
```

## 🎯 다음 단계

1. **LOG_LEVEL=DEBUG로 설정**
2. **시장 개장 시간(09:05)에 배치 실행**
3. **로그에서 API 응답 확인**:
   - `rt_cd`: 응답 코드
   - `msg_cd`: 메시지 코드
   - `msg1`: 에러 메시지
   - `output_length`: 데이터 개수

4. **결과 공유** - 로그를 보여주시면 더 정확한 진단 가능!

## 💡 참고

현재까지 성공한 것:
- ✅ Gemini AI Provider 통합
- ✅ 모델 전환 기능 (OpenAI ↔ Gemini)
- ✅ Rate Limiter 구현 및 통합
- ✅ 향상된 로깅 시스템
- ✅ 주식 가격 수집 100% 성공

남은 문제:
- ⏳ Historical data API 응답 분석 필요

거의 다 왔습니다! 🚀
