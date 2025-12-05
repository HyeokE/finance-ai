import { format, parse, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * Formatting utilities for numbers, dates, and currencies
 */

/**
 * Format number as Korean Won currency
 */
export function formatKRW(amount: number): string {
    return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Format number with commas
 */
export function formatNumber(num: number, decimals: number = 0): string {
    return new Intl.NumberFormat('ko-KR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num);
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 2): string {
    return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format percentage with + or - sign
 */
export function formatPercentChange(value: number, decimals: number = 2): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format date to YYYYMMDD string
 */
export function formatDateYYYYMMDD(date: Date = new Date()): string {
    return format(date, 'yyyyMMdd');
}

/**
 * Format date to YYYY-MM-DD string
 */
export function formatDateISO(date: Date = new Date()): string {
    return format(date, 'yyyy-MM-DD');
}

/**
 * Format date-time with Korean locale
 */
export function formatDateTime(date: Date = new Date()): string {
    return format(date, 'yyyy-MM-dd HH:mm:ss', { locale: ko });
}

/**
 * Parse YYYYMMDD string to Date
 */
export function parseYYYYMMDD(dateStr: string): Date {
    return parse(dateStr, 'yyyyMMdd', new Date());
}

/**
 * Get relative time string (e.g., "3 minutes ago")
 */
export function formatRelativeTime(date: Date): string {
    return formatDistanceToNow(date, {
        addSuffix: true,
        locale: ko,
    });
}

/**
 * Get today's date in YYYYMMDD format
 */
export function getToday(): string {
    return formatDateYYYYMMDD();
}

/**
 * Get N days ago date in YYYYMMDD format
 */
export function getDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return formatDateYYYYMMDD(date);
}

/**
 * Truncate string to specified length
 */
export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Format large numbers to K, M, B notation
 */
export function formatLargeNumber(num: number): string {
    if (num >= 1_000_000_000) {
        return `${(num / 1_000_000_000).toFixed(1)}B`;
    }
    if (num >= 1_000_000) {
        return `${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
        return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toString();
}
