import type { DecisionResponse } from '../api/client';

type Props = {
  decision: DecisionResponse | null;
  onClose: () => void;
};

export function DecisionDetailModal({ decision, onClose }: Props) {
  if (!decision) return null;

  const formatNumber = (value?: number | null) => (typeof value === 'number' ? value.toLocaleString() : '-');
  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">AI 의사결정 상세</h2>
              <p className="text-gray-500 text-sm">
                결정 ID: <span className="font-mono">{decision.id}</span>
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">티커</label>
                <p className="text-lg font-semibold text-gray-900">{decision.ticker}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">액션</label>
                <p>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      decision.action === 'BUY'
                        ? 'bg-green-100 text-green-800'
                        : decision.action === 'SELL'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {decision.action}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">매수 금액 (KRW)</label>
                <p className="text-lg text-gray-900">{decision.amount_krw ? `₩${formatNumber(decision.amount_krw)}` : '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">수량</label>
                <p className="text-lg text-gray-900">{formatNumber(decision.quantity || 0)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">신뢰도</label>
                <p className="text-lg text-gray-900">{(decision.confidence * 100).toFixed(1)}%</p>
              </div>
              {decision.runs?.started_at && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Run Started At</label>
                  <p className="text-sm text-gray-900">{formatDate(decision.runs.started_at)}</p>
                </div>
              )}
              {decision.runs?.status && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Run Status</label>
                  <p className="text-sm text-gray-900">{decision.runs.status}</p>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Reason</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{decision.reason}</p>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Timestamp</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Created At</label>
                  <p className="text-sm text-gray-900">{formatDate(decision.created_at)}</p>
                </div>
              </div>
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
