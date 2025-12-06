import { useEffect, useState, useCallback } from 'react';
import type { Market, MarketBatchSettings, MarketRiskSettings } from '@auto-finance/shared';
import { marketSettingsApi, batchApi } from '../api/client';
import { MARKET_INFO } from '../shared/lib/constants';

type Props = {
  market: Market;
  onBatchSuccess?: (payload: { runId: string; market: string }) => void;
};

export function MarketCard({ market, onBatchSuccess }: Props) {
  const [batchSettings, setBatchSettings] = useState<MarketBatchSettings | null>(null);
  const [riskSettings, setRiskSettings] = useState<MarketRiskSettings | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTimes, setEditedTimes] = useState('');
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [batchStatus, setBatchStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const info = MARKET_INFO[market];

  const loadSettings = useCallback(async () => {
    try {
      const [batchData, riskData] = await Promise.all([
        marketSettingsApi.getBatchSettings(market),
        marketSettingsApi.getRiskSettings(market),
      ]);

      setBatchSettings(batchData);
      setRiskSettings(riskData);
      setEditedTimes(batchData.schedule_times.join(', '));
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }, [market]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleToggle = async () => {
    if (!batchSettings) return;
    const newEnabled = !batchSettings.enabled;

    try {
      await marketSettingsApi.updateBatchSettings(market, { enabled: newEnabled });
      await loadSettings();
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  const handleSaveSchedule = async () => {
    try {
      const times = editedTimes
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t);
      await marketSettingsApi.updateBatchSettings(market, { schedule_times: times });
      await loadSettings();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save schedule:', error);
    }
  };

  const handleRunBatch = async () => {
    setIsRunningBatch(true);
    setBatchStatus(null);

    try {
      const result = await batchApi.runBatch(market);
      onBatchSuccess?.({ runId: result.run_id, market });
      setBatchStatus({
        type: 'success',
        message: `✅ 배치 실행 성공! Run ID: ${result.run_id || 'N/A'}`,
      });

      setTimeout(() => setBatchStatus(null), 5000);
    } catch (error: unknown) {
      const errorMessage =
        (error as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ||
        (error as { message?: string })?.message ||
        '배치 실행 실패';
      setBatchStatus({
        type: 'error',
        message: `❌ ${errorMessage}`,
      });
      setTimeout(() => setBatchStatus(null), 10000);
    } finally {
      setIsRunningBatch(false);
    }
  };

  if (!batchSettings || !riskSettings) {
    return (
      <div className="border rounded-lg p-6 mb-4 bg-white shadow-sm">
        <p className="text-gray-500">Loading {market}...</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-6 mb-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{info.flag}</span>
          <div>
            <h3 className="text-lg font-bold">{info.name}</h3>
            <p className="text-sm text-gray-500">{info.hours}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={batchSettings.enabled} onChange={handleToggle} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              batchSettings.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}
          >
            {batchSettings.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Times (KST)</label>
        {isEditing ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={editedTimes}
              onChange={(e) => setEditedTimes(e.target.value)}
              placeholder="09:05, 13:00, 15:00"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={handleSaveSchedule} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Save
            </button>
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 bg-gray-50 rounded-md font-mono text-sm">{batchSettings.schedule_times.join(', ')}</div>
            <button onClick={() => setIsEditing(true)} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
              Edit
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Max Position:</span>
          <span className="font-medium">{(riskSettings.max_position_weight * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Max Investment:</span>
          <span className="font-medium">{(riskSettings.max_total_investment * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Min Confidence:</span>
          <span className="font-medium">{(riskSettings.min_confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Max Stocks:</span>
          <span className="font-medium">{batchSettings.max_stocks}</span>
        </div>
      </div>

      <div className="pt-4 border-t">
        <button
          onClick={handleRunBatch}
          disabled={!batchSettings.enabled || isRunningBatch}
          className={`px-4 py-2 rounded-md transition-all ${
            batchSettings.enabled && !isRunningBatch ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isRunningBatch ? '실행 중...' : 'Run Batch Now'}
        </button>

        {batchStatus && (
          <div
            className={`mt-3 px-4 py-2 rounded-md text-sm ${
              batchStatus.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {batchStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}
