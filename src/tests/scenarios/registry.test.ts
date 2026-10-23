// Scenarios: #549 (specificationVersion + embeddingModel), #553 (reranking),
// #550 (isByok) through createProviderRegistry and the public `ai` APIs.
import {
  createProviderRegistry,
  embed,
  embedMany,
  generateText,
  rerank,
  streamText,
} from 'ai';
import { describe, expect, it } from 'vitest';
import { OpenRouterChatLanguageModel } from '../../chat';
import {
  chatChunk,
  chatCompletion,
  jsonResponse,
  mockProvider,
  sseResponse,
  USAGE,
} from './helpers';

const EMBEDDING_RESPONSE = {
  object: 'list',
  data: [{ object: 'embedding', embedding: [0.1, 0.2, 0.3], index: 0 }],
  model: 'openai/text-embedding-3-small',
  usage: { prompt_tokens: 3, total_tokens: 3 },
};

const RERANK_RESPONSE = {
  id: 'rerank-1',
  model: 'cohere/rerank-v3.5',
  provider: 'Cohere',
  results: [
    { index: 1, relevance_score: 0.91 },
    { index: 0, relevance_score: 0.07 },
  ],
  usage: { search_units: 1, total_tokens: 42, cost: 0.00002 },
};

function registryFor(
  responder: Parameters<typeof mockProvider>[0],
  settings?: Parameters<typeof mockProvider>[1],
) {
  const { provider, calls } = mockProvider(responder, settings);
  const registry = createProviderRegistry({ openrouter: provider });
  return { registry, provider, calls };
}

describe('registry: provider shape (#549)', () => {
  it('declares specificationVersion v4 and exposes embeddingModel', () => {
    const { provider } = mockProvider(() => jsonResponse({}));
    expect(provider.specificationVersion).toBe('v4');
    expect(typeof provider.embeddingModel).toBe('function');
    expect(
      provider.embeddingModel('openai/text-embedding-3-small').modelId,
    ).toBe('openai/text-embedding-3-small');
  });

  it('registry returns the real OpenRouter language model (no v2/v3 adapter)', () => {
    const { registry } = registryFor(() => jsonResponse({}));
    const model = registry.languageModel('openrouter:openai/gpt-4o');
    expect(model.specificationVersion).toBe('v4');
    expect(model).toBeInstanceOf(OpenRouterChatLanguageModel);
    expect(model.modelId).toBe('openai/gpt-4o');
  });

  it('generateText via registry reports usage and cost', async () => {
    const { registry, calls } = registryFor(() =>
      jsonResponse(chatCompletion({ content: 'hi' })),
    );
    const result = await generateText({
      model: registry.languageModel('openrouter:anthropic/claude-sonnet-4.5'),
      prompt: 'Hello',
    });
    expect(result.text).toBe('hi');
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(20);
    expect(result.usage.totalTokens).toBe(30);
    expect(result.providerMetadata?.openrouter?.usage).toMatchObject({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      cost: 0.0012,
    });
    expect(calls[0]?.url).toBe('https://openrouter.ai/api/v1/chat/completions');
  });
});

describe('registry: isByok (#550)', () => {
  for (const isByok of [true, false] as const) {
    it(`generateText surfaces isByok=${isByok}`, async () => {
      const { registry } = registryFor(() =>
        jsonResponse(
          chatCompletion(
            { content: 'ok' },
            { usage: { ...USAGE, is_byok: isByok } },
          ),
        ),
      );
      const result = await generateText({
        model: registry.languageModel('openrouter:openai/gpt-4o'),
        prompt: 'x',
      });
      expect(result.providerMetadata?.openrouter?.usage).toMatchObject({
        isByok,
      });
    });

    it(`streamText surfaces isByok=${isByok}`, async () => {
      const { registry } = registryFor(() =>
        sseResponse([
          chatChunk({ role: 'assistant', content: 'o' }),
          chatChunk({ content: 'k' }, { finish_reason: 'stop' }),
          chatChunk(null, {
            noChoices: true,
            usage: { ...USAGE, is_byok: isByok },
          }),
        ]),
      );
      const result = streamText({
        model: registry.languageModel('openrouter:openai/gpt-4o'),
        prompt: 'x',
      });
      expect(await result.text).toBe('ok');
      const metadata = await result.providerMetadata;
      expect(metadata?.openrouter?.usage).toMatchObject({
        isByok,
        cost: 0.0012,
      });
    });
  }

  it('omits isByok entirely when the API does not send is_byok', async () => {
    const { registry } = registryFor(() =>
      jsonResponse(chatCompletion({ content: 'ok' })),
    );
    const result = await generateText({
      model: registry.languageModel('openrouter:openai/gpt-4o'),
      prompt: 'x',
    });
    expect(result.providerMetadata?.openrouter?.usage).not.toHaveProperty(
      'isByok',
    );
  });

  it('streaming omits isByok when absent and keeps it absent for null', async () => {
    const { registry } = registryFor(() =>
      sseResponse([
        chatChunk({ content: 'ok' }, { finish_reason: 'stop' }),
        chatChunk(null, {
          noChoices: true,
          usage: { ...USAGE, is_byok: null },
        }),
      ]),
    );
    const result = streamText({
      model: registry.languageModel('openrouter:openai/gpt-4o'),
      prompt: 'x',
    });
    await result.consumeStream();
    const metadata = await result.providerMetadata;
    expect(metadata?.openrouter?.usage).not.toHaveProperty('isByok');
  });
});

describe('registry: embeddings (#549)', () => {
  it('embed() resolves through registry.embeddingModel', async () => {
    const { registry, calls } = registryFor(() =>
      jsonResponse(EMBEDDING_RESPONSE),
    );
    const { embedding, usage } = await embed({
      model: registry.embeddingModel(
        'openrouter:openai/text-embedding-3-small',
      ),
      value: 'sunny day',
    });
    expect(embedding).toEqual([0.1, 0.2, 0.3]);
    expect(usage.tokens).toBe(3);
    expect(calls[0]?.url).toBe('https://openrouter.ai/api/v1/embeddings');
    expect(calls[0]?.body).toMatchObject({
      model: 'openai/text-embedding-3-small',
      input: ['sunny day'],
    });
  });

  it('embedMany() resolves through registry.embeddingModel', async () => {
    const { registry } = registryFor(() =>
      jsonResponse({
        ...EMBEDDING_RESPONSE,
        data: [
          { object: 'embedding', embedding: [1, 0], index: 0 },
          { object: 'embedding', embedding: [0, 1], index: 1 },
        ],
      }),
    );
    const { embeddings } = await embedMany({
      model: registry.embeddingModel(
        'openrouter:openai/text-embedding-3-small',
      ),
      values: ['a', 'b'],
    });
    expect(embeddings).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });
});

describe('registry: reranking (#553)', () => {
  it('rerank() resolves through registry.rerankingModel', async () => {
    const { registry, calls } = registryFor(() =>
      jsonResponse(RERANK_RESPONSE),
    );
    const documents = ['Paris is in France.', 'Berlin is in Germany.'];
    const result = await rerank({
      model: registry.rerankingModel('openrouter:cohere/rerank-v3.5'),
      query: 'Where is Berlin?',
      documents,
      topN: 2,
    });
    expect(calls[0]?.url).toBe('https://openrouter.ai/api/v1/rerank');
    expect(calls[0]?.body).toMatchObject({
      model: 'cohere/rerank-v3.5',
      query: 'Where is Berlin?',
      documents,
      top_n: 2,
    });
    expect(result.rerankedDocuments).toEqual([
      'Berlin is in Germany.',
      'Paris is in France.',
    ]);
    expect(result.ranking[0]).toMatchObject({ originalIndex: 1, score: 0.91 });
    expect(result.providerMetadata?.openrouter).toMatchObject({
      provider: 'Cohere',
      usage: { searchUnits: 1, totalTokens: 42, cost: 0.00002 },
    });
  });

  it('rerank() with object documents keeps {text} and stringifies others', async () => {
    const { provider, calls } = mockProvider(() =>
      jsonResponse(RERANK_RESPONSE),
    );
    const result = await rerank({
      model: provider.rerankingModel('cohere/rerank-v3.5'),
      query: 'q',
      documents: [{ text: 'plain' }, { title: 'x', body: 'y' }],
    });
    expect(calls[0]?.body.documents).toEqual([
      { text: 'plain' },
      JSON.stringify({ title: 'x', body: 'y' }),
    ]);
    expect(result.ranking).toHaveLength(2);
  });

  it('rerank() merges routing settings and providerOptions', async () => {
    const { provider, calls } = mockProvider(() =>
      jsonResponse(RERANK_RESPONSE),
    );
    await rerank({
      model: provider.rerankingModel('cohere/rerank-v3.5', {
        provider: { order: ['cohere'] },
        user: 'user-1',
      }),
      query: 'q',
      documents: ['a', 'b'],
      providerOptions: { openrouter: { session_id: 's-1' } },
    });
    expect(calls[0]?.body).toMatchObject({
      provider: { order: ['cohere'] },
      user: 'user-1',
      session_id: 's-1',
    });
    expect(calls[0]?.body).not.toHaveProperty('top_n');
  });
});
