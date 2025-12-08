import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { stocksApi, dashboardApi, type DecisionResponse } from "../api/client";
import type { OrderWithMeta } from "../types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceLine,
  Legend,
} from "recharts";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { formatKRW } from "../lib/formatters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

type ChartDataPoint = {
  date: string;
  price: number;
  volume: number;
  buyPrice?: number;
  sellPrice?: number;
};

export function StockDetailPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stockInfo, setStockInfo] = useState<{
    name?: string;
    price?: number;
    change_pct?: number;
  } | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [decisions, setDecisions] = useState<DecisionResponse[]>([]);
  const [orders, setOrders] = useState<OrderWithMeta[]>([]);
  const [avgPrice, setAvgPrice] = useState<number | null>(null);
  const [position, setPosition] = useState<{
    ticker: string;
    quantity: number;
    avg_price: number;
    unrealized_pnl: number;
    unrealized_pnl_pct: number;
  } | null>(null);

  useEffect(() => {
    const loadStockData = async () => {
      if (!ticker) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch stock info, history, decisions, orders, and overview in parallel
        const [info, history, decisionsData, ordersData, overview] =
          await Promise.all([
            stocksApi.getDetail(ticker, "DOMESTIC").catch(() => null),
            stocksApi.getHistory(ticker, "DOMESTIC", 60).catch(() => []),
            dashboardApi
              .getRecentDecisions(200)
              .then((data) =>
                (data as DecisionResponse[]).filter((d) => d.ticker === ticker)
              )
              .catch(() => []),
            dashboardApi
              .getRecentOrders(200)
              .then((data) =>
                (data as OrderWithMeta[]).filter((o) => o.ticker === ticker)
              )
              .catch(() => []),
            dashboardApi.getOverview().catch(() => null),
          ]);

        setStockInfo(info);
        setDecisions(decisionsData);
        setOrders(ordersData);

        // Find current position to get average price
        if (overview?.positions) {
          const currentPosition = overview.positions.find(
            (p) => p.ticker === ticker
          );
          if (currentPosition) {
            setAvgPrice(currentPosition.avg_price);
            setPosition(currentPosition);
          }
        }

        if (!history || history.length === 0) {
          setError("차트 데이터가 없습니다.");
          return;
        }

        // Reverse to get chronological order (oldest first)
        const reversed = [...history].reverse();

        // Create a map of dates to orders
        const orderMap = new Map<string, { buy?: number; sell?: number }>();

        ordersData.forEach((order) => {
          const orderDate = new Date(order.created_at)
            .toISOString()
            .split("T")[0];
          const price = order.avg_filled_price || order.requested_price || 0;

          if (price > 0) {
            const existing = orderMap.get(orderDate) || {};
            if (order.direction === "buy") {
              existing.buy = price;
            } else if (order.direction === "sell") {
              existing.sell = price;
            }
            orderMap.set(orderDate, existing);
          }
        });

        // Create chart data with order markers
        const chartData: ChartDataPoint[] = reversed.map((item, index) => {
          const daysAgo = reversed.length - 1 - index;
          const date = new Date();
          date.setDate(date.getDate() - daysAgo);
          const dateStr = date.toISOString().split("T")[0];

          const orderInfo = orderMap.get(dateStr);

          return {
            date: date.toLocaleDateString("ko-KR", {
              month: "short",
              day: "numeric",
            }),
            price: item.close,
            volume: item.volume,
            buyPrice: orderInfo?.buy,
            sellPrice: orderInfo?.sell,
          };
        });

        setChartData(chartData);
      } catch (err) {
        console.error("Failed to load stock data:", err);
        setError("종목 정보를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    loadStockData();
  }, [ticker]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error && !chartData.length) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate(-1)}>
          ← 돌아가기
        </Button>
        <div className="flex min-h-[40vh] items-center justify-center rounded-lg border border-destructive/50 bg-destructive/10 p-8">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
              className="h-8"
            >
              ←
            </Button>
            <h2 className="text-2xl font-bold text-foreground lg:text-3xl">
              {stockInfo?.name || ticker}
            </h2>
            <Badge variant="secondary" className="font-mono">
              {ticker}
            </Badge>
          </div>
          {stockInfo &&
            stockInfo.price !== undefined &&
            stockInfo.change_pct !== undefined && (
              <div className="flex items-center gap-4 text-sm">
                <span className="terminal-number text-xl font-bold">
                  {formatKRW(stockInfo.price)}
                </span>
                <span
                  className={
                    stockInfo.change_pct >= 0
                      ? "text-success font-semibold"
                      : "text-destructive font-semibold"
                  }
                >
                  {stockInfo.change_pct >= 0 ? "+" : ""}
                  {stockInfo.change_pct.toFixed(2)}%
                </span>
              </div>
            )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {position && (
          <>
            <Card className="glass border-border/50">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">보유 수량</div>
                <div className="terminal-number text-2xl font-bold text-foreground">
                  {position.quantity}주
                </div>
              </CardContent>
            </Card>
            <Card className="glass border-border/50">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">평균 매수가</div>
                <div className="terminal-number text-2xl font-bold text-amber-500">
                  {formatKRW(position.avg_price, { compact: true })}
                </div>
              </CardContent>
            </Card>
            <Card className="glass border-border/50">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">평가 손익</div>
                <div
                  className={`terminal-number text-2xl font-bold ${
                    position.unrealized_pnl >= 0
                      ? "text-success"
                      : "text-destructive"
                  }`}
                >
                  {position.unrealized_pnl >= 0 ? "+" : ""}
                  {(position.unrealized_pnl_pct * 100).toFixed(1)}%
                </div>
                <div
                  className={`text-xs ${
                    position.unrealized_pnl >= 0
                      ? "text-success/70"
                      : "text-destructive/70"
                  }`}
                >
                  {formatKRW(position.unrealized_pnl, { compact: true })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">총 주문</div>
            <div className="terminal-number text-2xl font-bold text-foreground">
              {orders.length}
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">매수</div>
            <div className="terminal-number text-2xl font-bold text-success">
              {orders.filter((o) => o.direction === "buy").length}
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">매도</div>
            <div className="terminal-number text-2xl font-bold text-destructive">
              {orders.filter((o) => o.direction === "sell").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Price Chart */}
      {chartData.length > 0 && (
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>가격 추이 (최근 60일)</CardTitle>
            <CardDescription>
              일별 종가와 매수/매도 시점{avgPrice ? ", 평균 매수가" : ""}를
              표시합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  interval="preserveStartEnd"
                  minTickGap={30}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(value) => formatKRW(value, { compact: true })}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number, name: string) => {
                    if (name === "price") return [formatKRW(value), "종가"];
                    if (name === "volume")
                      return [value.toLocaleString(), "거래량"];
                    return [formatKRW(value), name];
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px" }}
                  formatter={(value) => {
                    if (value === "price") return "종가";
                    if (value === "volume") return "거래량";
                    return value;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />

                {/* Average Price Line */}
                {avgPrice && (
                  <ReferenceLine
                    y={avgPrice}
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    label={{
                      value: `평단가: ${formatKRW(avgPrice, {
                        compact: true,
                      })}`,
                      position: "right",
                      fill: "#f59e0b",
                      fontSize: 12,
                      fontWeight: "bold",
                    }}
                  />
                )}

                {/* Buy markers */}
                {chartData.map((point, index) =>
                  point.buyPrice ? (
                    <ReferenceDot
                      key={`buy-${index}`}
                      x={point.date}
                      y={point.buyPrice}
                      r={8}
                      fill="#22c55e"
                      stroke="#fff"
                      strokeWidth={2.5}
                      label={{
                        value: `▲ 매수 ${formatKRW(point.buyPrice, {
                          compact: true,
                        })}`,
                        position: "bottom",
                        fill: "#22c55e",
                        fontSize: 11,
                        fontWeight: "bold",
                        offset: 10,
                      }}
                    />
                  ) : null
                )}

                {/* Sell markers */}
                {chartData.map((point, index) =>
                  point.sellPrice ? (
                    <ReferenceDot
                      key={`sell-${index}`}
                      x={point.date}
                      y={point.sellPrice}
                      r={8}
                      fill="#ef4444"
                      stroke="#fff"
                      strokeWidth={2.5}
                      label={{
                        value: `▼ 매도 ${formatKRW(point.sellPrice, {
                          compact: true,
                        })}`,
                        position: "top",
                        fill: "#ef4444",
                        fontSize: 11,
                        fontWeight: "bold",
                        offset: 10,
                      }}
                    />
                  ) : null
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Orders Table */}
      {orders.length > 0 && (
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>주문 내역</CardTitle>
            <CardDescription>이 종목의 모든 주문 기록입니다</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="text-xs">날짜</TableHead>
                    <TableHead className="text-xs">구분</TableHead>
                    <TableHead className="text-xs">수량</TableHead>
                    <TableHead className="text-xs">체결가</TableHead>
                    <TableHead className="text-xs">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="border-border/50 hover:bg-secondary/30"
                    >
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("ko-KR")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            order.direction === "buy"
                              ? "success"
                              : "destructive"
                          }
                        >
                          {order.direction === "buy" ? "매수" : "매도"}
                        </Badge>
                      </TableCell>
                      <TableCell className="terminal-number text-foreground">
                        {order.filled_qty || order.requested_qty}주
                      </TableCell>
                      <TableCell className="terminal-number text-foreground">
                        {order.avg_filled_price
                          ? formatKRW(order.avg_filled_price)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            order.status === "filled"
                              ? "success"
                              : order.status === "pending"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {order.status === "filled"
                            ? "체결"
                            : order.status === "pending"
                            ? "대기"
                            : "실패"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Decisions Table */}
      {decisions.length > 0 && (
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>AI 결정 내역</CardTitle>
            <CardDescription>
              이 종목에 대한 AI의 투자 결정 기록입니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="text-xs">날짜</TableHead>
                    <TableHead className="text-xs">행동</TableHead>
                    <TableHead className="text-xs">수량</TableHead>
                    <TableHead className="text-xs">신뢰도</TableHead>
                    <TableHead className="text-xs">사유</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {decisions.map((decision) => (
                    <TableRow
                      key={decision.id}
                      className="border-border/50 hover:bg-secondary/30"
                    >
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(decision.created_at).toLocaleDateString(
                          "ko-KR"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            decision.action === "BUY"
                              ? "success"
                              : decision.action === "SELL"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {decision.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="terminal-number text-foreground">
                        {decision.quantity || "-"}
                      </TableCell>
                      <TableCell className="terminal-number font-semibold text-primary">
                        {(decision.confidence * 100).toFixed(0)}%
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {decision.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
