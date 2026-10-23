/**
 * #597 / #542  Cross-family reasoning replay matrix.
 *
 * Turn 1: OpenAI reasoning model ("gpt luna", as in #542) calls a tool.
 * Turn 2: the same history is sent to DeepSeek with
 *   (i)   full reasoning_details (+ reasoning text), curl-style
 *   (ii)  only reasoning.encrypted details, curl-style
 *   (iii) only reasoning.summary details, curl-style
 *   (iv)  no reasoning at all, curl-style
 *   (v)   the SDK with reasoningReplay: 'same-family'
 *   (vi)  the SDK default (reasoningReplay: 'all'), for comparison
 * Every status and error body is recorded, to settle whether #542 is a
 * backend bug (i/ii fail while iii/iv pass) or a client bug.
 * Asserted: (iv) and (v) succeed. The rest is recorded only.
 */
import type { ModelMessage } from 'ai';

import { generateText, jsonSchema, tool } from 'ai';
import { describe, expect } from 'vitest';
import {
  describeError,
  HAS_KEY,
  probe,
  providerFor,
  rawPost,
} from './lib/harness';
import { MODELS } from './lib/models';

const WEATHER_PARAMS = {
  type: 'object',
  properties: { city: { type: 'string' } },
  required: ['city'],
  additionalProperties: false,
} as const;

const USER = 'What is the weather in Paris? Use the tool, then answer briefly.';

describe.skipIf(!HAS_KEY)('cross-family reasoning replay (#542)', () => {
  probe(
    {
      id: '597-542-cross-family-matrix',
      pr: '#597/#542',
      title: `turn 1 ${MODELS.openaiLuna} + tool, turn 2 ${MODELS.deepseek} with i..vi`,
      model: `${MODELS.openaiLuna} -> ${MODELS.deepseek}`,
      timeoutMs: 300_000,
    },
    async ({ capture, observe }) => {
      const matrix: Record<string, unknown> = {};

      // ---- curl-style turn 1 ----------------------------------------------
      const t1 = await rawPost(capture, '/chat/completions', {
        model: MODELS.openaiLuna,
        messages: [{ role: 'user', content: USER }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get the weather for a city',
              parameters: WEATHER_PARAMS,
            },
          },
        ],
        tool_choice: 'required',
        reasoning: { effort: 'low' },
        max_tokens: 1024,
      });
      const msg = t1.json?.choices?.[0]?.message ?? {};
      const details: Array<{ type: string }> = msg.reasoning_details ?? [];
      const toolCall = msg.tool_calls?.[0];
      matrix.turn1 = {
        status: t1.status,
        error: t1.status >= 300 ? t1.text.slice(0, 1500) : undefined,
        bodyError: t1.json?.error,
        provider: t1.json?.provider,
        detailTypes: details.map((d) => d.type),
        hasReasoningText: Boolean(msg.reasoning),
        toolCall: toolCall?.function?.name,
      };
      if (!toolCall) {
        observe({ matrix });
        throw new Error(`turn 1 produced no tool call (status ${t1.status})`);
      }

      const variants: Record<string, Record<string, unknown>> = {
        'i-full': { reasoning: msg.reasoning, reasoning_details: details },
        'ii-encrypted-only': {
          reasoning_details: details.filter(
            (d) => d.type === 'reasoning.encrypted',
          ),
        },
        'iii-summary-only': {
          reasoning_details: details.filter(
            (d) => d.type === 'reasoning.summary',
          ),
        },
        'iv-none': {},
      };
      for (const [name, reasoning] of Object.entries(variants)) {
        const r = await rawPost(capture, '/chat/completions', {
          model: MODELS.deepseek,
          messages: [
            { role: 'user', content: USER },
            {
              role: 'assistant',
              content: msg.content ?? '',
              tool_calls: msg.tool_calls,
              ...reasoning,
            },
            {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ tempC: 18, sky: 'clear' }),
            },
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_weather',
                description: 'Get the weather for a city',
                parameters: WEATHER_PARAMS,
              },
            },
          ],
          max_tokens: 256,
        });
        matrix[name] = {
          status: r.status,
          sentDetailTypes: (
            (reasoning.reasoning_details as Array<{ type: string }>) ?? []
          ).map((d) => d.type),
          provider: r.json?.provider,
          error: r.status >= 300 ? r.text.slice(0, 1500) : undefined,
          // OpenRouter can return 200 with an `error` object for upstream failures.
          bodyError: r.json?.error,
          finishReason: r.json?.choices?.[0]?.finish_reason,
        };
      }

      // ---- SDK turn 1 + (v) same-family / (vi) default --------------------
      const openrouter = providerFor(capture);
      const tools = {
        get_weather: tool({
          description: 'Get the weather for a city',
          inputSchema: jsonSchema<{ city: string }>(WEATHER_PARAMS as any),
        }),
      };
      const sdk1 = await generateText({
        model: openrouter.chat(MODELS.openaiLuna),
        tools,
        toolChoice: 'required',
        reasoning: 'low',
        prompt: USER,
        maxOutputTokens: 1024,
        maxRetries: 0,
      });
      const sdkCall = sdk1.toolCalls[0];
      const history: ModelMessage[] = [
        { role: 'user', content: USER },
        ...sdk1.response.messages,
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: sdkCall?.toolCallId ?? 'missing',
              toolName: 'get_weather',
              output: { type: 'json', value: { tempC: 18, sky: 'clear' } },
            },
          ],
        },
      ];
      for (const [name, replay] of [
        ['v-sdk-same-family', 'same-family'],
        ['vi-sdk-default-all', undefined],
      ] as const) {
        const before = capture.exchanges.length;
        let error: string | undefined;
        try {
          await generateText({
            model: openrouter.chat(MODELS.deepseek),
            tools,
            messages: history,
            maxOutputTokens: 256,
            maxRetries: 0,
            providerOptions: replay
              ? { openrouter: { reasoningReplay: replay } }
              : undefined,
          });
        } catch (e) {
          error = describeError(e).slice(0, 1500);
        }
        const ex = capture.exchanges[before];
        const sentAssistant = ((ex?.requestBody as any)?.messages ?? []).find(
          (m: any) => m.role === 'assistant',
        );
        matrix[name] = {
          status: ex?.status,
          sentDetailTypes: (sentAssistant?.reasoning_details ?? []).map(
            (d: { type: string }) => d.type,
          ),
          error,
        };
      }

      observe({ matrix });
      const status = (k: string) => (matrix[k] as { status?: number }).status;
      expect(status('iv-none')).toBe(200);
      expect(status('v-sdk-same-family')).toBe(200);
    },
  );
});
