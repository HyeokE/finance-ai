import type { DecisionResponse } from "../api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { formatKRW } from "../lib/formatters";

type Props = {
  decision: DecisionResponse | null;
  onClose: () => void;
};

export function DecisionDetailModal({ decision, onClose }: Props) {
  const open = !!decision;
  if (!decision) return null;

  const formatNumber = (value?: number | null) =>
    typeof value === "number" ? value.toLocaleString() : "-";
  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="flex flex-col gap-1">
            <span>AI 의사결정 상세</span>
            <span className="text-sm font-normal text-muted-foreground">
              결정 ID: <span className="font-mono">{decision.id}</span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          <Card className="border-border/50 shadow-none">
            <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              <DetailItem
                label="티커"
                value={
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono font-semibold">
                      {decision.ticker}
                    </span>
                    {decision.name && (
                      <span className="text-sm text-muted-foreground">
                        {decision.name}
                      </span>
                    )}
                  </div>
                }
              />
              <DetailItem
                label="액션"
                value={
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
                }
              />
              <DetailItem
                label="매수 금액 (KRW)"
                value={
                  decision.amount_krw ? formatKRW(decision.amount_krw) : "-"
                }
              />
              <DetailItem
                label="수량"
                value={formatNumber(decision.quantity || 0)}
              />
              <DetailItem
                label="신뢰도"
                value={`${(decision.confidence * 100).toFixed(1)}%`}
              />
              {decision.runs?.started_at && (
                <DetailItem
                  label="배치 시작 시각"
                  value={formatDate(decision.runs.started_at)}
                />
              )}
              {decision.runs?.status && (
                <DetailItem label="배치 상태" value={decision.runs.status} />
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-none">
            <CardContent className="space-y-2 p-4">
              <div className="text-sm font-semibold text-foreground">사유</div>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                {decision.reason}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-none">
            <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              <DetailItem
                label="생성 시각"
                value={formatDate(decision.created_at)}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={onClose}>닫기</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1 rounded-md border border-border/50 bg-secondary/30 px-3 py-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
