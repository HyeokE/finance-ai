import { useEffect, useState } from 'react';
import { MARKET_INFO } from '../shared/lib/constants';
import { stocksApi, type StockSearchResult } from '../api/client';
import {
  useAddWatchlistMutation,
  useDeleteWatchlistMutation,
  usePopularStocksQuery,
  useToggleWatchlistMutation,
  useWatchlistQuery,
} from '../queries/watchlist';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';

type Props = {
  isActive: boolean;
};

export function WatchlistPage({ isActive }: Props) {
  const [selectedMarket, setSelectedMarket] = useState<string>('DOMESTIC');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStock, setNewStock] = useState({ ticker: '', name: '', notes: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const watchlistQuery = useWatchlistQuery(selectedMarket, isActive);
  const popularStocksQuery = usePopularStocksQuery(selectedMarket, showAddModal && !searchQuery);

  const addMutation = useAddWatchlistMutation();
  const toggleMutation = useToggleWatchlistMutation();
  const deleteMutation = useDeleteWatchlistMutation();

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

  const handleAddStock = () => {
    addMutation.mutate(
      {
        market: selectedMarket,
        ticker: newStock.ticker,
        name: newStock.name,
        notes: newStock.notes,
      },
      {
        onSuccess: () => {
          setNewStock({ ticker: '', name: '', notes: '' });
          setSearchQuery('');
          setSearchResults([]);
          setShowAddModal(false);
        },
        onError: (error: unknown) => {
          console.error('Failed to add stock:', error);
          alert('Failed to add stock. Please try again.');
        },
      }
    );
  };

  const handleToggleStock = (id: string, enabled: boolean) => {
    toggleMutation.mutate({
      id,
      enabled: !enabled,
      market: selectedMarket,
    });
  };

  const handleDeleteStock = (id: string) => {
    if (!confirm('Delete this stock from watchlist?')) return;
    deleteMutation.mutate({
      id,
      market: selectedMarket,
    });
  };

  useEffect(() => {
    setSearchQuery('');
    setSearchResults([]);
    setNewStock({ ticker: '', name: '', notes: '' });
  }, [selectedMarket]);

  const watchlist = watchlistQuery.data || [];
  const popularStocks = popularStocksQuery.data || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground lg:text-3xl">관심종목 관리</h2>
          <p className="text-sm text-muted-foreground">시장별 관심종목을 추가하고 관리합니다</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={selectedMarket} onChange={(e) => setSelectedMarket(e.target.value)} className="sm:w-44 bg-secondary/50 border-border/50">
            <option value="DOMESTIC">🇰🇷 Korea</option>
            <option value="US">🇺🇸 US</option>
            <option value="HK">🇭🇰 HK</option>
            <option value="JP">🇯🇵 JP</option>
            <option value="CN">🇨🇳 CN</option>
          </Select>
          <Button
            onClick={() => {
              setShowAddModal(true);
              popularStocksQuery.refetch();
            }}
            size="md"
            className="whitespace-nowrap"
          >
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            종목 추가
          </Button>
        </div>
      </div>

      {/* Watchlist Content */}
      <Card className="glass border-border/50">
        <CardContent className="p-4 sm:p-6">
          {watchlistQuery.isLoading && isActive && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                <p className="text-sm text-muted-foreground">워치리스트를 불러오는 중...</p>
              </div>
            </div>
          )}
          {watchlistQuery.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
              <p className="text-sm text-destructive">워치리스트를 불러오지 못했습니다.</p>
            </div>
          )}

          {!watchlistQuery.isLoading && !watchlistQuery.isError && (
            <>
              {watchlist.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <svg className="h-16 w-16 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                  <p className="mt-4 text-center text-muted-foreground">관심종목이 없습니다</p>
                  <p className="mt-1 text-center text-sm text-muted-foreground/70">종목을 추가하여 시작하세요</p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {watchlist.map((item, index) => (
                  <div
                    key={item.id}
                    className="glass animate-slide-up flex items-center justify-between rounded-lg border border-border/50 p-4 transition-all hover:border-primary/30 hover:bg-secondary/30"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-2xl ring-1 ring-primary/20">
                        {MARKET_INFO[item.market as keyof typeof MARKET_INFO]?.flag}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">
                          {item.name} <span className="text-sm text-muted-foreground">({item.ticker})</span>
                        </div>
                        {item.notes && <div className="text-xs text-muted-foreground">{item.notes}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={item.enabled ? 'success' : 'secondary'} className="min-w-[50px] justify-center">
                        {item.enabled ? '활성' : '비활성'}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => handleToggleStock(item.id, item.enabled)}>
                        {item.enabled ? '끄기' : '켜기'}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteStock(item.id)}>
                        삭제
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="glass border-border/50">
          <DialogHeader className="border-b border-border/50 p-6 pb-4">
            <DialogTitle className="text-xl font-bold text-foreground">관심종목 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-6">
            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-foreground">시장</Label>
              <Select
                value={selectedMarket}
                onChange={(e) => {
                  setSelectedMarket(e.target.value);
                  setSearchQuery('');
                  setSearchResults([]);
                  popularStocksQuery.refetch();
                }}
                className="bg-secondary/50 border-border/50"
              >
                <option value="DOMESTIC">🇰🇷 Korea</option>
                <option value="US">🇺🇸 US</option>
                <option value="HK">🇭🇰 HK</option>
                <option value="JP">🇯🇵 JP</option>
                <option value="CN">🇨🇳 CN</option>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-foreground">종목 검색</Label>
              <div className="relative">
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearchStocks(e.target.value)}
                  placeholder={
                    selectedMarket === 'DOMESTIC'
                      ? '005930, 삼성, Samsung 등으로 검색'
                      : selectedMarket === 'US'
                      ? 'AAPL, Apple, MSFT 등으로 검색'
                      : '티커/이름 검색'
                  }
                  className="bg-secondary/50 border-border/50"
                />
                {isSearching && (
                  <div className="absolute right-3 top-2.5 flex items-center gap-1.5">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <span className="text-xs text-muted-foreground">검색 중...</span>
                  </div>
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border/50 bg-secondary/30">
                  {searchResults.map((stock) => (
                    <button
                      key={stock.ticker}
                      onClick={() => handleSelectStock(stock)}
                      className="flex w-full items-start justify-between border-b border-border/50 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-primary/10"
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {stock.ticker} - {stock.name}
                        </div>
                        {stock.nameEn && <div className="text-xs text-muted-foreground">{stock.nameEn}</div>}
                      </div>
                      {stock.change_pct !== undefined && (
                        <span className={`terminal-number text-xs font-semibold ${stock.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {stock.change_pct >= 0 ? '+' : ''}
                          {stock.change_pct.toFixed(2)}%
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {!searchQuery && popularStocks.length > 0 && (
                <div className="mt-2">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">인기 종목 (거래량 기준)</div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {popularStocks.slice(0, 6).map((stock) => (
                      <Button
                        key={stock.ticker}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSelectStock(stock)}
                        className="text-xs"
                      >
                        {stock.ticker}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {newStock.ticker && (
              <div className="animate-scale-in rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-sm">
                <span className="text-muted-foreground">선택됨:</span>{' '}
                <span className="font-semibold text-primary">
                  {newStock.ticker} - {newStock.name}
                </span>
              </div>
            )}

            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-foreground">티커</Label>
              <Input
                value={newStock.ticker}
                onChange={(e) => setNewStock({ ...newStock, ticker: e.target.value })}
                placeholder="예) 005930"
                className="bg-secondary/50 border-border/50"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-foreground">이름</Label>
              <Input
                value={newStock.name}
                onChange={(e) => setNewStock({ ...newStock, name: e.target.value })}
                placeholder="예) 삼성전자"
                className="bg-secondary/50 border-border/50"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-foreground">메모 (선택)</Label>
              <Input
                value={newStock.notes}
                onChange={(e) => setNewStock({ ...newStock, notes: e.target.value })}
                placeholder="예) 장기 보유"
                className="bg-secondary/50 border-border/50"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="w-1/2"
                onClick={() => {
                  setShowAddModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                  setNewStock({ ticker: '', name: '', notes: '' });
                }}
              >
                취소
              </Button>
              <Button
                className="w-1/2"
                onClick={handleAddStock}
                disabled={!newStock.ticker || !newStock.name || addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    추가 중...
                  </span>
                ) : (
                  '추가'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
