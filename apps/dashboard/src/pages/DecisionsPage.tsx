import { useState } from 'react';
import type { DecisionResponse } from '../api/client';
import { DecisionDetailModal } from '../components/DecisionDetailModal';

type Props = {
  decisions: DecisionResponse[];
};

export function DecisionsPage({ decisions }: Props) {
  const [selectedDecision, setSelectedDecision] = useState<DecisionResponse | null>(null);

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold mb-4">AI Decision History</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticker</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {decisions.map((decision) => (
                <tr
                  key={decision.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedDecision(decision)}
                >
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(decision.created_at).toLocaleString()}</td>
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
                  <td className="px-4 py-3 text-sm text-gray-900">{decision.quantity || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {decision.amount_krw ? `₩${decision.amount_krw.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{(decision.confidence * 100).toFixed(0)}%</td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{decision.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {decisions.length === 0 && <p className="text-center py-8 text-gray-500">No decisions yet</p>}
        </div>
      </div>

      <DecisionDetailModal decision={selectedDecision} onClose={() => setSelectedDecision(null)} />
    </>
  );
}
