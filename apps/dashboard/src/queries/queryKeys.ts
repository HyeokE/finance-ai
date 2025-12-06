export const queryKeys = {
  overview: () => ['overview'] as const,
  decisions: (limit: number) => ['decisions', limit] as const,
  orders: (limit: number) => ['orders', limit] as const,
  watchlist: (market: string) => ['watchlist', market] as const,
  popularStocks: (market: string) => ['popular-stocks', market] as const,
  marketBatchSettings: (market: string) => ['market-batch-settings', market] as const,
  marketRiskSettings: (market: string) => ['market-risk-settings', market] as const,
  batchStatus: (runId: string) => ['batch-status', runId] as const,
};
