import type { Market } from '@auto-finance/shared';
import { MarketCard } from '../components/MarketCard';

type Props = {
  onBatchSuccess: (payload: { runId: string; market: string }) => void;
};

export function MarketsPage({ onBatchSuccess }: Props) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground lg:text-3xl">시장별 배치 관리</h2>
        <p className="text-sm text-muted-foreground">각 시장의 실행 스케줄과 리스크 파라미터를 설정하고 배치를 실행합니다</p>
      </div>

      {/* Market Cards */}
      <div className="grid gap-4">
        {(['DOMESTIC', 'US'] as Market[]).map((market, index) => (
          <div key={market} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
            <MarketCard market={market} onBatchSuccess={onBatchSuccess} />
          </div>
        ))}
      </div>
    </div>
  );
}
