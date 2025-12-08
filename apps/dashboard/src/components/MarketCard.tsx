import { useState } from 'react';
import type { Market } from '@auto-finance/shared';
import { MARKET_INFO } from '../shared/lib/constants';
import {
  useMarketBatchSettingsQuery,
  useMarketRiskSettingsQuery,
  useRunBatchMutation,
  useUpdateMarketBatchMutation,
  useUpdateMarketRiskMutation,
  useMarketStatusQuery,
} from '../queries/markets';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';

type Props = {
  market: Market;
  onBatchSuccess?: (payload: { runId: string; market: string }) => void;
};

export function MarketCard({ market, onBatchSuccess }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingRisk, setIsEditingRisk] = useState(false);
  const [editedTimes, setEditedTimes] = useState('');
  const [editedRiskSettings, setEditedRiskSettings] = useState({
    max_position_weight: 0,
    max_total_investment: 0,
    min_confidence: 0,
    max_trades_per_batch: 0,
  });
  const [editedMaxStocks, setEditedMaxStocks] = useState(0);
  const [batchStatus, setBatchStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const info = MARKET_INFO[market];

  const batchSettingsQuery = useMarketBatchSettingsQuery(market);
  const riskSettingsQuery = useMarketRiskSettingsQuery(market);
  const marketStatusQuery = useMarketStatusQuery();
  const updateBatchMutation = useUpdateMarketBatchMutation(market);
  const updateRiskMutation = useUpdateMarketRiskMutation(market);
  const runBatchMutation = useRunBatchMutation(market);

  const batchSettings = batchSettingsQuery.data;
  const riskSettings = riskSettingsQuery.data;
  const marketStatus = marketStatusQuery.data?.markets.find((m) => m.market === market);
  const isMarketOpen = marketStatus?.isOpen ?? true; // Default to true if status not loaded yet

  const handleToggle = async () => {
    if (!batchSettings) return;
    const newEnabled = !batchSettings.enabled;
    updateBatchMutation.mutate({ enabled: newEnabled });
  };

  const handleSaveSchedule = async () => {
    const times = editedTimes
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t);
    updateBatchMutation.mutate(
      { schedule_times: times },
      {
        onSuccess: () => setIsEditing(false),
      }
    );
  };

  const handleStartEditRisk = () => {
    if (riskSettings && batchSettings) {
      setEditedRiskSettings({
        max_position_weight: riskSettings.max_position_weight,
        max_total_investment: riskSettings.max_total_investment,
        min_confidence: riskSettings.min_confidence,
        max_trades_per_batch: riskSettings.max_trades_per_batch,
      });
      setEditedMaxStocks(batchSettings.max_stocks);
      setIsEditingRisk(true);
    }
  };

  const handleSaveRiskSettings = async () => {
    if (!riskSettings || !batchSettings) return;

    // Update risk settings
    updateRiskMutation.mutate(
      {
        max_position_weight: editedRiskSettings.max_position_weight,
        max_total_investment: editedRiskSettings.max_total_investment,
        min_confidence: editedRiskSettings.min_confidence,
        max_trades_per_batch: editedRiskSettings.max_trades_per_batch,
      },
      {
        onSuccess: () => {
          // Update max_stocks in batch settings
          updateBatchMutation.mutate(
            { max_stocks: editedMaxStocks },
            {
              onSuccess: () => setIsEditingRisk(false),
            }
          );
        },
      }
    );
  };

  const handleRunBatch = async () => {
    setBatchStatus(null);

    runBatchMutation.mutate(undefined, {
      onSuccess: (result) => {
        onBatchSuccess?.({ runId: result.run_id, market });
        setBatchStatus({
          type: 'success',
          message: `✅ 배치 실행 성공! Run ID: ${result.run_id || 'N/A'}`,
        });

        setTimeout(() => setBatchStatus(null), 5000);
      },
      onError: (error: unknown) => {
        const errorMessage =
          (error as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ||
          (error as { message?: string })?.message ||
          '배치 실행 실패';
        setBatchStatus({
          type: 'error',
          message: `❌ ${errorMessage}`,
        });
        setTimeout(() => setBatchStatus(null), 10000);
      },
    });
  };

  if (batchSettingsQuery.isLoading || riskSettingsQuery.isLoading) {
    return (
      <div className="glass rounded-lg border border-border/50 p-6">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Loading {market}...</p>
        </div>
      </div>
    );
  }

  if (batchSettingsQuery.isError || riskSettingsQuery.isError || !batchSettings || !riskSettings) {
    return (
      <div className="glass rounded-lg border border-destructive/50 p-6">
        <p className="text-sm text-destructive">설정을 불러오지 못했습니다.</p>
      </div>
    );
  }

  const defaultTimes = batchSettings.schedule_times.join(', ');

  return (
    <Card className="glass border-border/50 transition-glow hover:border-primary/30">
      <CardHeader className="flex flex-col gap-3 border-b border-border/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-3xl ring-1 ring-primary/20">
            {info.flag}
          </div>
          <div>
            <CardTitle className="text-lg font-bold">{info.name}</CardTitle>
            <CardDescription className="text-xs">{info.hours}</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={batchSettings.enabled} onChange={handleToggle} />
          <Badge variant={batchSettings.enabled ? 'success' : 'secondary'} className="min-w-[60px] justify-center">
            {batchSettings.enabled ? '활성' : '비활성'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 px-4 py-5 sm:px-6">
        {/* Schedule Section */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">실행 시간 (KST)</label>
          {isEditing ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={editedTimes}
                onChange={(e) => setEditedTimes(e.target.value)}
                placeholder="09:05, 13:00, 15:00"
                className="flex-1 bg-secondary/50 border-border/50 focus:border-primary"
              />
              <div className="flex gap-2 sm:w-auto">
                <Button onClick={handleSaveSchedule} size="md" className="flex-1 sm:flex-none">
                  저장
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} size="md" className="flex-1 sm:flex-none">
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="terminal-number flex-1 rounded-lg border border-border/50 bg-secondary/30 px-4 py-2.5 text-sm font-medium text-foreground">
                {batchSettings.schedule_times.join(', ')}
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setEditedTimes(defaultTimes);
                  setIsEditing(true);
                }}
                size="md"
                className="sm:w-auto"
              >
                수정
              </Button>
            </div>
          )}
        </div>

        {/* Risk Parameters Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-foreground">리스크 관리 설정</label>
            {!isEditingRisk && (
              <Button variant="outline" size="sm" onClick={handleStartEditRisk}>
                수정
              </Button>
            )}
          </div>

          {isEditingRisk ? (
            <div className="space-y-3 rounded-lg border border-border/50 bg-secondary/20 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">포지션 한도 (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={(editedRiskSettings.max_position_weight * 100).toFixed(0)}
                    onChange={(e) =>
                      setEditedRiskSettings({
                        ...editedRiskSettings,
                        max_position_weight: parseFloat(e.target.value) / 100,
                      })
                    }
                    className="bg-secondary/50 border-border/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">총 투자 한도 (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={(editedRiskSettings.max_total_investment * 100).toFixed(0)}
                    onChange={(e) =>
                      setEditedRiskSettings({
                        ...editedRiskSettings,
                        max_total_investment: parseFloat(e.target.value) / 100,
                      })
                    }
                    className="bg-secondary/50 border-border/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">최소 신뢰도 (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={(editedRiskSettings.min_confidence * 100).toFixed(0)}
                    onChange={(e) =>
                      setEditedRiskSettings({
                        ...editedRiskSettings,
                        min_confidence: parseFloat(e.target.value) / 100,
                      })
                    }
                    className="bg-secondary/50 border-border/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">최대 종목 수</label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={editedMaxStocks}
                    onChange={(e) => setEditedMaxStocks(parseInt(e.target.value) || 0)}
                    className="bg-secondary/50 border-border/50"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveRiskSettings} size="sm" className="flex-1">
                  저장
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditingRisk(false)}
                  size="sm"
                  className="flex-1"
                >
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="포지션 한도" value={`${(riskSettings.max_position_weight * 100).toFixed(0)}%`} />
              <Stat label="총 투자 한도" value={`${(riskSettings.max_total_investment * 100).toFixed(0)}%`} />
              <Stat label="최소 신뢰도" value={`${(riskSettings.min_confidence * 100).toFixed(0)}%`} />
              <Stat label="최대 종목 수" value={batchSettings.max_stocks} />
            </div>
          )}
        </div>

        {/* Action Section */}
        <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              onClick={handleRunBatch}
              disabled={!batchSettings.enabled || !isMarketOpen || runBatchMutation.isPending}
              variant={batchSettings.enabled && isMarketOpen ? 'default' : 'secondary'}
              size="md"
              className="sm:min-w-[160px]"
            >
              {runBatchMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                  실행 중...
                </span>
              ) : (
                '지금 배치 실행'
              )}
            </Button>
            {!isMarketOpen && marketStatus && (
              <span className="text-xs text-muted-foreground">
                ⏰ {marketStatus.tradingHours}
              </span>
            )}
          </div>

          {batchStatus && (
            <Badge variant={batchStatus.type === 'success' ? 'success' : 'destructive'} className="w-fit animate-scale-in">
              {batchStatus.message}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/50 bg-secondary/20 p-3 transition-colors hover:bg-secondary/30">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="terminal-number text-base font-bold text-foreground">{value}</span>
    </div>
  );
}
