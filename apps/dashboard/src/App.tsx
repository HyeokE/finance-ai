import { useState, useEffect } from 'react';
import type { Market, MarketBatchSettings, MarketRiskSettings } from '@auto-finance/shared';
import {
  marketSettingsApi,
  batchApi,
  dashboardApi,
  watchlistApi,
  type DashboardOverview,
  type Order,
  type DecisionResponse,
  type WatchlistItem,
} from './api/client';
import { MARKET_INFO } from './shared/lib/constants';

// ... (MarketCard component remains the same - keeping it for brevity)
function MarketCard({ market }: { market: Market }) {
  const [batchSettings, setBatchSettings] = useState<MarketBatchSettings | null>(null);
  const [riskSettings, setRiskSettings] = useState<MarketRiskSettings | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTimes, setEditedTimes] = useState('');

  const info = MARKET_INFO[market];

  useEffect(() => {
    loadSettings();
  }, [market]);

  const loadSettings = async () => {
    try {
      const [batchData, riskData] = await Promise.all([
        marketSettingsApi.getBatchSettings(market),
        marketSettingsApi.getRiskSettings(market),
      ]);

      setBatchSettings(batchData);
      setRiskSettings(riskData);
      setEditedTimes(batchData.schedule_times.join(', '));
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleToggle = async () => {
    if (!batchSettings) return;
    const newEnabled = !batchSettings.enabled;

    try {
      await marketSettingsApi.updateBatchSettings(market, { enabled: newEnabled });
      await loadSettings();
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  const handleSaveSchedule = async () => {
    try {
      const times = editedTimes.split(',').map((t) => t.trim()).filter((t) => t);
      await marketSettingsApi.updateBatchSettings(market, { schedule_times: times });
      await loadSettings();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save schedule:', error);
    }
  };

  const handleRunBatch = async () => {
    try {
      const result = await batchApi.runBatch(market);
      alert(`Batch started for ${market}: ${result.run_id}`);
    } catch (error) {
      console.error('Failed to run batch:', error);
    }
  };

  if (!batchSettings || !riskSettings) {
    return (
      <div className="border rounded-lg p-6 mb-4 bg-white shadow-sm">
        <p className="text-gray-500">Loading {market}...</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-6 mb-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{info.flag}</span>
          <div>
            <h3 className="text-lg font-bold">{info.name}</h3>
            <p className="text-sm text-gray-500">{info.hours}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={batchSettings.enabled} onChange={handleToggle} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${batchSettings.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            {batchSettings.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Times (KST)</label>
        {isEditing ? (
          <div className="flex gap-2">
            <input type="text" value={editedTimes} onChange={(e) => setEditedTimes(e.target.value)} placeholder="09:05, 13:00, 15:00" className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={handleSaveSchedule} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 bg-gray-50 rounded-md font-mono text-sm">{batchSettings.schedule_times.join(', ')}</div>
            <button onClick={() => setIsEditing(true)} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Edit</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Max Position:</span>
          <span className="font-medium">{(riskSettings.max_position_weight * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Max Investment:</span>
          <span className="font-medium">{(riskSettings.max_total_investment * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Min Confidence:</span>
          <span className="font-medium">{(riskSettings.min_confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Max Stocks:</span>
          <span className="font-medium">{batchSettings.max_stocks}</span>
        </div>
      </div>

      <div className="pt-4 border-t">
        <button onClick={handleRunBatch} disabled={!batchSettings.enabled} className={`px-4 py-2 rounded-md ${batchSettings.enabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}>
          Run Batch Now
        </button>
      </div>
    </div>
  );
}

function App() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [activeTab, setActiveTab] = useState('markets');
  const [decisions, setDecisions] = useState<DecisionResponse[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<string>('DOMESTIC');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStock, setNewStock] = useState({ ticker: '', name: '', notes: '' });

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
    } else if (activeTab === 'watchlist') {
      loadWatchlist();
    }
  }, [activeTab, selectedMarket]);

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

  const loadWatchlist = async () => {
    try {
      const data = await watchlistApi.getByMarket(selectedMarket);
      setWatchlist(data);
    } catch (error) {
      console.error('Failed to load watchlist:', error);
    }
  };

  const handleAddStock = async () => {
    try {
      await watchlistApi.add({
        market: selectedMarket,
        ticker: newStock.ticker,
        name: newStock.name,
        notes: newStock.notes,
      });
      setNewStock({ ticker: '', name: '', notes: '' });
      setShowAddModal(false);
      loadWatchlist();
    } catch (error) {
      console.error('Failed to add stock:', error);
    }
  };

  const handleToggleStock = async (id: string, enabled: boolean) => {
    try {
      await watchlistApi.toggle(id, !enabled);
      loadWatchlist();
    } catch (error) {
      console.error('Failed to toggle stock:', error);
    }
  };

  const handleDeleteStock = async (id: string) => {
    if (!confirm('Delete this stock from watchlist?')) return;
    try {
      await watchlistApi.delete(id);
      loadWatchlist();
    } catch (error) {
      console.error('Failed to delete stock:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Auto-Finance Dashboard</h1>
            <p className="text-gray-600">AI-Powered Multi-Market Trading Bot</p>
          </div>
          {overview && (
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="text-gray-500">Today's Runs</div>
                <div className="text-2xl font-bold text-gray-900">{overview.today_runs}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500">Success Rate</div>
                <div className="text-2xl font-bold text-green-600">{(overview.success_rate_30d * 100).toFixed(0)}%</div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-4">
            {['markets', 'watchlist', 'decisions', 'orders', 'overview'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 border-b-2 font-medium capitalize ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {tab === 'markets' ? 'Market Schedules' : tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Watchlist Tab */}
        {activeTab === 'watchlist' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Watchlist - Stock Selection</h2>
              <div className="flex gap-3">
                <select value={selectedMarket} onChange={(e) => setSelectedMarket(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md">
                  <option value="DOMESTIC">🇰🇷 Korea</option>
                  <option value="US">🇺🇸 US</option>
                  <option value="HK">🇭🇰 HK</option>
                  <option value="JP">🇯🇵 JP</option>
                  <option value="CN">🇨🇳 CN</option>
                </select>
                <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  + Add Stock
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {watchlist.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{MARKET_INFO[item.market as keyof typeof MARKET_INFO]?.flag}</span>
                      <div>
                        <div className="font-medium">{item.name} ({item.ticker})</div>
                        {item.notes && <div className="text-sm text-gray-500">{item.notes}</div>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={item.enabled} onChange={() => handleToggleStock(item.id, item.enabled)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                    <button onClick={() => handleDeleteStock(item.id)} className="px-3 py-1 text-red-600 hover:bg-red-50 rounded">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {watchlist.length === 0 && (
                <p className="text-center py-8 text-gray-500">No stocks in watchlist. AI will analyze all available stocks.</p>
              )}
            </div>
          </div>
        )}

        {/* Add Stock Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-bold mb-4">Add Stock to Watchlist</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Market</label>
                  <select value={selectedMarket} onChange={(e) => setSelectedMarket(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                    <option value="DOMESTIC">🇰🇷 Korea</option>
                    <option value="US">🇺🇸 US</option>
                    <option value="HK">🇭🇰 HK</option>
                    <option value="JP">🇯🇵 JP</option>
                    <option value="CN">🇨🇳 CN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ticker</label>
                  <input type="text" value={newStock.ticker} onChange={(e) => setNewStock({ ...newStock, ticker: e.target.value })} placeholder="e.g., 005930" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input type="text" value={newStock.name} onChange={(e) => setNewStock({ ...newStock, name: e.target.value })} placeholder="e.g., Samsung Electronics" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <input type="text" value={newStock.notes} onChange={(e) => setNewStock({ ...newStock, notes: e.target.value })} placeholder="e.g., Tech giant" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button onClick={handleAddStock} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Add</button>
              </div>
            </div>
          </div>
        )}

        {/* Market Schedules Tab */}
        {activeTab === 'markets' && (
          <div>
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-xl font-bold mb-2">Market-Specific Batch Settings</h2>
              <p className="text-gray-600 mb-6">Configure batch schedules and risk parameters for each market independently</p>
              <div>
                <MarketCard market="DOMESTIC" />
                <MarketCard market="US" />
                <MarketCard market="HK" />
                <MarketCard market="JP" />
                <MarketCard market="CN" />
              </div>
            </div>
          </div>
        )}

        {/* AI Decisions Tab */}
        {activeTab === 'decisions' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">AI Decision History</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticker</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {decisions.map((decision) => (
                    <tr key={decision.id}>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(decision.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{decision.ticker}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${decision.action === 'BUY' ? 'bg-green-100 text-green-800' : decision.action === 'SELL' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                          {decision.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{decision.quantity || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{decision.amount_krw ? `₩${decision.amount_krw.toLocaleString()}` : '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{(decision.confidence * 100).toFixed(0)}%</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{decision.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {decisions.length === 0 && <p className="text-center py-8 text-gray-500">No decisions yet</p>}
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">Order Execution History</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Market</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticker</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Direction</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Filled</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(order.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.runs?.market || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{order.ticker}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.direction === 'buy' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                          {order.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.requested_qty}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.filled_qty || 0}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.avg_filled_price ? `₩${order.avg_filled_price.toLocaleString()}` : '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.status === 'filled' ? 'bg-green-100 text-green-800' : order.status === 'failed' ? 'bg-red-100 text-red-800' : order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                          {order.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orders.length === 0 && <p className="text-center py-8 text-gray-500">No orders yet</p>}
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && overview && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">System Overview</h2>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-500">Latest Run</div>
                <div className="text-lg font-medium text-gray-900">{overview.latest_run?.status || 'No runs yet'}</div>
                {overview.latest_run && <div className="text-xs text-gray-400">{new Date(overview.latest_run.started_at).toLocaleString()}</div>}
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-sm text-gray-500">Today's Orders</div>
                  <div className="text-3xl font-bold text-gray-900">{overview.today_orders}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">30-Day Success Rate</div>
                  <div className="text-3xl font-bold text-green-600">{(overview.success_rate_30d * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
