import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DashboardOverview } from '../api/client';

type Props = {
  overview: DashboardOverview;
};

export function OverviewPage({ overview }: Props) {
  return (
    <div className="space-y-6">
      {overview.account && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold mb-6">계좌 정보</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">총 자산</div>
              <div className="text-2xl font-bold text-blue-600">₩{overview.account.total_equity.toLocaleString()}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">투자 금액</div>
              <div className="text-2xl font-bold text-green-600">₩{overview.account.investment_amount.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">현금</div>
              <div className="text-2xl font-bold text-gray-700">₩{overview.account.cash.toLocaleString()}</div>
            </div>
            <div className={`rounded-lg p-4 ${overview.account.return_rate >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="text-sm text-gray-600 mb-1">수익률</div>
              <div className={`text-2xl font-bold ${overview.account.return_rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {overview.account.return_rate >= 0 ? '+' : ''}
                {overview.account.return_rate.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {overview.account.total_return >= 0 ? '+' : ''}₩{overview.account.total_return.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {overview.pnl_trend && overview.pnl_trend.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold mb-6">수익률 추이 (최근 30일)</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={overview.pnl_trend.map((item) => ({
                date: new Date(item.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
                equity: item.total_equity,
                return: item.total_pnl || 0,
                returnRate: overview.account?.initial_equity
                  ? ((item.total_equity - overview.account.initial_equity) / overview.account.initial_equity) * 100
                  : 0,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" orientation="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                formatter={(value: unknown, name: string) => {
                  if (name === 'equity') return `₩${Number(value).toLocaleString()}`;
                  if (name === 'return') return `₩${Number(value).toLocaleString()}`;
                  if (name === 'returnRate') return `${Number(value).toFixed(2)}%`;
                  return String(value);
                }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} name="총 자산" dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="returnRate" stroke="#10b981" strokeWidth={2} name="수익률 (%)" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold mb-4">시스템 통계</h2>
        <div className="space-y-4">
          <div>
            <div className="text-sm text-gray-500">Latest Run</div>
            <div className="text-lg font-medium text-gray-900">{overview.latest_run?.status || 'No runs yet'}</div>
            {overview.latest_run && <div className="text-xs text-gray-400">{new Date(overview.latest_run.started_at).toLocaleString()}</div>}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-gray-500">Today's Orders</div>
              <div className="text-3xl font-bold text-gray-900">{overview.today_orders}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">30-Day Success Rate</div>
              <div className="text-3xl font-bold text-green-600">{(overview.success_rate_30d * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
