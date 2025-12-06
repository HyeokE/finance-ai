import type { DecisionResponse } from '../api/client';
import type { OrderWithMeta } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

export type BatchResult = {
  runId: string;
  market: string;
  status: string;
  decisions: DecisionResponse[];
  orders: OrderWithMeta[];
};

type Props = {
  result: BatchResult | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

export function BatchResultModal({ result, loading, error, onClose }: Props) {
  const open = !!result;
  const decisions = result?.decisions || [];
  const orders = result?.orders || [];

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-5xl">
        {result && (
          <>
            <DialogHeader className="p-6 pb-3">
              <DialogTitle className="flex flex-col gap-1">
                <span>배치 실행 결과</span>
                <span className="text-sm font-normal text-gray-500">
                  Run ID: <span className="font-mono">{result.runId}</span> / Market: {result.market}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="px-6 pb-6 space-y-4">
              {loading && (
                <div className="rounded-md bg-blue-50 border border-blue-100 text-blue-700 px-4 py-3 text-sm">
                  AI 의사결정과 체결 내역을 불러오는 중입니다...
                </div>
              )}
              {error && (
                <div className="rounded-md bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm">{error}</div>
              )}

              <Card className="border-gray-200 shadow-none">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <div className="text-sm font-semibold text-gray-900">AI 의사결정 결과</div>
                    <Badge variant="secondary">{decisions.length}개</Badge>
                  </div>
                  {decisions.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-gray-500">결정 내역이 없습니다.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>티커</TableHead>
                          <TableHead>액션</TableHead>
                          <TableHead>매수금액</TableHead>
                          <TableHead>수량</TableHead>
                          <TableHead>신뢰도</TableHead>
                          <TableHead>사유</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {decisions.map((decision) => (
                          <TableRow key={decision.id}>
                            <TableCell className="font-medium text-gray-900">{decision.ticker}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  decision.action === 'BUY' ? 'success' : decision.action === 'SELL' ? 'destructive' : 'secondary'
                                }
                              >
                                {decision.action}
                              </Badge>
                            </TableCell>
                            <TableCell>{decision.amount_krw ? `₩${decision.amount_krw.toLocaleString()}` : '-'}</TableCell>
                            <TableCell>{decision.quantity ? decision.quantity.toLocaleString() : '-'}</TableCell>
                            <TableCell>{(decision.confidence * 100).toFixed(0)}%</TableCell>
                            <TableCell className="text-gray-600 max-w-xs truncate">{decision.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-none">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <div className="text-sm font-semibold text-gray-900">주문/체결 내역</div>
                    <Badge variant="secondary">{orders.length}개</Badge>
                  </div>
                  {orders.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-gray-500">주문 내역이 없습니다.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>티커</TableHead>
                          <TableHead>방향</TableHead>
                          <TableHead>요청 수량</TableHead>
                          <TableHead>체결 수량</TableHead>
                          <TableHead>평균 체결가</TableHead>
                          <TableHead>상태</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium text-gray-900">{order.ticker}</TableCell>
                            <TableCell>
                              <Badge variant={order.direction === 'buy' ? 'secondary' : 'outline'}>
                                {order.direction.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>{order.requested_qty}</TableCell>
                            <TableCell>{order.filled_qty || 0}</TableCell>
                            <TableCell>{order.avg_filled_price ? `₩${order.avg_filled_price.toLocaleString()}` : '-'}</TableCell>
                            <TableCell>
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
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end pt-2">
                <Button onClick={onClose}>닫기</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
