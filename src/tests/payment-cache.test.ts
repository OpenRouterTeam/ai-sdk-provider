/**
 * Tests for PaymentCache
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PaymentCache } from '../utils/payment-cache';
import type { X402PaymentRequirements } from '../wallet/x402-types';

describe('PaymentCache', () => {
  let cache: PaymentCache;
  let mockRequirement: X402PaymentRequirements;

  beforeEach(() => {
    cache = new PaymentCache();
    mockRequirement = {
      scheme: 'exact',
      network: 'base-sepolia',
      maxAmountRequired: '1000000',
      resource: '/v1/chat/completions',
      description: 'Test payment',
      mimeType: 'application/json',
      payTo: '0x1234567890123456789012345678901234567890',
      maxTimeoutSeconds: 300,
      asset: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      extra: { name: 'USDC', version: '2' },
    };
  });

  it('should cache and retrieve requirements', () => {
    const url = 'http://localhost:8080/v1/chat/completions';
    const init = {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-3-haiku' }),
    };

    // Should be empty initially
    expect(cache.get(url, init, 'base-sepolia')).toBeNull();
    expect(cache.size()).toBe(0);

    // Cache a requirement
    cache.set(url, mockRequirement, init, 'base-sepolia', 600);

    // Should be able to retrieve it
    const cached = cache.get(url, init, 'base-sepolia');
    expect(cached).toEqual(mockRequirement);
    expect(cache.size()).toBe(1);
  });

  it('should generate different keys for different models', () => {
    const url = 'http://localhost:8080/v1/chat/completions';
    const init1 = {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-3-haiku' }),
    };
    const init2 = {
      method: 'POST',
      body: JSON.stringify({ model: 'gpt-4' }),
    };

    cache.set(url, mockRequirement, init1, 'base-sepolia', 600);
    cache.set(
      url,
      { ...mockRequirement, maxAmountRequired: '2000000' },
      init2,
      'base-sepolia',
      600
    );

    expect(cache.size()).toBe(2);

    const cached1 = cache.get(url, init1, 'base-sepolia');
    const cached2 = cache.get(url, init2, 'base-sepolia');

    expect(cached1?.maxAmountRequired).toBe('1000000');
    expect(cached2?.maxAmountRequired).toBe('2000000');
  });

  it('should handle expiration', async () => {
    const url = 'http://localhost:8080/v1/chat/completions';

    // Cache with very short TTL
    cache.set(url, mockRequirement, undefined, 'base-sepolia', 0.001); // 1ms

    // Should be available immediately
    expect(cache.get(url, undefined, 'base-sepolia')).toEqual(mockRequirement);

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should be null after expiration
    expect(cache.get(url, undefined, 'base-sepolia')).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it('should clear all entries', () => {
    cache.set('url1', mockRequirement, undefined, 'base-sepolia', 600);
    cache.set('url2', mockRequirement, undefined, 'base-sepolia', 600);

    expect(cache.size()).toBe(2);

    cache.clear();

    expect(cache.size()).toBe(0);
    expect(cache.get('url1', undefined, 'base-sepolia')).toBeNull();
    expect(cache.get('url2', undefined, 'base-sepolia')).toBeNull();
  });

  it('should clean up expired entries', async () => {
    const url1 = 'http://localhost:8080/url1';
    const url2 = 'http://localhost:8080/url2';

    // Cache one with short TTL, one with long TTL
    cache.set(url1, mockRequirement, undefined, 'base-sepolia', 0.001); // 1ms
    cache.set(url2, mockRequirement, undefined, 'base-sepolia', 600); // 10 minutes

    expect(cache.size()).toBe(2);

    // Wait for first to expire
    await new Promise(resolve => setTimeout(resolve, 50));

    // Manual cleanup
    cache.cleanup();

    expect(cache.size()).toBe(1);
    expect(cache.get(url1, undefined, 'base-sepolia')).toBeNull();
    expect(cache.get(url2, undefined, 'base-sepolia')).toEqual(mockRequirement);
  });

  it('should handle malformed URLs gracefully', () => {
    const badUrl = 'not-a-url';

    expect(() => {
      cache.set(badUrl, mockRequirement, undefined, 'base-sepolia', 600);
    }).not.toThrow();

    expect(() => {
      cache.get(badUrl, undefined, 'base-sepolia');
    }).not.toThrow();
  });

  it('should handle malformed request body gracefully', () => {
    const url = 'http://localhost:8080/v1/chat/completions';
    const badInit = {
      method: 'POST',
      body: 'not-json',
    };

    expect(() => {
      cache.set(url, mockRequirement, badInit, 'base-sepolia', 600);
    }).not.toThrow();

    expect(() => {
      cache.get(url, badInit, 'base-sepolia');
    }).not.toThrow();
  });
});
