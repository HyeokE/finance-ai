import { logger } from "./logger";

/**
 * Rate Limiter for API calls
 * Ensures we don't exceed API rate limits (e.g., KIS API: ~2-3 requests/second)
 */
export class RateLimiter {
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private readonly minDelayMs: number;
  private readonly maxRequestsPerSecond: number;

  /**
   * @param maxRequestsPerSecond - Maximum requests allowed per second (default: 2 for KIS API)
   */
  constructor(maxRequestsPerSecond: number = 2) {
    this.maxRequestsPerSecond = maxRequestsPerSecond;
    this.minDelayMs = 1000 / maxRequestsPerSecond; // Minimum time between requests
  }

  /**
   * Wait if necessary to respect rate limits
   * Call this BEFORE making an API request
   */
  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    // Only wait if this is not the first request and not enough time has passed
    if (this.lastRequestTime > 0 && elapsed < this.minDelayMs) {
      const delay = this.minDelayMs - elapsed;

      logger.debug(`⏱️ Rate limiter waiting ${delay}ms`, {
        elapsed_ms: elapsed,
        min_delay_ms: this.minDelayMs,
        request_count: this.requestCount,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;

    // Log stats every 10 requests
    if (this.requestCount % 10 === 0) {
      logger.info(
        `📊 Rate limiter processed ${this.requestCount} requests`,
        this.getStats()
      );
    }
  }

  /**
   * Get statistics about rate limiting
   */
  getStats(): { totalRequests: number; averageDelayMs: number } {
    return {
      totalRequests: this.requestCount,
      averageDelayMs: this.minDelayMs,
    };
  }

  /**
   * Reset rate limiter state
   */
  reset(): void {
    this.lastRequestTime = 0;
    this.requestCount = 0;
  }
}

/**
 * Global rate limiter instance for KIS API
 * KIS API limit: approximately 1-2 requests per second (conservative to avoid errors)
 * ⚠️ IMPORTANT: KIS API has strict rate limits - use 1 request/second for safety
 */
export const kisRateLimiter = new RateLimiter(1);
