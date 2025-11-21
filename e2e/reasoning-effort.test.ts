import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Reasoning effort parameter', () => {
  it('should work with reasoning.effort set to low', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = openrouter('anthropic/claude-sonnet-4', {
      usage: {
        include: true,
      },
    });

    const response = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: 'What is 2+2? Think through this step by step.',
        },
      ],
      providerOptions: {
        openrouter: {
          reasoning: {
            effort: 'low',
          },
        },
      },
    });

    expect(response.text).toBeTruthy();
    expect(response.text.length).toBeGreaterThan(0);

    expect(response.usage.totalTokens).toBeGreaterThan(0);

    expect(response.providerMetadata?.openrouter).toMatchObject({
      usage: expect.objectContaining({
        promptTokens: expect.any(Number),
        completionTokens: expect.any(Number),
        totalTokens: expect.any(Number),
      }),
    });
  });

  it('should work with reasoning.effort set to medium', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = openrouter('anthropic/claude-sonnet-4', {
      usage: {
        include: true,
      },
    });

    const response = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: 'What is the capital of France? Explain your reasoning.',
        },
      ],
      providerOptions: {
        openrouter: {
          reasoning: {
            effort: 'medium',
          },
        },
      },
    });

    expect(response.text).toBeTruthy();
    expect(response.text.length).toBeGreaterThan(0);

    expect(response.usage.totalTokens).toBeGreaterThan(0);

    expect(response.providerMetadata?.openrouter).toMatchObject({
      usage: expect.objectContaining({
        promptTokens: expect.any(Number),
        completionTokens: expect.any(Number),
        totalTokens: expect.any(Number),
      }),
    });
  });

  it('should work with reasoning.effort set to high', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = openrouter('anthropic/claude-sonnet-4', {
      usage: {
        include: true,
      },
    });

    const response = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content:
            'Solve this problem: If a train leaves station A at 60 mph and another train leaves station B at 80 mph, and they are 420 miles apart, when will they meet?',
        },
      ],
      providerOptions: {
        openrouter: {
          reasoning: {
            effort: 'high',
          },
        },
      },
    });

    expect(response.text).toBeTruthy();
    expect(response.text.length).toBeGreaterThan(0);

    expect(response.usage.totalTokens).toBeGreaterThan(0);

    expect(response.providerMetadata?.openrouter).toMatchObject({
      usage: expect.objectContaining({
        promptTokens: expect.any(Number),
        completionTokens: expect.any(Number),
        totalTokens: expect.any(Number),
      }),
    });
  });
});
