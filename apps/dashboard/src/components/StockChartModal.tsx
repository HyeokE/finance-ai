import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { stocksApi } from "../api/client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  Legend,
} from "recharts";
import { formatKRW } from "../lib/formatters";

type Props = {
  ticker: string;
  name: string;
  market: string;
  orders?: Array<{
    action: string;
    created_at: string;
    avg_filled_price?: number;
    requested_price?: number;
  }>;
  onClose: () => void;
};

type ChartDataPoint = {
  date: string;
  price: number;
  volume: number;
  buyPrice?: number;
  sellPrice?: number;
};

export function StockChartModal({
  ticker,
  name,
  market,
  orders,
  onClose,
}: Props) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadChartData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch stock history
        const history = await stocksApi.getHistory(ticker, market, 60);

        if (!history || history.length === 0) {
          setError("차트 데이터가 없습니다.");
          return;
        }

        // Reverse to get chronological order (oldest first)
        const reversed = [...history].reverse();

        // Create a map of dates to orders
        const orderMap = new Map<string, { buy?: number; sell?: number }>();

        if (orders) {
          orders.forEach((order) => {
            const orderDate = new Date(order.created_at)
              .toISOString()
              .split("T")[0];
            const price = order.avg_filled_price || order.requested_price || 0;

            if (price > 0) {
              const existing = orderMap.get(orderDate) || {};
              if (order.action === "BUY") {
                existing.buy = price;
              } else if (order.action === "SELL") {
                existing.sell = price;
              }
              orderMap.set(orderDate, existing);
            }
          });
        }

        // Create chart data with order markers
        const chartData: ChartDataPoint[] = reversed.map((item, index) => {
          // Estimate date based on index (most recent is last)
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
        console.error("Failed to load chart data:", err);
        setError("차트 데이터를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    loadChartData();
  }, [ticker, market, orders]);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {name} ({ticker}) - {market === "DOMESTIC" ? "🇰🇷" : "🇺🇸"}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && chartData.length > 0 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-secondary/20 p-4">
              <h3 className="mb-4 text-sm font-semibold">
                가격 추이 (최근 60일)
              </h3>
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
                    tickFormatter={(value) =>
                      formatKRW(value, { compact: true })
                    }
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

                  {/* Buy markers */}
                  {chartData.map((point, index) =>
                    point.buyPrice ? (
                      <ReferenceDot
                        key={`buy-${index}`}
                        x={point.date}
                        y={point.buyPrice}
                        r={6}
                        fill="hsl(var(--success))"
                        stroke="#fff"
                        strokeWidth={2}
                        label={{
                          value: "매수",
                          position: "top",
                          fill: "hsl(var(--success))",
                          fontSize: 10,
                          fontWeight: "bold",
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
                        r={6}
                        fill="hsl(var(--destructive))"
                        stroke="#fff"
                        strokeWidth={2}
                        label={{
                          value: "매도",
                          position: "top",
                          fill: "hsl(var(--destructive))",
                          fontSize: 10,
                          fontWeight: "bold",
                        }}
                      />
                    ) : null
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {orders && orders.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">주문 내역</h3>
                <div className="space-y-1">
                  {orders.map((order, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("ko-KR")}
                      </span>
                      <span
                        className={
                          order.action === "BUY"
                            ? "font-semibold text-success"
                            : "font-semibold text-destructive"
                        }
                      >
                        {order.action === "BUY" ? "매수" : "매도"}
                      </span>
                      <span className="terminal-number font-medium">
                        {formatKRW(
                          order.avg_filled_price || order.requested_price || 0
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
