import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stocksApi, watchlistApi } from '../api/client';
import { queryKeys } from './queryKeys';

export const watchlistQueries = {
  list: (market: string, enabled = true) => ({
    queryKey: queryKeys.watchlist(market),
    queryFn: () => watchlistApi.getByMarket(market),
    enabled,
  }),
  popular: (market: string, enabled = true) => ({
    queryKey: queryKeys.popularStocks(market),
    queryFn: () => stocksApi.getPopular(market, 30),
    enabled,
  }),
};

export const useWatchlistQuery = (market: string, enabled = true) => useQuery(watchlistQueries.list(market, enabled));
export const usePopularStocksQuery = (market: string, enabled = true) => useQuery(watchlistQueries.popular(market, enabled));

export const useAddWatchlistMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { market: string; ticker: string; name: string; notes?: string }) =>
      watchlistApi.add(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist(variables.market) });
    },
  });
};

export const useToggleWatchlistMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; enabled: boolean; market: string }) => watchlistApi.toggle(payload.id, payload.enabled),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist(variables.market) });
    },
  });
};

export const useDeleteWatchlistMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; market: string }) => watchlistApi.delete(payload.id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist(variables.market) });
    },
  });
};
