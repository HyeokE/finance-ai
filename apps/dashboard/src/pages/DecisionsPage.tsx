import { useState } from "react";
import type { DecisionResponse } from "../api/client";
import { DecisionDetailModal } from "../components/DecisionDetailModal";
import { StockChartModal } from "../components/StockChartModal";
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
  decisions: DecisionResponse[];
};

export function DecisionsPage({ decisions }: Props) {
  const [selectedDecision, setSelectedDecision] =
    useState<DecisionResponse | null>(null);
  const [chartStock, setChartStock] = useState<{
    ticker: string;
    name: string;
    market: string;
  } | null>(null);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground lg:text-3xl">
          AI 의사결정 기록
        </h2>
        <p className="text-sm text-muted-foreground">
          AI가 분석한 투자 결정 내역을 확인합니다
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">총 결정</div>
            <div className="terminal-number text-2xl font-bold text-foreground">
              {decisions.length}
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">매수 신호</div>
            <div className="terminal-number text-2xl font-bold text-green-400">
              {decisions.filter((d) => d.action === "BUY").length}
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">매도 신호</div>
            <div className="terminal-number text-2xl font-bold text-red-400">
              {decisions.filter((d) => d.action === "SELL").length}
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">평균 신뢰도</div>
            <div className="terminal-number text-2xl font-bold text-primary">
              {decisions.length > 0
                ? (
                    (decisions.reduce((sum, d) => sum + d.confidence, 0) /
                      decisions.length) *
                    100
                  ).toFixed(0)
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Decisions Table */}
      <Card className="glass border-border/50">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-lg">결정 내역</CardTitle>
          <CardDescription>클릭하여 상세 정보를 확인하세요</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">시간</TableHead>
                  <TableHead className="text-muted-foreground">티커</TableHead>
                  <TableHead className="text-muted-foreground">액션</TableHead>
                  <TableHead className="text-muted-foreground">수량</TableHead>
                  <TableHead className="text-muted-foreground">금액</TableHead>
                  <TableHead className="text-muted-foreground">
                    신뢰도
                  </TableHead>
                  <TableHead className="text-muted-foreground">사유</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decisions.map((decision) => (
                  <TableRow
                    key={decision.id}
                    onClick={() => setSelectedDecision(decision)}
                    className="cursor-pointer border-border/50 transition-colors hover:bg-secondary/30"
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(decision.created_at).toLocaleString("ko-KR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      <button
                        onClick={() =>
                          setChartStock({
                            ticker: decision.ticker,
                            name: decision.name || decision.ticker,
                            market: decision.runs?.market || "DOMESTIC",
                          })
                        }
                        className="flex flex-col gap-0.5 text-left transition-colors hover:text-primary"
                      >
                        <span className="font-mono">{decision.ticker}</span>
                        {decision.name && (
                          <span className="text-xs text-muted-foreground">
                            {decision.name}
                          </span>
                        )}
                      </button>
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
                    <TableCell className="terminal-number text-foreground">
                      {decision.amount_krw
                        ? formatKRW(decision.amount_krw)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <span className="terminal-number font-semibold text-primary">
                        {(decision.confidence * 100).toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {decision.reason}
                    </TableCell>
                  </TableRow>
                ))}
                {decisions.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
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
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <p>결정 내역이 없습니다</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <DecisionDetailModal
        decision={selectedDecision}
        onClose={() => setSelectedDecision(null)}
      />

      {chartStock && (
        <StockChartModal
          ticker={chartStock.ticker}
          name={chartStock.name}
          market={chartStock.market}
          orders={decisions
            .filter((d) => d.ticker === chartStock.ticker)
            .map((d) => ({
              action: d.action,
              created_at: d.created_at,
              avg_filled_price:
                d.amount_krw && d.quantity
                  ? d.amount_krw / d.quantity
                  : undefined,
              requested_price: undefined,
            }))}
          onClose={() => setChartStock(null)}
        />
      )}
    </div>
  );
}
