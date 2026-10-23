/**
 * #517  tool-level cache_control on an Anthropic model (cache write, then read)
 * #590/#585  assistant text-part cache control: block-array content plus
 *            tool_calls, and invalid cache control values never reach the wire
 */
import type { ModelMessage } from 'ai';

import { generateText, jsonSchema, tool } from 'ai';
import { describe, expect } from 'vitest';
import {
  assert2xx,
  HAS_KEY,
  lastBody,
  probe,
  providerFor,
} from './lib/harness';
import { MODELS } from './lib/models';

/** ~15k tokens of varied text: above Anthropic's minimum cacheable prefix. */
const LONG_TOOL_DESCRIPTION = [
  'Looks up an order by id. Validation rules follow.',
  ...Array.from(
    { length: 700 },
    (_, i) =>
      `Rule ${i}: field_${i} must match pattern p${(i * 7919) % 1000} unless region r${i % 13} applies.`,
  ),
].join(' ');

describe.skipIf(!HAS_KEY)('cache control', () => {
  probe(
    {
      id: '517-tool-cache-control',
      pr: '#517',
      title: 'tool cache_control is accepted and creates/reads a cache entry',
      model: MODELS.anthropic,
      timeoutMs: 180_000,
    },
    async ({ capture, observe, note }) => {
      // Pin one upstream so the second call can hit the first call's cache.
      const openrouter = providerFor(capture);
      const model = openrouter.chat(MODELS.anthropic, {
        provider: { order: ['anthropic'], allow_fallbacks: true },
      });
      const tools = {
        lookup_order: tool({
          description: LONG_TOOL_DESCRIPTION,
          inputSchema: jsonSchema<{ id: string }>({
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
            additionalProperties: false,
          }),
          providerOptions: {
            openrouter: { cacheControl: { type: 'ephemeral' } },
          },
        }),
      };

      const usages = [];
      for (let i = 0; i < 2; i++) {
        const result = await generateText({
          model,
          tools,
          toolChoice: 'none',
          prompt: 'Reply with the single word OK.',
          maxOutputTokens: 16,
          maxRetries: 0,
        });
        usages.push({
          inputTokens: result.usage.inputTokens,
          cacheRead: result.usage.inputTokenDetails.cacheReadTokens,
          cacheWrite: result.usage.inputTokenDetails.cacheWriteTokens,
          provider: result.providerMetadata?.openrouter?.provider,
        });
      }
      assert2xx(capture);

      const sentTool = (lastBody(capture).tools as any[])[0];
      observe({ sentToolCacheControl: sentTool?.cache_control, usages });
      expect(sentTool?.cache_control).toEqual({ type: 'ephemeral' });

      const sawCache = usages.some(
        (u) => (u.cacheRead ?? 0) > 0 || (u.cacheWrite ?? 0) > 0,
      );
      observe({ cacheActivityObserved: sawCache });
      if (!sawCache) {
        note(
          'No cache read/write tokens reported; request was accepted but the cache effect is unconfirmed.',
        );
      }
      expect(sawCache).toBe(true);
    },
  );

  probe(
    {
      id: '590-585-assistant-part-cache-control',
      pr: '#590/#585',
      title:
        'assistant text-part cacheControl sends block content + tool_calls; invalid values dropped',
      model: MODELS.anthropic,
    },
    async ({ capture, observe }) => {
      const openrouter = providerFor(capture);
      const messages: ModelMessage[] = [
        { role: 'user', content: 'What is the weather in Paris?' },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Let me check the weather for you.',
              providerOptions: {
                openrouter: { cacheControl: { type: 'ephemeral' } },
              },
            },
            {
              type: 'text',
              text: ' One moment.',
              // #590: invalid value, must be dropped client-side.
              providerOptions: {
                openrouter: { cacheControl: { type: 'persistent' } },
              },
            },
            {
              type: 'tool-call',
              toolCallId: 'toolu_probe_1',
              toolName: 'get_weather',
              input: { city: 'Paris' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'toolu_probe_1',
              toolName: 'get_weather',
              output: { type: 'json', value: { tempC: 18, sky: 'clear' } },
            },
          ],
        },
      ];

      const result = await generateText({
        model: openrouter.chat(MODELS.anthropic),
        tools: {
          get_weather: tool({
            description: 'Get the weather for a city',
            inputSchema: jsonSchema<{ city: string }>({
              type: 'object',
              properties: { city: { type: 'string' } },
              required: ['city'],
            }),
          }),
        },
        toolChoice: 'none',
        messages,
        maxOutputTokens: 32,
        maxRetries: 0,
      });
      assert2xx(capture);

      const sent = (lastBody(capture).messages as any[]).find(
        (m) => m.role === 'assistant',
      );
      observe({ sentAssistant: sent, text: result.text });
      expect(Array.isArray(sent.content)).toBe(true);
      expect(sent.content[0]).toMatchObject({
        type: 'text',
        cache_control: { type: 'ephemeral' },
      });
      expect(sent.content[1].cache_control).toBeUndefined();
      expect(sent.tool_calls?.[0]?.function?.name).toBe('get_weather');
    },
  );
});
