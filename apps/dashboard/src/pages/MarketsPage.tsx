import type { Market } from '@auto-finance/shared';
import { MarketCard } from '../components/MarketCard';

type Props = {
  onBatchSuccess: (payload: { runId: string; market: string }) => void;
};

export function MarketsPage({ onBatchSuccess }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-bold mb-2">Market-Specific Batch Settings</h2>
      <p className="text-gray-600 mb-6">Configure batch schedules and risk parameters for each market independently</p>
      <div>
        {(['DOMESTIC', 'US', 'HK', 'JP', 'CN'] as Market[]).map((market) => (
          <MarketCard key={market} market={market} onBatchSuccess={onBatchSuccess} />
        ))}
      </div>
    </div>
  );
}
