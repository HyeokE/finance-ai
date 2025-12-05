# 코딩 규칙 (Coding Rules)

## 📁 프로젝트 폴더 구조

프로젝트는 다음과 같은 폴더 구조를 따라야 합니다:

```
src/
├── agents/         # 에이전트 관련 로직 (비즈니스 자동화, 워크플로우)
├── controller/     # 컨트롤러 레이어 (요청/응답 처리)
├── domain/         # 도메인 모델 및 비즈니스 로직
├── infrastructure/ # 인프라 관련 코드 (데이터베이스, 외부 서비스 연동)
├── model/          # 데이터 모델 및 타입 정의
├── module/         # 재사용 가능한 모듈
└── util/           # 유틸리티 함수
```

### 각 폴더의 역할

- **agents/**: 자동화된 작업, 워크플로우, 에이전트 패턴을 구현하는 코드
- **controller/**: HTTP 요청을 받아 처리하고 응답을 반환하는 컨트롤러
- **domain/**: 핵심 비즈니스 로직과 도메인 규칙
- **infrastructure/**: 데이터베이스 연결, 외부 API 통신, 캐시 등 인프라 계층
- **model/**: 데이터 구조, 인터페이스, 타입 정의
- **module/**: 여러 곳에서 재사용되는 독립적인 모듈
- **util/**: 공통 헬퍼 함수 및 유틸리티

---

## 🏭 API 요청 Factory 패턴

모든 API 요청은 **Factory 패턴**을 사용하여 작성해야 합니다.

### 기본 원칙

1. API 클라이언트는 Factory를 통해 생성됩니다
2. 각 API 도메인별로 별도의 Factory를 구성합니다
3. 설정 및 인증은 Factory 레벨에서 관리됩니다
4. 재사용성과 테스트 용이성을 고려합니다

### 구현 예시

#### 1. API Factory 인터페이스

```typescript
// infrastructure/api/ApiFactory.ts
export interface ApiConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface ApiFactory<T> {
  create(config: ApiConfig): T;
}
```

#### 2. 구체적인 API Factory 구현

```typescript
// infrastructure/api/FinanceApiFactory.ts
import axios, { AxiosInstance } from 'axios';

export class FinanceApiFactory implements ApiFactory<FinanceApiClient> {
  create(config: ApiConfig): FinanceApiClient {
    const axiosInstance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 5000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    // 인터셉터 설정
    axiosInstance.interceptors.request.use(
      (config) => {
        // 토큰 추가 등
        const token = getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return new FinanceApiClient(axiosInstance);
  }
}
```

#### 3. API 클라이언트 클래스

```typescript
// infrastructure/api/FinanceApiClient.ts
export class FinanceApiClient {
  constructor(private readonly http: AxiosInstance) {}

  async getAccounts(): Promise<Account[]> {
    const response = await this.http.get('/accounts');
    return response.data;
  }

  async getTransactions(accountId: string): Promise<Transaction[]> {
    const response = await this.http.get(`/accounts/${accountId}/transactions`);
    return response.data;
  }

  async createTransaction(data: CreateTransactionDto): Promise<Transaction> {
    const response = await this.http.post('/transactions', data);
    return response.data;
  }
}
```

#### 4. 사용 예시

```typescript
// module/finance/FinanceService.ts
export class FinanceService {
  private apiClient: FinanceApiClient;

  constructor() {
    const factory = new FinanceApiFactory();
    this.apiClient = factory.create({
      baseURL: process.env.FINANCE_API_URL || 'https://api.finance.com',
      timeout: 10000,
    });
  }

  async getUserAccounts(userId: string): Promise<Account[]> {
    return this.apiClient.getAccounts();
  }
}
```

### Factory 패턴 장점

✅ **관심사의 분리**: API 생성 로직과 사용 로직 분리  
✅ **설정 중앙화**: 인증, 타임아웃, 헤더 등을 한 곳에서 관리  
✅ **테스트 용이성**: Mock Factory를 쉽게 주입 가능  
✅ **확장성**: 새로운 API 추가 시 일관된 패턴 적용  
✅ **유지보수성**: API 변경 시 Factory만 수정

---

## 📝 추가 규칙

### 명명 규칙
- 파일명: `PascalCase` (클래스) 또는 `camelCase` (함수)
- 클래스: `PascalCase`
- 함수/변수: `camelCase`
- 상수: `UPPER_SNAKE_CASE`
- 인터페이스: `PascalCase` (I 접두사 사용 안 함)

### Import 순서
1. 외부 라이브러리
2. 내부 모듈 (절대 경로)
3. 상대 경로 import
4. 타입 import (별도 그룹)

```typescript
// 외부 라이브러리
import express from 'express';
import axios from 'axios';

// 내부 모듈
import { FinanceService } from '@/module/finance';
import { UserRepository } from '@/infrastructure/database';

// 상대 경로
import { helper } from './helper';

// 타입
import type { Account, Transaction } from '@/model';
```

### 에러 처리
- 모든 API 호출은 try-catch로 감싸야 합니다
- 커스텀 에러 클래스를 사용합니다
- 에러 로깅을 표준화합니다

```typescript
try {
  const data = await apiClient.getData();
  return data;
} catch (error) {
  logger.error('Failed to fetch data', { error });
  throw new ApiError('데이터를 가져오는데 실패했습니다', error);
}
```

---

## 🔍 코드 리뷰 체크리스트

- [ ] 폴더 구조가 규칙을 따르는가?
- [ ] API 요청이 Factory 패턴으로 구현되었는가?
- [ ] 명명 규칙을 준수하는가?
- [ ] 에러 처리가 적절한가?
- [ ] 타입 안정성이 보장되는가?
- [ ] 테스트 코드가 작성되었는가?

