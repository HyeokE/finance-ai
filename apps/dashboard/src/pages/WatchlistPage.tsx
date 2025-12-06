import { useEffect, useState } from 'react';
import { MARKET_INFO } from '../shared/lib/constants';
import { watchlistApi, stocksApi, type WatchlistItem, type StockSearchResult } from '../api/client';

type Props = {
  isActive: boolean;
};

export function WatchlistPage({ isActive }: Props) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<string>('DOMESTIC');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStock, setNewStock] = useState({ ticker: '', name: '', notes: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [popularStocks, setPopularStocks] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (isActive) {
      loadWatchlist();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, selectedMarket]);

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
      notes: '',
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
                  <div className="font-medium">
                    {item.name} ({item.ticker})
                  </div>
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
        {watchlist.length === 0 && <p className="text-center py-8 text-gray-500">No stocks in watchlist. AI will analyze all available stocks.</p>}
      </div>

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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Stock</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchStocks(e.target.value)}
                    placeholder={
                      selectedMarket === 'DOMESTIC'
                        ? 'Search by ticker or name (e.g., 005930, 삼성, Samsung)'
                        : selectedMarket === 'US'
                        ? 'Search by ticker or name (e.g., AAPL, Apple, MSFT)'
                        : 'Search by ticker or name'
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {isSearching && <div className="absolute right-3 top-2.5 text-gray-400">Searching...</div>}
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-2 border border-gray-300 rounded-md max-h-60 overflow-y-auto">
                    {searchResults.map((stock) => (
                      <div
                        key={stock.ticker}
                        onClick={() => handleSelectStock(stock)}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                      >
                        <div className="font-medium">
                          {stock.ticker} - {stock.name}
                        </div>
                        {stock.nameEn && <div className="text-sm text-gray-500">{stock.nameEn}</div>}
                      </div>
                    ))}
                  </div>
                )}

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
                            <div className="font-medium text-sm">
                              {stock.ticker} - {stock.name}
                            </div>
                          </div>
                          {stock.change_pct !== undefined && (
                            <span className={`text-xs ${stock.change_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {stock.change_pct >= 0 ? '+' : ''}
                              {stock.change_pct.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {newStock.ticker && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <div className="text-sm font-medium text-blue-900 mb-1">Selected Stock</div>
                  <div className="text-lg font-bold text-blue-900">
                    {newStock.ticker} - {newStock.name}
                  </div>
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
                className={`flex-1 px-4 py-2 rounded-md ${
                  newStock.ticker && newStock.name ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
