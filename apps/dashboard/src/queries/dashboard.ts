import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/client';
import { queryKeys } from './queryKeys';

export const dashboardQueries = {
  overview: () => ({
    queryKey: queryKeys.overview(),
    queryFn: dashboardApi.getOverview,
    staleTime: 30_000,
  }),
  decisions: (limit = 50, enabled = true) => ({
    queryKey: queryKeys.decisions(limit),
    queryFn: () => dashboardApi.getRecentDecisions(limit),
    enabled,
  }),
  orders: (limit = 100, enabled = true) => ({
    queryKey: queryKeys.orders(limit),
    queryFn: () => dashboardApi.getRecentOrders(limit),
    enabled,
  }),
};

export const useOverviewQuery = () => useQuery(dashboardQueries.overview());
export const useDecisionsQuery = (limit = 50, enabled = true) => useQuery(dashboardQueries.decisions(limit, enabled));
export const useOrdersQuery = (limit = 100, enabled = true) => useQuery(dashboardQueries.orders(limit, enabled));
