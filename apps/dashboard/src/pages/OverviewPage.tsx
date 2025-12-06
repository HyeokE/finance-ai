import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DashboardOverview } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

type Props = {
  overview: DashboardOverview;
};

export function OverviewPage({ overview }: Props) {
  const pnlData =
    overview.pnl_trend?.map((item) => ({
      date: new Date(item.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
      equity: item.total_equity,
      return: item.total_pnl || 0,
      returnRate: overview.account?.initial_equity
        ? ((item.total_equity - overview.account.initial_equity) / overview.account.initial_equity) * 100
        : 0,
    })) || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground lg:text-3xl">포트폴리오 개요</h2>
        <p className="text-sm text-muted-foreground">실시간 자산 현황과 수익률 추이를 확인하세요</p>
      </div>

      {/* Account Stats Grid */}
      {overview.account && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="총 자산"
            value={`₩${overview.account.total_equity.toLocaleString()}`}
            className="glow-cyan"
          />
          <StatCard
            label="투자 금액"
            value={`₩${overview.account.investment_amount.toLocaleString()}`}
            className="border-primary/20"
          />
          <StatCard
            label="보유 현금"
            value={`₩${overview.account.cash.toLocaleString()}`}
            className="border-muted-foreground/20"
          />
          <StatCard
            label="수익률"
            value={`${overview.account.return_rate >= 0 ? '+' : ''}${overview.account.return_rate.toFixed(2)}%`}
            subValue={`${overview.account.total_return >= 0 ? '+' : ''}₩${overview.account.total_return.toLocaleString()}`}
            valueClass={overview.account.return_rate >= 0 ? 'text-green-400' : 'text-red-400'}
            className={overview.account.return_rate >= 0 ? 'glow-success' : 'glow-destructive'}
          />
        </div>
      )}

      {/* Performance Chart */}
      {pnlData.length > 0 && (
        <Card className="glass border-border/50 transition-glow hover:border-primary/30">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
              <CardTitle className="text-lg">수익률 추이 (최근 30일)</CardTitle>
            </div>
            <CardDescription>총 자산과 수익률 변화를 실시간으로 추적합니다</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[320px] lg:h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pnlData}>
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    stroke="hsl(var(--border))"
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    stroke="hsl(var(--border))"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    stroke="hsl(var(--border))"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      padding: '12px'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: unknown, name: string) => {
                      if (name === 'equity') return [`₩${Number(value).toLocaleString()}`, '총 자산'];
                      if (name === 'return') return [`₩${Number(value).toLocaleString()}`, '수익'];
                      if (name === 'returnRate') return [`${Number(value).toFixed(2)}%`, '수익률'];
                      return String(value);
                    }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="equity"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    name="equity"
                    dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="returnRate"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    name="returnRate"
                    dot={{ r: 3, fill: 'hsl(var(--success))' }}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Statistics */}
      <Card className="glass border-border/50">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-lg">시스템 통계</CardTitle>
          <CardDescription>배치 실행 현황과 성공률을 모니터링합니다</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SystemStat
              label="최근 실행"
              value={overview.latest_run?.status || '없음'}
              subValue={overview.latest_run ? new Date(overview.latest_run.started_at).toLocaleString('ko-KR') : undefined}
            />
            <SystemStat
              label="오늘 주문"
              value={overview.today_orders}
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
            />
            <SystemStat
              label="30일 성공률"
              value={`${(overview.success_rate_30d * 100).toFixed(1)}%`}
              valueClass="text-green-400"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  subValue?: string;
  valueClass?: string;
  className?: string;
};

function StatCard({ label, value, subValue, valueClass, className }: StatCardProps) {
  return (
    <Card className={`glass border-border/50 transition-glow hover:border-primary/30 ${className || ''}`}>
      <CardContent className="p-6">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className={`terminal-number text-2xl font-bold lg:text-3xl ${valueClass || 'text-foreground'}`}>
            {value}
          </p>
          {subValue && (
            <p className="text-sm text-muted-foreground terminal-number">{subValue}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type SystemStatProps = {
  label: string;
  value: string | number;
  subValue?: string;
  valueClass?: string;
  icon?: React.ReactNode;
};

function SystemStat({ label, value, subValue, valueClass, icon }: SystemStatProps) {
  return (
    <div className="flex items-start gap-4 rounded-lg border border-border/50 bg-secondary/30 p-4 transition-colors hover:bg-secondary/50">
      {icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      )}
      <div className="flex-1 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold ${valueClass || 'text-foreground'}`}>{value}</p>
        {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
      </div>
    </div>
  );
}
