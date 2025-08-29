/**
 * Tests for X402FetchWrapper
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { X402FetchWrapper } from '../wallet/x402-fetch-wrapper';
import type { Account } from 'viem';
import type { X402PaymentRequirements } from '../wallet/x402-types';

describe('X402FetchWrapper', () => {
  let mockAccount: Account;
  let mockFetch: ReturnType<typeof vi.fn>;
  let wrapper: X402FetchWrapper;

  const mockRequirement: X402PaymentRequirements = {
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

  beforeEach(() => {
    mockAccount = {
      address: '0x1234567890123456789012345678901234567890',
      signTypedData: vi.fn().mockResolvedValue('0x123456789abcdef'),
      type: 'local',
    } as any;

    mockFetch = vi.fn();

    wrapper = new X402FetchWrapper({
      baseFetch: mockFetch,
      signer: mockAccount,
      payment: {
        network: 'base-sepolia',
        validityDuration: 600,
        mode: 'lazy',
      },
    });

    // Mock the payment generation functions
    vi.mock('./x402-payment-utils', () => ({
      generateX402PaymentFromRequirement: vi
        .fn()
        .mockResolvedValue('mock-x402-payment'),
    }));
  });

  it('should pass through non-402 responses', async () => {
    const mockResponse = new Response('success', { status: 200 });
    mockFetch.mockResolvedValue(mockResponse);

    const result = await wrapper.fetch('http://localhost:8080/test');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toBe(mockResponse);
  });

  it('should handle 402 response without payment requirements', async () => {
    const mock402Response = new Response('Payment Required', {
      status: 402,
      headers: {},
    });
    mockFetch.mockResolvedValue(mock402Response);

    const result = await wrapper.fetch('http://localhost:8080/test');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toBe(mock402Response);
  });

  it('should handle 402 with x-payment-required header', async () => {
    // First call returns 402 with payment requirement
    const mock402Response = new Response('Payment Required', {
      status: 402,
      headers: {
        'x-payment-required': JSON.stringify(mockRequirement),
      },
    });

    // Second call (with payment) returns success
    const mockSuccessResponse = new Response('success', { status: 200 });

    mockFetch
      .mockResolvedValueOnce(mock402Response)
      .mockResolvedValueOnce(mockSuccessResponse);

    const result = await wrapper.fetch('http://localhost:8080/test', {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-3-haiku' }),
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);

    // First call should be without payment
    const firstCallHeaders = mockFetch.mock.calls[0]?.[1]?.headers as
      | Record<string, string>
      | undefined;
    expect(firstCallHeaders).not.toHaveProperty('x-payment');

    // Second call should have payment header
    const secondCallHeaders = mockFetch.mock.calls[1]?.[1]?.headers as
      | Record<string, string>
      | undefined;
    expect(secondCallHeaders).toHaveProperty('x-payment');

    expect(result).toBe(mockSuccessResponse);
  });

  it('should add preferred network header', async () => {
    const mockResponse = new Response('success', { status: 200 });
    mockFetch.mockResolvedValue(mockResponse);

    await wrapper.fetch('http://localhost:8080/test');

    const callHeaders = mockFetch.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(callHeaders['x-payment-network']).toBe('base-sepolia');
  });

  it('should merge headers correctly', async () => {
    const mockResponse = new Response('success', { status: 200 });
    mockFetch.mockResolvedValue(mockResponse);

    await wrapper.fetch('http://localhost:8080/test', {
      headers: {
        'Content-Type': 'application/json',
        'Custom-Header': 'test-value',
      },
    });

    const callHeaders = mockFetch.mock.calls[0]?.[1]?.headers as
      | Record<string, string>
      | undefined;
    expect(callHeaders?.['Content-Type']).toBe('application/json');
    expect(callHeaders?.['Custom-Header']).toBe('test-value');
    expect(callHeaders?.['x-payment-network']).toBe('base-sepolia');
  });

  it('should handle payment generation failure', async () => {
    // Mock payment generation to fail
    const { generateX402PaymentFromRequirement } = await import(
      './x402-payment-utils'
    );
    vi.mocked(generateX402PaymentFromRequirement).mockResolvedValue(null);

    const mock402Response = new Response('Payment Required', {
      status: 402,
      headers: {
        'x-payment-required': JSON.stringify(mockRequirement),
      },
    });

    mockFetch.mockResolvedValue(mock402Response);

    const result = await wrapper.fetch('http://localhost:8080/test');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toBe(mock402Response);
  });

  it('should cache payment requirements', async () => {
    const mock402Response = new Response('Payment Required', {
      status: 402,
      headers: {
        'x-payment-required': JSON.stringify(mockRequirement),
      },
    });

    const mockSuccessResponse = new Response('success', { status: 200 });

    mockFetch
      .mockResolvedValueOnce(mock402Response)
      .mockResolvedValueOnce(mockSuccessResponse);

    await wrapper.fetch('http://localhost:8080/test');

    expect(wrapper.getCacheSize()).toBe(1);
  });

  it('should clear cache', async () => {
    const mock402Response = new Response('Payment Required', {
      status: 402,
      headers: {
        'x-payment-required': JSON.stringify(mockRequirement),
      },
    });

    const mockSuccessResponse = new Response('success', { status: 200 });

    mockFetch
      .mockResolvedValueOnce(mock402Response)
      .mockResolvedValueOnce(mockSuccessResponse);

    await wrapper.fetch('http://localhost:8080/test');

    expect(wrapper.getCacheSize()).toBe(1);

    wrapper.clearCache();

    expect(wrapper.getCacheSize()).toBe(0);
  });

  it('should handle URL objects', async () => {
    const mockResponse = new Response('success', { status: 200 });
    mockFetch.mockResolvedValue(mockResponse);

    const url = new URL('http://localhost:8080/test');
    const result = await wrapper.fetch(url);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toBe(mockResponse);
  });

  it('should handle Request objects', async () => {
    const mockResponse = new Response('success', { status: 200 });
    mockFetch.mockResolvedValue(mockResponse);

    const request = new Request('http://localhost:8080/test', {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-3-haiku' }),
    });
    const result = await wrapper.fetch(request);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toBe(mockResponse);
  });
});
