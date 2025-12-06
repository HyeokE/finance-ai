const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

export async function triggerBatch() {
    const res = await fetch(`${API_BASE_URL}/api/batch/run`, {
        method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to trigger batch');
    return res.json();
}

export async function fetchAnalytics() {
    const res = await fetch(`${API_BASE_URL}/api/analytics`);
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
}
