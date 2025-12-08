/**
 * Format currency in Korean style
 * Examples:
 * - 1,000,000 → 100만
 * - 1,234,567 → 123만
 * - 12,345,678 → 1,234만
 * - 123,456,789 → 1억 2,345만
 */
export function formatKRW(
  amount: number,
  options?: { compact?: boolean }
): string {
  const { compact = false } = options || {};

  if (amount === 0) return "0원";

  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  // 1억 이상
  if (absAmount >= 100_000_000) {
    const eok = Math.floor(absAmount / 100_000_000);
    const man = Math.floor((absAmount % 100_000_000) / 10_000);

    if (man === 0) {
      return `${sign}${eok.toLocaleString()}억원`;
    }

    if (compact) {
      return `${sign}${eok.toLocaleString()}억 ${man.toLocaleString()}만원`;
    }

    // 천 단위까지 표시
    const cheon = Math.floor((absAmount % 10_000) / 1_000);
    if (cheon === 0) {
      return `${sign}${eok.toLocaleString()}억 ${man.toLocaleString()}만원`;
    }
    return `${sign}${eok.toLocaleString()}억 ${man.toLocaleString()}만 ${cheon}천원`;
  }

  // 1만 이상 1억 미만
  if (absAmount >= 10_000) {
    const man = Math.floor(absAmount / 10_000);
    const cheon = Math.floor((absAmount % 10_000) / 1_000);

    if (cheon === 0 || compact) {
      return `${sign}${man.toLocaleString()}만원`;
    }

    return `${sign}${man.toLocaleString()}만 ${cheon}천원`;
  }

  // 1천 이상 1만 미만
  if (absAmount >= 1_000) {
    const cheon = Math.floor(absAmount / 1_000);
    const rest = absAmount % 1_000;

    if (rest === 0 || compact) {
      return `${sign}${cheon.toLocaleString()}천원`;
    }

    return `${sign}${cheon.toLocaleString()}천 ${rest}원`;
  }

  // 1천 미만
  return `${sign}${absAmount.toLocaleString()}원`;
}

/**
 * Format percentage with sign
 */
export function formatPercent(value: number, decimals: number = 2): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format number with K/M/B suffix (for charts)
 */
export function formatCompact(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toString();
}
