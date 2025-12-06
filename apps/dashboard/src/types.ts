import type { Order } from './api/client';

export type OrderWithMeta = Order & {
  requested_price?: number;
  order_type?: string;
  runs?: {
    market?: string;
    started_at?: string;
    status?: string;
  };
  updated_at?: string;
};
