import { streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Web Search E2E Tests', () => {
  it('should handle web search with plugins configuration', async () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  const model = openrouter('anthropic/claude-3.5-sonnet', {
    plugins: [
      {
        id: 'web',
        max_results: 3,
        search_prompt: 'Find recent information about',
      },
    ],
    usage: {
      include: true,
    },
  });

  const response = streamText({
    model,
    messages: [
      {
        role: 'user',
        content: 'What are the latest developments in AI in 2024?',
      },
    ],
  });

  await response.consumeStream();
  const fullResponse = await response.text;
  
  expect(fullResponse).toBeTruthy();
  expect(fullResponse.length).toBeGreaterThan(0);

  const providerMetadata = await response.providerMetadata;
  expect(providerMetadata?.openrouter).toMatchObject({
    usage: expect.objectContaining({
      promptTokens: expect.any(Number),
      completionTokens: expect.any(Number),
      totalTokens: expect.any(Number),
    }),
  });
});

it('should handle web search with web_search_options configuration', async () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  const model = openrouter('anthropic/claude-3.5-sonnet', {
    web_search_options: {
      max_results: 5,
      search_prompt: 'Search for current information about',
    },
    usage: {
      include: true,
    },
  });

  const response = streamText({
    model,
    messages: [
      {
        role: 'user',
        content: 'What is the current weather in San Francisco?',
      },
    ],
  });

  let hasSourceContent = false;
  const sources: any[] = [];

  for await (const part of response.fullStream) {
    if (part.type === 'source') {
      hasSourceContent = true;
      sources.push(part);
    }
  }

  const fullResponse = await response.text;
  
  expect(fullResponse).toBeTruthy();
  expect(fullResponse.length).toBeGreaterThan(0);

  if (hasSourceContent) {
    expect(sources.length).toBeGreaterThan(0);
    
    sources.forEach(source => {
      expect(source).toMatchObject({
        type: 'source',
        sourceType: 'url',
        id: expect.any(String),
        url: expect.any(String),
        title: expect.any(String),
      });
      
      expect(source.url).toMatch(/^https?:\/\//);
      expect(source.title).toBeTruthy();
    });
  }

  const providerMetadata = await response.providerMetadata;
  expect(providerMetadata?.openrouter).toMatchObject({
    usage: expect.objectContaining({
      promptTokens: expect.any(Number),
      completionTokens: expect.any(Number),
      totalTokens: expect.any(Number),
    }),
  });
});

it('should handle web search citations in streaming response', async () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  const model = openrouter('anthropic/claude-3.5-sonnet', {
    plugins: [
      {
        id: 'web',
        max_results: 2,
      },
    ],
    usage: {
      include: true,
    },
  });

  const response = streamText({
    model,
    messages: [
      {
        role: 'user',
        content: 'Tell me about the latest SpaceX launch with sources.',
      },
    ],
  });

  const streamParts: Array<{ type: string; sourceType?: string; id?: string; url?: string; title?: string; text?: string; }> = [];
  
  for await (const part of response.fullStream) {
    streamParts.push(part);
  }

  const textParts = streamParts.filter(part => part.type === 'text-delta' || part.type === 'text');
  const sourceParts = streamParts.filter(part => part.type === 'source');

  expect(textParts.length).toBeGreaterThan(0);

  if (sourceParts.length > 0) {
    sourceParts.forEach(source => {
      expect(source).toMatchObject({
        type: 'source',
        sourceType: 'url',
        id: expect.any(String),
        url: expect.any(String),
        title: expect.any(String),
      });
      
      expect(source.url).toMatch(/^https?:\/\//);
      expect(source.title).toBeTruthy();
      expect(source.title?.length).toBeGreaterThan(0);
    });
  }

  const finalText = await response.text;
  expect(finalText).toBeTruthy();
  expect(finalText.length).toBeGreaterThan(0);
  });
});
