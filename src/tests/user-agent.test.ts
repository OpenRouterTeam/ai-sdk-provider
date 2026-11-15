import {
  embed,
  experimental_evaluate as evaluate,
  generateImage,
  generateText,
  experimental_generateVideo as generateVideo,
  rerank,
  streamText,
} from 'ai';
import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../provider';
import { VERSION } from '../version';

const PROVIDER_USER_AGENT = `ai-sdk/openrouter/${VERSION}`;
const AI_USER_AGENT = /\bai\/\d+\.\d+\.\d+/;

const CHAT_RESPONSE = {
  id: 'chatcmpl-1',
  model: 'openai/gpt-4o-mini',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'Hello' },
      finish_reason: 'stop',
    },
  ],
};

const RESPONSES: Record<string, unknown> = {
  '/api/v1/chat/completions': CHAT_RESPONSE,
  '/api/v1/completions': {
    id: 'cmpl-1',
    model: 'openai/gpt-3.5-turbo-instruct',
    choices: [{ index: 0, text: 'Hello', finish_reason: 'stop' }],
  },
  '/api/v1/embeddings': {
    object: 'list',
    data: [{ object: 'embedding', embedding: [0.1, 0.2], index: 0 }],
    model: 'openai/text-embedding-3-small',
  },
  '/api/v1/rerank': {
    model: 'cohere/rerank-v3.5',
    results: [{ index: 0, relevance_score: 0.9 }],
  },
  '/api/v1/images': {
    created: 1,
    data: [{ b64_json: 'iVBORw0KGgo=' }],
  },
  '/api/alpha/decisions': {
    id: 'gen-dec-1',
    model: 'typesafe/jev-1.13',
    answers: { q: { type: 'noul', noul: 0.5 } },
  },
};

function createProvider() {
  const userAgents: string[] = [];
  const provider = createOpenRouter({
    apiKey: 'test-api-key',
    fetch: async (input, init) => {
      userAgents.push(new Headers(init?.headers).get('user-agent') ?? '');
      const path = new URL(String(input)).pathname;
      const body = RESPONSES[path];
      if (body === undefined) {
        return new Response(
          JSON.stringify({ error: { message: 'Not found', code: 400 } }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  return { provider, userAgents };
}

function expectBothUserAgents(userAgent: string | undefined) {
  expect(userAgent).toMatch(AI_USER_AGENT);
  expect(userAgent).toContain(PROVIDER_USER_AGENT);
}

describe('user agent through the AI SDK', () => {
  it('keeps the provider identifier for generateText with a chat model', async () => {
    const { provider, userAgents } = createProvider();
    await generateText({
      model: provider.chat('openai/gpt-4o-mini'),
      prompt: 'Hi',
    });
    expectBothUserAgents(userAgents[0]);
  });

  it('keeps the provider identifier for streamText with a chat model', async () => {
    const { provider, userAgents } = createProvider();
    const result = streamText({
      model: provider.chat('openai/gpt-4o-mini'),
      prompt: 'Hi',
      onError: () => {},
    });
    await result.consumeStream();
    // `ai` 7.0.103 sends no `ai/<version>` user agent for streamText.
    expect(userAgents[0]).toContain(PROVIDER_USER_AGENT);
  });

  it('keeps the provider identifier for generateText with a completion model', async () => {
    const { provider, userAgents } = createProvider();
    await generateText({
      model: provider.completion('openai/gpt-3.5-turbo-instruct'),
      prompt: 'Hi',
    });
    expectBothUserAgents(userAgents[0]);
  });

  it('keeps the provider identifier for embed', async () => {
    const { provider, userAgents } = createProvider();
    await embed({
      model: provider.embeddingModel('openai/text-embedding-3-small'),
      value: 'Hi',
    });
    expectBothUserAgents(userAgents[0]);
  });

  it('keeps the provider identifier for rerank', async () => {
    const { provider, userAgents } = createProvider();
    await rerank({
      model: provider.rerankingModel('cohere/rerank-v3.5'),
      query: 'Hi',
      documents: ['a'],
    });
    // `ai` 7.0.103 sends no `ai/<version>` user agent for rerank.
    expect(userAgents[0]).toContain(PROVIDER_USER_AGENT);
  });

  it('keeps the provider identifier for generateImage', async () => {
    const { provider, userAgents } = createProvider();
    await generateImage({
      model: provider.imageModel('openai/gpt-image-1'),
      prompt: 'A cat',
    });
    expectBothUserAgents(userAgents[0]);
  });

  it('keeps the provider identifier for generateVideo', async () => {
    const { provider, userAgents } = createProvider();
    // The mocked submit request fails; only its headers matter here.
    await expect(
      generateVideo({
        model: provider.videoModel('google/veo-3'),
        prompt: 'A cat',
        maxRetries: 0,
      }),
    ).rejects.toThrow();
    expectBothUserAgents(userAgents[0]);
  });

  it('keeps the provider identifier for evaluate', async () => {
    const { provider, userAgents } = createProvider();
    await evaluate({
      model: provider.decisionModel('typesafe/jev-1.13'),
      state: 'x',
      questions: { q: { type: 'boolean', instructions: 'Is it?' } },
    });
    expectBothUserAgents(userAgents[0]);
  });

  it('sends a custom call-level User-Agent verbatim on a direct model call', async () => {
    const { provider, userAgents } = createProvider();
    await provider.chat('openai/gpt-4o-mini').doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      headers: { 'user-agent': 'my-app/1.0' },
    });
    expect(userAgents[0]).toMatch(/^my-app\/1\.0\b/);
    expect(userAgents[0]).not.toContain(PROVIDER_USER_AGENT);
  });

  it('still sends a user-specified provider User-Agent through generateText', async () => {
    const userAgents: string[] = [];
    const provider = createOpenRouter({
      apiKey: 'test-api-key',
      headers: { 'User-Agent': 'my-app/1.0' },
      fetch: async (_input, init) => {
        userAgents.push(new Headers(init?.headers).get('user-agent') ?? '');
        return new Response(JSON.stringify(CHAT_RESPONSE), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    await generateText({
      model: provider.chat('openai/gpt-4o-mini'),
      prompt: 'Hi',
    });
    expect(userAgents[0]).not.toContain(PROVIDER_USER_AGENT);
  });
});
