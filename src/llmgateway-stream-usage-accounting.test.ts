import type { LLMGatewayChatSettings } from './types/llmgateway-chat-settings';

import {
  convertReadableStreamToArray,
  StreamingTestServer,
} from '@ai-sdk/provider-utils/test';
import { describe, expect, it } from 'vitest';

import { LLMGatewayChatLanguageModel } from './llmgateway-chat-language-model';

describe('LLMGateway Streaming Usage Accounting', () => {
  const server = new StreamingTestServer(
    'https://api.llmgateway.io/chat/completions',
  );

  server.setupTestEnvironment();

  function prepareStreamResponse(includeUsage = true) {
    server.responseChunks = [
      `data: {"id":"test-id","model":"test-model","choices":[{"delta":{"content":"Hello"},"index":0}]}\n\n`,
      `data: {"choices":[{"finish_reason":"stop","index":0}]}\n\n`,
    ];

    if (includeUsage) {
      server.responseChunks.push(
        `data: {"usage":{"prompt_tokens":10,"prompt_tokens_details":{"cached_tokens":5},"completion_tokens":20,"completion_tokens_details":{"reasoning_tokens":8},"total_tokens":30,"cost":0.0015},"choices":[]}\n\n`,
      );
    }

    server.responseChunks.push('data: [DONE]\n\n');
  }

  it('should include stream_options.include_usage in request when enabled', async () => {
    prepareStreamResponse();

    // Create model with usage accounting enabled
    const settings: LLMGatewayChatSettings = {
      usage: { include: true },
    };

    const model = new LLMGatewayChatLanguageModel('test-model', settings, {
      provider: 'llmgateway.chat',
      url: () => 'https://api.llmgateway.io/chat/completions',
      headers: () => ({}),
      compatibility: 'strict',
      fetch: global.fetch,
    });

    // Call the model with streaming
    await model.doStream({
      mode: { type: 'regular' },
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
      maxTokens: 100,
      inputFormat: 'messages',
    });

    // Verify stream options
    const requestBody = await server.getRequestBodyJson();
    expect(requestBody).toBeDefined();
    expect(requestBody.stream).toBe(true);
    expect(requestBody.stream_options).toEqual({
      include_usage: true,
    });
  });

  it('should include provider-specific metadata in finish event when usage accounting is enabled', async () => {
    prepareStreamResponse(true);

    // Create model with usage accounting enabled
    const settings: LLMGatewayChatSettings = {
      usage: { include: true },
    };

    const model = new LLMGatewayChatLanguageModel('test-model', settings, {
      provider: 'llmgateway.chat',
      url: () => 'https://api.llmgateway.io/chat/completions',
      headers: () => ({}),
      compatibility: 'strict',
      fetch: global.fetch,
    });

    // Call the model with streaming
    const result = await model.doStream({
      mode: { type: 'regular' },
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
      maxTokens: 100,
      inputFormat: 'messages',
    });

    // Read all chunks from the stream
    const chunks = await convertReadableStreamToArray(result.stream);

    // Find the finish chunk
    const finishChunk = chunks.find((chunk) => chunk.type === 'finish');
    expect(finishChunk).toBeDefined();

    // Verify metadata is included
    expect(finishChunk?.providerMetadata).toBeDefined();
    const llmgatewayData = finishChunk?.providerMetadata?.llmgateway;
    expect(llmgatewayData).toBeDefined();

    const usage = llmgatewayData?.usage;
    expect(usage).toMatchObject({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      cost: 0.0015,
      promptTokensDetails: { cachedTokens: 5 },
      completionTokensDetails: { reasoningTokens: 8 },
    });
  });

  it('should not include provider-specific metadata when usage accounting is disabled', async () => {
    prepareStreamResponse(false);

    // Create model with usage accounting disabled
    const settings: LLMGatewayChatSettings = {
      // No usage property
    };

    const model = new LLMGatewayChatLanguageModel('test-model', settings, {
      provider: 'llmgateway.chat',
      url: () => 'https://api.llmgateway.io/chat/completions',
      headers: () => ({}),
      compatibility: 'strict',
      fetch: global.fetch,
    });

    // Call the model with streaming
    const result = await model.doStream({
      mode: { type: 'regular' },
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
      maxTokens: 100,
      inputFormat: 'messages',
    });

    // Read all chunks from the stream
    const chunks = await convertReadableStreamToArray(result.stream);

    // Find the finish chunk
    const finishChunk = chunks.find((chunk) => chunk.type === 'finish');
    expect(finishChunk).toBeDefined();

    // Verify that provider metadata is not included
    expect(finishChunk?.providerMetadata?.llmgateway).toBeUndefined();
  });
});
