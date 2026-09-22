/**
 * Regression test for GitHub issue #540
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/540
 *
 * Reported error: AI_InvalidPromptError: Invalid prompt: The messages must be a ModelMessage[]. content[0].providerOptions.openrouter.reasoning_details[0].signature → "Invalid input: expected string, received undefined"
 * Model: z-ai/glm-5.3-flash
 *
 * This test verifies that streaming reasoning_details accumulation does not
 * assign `signature: undefined` or `format: undefined` as own properties, which
 * would break AI SDK prompt validation when echoed in multi-turn conversations.
 */
import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import type { UIMessage } from 'ai';

import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { convertToModelMessages, stepCountIs, streamText, tool } from 'ai';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createOpenRouter } from '@/src';
import { ReasoningDetailType } from '@/src/schemas/reasoning-details';

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'hi' }] },
];

type AccumulatedDetail = {
  type: string;
  text?: string;
  summary?: string;
  data?: string;
  id?: string;
  index?: number;
  format?: string;
  signature?: string;
};

describe('Issue #540: streaming reasoning_details accumulation must not assign undefined keys', () => {
  it('does not assign signature: undefined when merging reasoning.text deltas without signature', async () => {
    const chunks = [
      {
        id: '1',
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant',
              reasoning_details: [
                {
                  type: ReasoningDetailType.Text,
                  text: 'think',
                  format: 'unknown',
                  index: 0,
                },
              ],
            },
            finish_reason: null,
          },
        ],
      },
      {
        id: '1',
        choices: [
          {
            index: 0,
            delta: {
              reasoning_details: [
                {
                  type: ReasoningDetailType.Text,
                  text: ' more',
                  format: 'unknown',
                  index: 0,
                },
              ],
            },
            finish_reason: null,
          },
        ],
      },
      {
        id: '1',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'myTool',
                    arguments: '{"a":1}',
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      },
      {
        id: '1',
        choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      },
    ];

    const fakeFetch = async () =>
      new Response(
        chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') +
          'data: [DONE]\n\n',
        { headers: { 'content-type': 'text/event-stream' } },
      );

    const openrouter = createOpenRouter({ apiKey: 'k', fetch: fakeFetch });
    const result = streamText({
      model: openrouter('z-ai/glm-5.3-flash'),
      messages: [{ role: 'user', content: 'hi' }],
      tools: {
        myTool: tool({
          inputSchema: z.object({ a: z.number() }),
          execute: async () => 'ok',
        }),
      },
      stopWhen: stepCountIs(1),
    });

    let meta:
      | { openrouter?: { reasoning_details?: AccumulatedDetail[] } }
      | undefined;
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'tool-call') {
        meta = chunk.providerMetadata as typeof meta;
      }
    }

    expect(meta).toBeDefined();
    const reasoningDetails = meta?.openrouter?.reasoning_details;
    expect(reasoningDetails).toHaveLength(1);
    const detail = reasoningDetails?.[0];
    expect(detail).toBeDefined();

    // Must not have an own property 'signature' with value undefined
    expect(Object.hasOwn(detail as object, 'signature')).toBe(false);

    // Verify round-trip into convertToModelMessages passes AI SDK prompt validation
    const ui: UIMessage[] = [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-myTool',
            state: 'output-available',
            toolCallId: 'call_1',
            input: { a: 1 },
            output: 'ok',
            callProviderMetadata: meta,
          },
        ],
      },
    ];

    const messages = await convertToModelMessages(ui);
    const validator = {
      specificationVersion: 'v2' as const,
      provider: 'test',
      modelId: 'fake',
      supportedUrls: {},
      async doGenerate() {
        throw new Error('REACHED_DO_GENERATE');
      },
      async doStream() {
        throw new Error('REACHED_DO_STREAM');
      },
    };

    // Prompt validation runs before doStream; it should reach doStream and not throw AI_InvalidPromptError
    await expect(
      (async () => {
        const validatedResult = streamText({
          model: validator,
          messages,
        });
        for await (const chunk of validatedResult.fullStream) {
          if (chunk.type === 'error') {
            throw chunk.error;
          }
        }
      })(),
    ).rejects.toThrow('REACHED_DO_STREAM');
  });

  it('does not assign format: undefined or signature: undefined in doStream finish event', async () => {
    const chunks = [
      `data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"z-ai/glm-5.3-flash","choices":[{"index":0,"delta":{"role":"assistant","content":"","reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"part1","index":0}]},"finish_reason":null}]}\n\n`,
      `data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"z-ai/glm-5.3-flash","choices":[{"index":0,"delta":{"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"part2","index":0}]},"finish_reason":null}]}\n\n`,
      `data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"z-ai/glm-5.3-flash","choices":[{"index":0,"delta":{"content":"done"},"finish_reason":null}]}\n\n`,
      `data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"z-ai/glm-5.3-flash","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n`,
      `data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"z-ai/glm-5.3-flash","choices":[],"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}\n\n`,
      'data: [DONE]\n\n',
    ];

    const fakeFetch = async () =>
      new Response(chunks.join(''), {
        headers: { 'content-type': 'text/event-stream' },
      });

    const openrouter = createOpenRouter({ apiKey: 'k', fetch: fakeFetch });
    const model = openrouter.chat('z-ai/glm-5.3-flash');
    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    const finishEvent = elements.find((el) => el.type === 'finish');
    expect(finishEvent).toBeDefined();

    const finishMeta = finishEvent?.providerMetadata as
      | { openrouter?: { reasoning_details?: AccumulatedDetail[] } }
      | undefined;
    expect(finishMeta).toBeDefined();

    const detail = finishMeta?.openrouter?.reasoning_details?.[0];
    expect(detail).toBeDefined();
    expect(detail?.text).toBe('part1part2');
    expect(Object.hasOwn(detail as object, 'format')).toBe(false);
    expect(Object.hasOwn(detail as object, 'signature')).toBe(false);
  });
});
