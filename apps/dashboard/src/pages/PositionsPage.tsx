import { useNavigate } from "react-router-dom";
import { useOverviewQuery } from "../queries/dashboard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { formatKRW } from "../lib/formatters";

export function PositionsPage() {
  const navigate = useNavigate();
  const overviewQuery = useOverviewQuery();

  if (overviewQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const positions = overviewQuery.data?.positions || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground lg:text-3xl">
          보유 종목
        </h2>
        <p className="text-sm text-muted-foreground">
          현재 보유 중인 종목과 수익률을 확인합니다
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">총 종목 수</div>
            <div className="terminal-number text-2xl font-bold text-foreground">
              {positions.length}
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">총 평가액</div>
            <div className="terminal-number text-2xl font-bold text-foreground">
              {formatKRW(
                positions.reduce((sum, p) => sum + p.market_value, 0),
                { compact: true }
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">총 평가손익</div>
            <div
              className={`terminal-number text-2xl font-bold ${
                positions.reduce((sum, p) => sum + p.unrealized_pnl, 0) >= 0
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {formatKRW(
                positions.reduce((sum, p) => sum + p.unrealized_pnl, 0),
                { compact: true }
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">평균 수익률</div>
            <div
              className={`terminal-number text-2xl font-bold ${
                positions.length > 0
                  ? positions.reduce(
                      (sum, p) => sum + p.unrealized_pnl_pct,
                      0
                    ) /
                      positions.length >=
                    0
                    ? "text-green-400"
                    : "text-red-400"
                  : "text-foreground"
              }`}
            >
              {positions.length > 0
                ? `${(
                    (positions.reduce(
                      (sum, p) => sum + p.unrealized_pnl_pct,
                      0
                    ) /
                      positions.length) *
                    100
                  ).toFixed(1)}%`
                : "0%"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Positions List */}
      <Card className="glass border-border/50">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-cyan-400"></div>
              <CardTitle className="text-lg">전체 보유 종목</CardTitle>
            </div>
            <span className="text-sm text-muted-foreground">
              {positions.length}개 종목
            </span>
          </div>
          <CardDescription>
            클릭하면 종목 상세 페이지로 이동합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {positions.length > 0 ? (
            <div className="space-y-3">
              {positions.map((position) => (
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
                      className={`text-lg font-bold ${
                        position.unrealized_pnl_pct >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {position.unrealized_pnl_pct >= 0 ? "+" : ""}
                      {(position.unrealized_pnl_pct * 100).toFixed(2)}%
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
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg
                className="mb-4 h-16 w-16 text-muted-foreground/30"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="text-muted-foreground">보유 종목이 없습니다</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                배치 실행 후 매수 주문이 체결되면 여기에 표시됩니다
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
