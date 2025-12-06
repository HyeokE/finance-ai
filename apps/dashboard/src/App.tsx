import { useEffect, useState, useCallback } from 'react';
import type { DashboardOverview, DecisionResponse, Order } from './api/client';
import { batchApi, dashboardApi } from './api/client';
import { BatchResultModal, type BatchResult } from './components/BatchResultModal';
import { MarketsPage } from './pages/MarketsPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { DecisionsPage } from './pages/DecisionsPage';
import { OrdersPage } from './pages/OrdersPage';
import { OverviewPage } from './pages/OverviewPage';
import type { OrderWithMeta } from './types';

function App() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [activeTab, setActiveTab] = useState('markets');
  const [decisions, setDecisions] = useState<DecisionResponse[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [isFetchingBatchResult, setIsFetchingBatchResult] = useState(false);
  const [batchResultError, setBatchResultError] = useState<string | null>(null);

  useEffect(() => {
    loadOverview();
    const interval = setInterval(loadOverview, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'decisions') {
      loadDecisions();
    } else if (activeTab === 'orders') {
      loadOrders();
    }
  }, [activeTab]);

  const loadOverview = async () => {
    try {
      const data = await dashboardApi.getOverview();
      setOverview(data);
    } catch (error) {
      console.error('Failed to load overview:', error);
    }
  };

  const loadDecisions = async () => {
    try {
      const data = await dashboardApi.getRecentDecisions();
      setDecisions(data);
    } catch (error) {
      console.error('Failed to load decisions:', error);
    }
  };

  const loadOrders = async () => {
    try {
      const data = await dashboardApi.getRecentOrders();
      setOrders(data);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  };

  const fetchBatchResult = async ({ runId, market }: { runId: string; market: string }) => {
    setIsFetchingBatchResult(true);
    setBatchResultError(null);
    try {
      const status = await batchApi.getStatus(runId);
      const decisionList = status.decisions || [];
      const recentOrders = (await dashboardApi.getRecentOrders(200)) as OrderWithMeta[];
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
      console.error('Failed to fetch batch result', error);
      setBatchResultError(error instanceof Error ? error.message : '배치 결과를 가져오지 못했습니다');
    } finally {
      setIsFetchingBatchResult(false);
    }
  };

  const handleBatchSuccess = useCallback(
    (payload: { runId: string; market: string }) => {
      setBatchResult({
        runId: payload.runId,
        market: payload.market,
        status: 'running',
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Header overview={overview} />

        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-4">
            {['markets', 'watchlist', 'decisions', 'orders', 'overview'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 border-b-2 font-medium capitalize ${
                  activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'markets' ? 'Market Schedules' : tab}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'markets' && <MarketsPage onBatchSuccess={handleBatchSuccess} />}
        {activeTab === 'watchlist' && <WatchlistPage isActive={activeTab === 'watchlist'} />}
        {activeTab === 'decisions' && <DecisionsPage decisions={decisions} />}
        {activeTab === 'orders' && <OrdersPage orders={orders} />}
        {activeTab === 'overview' && overview && <OverviewPage overview={overview} />}

        <BatchResultModal result={batchResult} loading={isFetchingBatchResult} error={batchResultError} onClose={closeBatchResult} />
      </div>
    </div>
  );
}

function Header({ overview }: { overview: DashboardOverview | null }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Auto-Finance Dashboard</h1>
        <p className="text-gray-600">AI-Powered Multi-Market Trading Bot</p>
      </div>
      {overview && (
        <div className="flex gap-6 text-sm">
          {overview.account && (
            <>
              <HeaderStat label="총 자산" value={`₩${overview.account.total_equity.toLocaleString()}`} valueClass="text-gray-900" />
              <HeaderStat label="투자 금액" value={`₩${overview.account.investment_amount.toLocaleString()}`} valueClass="text-blue-600" />
              <HeaderStat
                label="수익률"
                value={`${overview.account.return_rate >= 0 ? '+' : ''}${overview.account.return_rate.toFixed(2)}%`}
                valueClass={overview.account.return_rate >= 0 ? 'text-green-600' : 'text-red-600'}
              />
            </>
          )}
          <HeaderStat label="Today's Runs" value={overview.today_runs} valueClass="text-gray-900" />
          <HeaderStat label="Success Rate" value={`${(overview.success_rate_30d * 100).toFixed(0)}%`} valueClass="text-green-600" />
        </div>
      )}
    </div>
  );
}

function HeaderStat({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="text-center">
      <div className="text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}

export default App;
