import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DashboardOverview } from "../api/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { formatKRW, formatPercent } from "../lib/formatters";

type Props = {
  overview: DashboardOverview;
};

export function OverviewPage({ overview }: Props) {
  const navigate = useNavigate();
  // Calculate return rate based on first day's equity (not initial_equity)
  const firstEquity =
    overview.pnl_trend?.[0]?.total_equity ||
    overview.account?.initial_equity ||
    1;

  const pnlData =
    overview.pnl_trend?.map((item) => {
      const date = new Date(item.created_at);
      return {
        date: date.toLocaleDateString("ko-KR", {
          month: "short",
          day: "numeric",
        }),
        fullDate: date.toISOString().split("T")[0], // For tooltip
        equity: item.total_equity,
        return: item.total_pnl || 0,
        // Return rate from first day of the 30-day period
        returnRate: firstEquity
          ? ((item.total_equity - firstEquity) / firstEquity) * 100
          : 0,
      };
    }) || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground lg:text-3xl">
          포트폴리오 개요
        </h2>
        <p className="text-sm text-muted-foreground">
          실시간 자산 현황과 수익률 추이를 확인하세요
        </p>
      </div>

      {/* Account Stats Grid */}
      {overview.account && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="총 자산"
            value={formatKRW(overview.account.total_equity)}
            className="glow-cyan"
          />
          <StatCard
            label="투자 금액"
            value={formatKRW(overview.account.investment_amount)}
            className="border-primary/20"
          />
          <StatCard
            label="보유 현금"
            value={formatKRW(overview.account.cash)}
            className="border-muted-foreground/20"
          />
          <StatCard
            label="수익률"
            value={formatPercent(overview.account.return_rate)}
            subValue={formatKRW(overview.account.total_return)}
            valueClass={
              overview.account.return_rate >= 0
                ? "text-green-400"
                : "text-red-400"
            }
            className={
              overview.account.return_rate >= 0
                ? "glow-success"
                : "glow-destructive"
            }
          />
          <FearGreedCard index={overview.fear_greed_index ?? 50} />
        </div>
      )}

      {/* Performance Chart */}
      {pnlData.length > 0 && (
        <Card className="glass border-border/50 transition-glow hover:border-primary/30">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
              <CardTitle className="text-lg">
                자산 및 수익률 추이 (최근 30일)
              </CardTitle>
            </div>
            <CardDescription>
              포트폴리오 자산과 기간 대비 수익률 변화를 추적합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[320px] lg:h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pnlData}>
                  <defs>
                    <linearGradient
                      id="equityGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                    stroke="hsl(var(--border))"
                    interval="preserveStartEnd"
                    minTickGap={30}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                    stroke="hsl(var(--border))"
                    tickFormatter={(value) => {
                      if (value >= 1000000) {
                        return `${(value / 1000000).toFixed(0)}M`;
                      } else if (value >= 1000) {
                        return `${(value / 1000).toFixed(0)}K`;
                      }
                      return value.toString();
                    }}
                    label={{
                      value: "총 자산 (₩)",
                      angle: -90,
                      position: "insideLeft",
                      style: {
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                      },
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                    stroke="hsl(var(--border))"
                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                    label={{
                      value: "수익률 (%)",
                      angle: 90,
                      position: "insideRight",
                      style: {
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                      },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      padding: "12px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: unknown, name: string) => {
                      if (name === "equity")
                        return [formatKRW(Number(value)), "총 자산"];
                      if (name === "return")
                        return [formatKRW(Number(value)), "누적 수익"];
                      if (name === "returnRate")
                        return [
                          `${Number(value).toFixed(2)}%`,
                          "기간 대비 수익률",
                        ];
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
                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="returnRate"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    name="returnRate"
                    dot={{ r: 3, fill: "hsl(var(--success))" }}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Holdings Preview */}
      <Card className="glass border-border/50 transition-glow hover:border-primary/30">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-cyan-400"></div>
              <CardTitle className="text-lg">보유 종목</CardTitle>
            </div>
            <button
              onClick={() => navigate("/positions")}
              className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              전체 보기
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
          <CardDescription>
            {overview.positions?.length || 0}개 종목 보유 중
            {overview.positions &&
              overview.positions.length > 3 &&
              ` (${overview.positions.length - 3}개 더 있음)`}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {overview.positions && overview.positions.length > 0 ? (
            <div className="space-y-3">
              {overview.positions.slice(0, 3).map((position) => (
                <button
                  key={position.ticker}
                  onClick={() => navigate(`/stock/${position.ticker}`)}
                  className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-secondary/30 p-4 text-left transition-all hover:bg-secondary/50 hover:border-primary/30 cursor-pointer"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary">
                        {position.ticker}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {position.name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{position.quantity}주</span>
                      <span>
                        평균 {formatKRW(position.avg_price, { compact: true })}
                      </span>
                      <span>
                        현재{" "}
                        {formatKRW(position.current_price, { compact: true })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-mono font-bold ${
                        position.unrealized_pnl >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {formatPercent(position.unrealized_pnl_pct * 100)}
                    </p>
                    <p
                      className={`text-sm ${
                        position.unrealized_pnl >= 0
                          ? "text-green-400/70"
                          : "text-red-400/70"
                      }`}
                    >
                      {formatKRW(position.unrealized_pnl)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      비중 {(position.weight * 100).toFixed(1)}%
                    </p>
                  </div>
                </button>
              ))}
              {overview.positions.length > 3 && (
                <button
                  onClick={() => navigate("/positions")}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border/50 bg-secondary/20 p-3 text-sm text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
                >
                  <span>+{overview.positions.length - 3}개 종목 더 보기</span>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <svg
                className="h-12 w-12 text-muted-foreground/50 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <p className="text-muted-foreground">보유 종목이 없습니다</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                배치 실행 후 매수 주문이 체결되면 여기에 표시됩니다
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Statistics */}
      <Card className="glass border-border/50">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-lg">시스템 통계</CardTitle>
          <CardDescription>
            배치 실행 현황과 성공률을 모니터링합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SystemStat
              label="최근 실행"
              value={overview.latest_run?.status || "없음"}
              subValue={
                overview.latest_run
                  ? new Date(overview.latest_run.started_at).toLocaleString(
                      "ko-KR"
                    )
                  : undefined
              }
            />
            <SystemStat
              label="오늘 주문"
              value={overview.today_orders}
              icon={
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              }
            />
            <SystemStat
              label="30일 성공률"
              value={`${(overview.success_rate_30d * 100).toFixed(1)}%`}
              valueClass="text-green-400"
              icon={
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
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

function StatCard({
  label,
  value,
  subValue,
  valueClass,
  className,
}: StatCardProps) {
  return (
    <Card
      className={`glass border-border/50 transition-glow hover:border-primary/30 ${
        className || ""
      }`}
    >
      <CardContent className="p-6">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <p
            className={`terminal-number text-xl font-bold lg:text-2xl ${
              valueClass || "text-foreground"
            }`}
          >
            {value}
          </p>
          {subValue && (
            <p className="text-sm text-muted-foreground terminal-number">
              {subValue}
            </p>
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

function SystemStat({
  label,
  value,
  subValue,
  valueClass,
  icon,
}: SystemStatProps) {
  return (
    <div className="flex items-start gap-4 rounded-lg border border-border/50 bg-secondary/30 p-4 transition-colors hover:bg-secondary/50">
      {icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      )}
      <div className="flex-1 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold ${valueClass || "text-foreground"}`}>
          {value}
        </p>
        {subValue && (
          <p className="text-xs text-muted-foreground">{subValue}</p>
        )}
      </div>
    </div>
  );
}

type FearGreedCardProps = {
  index: number;
};

function FearGreedCard({ index }: FearGreedCardProps) {
  // Determine emotion and color based on index
  // 0-25: Extreme Fear (red)
  // 26-45: Fear (orange)
  // 46-54: Neutral (yellow)
  // 55-75: Greed (light green)
  // 76-100: Extreme Greed (green)

  // If index is undefined or null, show neutral (50)
  const safeIndex = index ?? 50;

  const getEmotion = (
    idx: number
  ): { label: string; color: string; bgColor: string } => {
    if (idx <= 25) {
      return {
        label: "극도의 공포",
        color: "text-red-400",
        bgColor: "bg-red-500/20 border-red-500/30",
      };
    } else if (idx <= 45) {
      return {
        label: "공포",
        color: "text-orange-400",
        bgColor: "bg-orange-500/20 border-orange-500/30",
      };
    } else if (idx <= 54) {
      return {
        label: "중립",
        color: "text-yellow-400",
        bgColor: "bg-yellow-500/20 border-yellow-500/30",
      };
    } else if (idx <= 75) {
      return {
        label: "탐욕",
        color: "text-green-400",
        bgColor: "bg-green-500/20 border-green-500/30",
      };
    } else {
      return {
        label: "극도의 탐욕",
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/20 border-emerald-500/30",
      };
    }
  };

  const emotion = getEmotion(safeIndex);
  const percentage = Math.round(safeIndex);

  // Show "데이터 없음" if index is not available
  const isDataAvailable = index !== undefined && index !== null;

  return (
    <Card
      className={`glass border-border/50 transition-glow hover:border-primary/30 ${emotion.bgColor}`}
    >
      <CardContent className="p-6">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            공포 탐욕 지수
          </p>
          <div className="flex items-baseline gap-2">
            <p
              className={`terminal-number text-2xl font-bold lg:text-3xl ${emotion.color}`}
            >
              {percentage}
            </p>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
          <p className={`text-sm font-semibold ${emotion.color}`}>
            {isDataAvailable ? emotion.label : "데이터 없음"}
          </p>
          {/* Progress bar */}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary/50">
            <div
              className={`h-full transition-all ${emotion.color.replace(
                "text-",
                "bg-"
              )}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
