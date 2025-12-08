const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8888';

export async function fetchBatchSettings() {
    const res = await fetch(`${API_BASE_URL}/api/settings/batch`);
    if (!res.ok) throw new Error('Failed to fetch batch settings');
    return res.json();
}

export async function updateBatchSettings(settings: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/api/settings/batch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update batch settings');
    return res.json();
}

export async function fetchRiskSettings() {
    const res = await fetch(`${API_BASE_URL}/api/settings/risk`);
    if (!res.ok) throw new Error('Failed to fetch risk settings');
    return res.json();
}

export async function updateRiskSettings(settings: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/api/settings/risk`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update risk settings');
    return res.json();
}

export async function fetchDashboardOverview() {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/overview`);
    if (!res.ok) throw new Error('Failed to fetch dashboard overview');
    return res.json();
}

export async function fetchRecentDecisions(limit = 20) {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/recent-decisions?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch recent decisions');
    return res.json();
}

export async function fetchMarketStatus() {
    const res = await fetch(`${API_BASE_URL}/api/batch/market-status`);
    if (!res.ok) throw new Error('Failed to fetch market status');
    return res.json();
}

export async function triggerBatch(market: 'DOMESTIC' | 'US') {
    const res = await fetch(`${API_BASE_URL}/api/batch/run/${market}`, {
        method: 'POST',
    });
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to trigger batch');
    }
    return res.json();
}

export async function fetchAnalytics() {
    const res = await fetch(`${API_BASE_URL}/api/analytics`);
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
}
