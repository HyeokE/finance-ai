import type { DecisionResponse } from '../api/client';
import type { OrderWithMeta } from '../types';

export type BatchResult = {
  runId: string;
  market: string;
  status: string;
  decisions: DecisionResponse[];
  orders: OrderWithMeta[];
};

type Props = {
  result: BatchResult | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

export function BatchResultModal({ result, loading, error, onClose }: Props) {
  if (!result) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">배치 실행 결과</h2>
              <p className="text-gray-500 text-sm">
                Run ID: <span className="font-mono">{result.runId}</span> / Market: {result.market}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          {loading && (
            <div className="mb-4 rounded-md bg-blue-50 border border-blue-100 text-blue-700 px-4 py-3 text-sm">
              AI 의사결정과 체결 내역을 불러오는 중입니다...
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI 의사결정 결과</h3>
              {result.decisions.length === 0 ? (
                <p className="text-sm text-gray-500">결정 내역이 없습니다.</p>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">티커</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">액션</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">매수금액</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">신뢰도</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">사유</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {result.decisions.map((decision) => (
                        <tr key={decision.id}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{decision.ticker}</td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                decision.action === 'BUY'
                                  ? 'bg-green-100 text-green-800'
                                  : decision.action === 'SELL'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {decision.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {decision.amount_krw ? `₩${decision.amount_krw.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {decision.quantity ? decision.quantity.toLocaleString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{(decision.confidence * 100).toFixed(0)}%</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{decision.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">실제 주문/체결 내역</h3>
              {result.orders.length === 0 ? (
                <p className="text-sm text-gray-500">주문 내역이 없습니다.</p>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">티커</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">방향</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">요청 수량</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">체결 수량</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">평균 체결가</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {result.orders.map((order) => (
                        <tr key={order.id}>
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
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
