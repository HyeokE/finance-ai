import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { batchApi, marketSettingsApi } from '../api/client';
import { queryKeys } from './queryKeys';

export const marketQueries = {
  batchSettings: (market: string) => ({
    queryKey: queryKeys.marketBatchSettings(market),
    queryFn: () => marketSettingsApi.getBatchSettings(market),
  }),
  riskSettings: (market: string) => ({
    queryKey: queryKeys.marketRiskSettings(market),
    queryFn: () => marketSettingsApi.getRiskSettings(market),
  }),
  marketStatus: () => ({
    queryKey: ['market-status'],
    queryFn: () => batchApi.getMarketStatus(),
    refetchInterval: 60000, // Refetch every minute
  }),
};

export const useMarketBatchSettingsQuery = (market: string) => useQuery(marketQueries.batchSettings(market));
export const useMarketRiskSettingsQuery = (market: string) => useQuery(marketQueries.riskSettings(market));
export const useMarketStatusQuery = () => useQuery(marketQueries.marketStatus());

export const useUpdateMarketBatchMutation = (market: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Awaited<ReturnType<typeof marketSettingsApi.getBatchSettings>>>) =>
      marketSettingsApi.updateBatchSettings(market, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketBatchSettings(market) });
    },
  });
};

export const useUpdateMarketRiskMutation = (market: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Awaited<ReturnType<typeof marketSettingsApi.getRiskSettings>>>) =>
      marketSettingsApi.updateRiskSettings(market, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketRiskSettings(market) });
    },
  });
};

export const useRunBatchMutation = (market: string) =>
  useMutation({
    mutationFn: () => batchApi.runBatch(market),
  });
