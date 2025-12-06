import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Market, MarketBatchSettings, MarketRiskSettings } from '@auto-finance/shared';
import {
  marketSettingsApi,
  batchApi,
  dashboardApi,
  watchlistApi,
  stocksApi,
  type DashboardOverview,
  type Order,
  type DecisionResponse,
  type WatchlistItem,
  type StockSearchResult,
} from './api/client';
import { MARKET_INFO } from './shared/lib/constants';

// ... (MarketCard component remains the same - keeping it for brevity)
function MarketCard({ market }: { market: Market }) {
  const [batchSettings, setBatchSettings] = useState<MarketBatchSettings | null>(null);
  const [riskSettings, setRiskSettings] = useState<MarketRiskSettings | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTimes, setEditedTimes] = useState('');
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [batchStatus, setBatchStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const info = MARKET_INFO[market];

  const loadSettings = useCallback(async () => {
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
  }, [market]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
    setIsRunningBatch(true);
    setBatchStatus(null);
    
    try {
      const result = await batchApi.runBatch(market);
      setBatchStatus({
        type: 'success',
        message: `✅ 배치 실행 성공! Run ID: ${result.run_id || 'N/A'}`
      });
      
      // Clear status after 5 seconds
      setTimeout(() => setBatchStatus(null), 5000);
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error 
        || (error as { message?: string })?.message 
        || '배치 실행 실패';
      setBatchStatus({
        type: 'error',
        message: `❌ ${errorMessage}`
      });
      
      // Clear error status after 10 seconds
      setTimeout(() => setBatchStatus(null), 10000);
    } finally {
      setIsRunningBatch(false);
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
        <button 
          onClick={handleRunBatch} 
          disabled={!batchSettings.enabled || isRunningBatch} 
          className={`px-4 py-2 rounded-md transition-all ${
            batchSettings.enabled && !isRunningBatch
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isRunningBatch ? '실행 중...' : 'Run Batch Now'}
        </button>
        
        {batchStatus && (
          <div className={`mt-3 px-4 py-2 rounded-md text-sm ${
            batchStatus.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {batchStatus.message}
          </div>
        )}
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [popularStocks, setPopularStocks] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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

  const loadPopularStocks = async () => {
    try {
      const data = await stocksApi.getPopular(selectedMarket, 30);
      setPopularStocks(data);
    } catch (error) {
      console.error('Failed to load popular stocks:', error);
    }
  };

  const handleSearchStocks = async (query: string) => {
    setSearchQuery(query);
    if (!query || query.length < 1) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await stocksApi.search(query, selectedMarket);
      setSearchResults(results);
    } catch (error) {
      console.error('Failed to search stocks:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectStock = (stock: StockSearchResult) => {
    setNewStock({
      ticker: stock.ticker,
      name: stock.name,
      notes: ''
    });
    setSearchQuery('');
    setSearchResults([]);
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
      setSearchQuery('');
      setSearchResults([]);
      setShowAddModal(false);
      loadWatchlist();
    } catch (error) {
      console.error('Failed to add stock:', error);
      alert('Failed to add stock. Please try again.');
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
              {overview.account && (
                <>
                  <div className="text-center">
                    <div className="text-gray-500">총 자산</div>
                    <div className="text-2xl font-bold text-gray-900">
                      ₩{overview.account.total_equity.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500">투자 금액</div>
                    <div className="text-2xl font-bold text-blue-600">
                      ₩{overview.account.investment_amount.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500">수익률</div>
                    <div className={`text-2xl font-bold ${overview.account.return_rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {overview.account.return_rate >= 0 ? '+' : ''}{overview.account.return_rate.toFixed(2)}%
                    </div>
                  </div>
                </>
              )}
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
                <button
                  onClick={() => {
                    setShowAddModal(true);
                    loadPopularStocks();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4">Add Stock to Watchlist</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Market</label>
                  <select
                    value={selectedMarket}
                    onChange={(e) => {
                      setSelectedMarket(e.target.value);
                      setSearchQuery('');
                      setSearchResults([]);
                      loadPopularStocks();
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="DOMESTIC">🇰🇷 Korea</option>
                    <option value="US">🇺🇸 US</option>
                    <option value="HK">🇭🇰 HK</option>
                    <option value="JP">🇯🇵 JP</option>
                    <option value="CN">🇨🇳 CN</option>
                  </select>
                </div>

                {/* Stock Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search Stock</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchStocks(e.target.value)}
                      placeholder={
                        selectedMarket === 'DOMESTIC'
                          ? "Search by ticker or name (e.g., 005930, 삼성, Samsung)"
                          : selectedMarket === 'US'
                          ? "Search by ticker or name (e.g., AAPL, Apple, MSFT)"
                          : "Search by ticker or name"
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-2.5 text-gray-400">
                        Searching...
                      </div>
                    )}
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="mt-2 border border-gray-300 rounded-md max-h-60 overflow-y-auto">
                      {searchResults.map((stock) => (
                        <div
                          key={stock.ticker}
                          onClick={() => handleSelectStock(stock)}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                        >
                          <div className="font-medium">{stock.ticker} - {stock.name}</div>
                          {stock.nameEn && <div className="text-sm text-gray-500">{stock.nameEn}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Popular Stocks - shown when no search query */}
                  {!searchQuery && popularStocks.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-medium text-gray-500 mb-2">Popular Stocks (By Volume)</div>
                      <div className="border border-gray-300 rounded-md max-h-60 overflow-y-auto">
                        {popularStocks.slice(0, 10).map((stock) => (
                          <div
                            key={stock.ticker}
                            onClick={() => handleSelectStock(stock)}
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 flex justify-between items-center"
                          >
                            <div>
                              <div className="font-medium text-sm">{stock.ticker} - {stock.name}</div>
                            </div>
                            {stock.change_pct !== undefined && (
                              <span className={`text-xs ${stock.change_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected Stock Details */}
                {newStock.ticker && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="text-sm font-medium text-blue-900 mb-1">Selected Stock</div>
                    <div className="text-lg font-bold text-blue-900">{newStock.ticker} - {newStock.name}</div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ticker</label>
                  <input
                    type="text"
                    value={newStock.ticker}
                    onChange={(e) => setNewStock({ ...newStock, ticker: e.target.value })}
                    placeholder="e.g., 005930"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    readOnly={!!newStock.ticker}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={newStock.name}
                    onChange={(e) => setNewStock({ ...newStock, name: e.target.value })}
                    placeholder="e.g., Samsung Electronics"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={newStock.notes}
                    onChange={(e) => setNewStock({ ...newStock, notes: e.target.value })}
                    placeholder="e.g., Tech giant"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSearchQuery('');
                    setSearchResults([]);
                    setNewStock({ ticker: '', name: '', notes: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStock}
                  disabled={!newStock.ticker || !newStock.name}
                  className={`flex-1 px-4 py-2 rounded-md ${newStock.ticker && newStock.name ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                >
                  Add
                </button>
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
                    <tr 
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
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
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.status === 'filled' ? 'bg-green-100 text-green-800' : order.status === 'failed' ? 'bg-red-100 text-red-800' : order.status === 'pending' || order.status === 'requested' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
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

        {/* Order Detail Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedOrder(null)}>
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Ticker</label>
                      <p className="text-lg font-semibold text-gray-900">{selectedOrder.ticker}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Direction</label>
                      <p>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedOrder.direction === 'buy' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                          {selectedOrder.direction.toUpperCase()}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <p>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedOrder.status === 'filled' ? 'bg-green-100 text-green-800' : selectedOrder.status === 'failed' ? 'bg-red-100 text-red-800' : selectedOrder.status === 'pending' || selectedOrder.status === 'requested' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                          {selectedOrder.status.toUpperCase()}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Market</label>
                      <p className="text-gray-900">{selectedOrder.runs?.market || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Quantity & Price */}
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Requested Quantity</label>
                        <p className="text-lg text-gray-900">{selectedOrder.requested_qty.toLocaleString()} shares</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Filled Quantity</label>
                        <p className="text-lg text-gray-900">{selectedOrder.filled_qty?.toLocaleString() || 0} shares</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Average Filled Price</label>
                        <p className="text-lg text-gray-900">
                          {selectedOrder.avg_filled_price ? `₩${selectedOrder.avg_filled_price.toLocaleString()}` : '-'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Total Amount</label>
                        <p className="text-lg font-semibold text-gray-900">
                          {selectedOrder.filled_qty && selectedOrder.avg_filled_price 
                            ? `₩${(selectedOrder.filled_qty * selectedOrder.avg_filled_price).toLocaleString()}`
                            : '-'}
                        </p>
                      </div>
                      {selectedOrder.requested_price && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Requested Price</label>
                          <p className="text-lg text-gray-900">₩{selectedOrder.requested_price.toLocaleString()}</p>
                        </div>
                      )}
                      {selectedOrder.order_type && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Order Type</label>
                          <p className="text-lg text-gray-900">{selectedOrder.order_type}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Broker Info */}
                  {selectedOrder.broker_order_id && (
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Broker Information</h3>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Broker Order ID</label>
                        <p className="text-sm font-mono text-gray-900 bg-gray-50 p-2 rounded">{selectedOrder.broker_order_id}</p>
                      </div>
                    </div>
                  )}

                  {/* Error Info */}
                  {(selectedOrder.error_code || selectedOrder.error_message) && (
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-semibold text-red-600 mb-3">Error Information</h3>
                      {selectedOrder.error_code && (
                        <div className="mb-2">
                          <label className="text-sm font-medium text-gray-500">Error Code</label>
                          <p className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded">{selectedOrder.error_code}</p>
                        </div>
                      )}
                      {selectedOrder.error_message && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Error Message</label>
                          <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{selectedOrder.error_message}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Timestamps</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Created At</label>
                        <p className="text-sm text-gray-900">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                      </div>
                      {selectedOrder.updated_at && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Updated At</label>
                          <p className="text-sm text-gray-900">{new Date(selectedOrder.updated_at).toLocaleString()}</p>
                        </div>
                      )}
                      {selectedOrder.runs?.started_at && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Run Started At</label>
                          <p className="text-sm text-gray-900">{new Date(selectedOrder.runs.started_at).toLocaleString()}</p>
                        </div>
                      )}
                      {selectedOrder.runs?.status && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Run Status</label>
                          <p className="text-sm text-gray-900">{selectedOrder.runs.status}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && overview && (
          <div className="space-y-6">
            {/* Account Information */}
            {overview.account && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold mb-6">계좌 정보</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">총 자산</div>
                    <div className="text-2xl font-bold text-blue-600">
                      ₩{overview.account.total_equity.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">투자 금액</div>
                    <div className="text-2xl font-bold text-green-600">
                      ₩{overview.account.investment_amount.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">현금</div>
                    <div className="text-2xl font-bold text-gray-700">
                      ₩{overview.account.cash.toLocaleString()}
                    </div>
                  </div>
                  <div className={`rounded-lg p-4 ${overview.account.return_rate >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="text-sm text-gray-600 mb-1">수익률</div>
                    <div className={`text-2xl font-bold ${overview.account.return_rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {overview.account.return_rate >= 0 ? '+' : ''}{overview.account.return_rate.toFixed(2)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {overview.account.total_return >= 0 ? '+' : ''}₩{overview.account.total_return.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PnL Trend Chart */}
            {overview.pnl_trend && overview.pnl_trend.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold mb-6">수익률 추이 (최근 30일)</h2>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={overview.pnl_trend.map(item => ({
                    date: new Date(item.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
                    equity: item.total_equity,
                    return: item.total_pnl || 0,
                    returnRate: overview.account?.initial_equity 
                      ? ((item.total_equity - overview.account.initial_equity) / overview.account.initial_equity) * 100 
                      : 0,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" orientation="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value: unknown, name: string) => {
                        if (name === 'equity') return `₩${Number(value).toLocaleString()}`;
                        if (name === 'return') return `₩${Number(value).toLocaleString()}`;
                        if (name === 'returnRate') return `${Number(value).toFixed(2)}%`;
                        return String(value);
                      }}
                    />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="equity" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="총 자산"
                      dot={{ r: 3 }}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="returnRate" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="수익률 (%)"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* System Stats */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold mb-4">시스템 통계</h2>
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
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
