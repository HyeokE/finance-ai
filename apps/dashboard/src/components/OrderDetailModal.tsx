import type { OrderWithMeta } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

type Props = {
  order: OrderWithMeta | null;
  onClose: () => void;
};

export function OrderDetailModal({ order, onClose }: Props) {
  const open = !!order;
  if (!order) return null;

  const formatNumber = (value?: number | null) => (typeof value === 'number' ? value.toLocaleString() : '-');
  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="text-2xl">주문 상세</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          <Card className="border-gray-200 shadow-none">
            <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              <DetailItem label="티커" value={order.ticker} />
              <DetailItem
                label="방향"
                value={<Badge variant={order.direction === 'buy' ? 'secondary' : 'outline'}>{order.direction.toUpperCase()}</Badge>}
              />
              <DetailItem
                label="상태"
                value={
                  <Badge
                    variant={
                      order.status === 'filled'
                        ? 'success'
                        : order.status === 'failed'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {order.status.toUpperCase()}
                  </Badge>
                }
              />
              <DetailItem label="시장" value={order.runs?.market || 'N/A'} />
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-none">
            <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              <DetailItem label="요청 수량" value={`${formatNumber(order.requested_qty)} 주`} />
              <DetailItem label="체결 수량" value={`${formatNumber(order.filled_qty || 0)} 주`} />
              <DetailItem
                label="평균 체결가"
                value={typeof order.avg_filled_price === 'number' ? `₩${formatNumber(order.avg_filled_price)}` : '-'}
              />
              <DetailItem
                label="총액"
                value={
                  order.filled_qty && order.avg_filled_price
                    ? `₩${formatNumber(order.filled_qty * order.avg_filled_price)}`
                    : '-'
                }
              />
              {typeof order.requested_price === 'number' && (
                <DetailItem label="요청 가격" value={`₩${formatNumber(order.requested_price)}`} />
              )}
              {order.order_type && <DetailItem label="주문 유형" value={order.order_type} />}
            </CardContent>
          </Card>

          {order.broker_order_id && (
            <Card className="border-gray-200 shadow-none">
              <CardContent className="grid grid-cols-1 gap-3 p-4">
                <DetailItem label="증권사 주문 ID" value={<span className="font-mono">{order.broker_order_id}</span>} />
              </CardContent>
            </Card>
          )}

          {(order.error_code || order.error_message) && (
            <Card className="border-gray-200 shadow-none">
              <CardContent className="grid grid-cols-1 gap-3 p-4">
                <div className="text-sm font-semibold text-red-600">에러 정보</div>
                {order.error_code && <DetailItem label="에러 코드" value={order.error_code} />}
                {order.error_message && <DetailItem label="에러 메시지" value={order.error_message} />}
              </CardContent>
            </Card>
          )}

          <Card className="border-gray-200 shadow-none">
            <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              <DetailItem label="생성 시각" value={formatDate(order.created_at)} />
              {order.updated_at && <DetailItem label="업데이트 시각" value={formatDate(order.updated_at)} />}
              {order.runs?.started_at && <DetailItem label="배치 시작 시각" value={formatDate(order.runs.started_at)} />}
              {order.runs?.status && <DetailItem label="배치 상태" value={order.runs.status} />}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              닫기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}
