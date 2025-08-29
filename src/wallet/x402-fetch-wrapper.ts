/**
 * X402 fetch wrapper - handles automatic payment flow
 */

import type { Account } from 'viem';
import type { DreamsRouterPaymentConfig, SolanaSigner } from '../types';
import type { X402PaymentRequirements } from './x402-types';
import { PaymentCache } from '../utils/payment-cache';
import { generateX402PaymentFromRequirement } from './x402-payment-utils';
import { generateSolanaX402PaymentFromRequirement } from './x402-solana-utils';

export interface X402FetchWrapperOptions {
  baseFetch?: typeof fetch;
  payment?: DreamsRouterPaymentConfig;
  signer?: Account;
  solanaSigner?: SolanaSigner;
}

export class X402FetchWrapper {
  private cache = new PaymentCache();

  constructor(private options: X402FetchWrapperOptions) {}

  /**
   * Merge headers from different sources
   */
  private mergeHeaders(
    base: HeadersInit | undefined,
    extra: Record<string, string>
  ): Record<string, string> {
    const out: Record<string, string> = {};
    if (base instanceof Headers) {
      base.forEach((v, k) => (out[k] = v));
    } else if (Array.isArray(base)) {
      for (const [k, v] of base) out[k] = v;
    } else if (base) {
      Object.assign(out, base as Record<string, string>);
    }
    Object.assign(out, extra);
    return out;
  }

  /**
   * Parse payment requirements from 402 response
   */
  private async parseRequirementFromResponse(
    res: Response
  ): Promise<X402PaymentRequirements | null> {
    const header = res.headers.get('x-payment-required');
    if (header) {
      try {
        return JSON.parse(header) as X402PaymentRequirements;
      } catch {}
    }

    return null;
  }

  /**
   * Generate x402 payment from requirements
   */
  private async generatePayment(
    requirement: X402PaymentRequirements
  ): Promise<string | null> {
    try {
      if (requirement.network.startsWith('solana')) {
        if (!this.options.solanaSigner) {
          throw new Error('Solana signer is required for SOL payments');
        }
        return await generateSolanaX402PaymentFromRequirement(
          requirement,
          this.options.solanaSigner
        );
      } else {
        if (!this.options.signer) {
          throw new Error('EVM signer is required for EVM payments');
        }
        return await generateX402PaymentFromRequirement(
          this.options.signer,
          requirement,
          { validityDuration: this.options.payment?.validityDuration }
        );
      }
    } catch (err) {
      console.error('Failed to generate x402 payment:', err);
      return null;
    }
  }

  /**
   * Convert URL/Request to string for cache key generation
   */
  private getUrlString(url: string | URL | Request): string {
    if (typeof url === 'string') return url;
    if (url instanceof URL) return url.toString();
    if (url instanceof Request) return url.url;
    return String(url);
  }

  /**
   * Try to use cached payment requirement for eager payment
   */
  private async tryEagerPayment(
    url: string | URL | Request,
    init?: RequestInit
  ): Promise<{ url: string | URL | Request; init?: RequestInit } | null> {
    if (!this.options.payment || this.options.payment.mode !== 'eager') {
      return null;
    }

    const urlString = this.getUrlString(url);
    const cached = this.cache.get(
      urlString,
      init,
      this.options.payment.network
    );
    if (!cached) {
      return null;
    }

    const x402Payment = await this.generatePayment(cached);
    if (!x402Payment) {
      return null;
    }

    const headers = this.mergeHeaders(init?.headers, {
      'x-payment': x402Payment,
    });
    return { url, init: { ...init, headers } };
  }

  /**
   * Main fetch wrapper that handles x402 flow
   */
  async fetch(
    url: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> {
    const baseFetch = this.options.baseFetch || fetch;
    let headers = this.mergeHeaders(init?.headers, {});

    // Add preferred network hint if configured
    if (this.options.payment?.network && !headers['x-payment-network']) {
      headers['x-payment-network'] = this.options.payment.network;
    }

    // Try eager payment first
    const eagerResult = await this.tryEagerPayment(url, { ...init, headers });
    let firstResponse: Response;

    if (eagerResult) {
      firstResponse = await baseFetch(eagerResult.url, eagerResult.init);
    } else {
      firstResponse = await baseFetch(url, { ...init, headers });
    }

    // If not 402, return as-is
    if (firstResponse.status !== 402) {
      return firstResponse;
    }

    // Parse payment requirements
    const requirement = await this.parseRequirementFromResponse(firstResponse);
    if (!requirement) {
      return firstResponse; // Can't handle this 402
    }

    // Generate payment
    const x402Payment = await this.generatePayment(requirement);
    if (!x402Payment) {
      return firstResponse; // Payment generation failed
    }

    // Cache requirement for future use
    const urlString = this.getUrlString(url);
    this.cache.set(
      urlString,
      requirement,
      init,
      this.options.payment?.network,
      this.options.payment?.validityDuration
    );

    // Retry with payment
    const retryHeaders = this.mergeHeaders(init?.headers, {
      'x-payment': x402Payment,
    });

    return baseFetch(url, { ...init, headers: retryHeaders });
  }

  /**
   * Clear payment cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size for testing
   */
  getCacheSize(): number {
    return this.cache.size();
  }
}
