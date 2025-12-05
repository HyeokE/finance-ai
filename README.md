# Auto-Finance: AI-Powered Multi-Market Trading Bot

> 🤖 AI 기반 자동 매매 시스템 - 한국 및 해외 주식 지원 (Monorepo)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-Workspace-orange)](https://pnpm.io/)

## 📦 Monorepo Structure

```
auto-finance/
├── apps/
│   ├── backend/          # Trading bot server
│   └── dashboard/        # React admin dashboard
├── packages/             # Shared packages (future)
├── pnpm-workspace.yaml   # Workspace config
└── package.json          # Root package
```

## ✨ Features

### Core Features
- **AI-Powered Decisions**: GPT-4o analyzes market data
- **Multi-Market Support**: Korea, US, Hong Kong, Japan, China
- **Risk Management**: Position limits, currency exposure
- **Web Dashboard**: Real-time monitoring and configuration
- **Paper Trading**: Test strategies safely
- **Automated Execution**: 4x daily batch runs

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+ (`npm install -g pnpm`)
- Accounts: KIS, OpenAI, Supabase

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/auto-finance.git
cd auto-finance

# Install all dependencies
pnpm install

# Copy environment template
cp .env.example .env
nano .env  # Fill in your credentials
```

### Database Setup

1. Create Supabase project
2. Run migrations:
```bash
# In Supabase SQL editor
cat apps/backend/src/infrastructure/database/schema.sql
cat apps/backend/src/infrastructure/database/migration_settings.sql
```

### Development

```bash
# Run backend
pnpm dev:backend

# Run dashboard (separate terminal)
pnpm dev:dashboard

# Build everything
pnpm build

# Build specific app
pnpm build:backend
pnpm build:dashboard
```

## 📊 Usage

### Manual Batch Trigger

```bash
curl -X POST http://localhost:3000/api/batch/run
```

### Access Dashboard

```
http://localhost:5173
```

Features:
- ⚙️ Batch configuration
- 🛡️ Risk settings
- 📊 Real-time monitoring
- 📈 Analytics

## 🏗️ Architecture

### Backend (`apps/backend`)

```
src/
├── agents/           # AI decision engine
├── controller/       # API controllers
├── infrastructure/   # External services
├── model/            # TypeScript types
├── module/          # Business logic
└── util/            # Helpers
```

### Dashboard (`apps/dashboard`)

```
src/
├── components/      # React components
├── lib/            # API client, utils
└── App.tsx         # Main app
```

## 💰 Supported Markets

| Market | Hours (KST) | Currency | Max Position |
|--------|-------------|----------|--------------|
| 🇰🇷 Korea | 09:00-15:30 | KRW | 20% |
| 🇺🇸 US | 23:30-06:00 | USD | 15% |
| 🇭🇰 Hong Kong | 10:30-17:00 | HKD | 15% |
| 🇯🇵 Japan | 09:00-15:00 | JPY | 15% |
| 🇨🇳 China | 10:30-16:00 | CNY | 15% |

## 🛡️ Risk Management

- **Position Limits**: 15-20% per stock
- **Currency Exposure**: USD 30%, HKD 20%, JPY 15%, CNY 10%
- **Cash Reserve**: Minimum 20%
- **Stop Loss**: -3% trigger
- **AI Confidence**: 60% threshold

## 🚀 Deployment

### Oracle Cloud (Automated)

1. Setup GitHub Secrets
2. Push to `main` branch
3. GitHub Actions deploys automatically

See [DEPLOYMENT.md](DEPLOYMENT.md) for details.

### Manual Deployment

```bash
# SSH to server
./deploy.sh

# Or use pnpm
pnpm deploy:backend
pnpm deploy:dashboard
```

## 📝 Monorepo Commands

```bash
# Install all dependencies
pnpm install

# Build all apps
pnpm build

# Run backend dev server
pnpm dev:backend

# Run dashboard dev server
pnpm dev:dashboard

# Build specific app
pnpm --filter @auto-finance/backend build
pnpm --filter @auto-finance/dashboard build

# Type check all
pnpm typecheck

# Clean all builds
pnpm clean
```

## 🔧 Environment Variables

### Backend (.env in root)

```bash
MODE=paper  # paper | live | backtest
KIS_APP_KEY=your_key
KIS_APP_SECRET=your_secret
OPENAI_API_KEY=your_key
SUPABASE_URL=your_url
SUPABASE_SERVICE_KEY=your_key
```

### Dashboard (apps/dashboard/.env)

```bash
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
```

## 📖 Documentation

- [Implementation Plan](./docs/implementation_plan.md)
- [Overseas Trading](./docs/overseas_implementation_plan.md)
- [Dashboard Guide](./docs/dashboard_quickstart.md)
- [Deployment Guide](./DEPLOYMENT.md)

## ⚠️ Disclaimer

**This software is for educational purposes only.**

- Trading involves substantial risk
- Start with paper mode
- Never invest more than you can afford to lose
- Consult a financial advisor

## 📄 License

ISC License

---

Made with ❤️ using pnpm workspaces
