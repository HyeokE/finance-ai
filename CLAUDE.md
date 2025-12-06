# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Auto-Finance is an AI-powered multi-market trading bot that uses GPT-4o for decision-making across Korea, US, Hong Kong, Japan, and China markets. The system runs automated batch processing 4x daily with comprehensive risk management.

## Monorepo Structure

This is a **pnpm workspace** monorepo with three packages:

```
auto-finance/
├── apps/
│   ├── backend/          # Node.js/Express trading bot server
│   └── dashboard/        # React/Vite admin dashboard
└── packages/
    └── shared/           # Shared TypeScript types and models
```

**Key workspace commands:**
```bash
# Install all dependencies (always use pnpm, never npm)
pnpm install

# Development
pnpm dev:backend          # Run backend with tsx watch on port 3000
pnpm dev:dashboard        # Run dashboard with Vite dev server on port 5173

# Building
pnpm build                # Build all workspaces
pnpm build:backend        # Build backend only (outputs to apps/backend/dist)
pnpm build:dashboard      # Build dashboard only (outputs to apps/dashboard/dist)

# Type checking
pnpm typecheck            # Run TypeScript type check across all workspaces

# Backend-specific (run from apps/backend)
pnpm --filter @auto-finance/backend dev
pnpm --filter @auto-finance/backend build
pnpm --filter @auto-finance/backend start    # Run built backend (node dist/server.js)

# Dashboard-specific (run from apps/dashboard)
pnpm --filter @auto-finance/dashboard dev
pnpm --filter @auto-finance/dashboard build
```

**Important:** This project uses pnpm workspaces. Never suggest `npm install` or `yarn`. Always use `pnpm`.

## Backend Architecture (`apps/backend`)

The backend follows a layered architecture with strict folder responsibilities:

```
src/
├── agents/           # Business automation & workflow orchestration
│   ├── AIDecisionEngine.ts      # GPT-4o integration for trading decisions
│   ├── BatchOrchestrator.ts     # Coordinates entire batch workflow
│   └── SystemPrompt.ts          # AI prompt templates
├── controller/       # HTTP request/response handlers
│   ├── BatchController.ts       # Manual batch trigger endpoint
│   ├── OrderExecutor.ts         # Order submission to KIS broker
│   ├── SettingsController.ts    # Settings CRUD API
│   └── WatchlistController.ts   # Watchlist management API
├── infrastructure/   # External services integration
│   ├── api/
│   │   ├── ApiFactory.ts        # Base factory interface
│   │   ├── KISApiFactory.ts     # Korea Investment & Securities API factory
│   │   ├── KISApiClient.ts      # KIS trading API client
│   │   ├── OpenAIFactory.ts     # OpenAI API factory
│   │   └── OpenAIClient.ts      # GPT-4o client wrapper
│   └── database/
│       ├── SupabaseClient.ts    # Supabase client singleton
│       ├── DatabaseRepository.ts # Trading data persistence
│       ├── SettingsRepository.ts # Settings & configuration persistence
│       ├── schema.sql            # Main database schema
│       ├── migration_settings.sql
│       ├── migration_market_settings.sql
│       └── migration_watchlist.sql
├── model/            # TypeScript type definitions
│   ├── Trading.ts    # Portfolio, Position, Order types
│   ├── AI.ts         # AIDecision, AIInput, Constraints
│   ├── Market.ts     # Market enums and types
│   └── MarketSettings.ts  # BatchSettings, RiskSettings
├── module/           # Core business logic modules
│   ├── DataCollector.ts     # Fetches market/portfolio data from KIS
│   ├── ContextCompressor.ts # Compresses market features for AI
│   └── RiskValidator.ts     # Pre/post-trade risk checks
├── util/             # Helper functions
│   ├── logger.ts     # Structured logging
│   ├── errors.ts     # Custom error classes
│   ├── retry.ts      # Retry logic for API calls
│   └── formatters.ts # Currency/number formatting
├── scheduler.ts      # node-cron schedules (4x daily batches)
└── server.ts         # Express app setup & route registration
```

### Path Aliases

The backend uses TypeScript path aliases configured in [tsconfig.json](tsconfig.json):
- `@/*` → `src/*`
- `@agents/*` → `agents/*`
- `@controller/*` → `controller/*`
- `@infrastructure/*` → `infrastructure/*`
- `@model/*` → `model/*`
- `@module/*` → `module/*`
- `@util/*` → `util/*`

**Always use these aliases** when adding imports in backend code.

### API Factory Pattern (CRITICAL)

**All external API clients MUST use the Factory pattern.** This is a strict project requirement from [CODING_RULES.md](CODING_RULES.md).

Pattern structure:
1. **Factory Interface** ([infrastructure/api/ApiFactory.ts](apps/backend/src/infrastructure/api/ApiFactory.ts)): Defines `create(config: ApiConfig)` method
2. **Concrete Factory** (e.g., `KISApiFactory`, `OpenAIFactory`): Implements factory, sets up axios instances, configures interceptors
3. **API Client Class** (e.g., `KISApiClient`, `OpenAIClient`): Contains domain-specific API methods
4. **Usage**: Services instantiate factories and call `create()` with config

When adding new external APIs:
- Never create raw axios instances directly
- Always create a Factory class and Client class
- Place in `infrastructure/api/`
- Follow the existing `KISApiFactory` and `OpenAIFactory` patterns

### AI Provider Architecture

The system supports **multiple AI providers** through a common `IAIProvider` interface:

**Supported Providers:**
- **OpenAI**: GPT-4o, GPT-4.5, GPT-5.1 (default)
- **Google Gemini**: gemini-2.0-flash-exp, gemini-1.5-pro, gemini-1.5-flash

**Provider Selection:**
- Configure via `AI_PROVIDER` environment variable ('openai' or 'gemini')
- Defaults to 'openai' if not specified or invalid
- Provider is initialized at `AIDecisionEngine` construction time

**Architecture Pattern:**
- `IAIProvider` interface ([infrastructure/api/IAIProvider.ts](apps/backend/src/infrastructure/api/IAIProvider.ts)): Common contract with `getTradingDecision()` and `testConnection()` methods
- Provider-specific factories: `OpenAIFactory`, `GeminiApiFactory`
- Provider-specific clients: `OpenAIClient`, `GeminiApiClient`
- `AIDecisionEngine` depends on the interface, not concrete implementations (Dependency Inversion)

**Adding New AI Providers:**
1. Create client class implementing `IAIProvider`
2. Create factory class implementing `ApiFactory<YourClient>`
3. Add provider type to `AIProviderType` union in `AIDecisionEngine`
4. Add case to `createProvider()` switch statement
5. Update `.env.example` with new provider credentials

### Batch Processing Workflow

The `BatchOrchestrator` coordinates market-specific batch runs in this sequence:

1. **Load Settings**: Fetch market-specific batch & risk settings from Supabase
2. **Check if Enabled**: Skip if `marketSettings.enabled = false`
3. **Data Collection**: `DataCollector` fetches portfolio, positions, market indices, watchlist from KIS API
4. **Context Compression**: `ContextCompressor` aggregates features into compressed JSON
5. **AI Decision**: `AIDecisionEngine` sends context to GPT-4o, parses JSON decisions
6. **Risk Validation**: `RiskValidator` checks position limits, currency exposure, cash reserves
7. **Order Execution**: `OrderExecutor` submits approved orders to KIS broker
8. **Persistence**: Save run logs, decisions, orders, snapshots to Supabase

Key entry points:
- Manual trigger: `POST /api/batch/run` (calls `BatchController.runBatch()`)
- Scheduled: [scheduler.ts](apps/backend/src/scheduler.ts) runs batches 4x daily via node-cron

### Database Schema

Supabase PostgreSQL with 5 main tables (see [schema.sql](apps/backend/src/infrastructure/database/schema.sql)):

- `runs`: Batch execution logs (mode, status, timestamps)
- `decisions`: AI decisions per stock (ticker, action, confidence, reason)
- `orders`: Order execution tracking (qty, price, status, broker_order_id)
- `portfolio_snapshots`: Portfolio state at each batch (equity, cash, positions JSONB)
- `market_snapshots`: Market context (index_info, sentiment, compressed features)

Additional tables:
- `batch_settings`: Global batch configuration
- `market_batch_settings`: Per-market batch configuration (enabled, max_daily_trades, etc.)
- `risk_settings`: Global risk constraints
- `market_risk_settings`: Per-market risk limits (max_position_pct, max_currency_exposure)
- `watchlist`: User-selected stock watchlist per market

To apply schema changes, run SQL directly in Supabase SQL editor (no migrations framework).

## Dashboard Architecture (`apps/dashboard`)

React 19 + Vite + TypeScript + Tailwind CSS with Feature-Sliced Design architecture:

```
src/
├── app/              # Application initialization
├── pages/            # Route components
├── widgets/          # Composite UI blocks (Dashboard sections)
├── features/         # Feature-specific logic (BatchControls, RiskSettings)
├── entities/         # Domain entities (Position, Order)
├── shared/           # Shared UI components, utilities
│   ├── ui/           # Reusable components (Button, Card, etc.)
│   └── lib/          # Utilities, API client
├── lib/              # API client, Supabase client
└── App.tsx           # Main app component
```

**Dashboard development:**
- Uses Vite for dev server and build
- Environment variables in `apps/dashboard/.env` (VITE_ prefix required)
- Communicates with backend via REST API (`VITE_API_URL`)
- Direct Supabase access for read-only data (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)

## Shared Package (`packages/shared`)

Contains shared TypeScript types exported to both backend and dashboard:
- `MarketSettings.ts`: Market configuration types
- `Trading.ts`: Trading domain types (Portfolio, Position, Order)
- `AI.ts`: AI decision types
- `Watchlist.ts`: Watchlist types

When adding shared types:
1. Add to `packages/shared/src/`
2. Export from `packages/shared/src/index.ts`
3. Run `pnpm --filter @auto-finance/shared build`
4. Import as `import { Type } from '@auto-finance/shared'` in apps

## Environment Setup

**Backend** requires `.env` in project root with:
- `MODE`: 'paper' | 'live' | 'backtest'
- `KIS_APP_KEY`, `KIS_APP_SECRET`: Korea Investment & Securities credentials
- `AI_PROVIDER`: 'openai' | 'gemini' (default: 'openai')
- `OPENAI_API_KEY`: OpenAI API key (required if using OpenAI)
- `OPENAI_MODEL`: OpenAI model name (optional, default: 'gpt-4o')
- `GEMINI_API_KEY`: Google Gemini API key (required if using Gemini)
- `GEMINI_MODEL`: Gemini model name (optional, default: 'gemini-2.0-flash-exp')
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`: Supabase connection

**Dashboard** requires `apps/dashboard/.env` with:
- `VITE_API_URL`: Backend URL (e.g., http://localhost:3000)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: Supabase connection

See [.env.example](.env.example) for full template.

## Multi-Market Support

The system supports 5 markets defined in `Market` enum:
- `KOREA`: 09:00-15:30 KST, KRW, 20% max position
- `USA`: 23:30-06:00 KST, USD, 15% max position
- `HONGKONG`: 10:30-17:00 KST, HKD, 15% max position
- `JAPAN`: 09:00-15:00 KST, JPY, 15% max position
- `CHINA`: 10:30-16:00 KST, CNY, 15% max position

Each market has independent:
- Batch settings (`market_batch_settings` table)
- Risk settings (`market_risk_settings` table)
- Watchlist (`watchlist` table with market column)
- Scheduled batch runs

When adding market-specific features, always consider per-market configuration.

## Code Style & Conventions

From [CODING_RULES.md](CODING_RULES.md):

**Naming:**
- Files: `PascalCase` (classes) or `camelCase` (functions)
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Interfaces: `PascalCase` (no `I` prefix)

**Import Order:**
1. External libraries
2. Internal modules (absolute paths with `@/` aliases)
3. Relative paths
4. Type imports (separate group)

**Error Handling:**
- Wrap all external API calls in try-catch
- Use custom error classes from [util/errors.ts](apps/backend/src/util/errors.ts)
- Log errors with structured context using [util/logger.ts](apps/backend/src/util/logger.ts)

## Deployment

Production deployment to Oracle Cloud via GitHub Actions (see [DEPLOYMENT.md](DEPLOYMENT.md)):
- Backend: PM2 process manager, Nginx reverse proxy on port 3000
- Dashboard: Static files served by Nginx
- Triggered on push to `main` branch or manual workflow dispatch
- Environment variables managed on server in `~/auto-finance/.env`

For local testing of production build:
```bash
pnpm build:backend
node apps/backend/dist/server.js
```

## Development Workflow

1. **Starting development:**
   ```bash
   pnpm install
   cp .env.example .env
   # Fill in .env credentials
   pnpm dev:backend    # Terminal 1
   pnpm dev:dashboard  # Terminal 2
   ```

2. **Manual batch trigger:**
   ```bash
   curl -X POST http://localhost:3000/api/batch/run
   ```

3. **View dashboard:** http://localhost:5173

4. **Type checking before commit:**
   ```bash
   pnpm typecheck
   ```

5. **Database changes:** Run SQL in Supabase SQL editor (no migration CLI)

## Risk Management

Enforced by `RiskValidator` using constraints from `risk_settings` and `market_risk_settings`:
- Position limits: 15-20% per stock
- Currency exposure caps: USD 30%, HKD 20%, JPY 15%, CNY 10%
- Minimum cash reserve: 20%
- Stop loss trigger: -3%
- AI confidence threshold: 60% (0.6)

Always validate new trading logic against these constraints before execution.
