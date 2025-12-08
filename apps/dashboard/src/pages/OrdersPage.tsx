import { useState } from "react";
import { OrderDetailModal } from "../components/OrderDetailModal";
import { StockChartModal } from "../components/StockChartModal";
import type { OrderWithMeta } from "../types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { formatKRW } from "../lib/formatters";

type Props = {
  orders: OrderWithMeta[];
};

export function OrdersPage({ orders }: Props) {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithMeta | null>(
    null
  );
  const [chartStock, setChartStock] = useState<{
    ticker: string;
    name: string;
    market: string;
  } | null>(null);

  const filledOrders = orders.filter((o) => o.status === "filled").length;
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const failedOrders = orders.filter((o) => o.status === "failed").length;
  const totalRequested = orders.reduce((sum, o) => sum + o.requested_qty, 0);
  const totalFilled = orders.reduce((sum, o) => sum + (o.filled_qty || 0), 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground lg:text-3xl">
          주문/체결 기록
        </h2>
        <p className="text-sm text-muted-foreground">
          모든 주문 내역과 체결 상태를 확인합니다
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">총 주문</div>
            <div className="terminal-number text-2xl font-bold text-foreground">
              {orders.length}
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50 glow-success">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">체결 완료</div>
            <div className="terminal-number text-2xl font-bold text-green-400">
              {filledOrders}
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">대기 중</div>
            <div className="terminal-number text-2xl font-bold text-yellow-400">
              {pendingOrders}
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50 glow-destructive">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">실패</div>
            <div className="terminal-number text-2xl font-bold text-red-400">
              {failedOrders}
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">체결률</div>
            <div className="terminal-number text-2xl font-bold text-primary">
              {totalRequested > 0
                ? ((totalFilled / totalRequested) * 100).toFixed(0)
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card className="glass border-border/50">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-lg">주문 내역</CardTitle>
          <CardDescription>클릭하여 상세 정보를 확인하세요</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">시간</TableHead>
                  <TableHead className="text-muted-foreground">시장</TableHead>
                  <TableHead className="text-muted-foreground">티커</TableHead>
                  <TableHead className="text-muted-foreground">방향</TableHead>
                  <TableHead className="text-muted-foreground">
                    요청 수량
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    체결 수량
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    평균가
                  </TableHead>
                  <TableHead className="text-muted-foreground">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="cursor-pointer border-border/50 transition-colors hover:bg-secondary/30"
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleString("ko-KR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {order.runs?.market || "N/A"}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setChartStock({
                            ticker: order.ticker,
                            name: order.name || order.ticker,
                            market: order.runs?.market || "DOMESTIC",
                          });
                        }}
                        className="flex flex-col gap-0.5 text-left transition-colors hover:text-primary"
                      >
                        <span className="font-mono">{order.ticker}</span>
                        {order.name && (
                          <span className="text-xs text-muted-foreground">
                            {order.name}
                          </span>
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          order.direction === "buy" ? "success" : "destructive"
                        }
                      >
                        {order.direction.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="terminal-number text-foreground">
                      {order.requested_qty}
                    </TableCell>
                    <TableCell className="terminal-number text-foreground">
                      {order.filled_qty || 0}
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
                            : order.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {order.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-12 text-center text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <svg
                          className="h-12 w-12 text-muted-foreground/30"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                        <p>주문 내역이 없습니다</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />

      {chartStock && (
        <StockChartModal
          ticker={chartStock.ticker}
          name={chartStock.name}
          market={chartStock.market}
          orders={orders
            .filter((o) => o.ticker === chartStock.ticker)
            .map((o) => ({
              action: o.direction.toUpperCase(),
              created_at: o.created_at,
              avg_filled_price: o.avg_filled_price,
              requested_price: o.requested_price,
            }))}
          onClose={() => setChartStock(null)}
        />
      )}
    </div>
  );
}
