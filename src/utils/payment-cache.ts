/**
 * Payment requirements cache for x402 providers
 */

import type { X402PaymentRequirements } from '../wallet/x402-types';

export interface CachedRequirement {
  requirement: X402PaymentRequirements;
  expiresAt: number;
}

export class PaymentCache {
  private cache = new Map<string, CachedRequirement>();

  /**
   * Generate cache key from URL and request
   */
  private getCacheKey(url: string, init?: RequestInit): string {
    try {
      const u = new URL(url);
      const path = u.pathname;
      let model = '';
      if (init?.body && typeof init.body === 'string') {
        try {
          const parsed = JSON.parse(init.body);
          model = parsed?.model || '';
        } catch {}
      }
      // Network would come from payment config, passed separately
      return [u.origin, path, model].join('|');
    } catch {
      return url;
    }
  }

  /**
   * Get cached requirement if valid
   */
  get(
    url: string,
    init?: RequestInit,
    network?: string
  ): X402PaymentRequirements | null {
    const key = this.getCacheKey(url, init) + (network ? `|${network}` : '');
    const cached = this.cache.get(key);

    if (!cached || Date.now() > cached.expiresAt) {
      if (cached) {
        this.cache.delete(key); // Clean up expired entries
      }
      return null;
    }

    return cached.requirement;
  }

  /**
   * Cache a payment requirement
   */
  set(
    url: string,
    requirement: X402PaymentRequirements,
    init?: RequestInit,
    network?: string,
    validityDuration?: number
  ): void {
    const key = this.getCacheKey(url, init) + (network ? `|${network}` : '');

    const ttl = Math.floor(
      1000 *
        Math.min(
          validityDuration ?? 600,
          requirement.maxTimeoutSeconds ?? 600
        ) *
        0.9 // 90% of validity to avoid expiration mid-flight
    );

    this.cache.set(key, {
      requirement,
      expiresAt: Date.now() + Math.max(10_000, ttl), // Minimum 10 seconds
    });
  }

  /**
   * Clear all cached requirements
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size for testing/debugging
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}
