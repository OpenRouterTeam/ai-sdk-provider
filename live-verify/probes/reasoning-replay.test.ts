/**
 * #606      server tool -> `reasoning.server_tool_call` detail, replayed on turn 2
 * #600      encrypted-only reasoning carried by an empty reasoning part
 *           (generateText) and replayed on turn 2 without a 400
 * #608      same through streamText (late reasoning_details snapshot)
 * #583      separately signed Anthropic thinking blocks + tool call, replayed
 */
import type { ModelMessage } from 'ai';

import { createProviderDefinedToolFactory } from '@ai-sdk/provider-utils';
import { generateText, isStepCount, jsonSchema, streamText, tool } from 'ai';
import { describe, expect } from 'vitest';
import {
  assert2xx,
  HAS_KEY,
  lastBody,
  probe,
  providerFor,
} from './lib/harness';
import { MODELS } from './lib/models';

type Detail = {
  type: string;
  signature?: string | null;
  data?: string;
  tool_name?: string;
  [k: string]: unknown;
};

/** `openrouter:datetime`: free, in-process OpenRouter server tool. */
const datetimeTool = createProviderDefinedToolFactory<
  Record<string, never>,
  { timezone?: string }
>({
  id: 'openrouter.datetime',
  inputSchema: jsonSchema<Record<string, never>>({ type: 'object' }),
});

function assistantDetails(body: Record<string, unknown>): Detail[] {
  return (body.messages as any[])
    .filter((m) => m.role === 'assistant')
    .flatMap((m) => (m.reasoning_details ?? []) as Detail[]);
}

function detailsFromContent(content: ReadonlyArray<any>): Detail[] {
  return content.flatMap(
    (p) =>
      (p.providerMetadata?.openrouter?.reasoning_details ?? []) as Detail[],
  );
}

describe.skipIf(!HAS_KEY)('reasoning replay', () => {
  probe(
    {
      id: '606-server-tool-call-replay',
      pr: '#606',
      title:
        'reasoning.server_tool_call from a server tool is replayed on turn 2',
      model: MODELS.openaiCheap,
      timeoutMs: 180_000,
    },
    async ({ capture, observe, markInfo }) => {
      const openrouter = providerFor(capture);
      const model = openrouter.chat(MODELS.openaiCheap);
      const candidates = {
        'openrouter:datetime': { datetime: datetimeTool({}) },
        'openrouter:web_search': {
          web_search: openrouter.tools.webSearch({ maxResults: 1 }),
        },
      };

      const attempts: Record<string, unknown> = {};
      for (const [name, tools] of Object.entries(candidates)) {
        const prompt =
          name === 'openrouter:datetime'
            ? 'Use the datetime tool, then tell me today’s UTC date (YYYY-MM-DD only).'
            : 'Search the web for the OpenRouter homepage title. Answer in five words.';
        const first: ModelMessage[] = [{ role: 'user', content: prompt }];
        const turn1 = await generateText({
          model,
          tools,
          messages: first,
          maxOutputTokens: 64,
          maxRetries: 0,
        });
        const rawDetails = ((turn1.response.body as any)?.choices?.[0]?.message
          ?.reasoning_details ?? []) as Detail[];
        const serverCalls = rawDetails.filter(
          (d) => d.type === 'reasoning.server_tool_call',
        );
        attempts[name] = {
          rawDetailTypes: rawDetails.map((d) => d.type),
          serverToolNames: serverCalls.map((d) => d.tool_name),
          text: turn1.text,
        };
        if (serverCalls.length === 0) {
          continue;
        }

        await generateText({
          model,
          tools,
          messages: [
            ...first,
            ...turn1.response.messages,
            { role: 'user', content: 'Thanks. Repeat that in three words.' },
          ],
          maxOutputTokens: 32,
          maxRetries: 0,
        });
        assert2xx(capture);
        const replayed = assistantDetails(lastBody(capture)).filter(
          (d) => d.type === 'reasoning.server_tool_call',
        );
        observe({
          attempts,
          usedTool: name,
          replayedServerToolCalls: replayed,
        });
        expect(replayed.length).toBe(serverCalls.length);
        return;
      }

      assert2xx(capture);
      observe({ attempts });
      markInfo(
        'Backend returned no reasoning.server_tool_call for datetime or web_search; replay could not be exercised.',
      );
    },
  );

  for (const mode of ['generate', 'stream'] as const) {
    const id =
      mode === 'generate'
        ? '600-encrypted-carrier-generate'
        : '608-encrypted-carrier-stream';
    probe(
      {
        id,
        pr: mode === 'generate' ? '#600' : '#608',
        title: `${mode}Text: encrypted-only reasoning is carried and replayed on turn 2 (no 400)`,
        model: MODELS.openaiReasoning,
        timeoutMs: 180_000,
      },
      async ({ capture, observe, markInfo }) => {
        const openrouter = providerFor(capture);
        const model = openrouter.chat(MODELS.openaiReasoning);
        const first: ModelMessage[] = [
          { role: 'user', content: 'Think briefly, then answer: 12 + 30 = ?' },
        ];

        let content: ReadonlyArray<any>;
        let responseMessages: ModelMessage[];
        if (mode === 'generate') {
          const r = await generateText({
            model,
            reasoning: 'low',
            messages: first,
            maxOutputTokens: 1024,
            maxRetries: 0,
          });
          content = r.content;
          responseMessages = r.response.messages;
        } else {
          let streamError: unknown;
          const r = streamText({
            model,
            reasoning: 'low',
            messages: first,
            maxOutputTokens: 1024,
            maxRetries: 0,
            onError: ({ error }) => {
              streamError = error;
            },
          });
          try {
            content = await r.content;
            responseMessages = (await r.response).messages;
          } catch (e) {
            throw streamError ?? e;
          }
        }

        const carried = detailsFromContent(content);
        const encrypted = carried.filter(
          (d) => d.type === 'reasoning.encrypted',
        );
        const emptyCarrier = content.some(
          (p) =>
            p.type === 'reasoning' &&
            p.text === '' &&
            (p.providerMetadata?.openrouter?.reasoning_details ?? []).length >
              0,
        );

        await generateText({
          model,
          reasoning: 'low',
          messages: [
            ...first,
            ...responseMessages,
            { role: 'user', content: 'Now add 1. Number only.' },
          ],
          maxOutputTokens: 1024,
          maxRetries: 0,
        });
        assert2xx(capture);

        const replayed = assistantDetails(lastBody(capture));
        observe({
          turn1PartTypes: content.map((p) => p.type),
          carriedDetailTypes: carried.map((d) => d.type),
          emptyReasoningCarrier: emptyCarrier,
          replayedDetailTypes: replayed.map((d) => d.type),
        });
        if (encrypted.length === 0) {
          markInfo(
            'Turn 1 returned no reasoning.encrypted detail; only the no-400 replay was verified.',
          );
          return;
        }
        expect(
          replayed.filter((d) => d.type === 'reasoning.encrypted').length,
        ).toBeGreaterThanOrEqual(1);
        expect(replayed.some((d) => d.data === encrypted[0]?.data)).toBe(true);
      },
    );
  }

  probe(
    {
      id: '583-signed-thinking-blocks-replay',
      pr: '#583',
      title:
        'separately signed Anthropic thinking blocks + tool call stay separate and replay (no invalid signature)',
      model: MODELS.anthropicThinking,
      timeoutMs: 240_000,
    },
    async ({ capture, observe, markInfo }) => {
      const openrouter = providerFor(capture);
      const model = openrouter.chat(MODELS.anthropicThinking);
      const tools = {
        get_weather: tool({
          description: 'Get the current weather for one city.',
          inputSchema: jsonSchema<{ city: string }>({
            type: 'object',
            properties: { city: { type: 'string' } },
            required: ['city'],
          }),
          execute: async ({ city }) => ({ city, tempC: 18, sky: 'clear' }),
        }),
      };
      const first: ModelMessage[] = [
        {
          role: 'user',
          content:
            'Check the weather in Paris and then in Rome using the tool, one call at a time. Before each tool call, write one short sentence about what you are doing next.',
        },
      ];

      // Turn 1 (streamed): one step, i.e. thinking blocks + tool call(s).
      let streamError: unknown;
      const turn1 = streamText({
        model,
        tools,
        reasoning: 'low',
        messages: first,
        stopWhen: isStepCount(1),
        maxOutputTokens: 1024,
        maxRetries: 0,
        onError: ({ error }) => {
          streamError = error;
        },
      });
      let content: ReadonlyArray<any>;
      let responseMessages: ModelMessage[];
      try {
        content = await turn1.content;
        responseMessages = (await turn1.response).messages;
      } catch (e) {
        throw streamError ?? e;
      }
      const signed = detailsFromContent(content).filter(
        (d) => d.type === 'reasoning.text' && d.signature,
      );
      const uniqueSignatures = [...new Set(signed.map((d) => d.signature))];

      // Turn 2: replay the assistant message (thinking + tool calls) and the
      // tool results. A merged/mis-signed block would be refused with 400.
      await generateText({
        model,
        tools,
        reasoning: 'low',
        messages: [...first, ...responseMessages],
        stopWhen: isStepCount(1),
        maxOutputTokens: 1024,
        maxRetries: 0,
      });
      assert2xx(capture);

      const replayedSignatures = assistantDetails(lastBody(capture))
        .filter((d) => d.type === 'reasoning.text' && d.signature)
        .map((d) => d.signature);
      observe({
        turn1PartTypes: content.map((p) => p.type),
        signedBlocksInStream: uniqueSignatures.length,
        signedBlocksReplayed: new Set(replayedSignatures).size,
        toolCalls: content.filter((p) => p.type === 'tool-call').length,
      });
      expect(new Set(replayedSignatures).size).toBe(uniqueSignatures.length);
      if (uniqueSignatures.length < 2) {
        markInfo(
          `Model produced ${uniqueSignatures.length} signed thinking block(s); the two-block case (#582) was not exercised this run.`,
        );
      }
    },
  );
});
