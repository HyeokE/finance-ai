import { useState, useCallback } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { batchApi, dashboardApi } from "./api/client";
import {
  BatchResultModal,
  type BatchResult,
} from "./components/BatchResultModal";
import { MarketsPage } from "./pages/MarketsPage";
import { WatchlistPage } from "./pages/WatchlistPage";
import { DecisionsPage } from "./pages/DecisionsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { OverviewPage } from "./pages/OverviewPage";
import { StockDetailPage } from "./pages/StockDetailPage";
import { PositionsPage } from "./pages/PositionsPage";
import type { OrderWithMeta } from "./types";
import {
  useDecisionsQuery,
  useOrdersQuery,
  useOverviewQuery,
} from "./queries/dashboard";
import { Sidebar } from "./components/Sidebar";
import { MobileNav } from "./components/MobileNav";

function App() {
  const location = useLocation();
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [isFetchingBatchResult, setIsFetchingBatchResult] = useState(false);
  const [batchResultError, setBatchResultError] = useState<string | null>(null);

  const overviewQuery = useOverviewQuery();
  const decisionsQuery = useDecisionsQuery(
    50,
    location.pathname === "/decisions"
  );
  const ordersQuery = useOrdersQuery(100, location.pathname === "/orders");

  const fetchBatchResult = async ({
    runId,
    market,
  }: {
    runId: string;
    market: string;
  }) => {
    setIsFetchingBatchResult(true);
    setBatchResultError(null);
    try {
      const status = await batchApi.getStatus(runId);
      const decisionList = status.decisions || [];
      const recentOrders = (await dashboardApi.getRecentOrders(
        200
      )) as OrderWithMeta[];
      const runStart = status.run.started_at;

      const ordersForRun = recentOrders.filter((order) => {
        if (order.run_id) {
          return order.run_id === runId;
        }
        return order.runs?.started_at === runStart;
      });

      setBatchResult({
        runId,
        market,
        status: status.run.status,
        decisions: decisionList,
        orders: ordersForRun,
      });
    } catch (error: unknown) {
      console.error("Failed to fetch batch result", error);
      setBatchResultError(
        error instanceof Error
          ? error.message
          : "배치 결과를 가져오지 못했습니다"
      );
    } finally {
      setIsFetchingBatchResult(false);
    }
  };

  const handleBatchSuccess = useCallback(
    (payload: { runId: string; market: string }) => {
      setBatchResult({
        runId: payload.runId,
        market: payload.market,
        status: "running",
        decisions: [],
        orders: [],
      });
      fetchBatchResult(payload);
    },
    [] // stable callback
  );

  const closeBatchResult = () => {
    setBatchResult(null);
    setBatchResultError(null);
    setIsFetchingBatchResult(false);
  };

  const stats = overviewQuery.data
    ? {
        totalEquity: overviewQuery.data.account?.total_equity,
        returnRate: overviewQuery.data.account?.return_rate,
        todayRuns: overviewQuery.data.today_runs,
      }
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar for desktop */}
      <Sidebar stats={stats} />

      {/* Mobile header */}
      <div className="fixed left-0 right-0 top-0 z-30 border-b border-border bg-card/80 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <svg
                className="h-5 w-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">
                Auto Finance
              </h1>
              <p className="text-xs text-muted-foreground">AI Trading</p>
            </div>
          </div>
          {stats?.returnRate !== undefined && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">수익률</div>
              <div
                className={`terminal-number text-sm font-bold ${
                  stats.returnRate >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {stats.returnRate >= 0 ? "+" : ""}
                {stats.returnRate.toFixed(2)}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="min-h-screen pb-20 pt-16 lg:ml-64 lg:pb-6 lg:pt-6">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="animate-fade-in">
            <Routes>
              <Route
                path="/"
                element={
                  overviewQuery.data ? (
                    <OverviewPage overview={overviewQuery.data} />
                  ) : null
                }
              />
              <Route
                path="/markets"
                element={<MarketsPage onBatchSuccess={handleBatchSuccess} />}
              />
              <Route
                path="/watchlist"
                element={
                  <WatchlistPage
                    isActive={location.pathname === "/watchlist"}
                  />
                }
              />
              <Route
                path="/decisions"
                element={
                  <DecisionsPage decisions={decisionsQuery.data || []} />
                }
              />
              <Route
                path="/orders"
                element={<OrdersPage orders={ordersQuery.data || []} />}
              />
              <Route path="/positions" element={<PositionsPage />} />
              <Route path="/stock/:ticker" element={<StockDetailPage />} />
            </Routes>
          </div>
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <MobileNav />

      {/* Batch result modal */}
      <BatchResultModal
        result={batchResult}
        loading={isFetchingBatchResult}
        error={batchResultError}
        onClose={closeBatchResult}
      />
    </div>
  );
}

export default App;
