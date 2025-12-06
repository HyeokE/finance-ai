import type { OrderWithMeta } from '../types';

type Props = {
  order: OrderWithMeta | null;
  onClose: () => void;
};

export function OrderDetailModal({ order, onClose }: Props) {
  if (!order) return null;

  const formatNumber = (value?: number | null) => (typeof value === 'number' ? value.toLocaleString() : '-');
  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Ticker</label>
                <p className="text-lg font-semibold text-gray-900">{order.ticker}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Direction</label>
                <p>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      order.direction === 'buy' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {order.direction.toUpperCase()}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <p>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
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
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Market</label>
                <p className="text-gray-900">{order.runs?.market || 'N/A'}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Requested Quantity</label>
                  <p className="text-lg text-gray-900">{formatNumber(order.requested_qty)} shares</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Filled Quantity</label>
                  <p className="text-lg text-gray-900">{formatNumber(order.filled_qty || 0)} shares</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Average Filled Price</label>
                  <p className="text-lg text-gray-900">
                    {typeof order.avg_filled_price === 'number' ? `₩${formatNumber(order.avg_filled_price)}` : '-'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Amount</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {order.filled_qty && order.avg_filled_price ? `₩${formatNumber(order.filled_qty * order.avg_filled_price)}` : '-'}
                  </p>
                </div>
                {typeof order.requested_price === 'number' && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Requested Price</label>
                    <p className="text-lg text-gray-900">₩{formatNumber(order.requested_price)}</p>
                  </div>
                )}
                {order.order_type && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Order Type</label>
                    <p className="text-lg text-gray-900">{order.order_type}</p>
                  </div>
                )}
              </div>
            </div>

            {order.broker_order_id && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Broker Information</h3>
                <div>
                  <label className="text-sm font-medium text-gray-500">Broker Order ID</label>
                  <p className="text-sm font-mono text-gray-900 bg-gray-50 p-2 rounded">{order.broker_order_id}</p>
                </div>
              </div>
            )}

            {(order.error_code || order.error_message) && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-red-600 mb-3">Error Information</h3>
                {order.error_code && (
                  <div className="mb-2">
                    <label className="text-sm font-medium text-gray-500">Error Code</label>
                    <p className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded">{order.error_code}</p>
                  </div>
                )}
                {order.error_message && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Error Message</label>
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{order.error_message}</p>
                  </div>
                )}
              </div>
            )}

            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Timestamps</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Created At</label>
                  <p className="text-sm text-gray-900">{formatDate(order.created_at)}</p>
                </div>
                {order.updated_at && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Updated At</label>
                    <p className="text-sm text-gray-900">{formatDate(order.updated_at)}</p>
                  </div>
                )}
                {order.runs?.started_at && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Run Started At</label>
                    <p className="text-sm text-gray-900">{formatDate(order.runs.started_at)}</p>
                  </div>
                )}
                {order.runs?.status && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Run Status</label>
                    <p className="text-sm text-gray-900">{order.runs.status}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
