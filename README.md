# Auto-Finance: AI-Powered Multi-Market Trading Bot

> 🤖 AI 기반 자동 매매 시스템 - 한국 및 해외 주식 지원

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-ISC-orange)](LICENSE)

## 🌍 Supported Markets

- 🇰🇷 **Korea**: KOSPI, KOSDAQ
- 🇺🇸 **United States**: NASDAQ, NYSE, AMEX
- 🇭🇰 **Hong Kong**: HKEX
- 🇯🇵 **Japan**: Tokyo Stock Exchange
- 🇨🇳 **China**: Shanghai, Shenzhen

## ✨ Features

### Core Features
- **AI-Powered Decisions**: GPT-4o analyzes market data and makes trading decisions
- **Multi-Market Support**: Trade stocks across 5 different markets
- **Risk Management**: Position limits, stop loss, currency exposure controls
- **Paper Trading**: Test strategies without real money
- **Automated Execution**: 4x daily batch runs during market hours
- **Complete Audit Trail**: All decisions and trades logged to database

### Advanced Features
- **Context Compression**: Optimizes GPT token usage
- **Currency Management**: Multi-currency portfolio tracking
- **Factory Pattern API**: Clean, testable architecture
- **Real-time Monitoring**: Health checks and analytics endpoints
- **Flexible Scheduling**: Configurable batch times via cron

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm (or npm/yarn)
- Accounts:
  - [Korea Investment & Securities](https://www.koreainvestment.com/) (한국투자증권)
  - [OpenAI](https://platform.openai.com/)
  - [Supabase](https://supabase.com/)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/auto-finance.git
cd auto-finance

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### Database Setup

1. Create a Supabase project
2. Run the schema:
```bash
cat src/infrastructure/database/schema.sql
```
3. Copy and execute in Supabase SQL editor

### Configuration

Edit `.env` file:

```bash
# Required
KIS_APP_KEY=your_kis_app_key
KIS_APP_SECRET=your_kis_secret
KIS_ACCOUNT_NUMBER=your_account
OPENAI_API_KEY=sk-your-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Trading Mode
MODE=paper  # Start with paper mode!

# Overseas Trading
ENABLE_OVERSEAS_TRADING=true
SUPPORTED_MARKETS=US,HK,JP,CN
```

### Run

```bash
# Development
pnpm dev

# Production
pnpm build
pnpm start
```

## 📊 Usage

### Manual Batch Trigger

```bash
curl -X POST http://localhost:3000/api/batch/run
```

Response:
```json
{
  "success": true,
  "run_id": "uuid-here",
  "status": "success"
}
```

### Check Batch Status

```bash
curl http://localhost:3000/api/batch/status/{run_id}
```

### View Analytics

```bash
curl http://localhost:3000/api/analytics
```

## 🏗️ Architecture

```
┌─────────────┐
│  Scheduler  │ (4x daily)
└──────┬──────┘
       │
       v
┌──────────────────┐
│ BatchOrchestrator│
├──────────────────┤
│ 1. Data Collect  │ → KIS API (Korean + Overseas)
│ 2. Compress      │ → Feature Engineering
│ 3. AI Decision   │ → GPT-4o
│ 4. Validate      │ → Risk Check
│ 5. Execute       │ → Place Orders
│ 6. Log           │ → Supabase
└──────────────────┘
```

## 💰 Trading Markets

### Korean Market (국내)
- Trading hours: 09:00 - 15:30 KST
- Currencies: KRW
- Max position: 20% per stock
- Examples: 삼성전자 (005930), SK하이닉스 (000660)

### US Market (미국)
- Trading hours: 23:30 - 06:00 KST (next day)
- Currencies: USD
- Max position: 15% per stock
- Examples: AAPL, MSFT, GOOGL, TSLA

### Hong Kong Market (홍콩)
- Trading hours: 10:30 - 17:00 KST
- Currencies: HKD
- Max position: 15% per stock
- Examples: 0700.HK (Tencent), 0941.HK (China Mobile)

### Japan Market (일본)
- Trading hours: 09:00 - 15:00 KST
- Currencies: JPY
- Max position: 15% per stock
- Examples: 7203.T (Toyota), 9984.T (SoftBank)

### China Market (중국)
- Trading hours: 10:30 - 16:00 KST
- Currencies: CNY
- Max position: 15% per stock
- Examples: 600519.SS (Moutai), 000001.SZ (Ping An)

## 🛡️ Risk Management

### Position Limits
- **Domestic**: Max 20% per stock, 80% total
- **Overseas**: Max 15% per stock, 50% total

### Currency Exposure
- USD: Max 30%
- HKD: Max 20%
- JPY: Max 15%
- CNY: Max 10%

### Safety Features
- Stop loss at -3%
- Minimum 20% cash reserve
- Paper mode for testing
- AI confidence threshold (60%)

## 📝 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | System health check |
| POST | `/api/batch/run` | Trigger manual batch |
| GET | `/api/batch/status/:runId` | Get batch status |
| GET | `/api/analytics` | Performance analytics |

## 🔧 Development

### Project Structure

```
src/
├── agents/           # AI decision engine, orchestrator
├── controller/       # Order execution
├── infrastructure/   # API clients, database
├── model/            # TypeScript types
├── module/           # Business logic
└── util/             # Helpers (logger, retry, etc.)
```

### Build

```bash
pnpm build
```

### Lint & Format

```bash
pnpm lint
pnpm format
```

## 📖 Documentation

- [Implementation Plan](./implementation_plan.md)
- [Overseas Trading Plan](./overseas_implementation_plan.md)
- [Coding Rules](./CODING_RULES.md)
- [Walkthrough](./walkthrough.md)

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines first.

## ⚠️ Disclaimer

**This software is for educational purposes only.**

- Trading involves substantial risk of loss
- Past performance does not guarantee future results
- Start with paper trading mode
- Never invest more than you can afford to lose
- Consult a financial advisor before trading

## 📄 License

ISC License - see [LICENSE](LICENSE) file for details.

## 🙋 Support

- GitHub Issues: [Create an issue](https://github.com/yourusername/auto-finance/issues)
- Documentation: Check `/docs` folder
- KIS API Docs: https://apiportal.koreainvestment.com/

---

Made with ❤️ by Auto-Finance Team
