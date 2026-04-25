/**
 * Regression test for GitHub issue #483
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/483
 *
 * Issue: `response_format.json_schema.strict` is hardcoded to `true` in the
 * outbound payload, with no setting to opt out. For models whose downstream
 * providers don't advertise support for strict mode, OpenRouter returns
 * HTTP 404 ("No endpoints available matching your guardrail restrictions
 * and data policy") because the strict flag eliminates every eligible
 * endpoint.
 *
 * Expected behavior after fix: the SDK still defaults `strict` to `true`
 * (backward compatible), but a new `structuredOutputs.strict` setting on
 * `OpenRouterChatSettings` lets users override the value (in particular
 * set it to `false`) so they can route to providers that don't implement
 * strict json_schema.
 */
import type { LanguageModelV3Prompt } from '@ai-sdk/provider';
import type { JSONSchema7 } from 'json-schema';

import { createTestServer } from '@ai-sdk/test-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createOpenRouter } from '@/src';

const TEST_SCHEMA: JSONSchema7 = {
  type: 'object',
  properties: { items: { type: 'array', items: { type: 'string' } } },
  required: ['items'],
  additionalProperties: false,
};

const TEST_PROMPT: LanguageModelV3Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'hi' }] },
];

function prepareJsonResponse(
  content: string,
  server: ReturnType<typeof createTestServer>,
) {
  server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
    type: 'json-value',
    body: {
      id: 'x',
      object: 'chat.completion',
      created: 0,
      model: 'moonshotai/kimi-k2.6',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    },
  };
}

describe('Issue #483: response_format strict should be configurable', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: { type: 'json-value', body: {} },
    },
  });
  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  const provider = createOpenRouter({ apiKey: 'test-key' });

  it('defaults strict to true (backward compatible)', async () => {
    prepareJsonResponse('{"items":[]}', server);
    const model = provider.chat('moonshotai/kimi-k2.6');
    await model.doGenerate({
      prompt: TEST_PROMPT,
      responseFormat: { type: 'json', schema: TEST_SCHEMA, name: 'Colors' },
    });
    const body = await server.calls[0]!.requestBodyJson;
    expect(body).toMatchObject({
      response_format: { json_schema: { strict: true } },
    });
  });

  it('allows disabling strict via structuredOutputs setting', async () => {
    prepareJsonResponse('{"items":[]}', server);
    const model = provider.chat('moonshotai/kimi-k2.6', {
      structuredOutputs: { strict: false },
    });
    await model.doGenerate({
      prompt: TEST_PROMPT,
      responseFormat: { type: 'json', schema: TEST_SCHEMA, name: 'Colors' },
    });
    const body = await server.calls[0]!.requestBodyJson;
    expect(body).toMatchObject({
      response_format: { json_schema: { strict: false } },
    });
  });

  it('allows explicit strict=true via structuredOutputs setting', async () => {
    prepareJsonResponse('{"items":[]}', server);
    const model = provider.chat('moonshotai/kimi-k2.6', {
      structuredOutputs: { strict: true },
    });
    await model.doGenerate({
      prompt: TEST_PROMPT,
      responseFormat: { type: 'json', schema: TEST_SCHEMA, name: 'Colors' },
    });
    const body = await server.calls[0]!.requestBodyJson;
    expect(body).toMatchObject({
      response_format: { json_schema: { strict: true } },
    });
  });

  it('treats structuredOutputs.strict=undefined as default (true)', async () => {
    prepareJsonResponse('{"items":[]}', server);
    const model = provider.chat('moonshotai/kimi-k2.6', {
      structuredOutputs: { strict: undefined },
    });
    await model.doGenerate({
      prompt: TEST_PROMPT,
      responseFormat: { type: 'json', schema: TEST_SCHEMA, name: 'Colors' },
    });
    const body = await server.calls[0]!.requestBodyJson;
    expect(body).toMatchObject({
      response_format: { json_schema: { strict: true } },
    });
  });

  it('treats empty structuredOutputs object as default (true)', async () => {
    prepareJsonResponse('{"items":[]}', server);
    const model = provider.chat('moonshotai/kimi-k2.6', {
      structuredOutputs: {},
    });
    await model.doGenerate({
      prompt: TEST_PROMPT,
      responseFormat: { type: 'json', schema: TEST_SCHEMA, name: 'Colors' },
    });
    const body = await server.calls[0]!.requestBodyJson;
    expect(body).toMatchObject({
      response_format: { json_schema: { strict: true } },
    });
  });

  it('preserves responseFormat.name and description alongside strict override', async () => {
    prepareJsonResponse('{"items":[]}', server);
    const model = provider.chat('moonshotai/kimi-k2.6', {
      structuredOutputs: { strict: false },
    });
    await model.doGenerate({
      prompt: TEST_PROMPT,
      responseFormat: {
        type: 'json',
        schema: TEST_SCHEMA,
        name: 'PersonResponse',
        description: 'A person object',
      },
    });
    const body = await server.calls[0]!.requestBodyJson;
    expect(body).toMatchObject({
      response_format: {
        type: 'json_schema',
        json_schema: {
          schema: TEST_SCHEMA,
          strict: false,
          name: 'PersonResponse',
          description: 'A person object',
        },
      },
    });
  });

  it('does not emit response_format when responseFormat is omitted, regardless of structuredOutputs', async () => {
    prepareJsonResponse('hello', server);
    const model = provider.chat('moonshotai/kimi-k2.6', {
      structuredOutputs: { strict: false },
    });
    await model.doGenerate({ prompt: TEST_PROMPT });
    const body = await server.calls[0]!.requestBodyJson;
    expect(body).not.toHaveProperty('response_format');
  });

  it('still emits json_object (no strict) when responseFormat.type=json without schema', async () => {
    prepareJsonResponse('{"items":[]}', server);
    const model = provider.chat('moonshotai/kimi-k2.6', {
      structuredOutputs: { strict: false },
    });
    await model.doGenerate({
      prompt: TEST_PROMPT,
      responseFormat: { type: 'json' },
    });
    const body = await server.calls[0]!.requestBodyJson;
    expect(body).toMatchObject({
      response_format: { type: 'json_object' },
    });
    // json_object branch never carries `strict`; structuredOutputs.strict
    // should be a no-op for it.
    expect(body).not.toHaveProperty('response_format.json_schema');
  });
});
