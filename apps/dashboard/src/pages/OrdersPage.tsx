import { useState } from 'react';
import { OrderDetailModal } from '../components/OrderDetailModal';
import type { OrderWithMeta } from '../types';

type Props = {
  orders: OrderWithMeta[];
};

export function OrdersPage({ orders }: Props) {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithMeta | null>(null);

  return (
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
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      order.direction === 'buy' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {order.direction.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{order.requested_qty}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{order.filled_qty || 0}</td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {order.avg_filled_price ? `₩${order.avg_filled_price.toLocaleString()}` : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      order.status === 'filled'
                        ? 'bg-green-100 text-green-800'
                        : order.status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : order.status === 'pending' || order.status === 'requested'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {order.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="text-center py-8 text-gray-500">No orders yet</p>}
      </div>

      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  );
}
