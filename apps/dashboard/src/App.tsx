import { useState, useEffect } from 'react';
import { Activity, Settings, BarChart3, PlayCircle } from 'lucide-react';
import {
  fetchDashboardOverview,
  fetchBatchSettings,
  fetchRiskSettings,
  updateBatchSettings,
  updateRiskSettings,
  triggerBatch,
  fetchRecentDecisions,
} from './lib/api';
import { formatCurrency, formatPercent, formatDate } from './lib/utils';
import './index.css';

interface DashboardData {
  latest_run: any;
  today_runs: number;
  today_orders: number;
  success_rate_30d: number;
}

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [batchSettings, setBatchSettings] = useState<any>(null);
  const [riskSettings, setRiskSettings] = useState<any>(null);
  const [recentDecisions, setRecentDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [overview, batch, risk, decisions] = await Promise.all([
        fetchDashboardOverview(),
        fetchBatchSettings(),
        fetchRiskSettings(),
        fetchRecentDecisions(10),
      ]);

      setDashboardData(overview);
      setBatchSettings(batch);
      setRiskSettings(risk);
      setRecentDecisions(decisions);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleTriggerBatch() {
    try {
      await triggerBatch();
      alert('Batch triggered successfully!');
      setTimeout(loadData, 2000);
    } catch (error) {
      alert('Failed to trigger batch');
    }
  }

  async function handleSaveBatchSettings() {
    try {
      await updateBatchSettings(batchSettings);
      alert('Batch settings saved!');
    } catch (error) {
      alert('Failed to save batch settings');
    }
  }

  async function handleSaveRiskSettings() {
    try {
      await updateRiskSettings(riskSettings);
      alert('Risk settings saved!');
    } catch (error) {
      alert('Failed to save risk settings');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Auto-Finance Dashboard</h1>
              <p className="text-sm text-gray-500">AI-Powered Trading System</p>
            </div>
            <button
              onClick={handleTriggerBatch}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <PlayCircle size={20} />
              Run Batch Now
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex gap-4 border-b">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'batch', label: 'Batch Settings', icon: Settings },
            { id: 'risk', label: 'Risk Settings', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && dashboardData && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'Today Runs', value: dashboardData.today_runs, color: 'blue' },
                { label: 'Today Orders', value: dashboardData.today_orders, color: 'green' },
                {
                  label: 'Success Rate (30d)',
                  value: formatPercent(dashboardData.success_rate_30d),
                  color: 'purple',
                },
                {
                  label: 'Last Run',
                  value: dashboardData.latest_run?.status || 'N/A',
                  color: 'orange',
                },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="text-sm text-gray-500">{stat.label}</div>
                  <div className={`text-2xl font-bold text-${stat.color}-600 mt-2`}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Recent Decisions */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold">Recent Decisions</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Ticker', 'Action', 'Amount/Qty', 'Confidence', 'Reason', 'Time'].map((h) => (
                        <th
                          key={h}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentDecisions.map((d, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{d.ticker}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${d.action === 'BUY'
                                ? 'bg-green-100 text-green-800'
                                : d.action === 'SELL'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                          >
                            {d.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {d.amount_krw ? formatCurrency(d.amount_krw) : d.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {formatPercent(d.confidence)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {d.reason}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(d.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'batch' && batchSettings && (
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <h2 className="text-lg font-semibold mb-4">Batch Configuration</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mode</label>
                <select
                  value={batchSettings.mode}
                  onChange={(e) => setBatchSettings({ ...batchSettings, mode: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="paper">Paper Trading</option>
                  <option value="live">Live Trading</option>
                  <option value="backtest">Backtest</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={batchSettings.enabled}
                    onChange={(e) =>
                      setBatchSettings({ ...batchSettings, enabled: e.target.checked })
                    }
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Enable Automatic Execution</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule Times (comma-separated)
                </label>
                <input
                  type="text"
                  value={batchSettings.schedule_times.join(', ')}
                  onChange={(e) =>
                    setBatchSettings({
                      ...batchSettings,
                      schedule_times: e.target.value.split(',').map((t) => t.trim()),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="09:05, 10:30, 13:30, 15:00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supported Markets
                </label>
                <div className="space-y-2">
                  {['DOMESTIC', 'US', 'HK', 'JP', 'CN'].map((market) => (
                    <label key={market} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={batchSettings.supported_markets.includes(market)}
                        onChange={(e) => {
                          const markets = e.target.checked
                            ? [...batchSettings.supported_markets, market]
                            : batchSettings.supported_markets.filter((m: string) => m !== market);
                          setBatchSettings({ ...batchSettings, supported_markets: markets });
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{market}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSaveBatchSettings}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Save Batch Settings
              </button>
            </div>
          </div>
        )}

        {activeTab === 'risk' && riskSettings && (
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <h2 className="text-lg font-semibold mb-4">Risk Management Settings</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { key: 'max_position_weight_domestic', label: 'Max Domestic Position (%)', max: 100 },
                { key: 'max_position_weight_overseas', label: 'Max Overseas Position (%)', max: 100 },
                { key: 'max_total_investment', label: 'Max Total Investment (%)', max: 100 },
                { key: 'max_overseas_total', label: 'Max Overseas Total (%)', max: 100 },
                { key: 'min_cash_reserve', label: 'Min Cash Reserve (%)', max: 100 },
                { key: 'min_confidence', label: 'Min Confidence (%)', max: 100 },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {field.label}
                  </label>
                  <input
                    type="number"
                    value={(riskSettings[field.key] * 100).toFixed(1)}
                    onChange={(e) =>
                      setRiskSettings({
                        ...riskSettings,
                        [field.key]: parseFloat(e.target.value) / 100,
                      })
                    }
                    step="0.1"
                    min="0"
                    max={field.max}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Trades per Batch
                </label>
                <input
                  type="number"
                  value={riskSettings.max_trades_per_batch}
                  onChange={(e) =>
                    setRiskSettings({
                      ...riskSettings,
                      max_trades_per_batch: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Order Amount (KRW)
                </label>
                <input
                  type="number"
                  value={riskSettings.min_order_amount}
                  onChange={(e) =>
                    setRiskSettings({
                      ...riskSettings,
                      min_order_amount: parseInt(e.target.value),
                    })
                  }
                  step="10000"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <button
              onClick={handleSaveRiskSettings}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Save Risk Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
