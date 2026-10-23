/**
 * #548  `strict: true` on a function tool
 * #566  `reasoning: { effort: 'max' }` in model settings
 * #518  call-level `reasoning` (AI SDK v7) -> `reasoning.effort`
 * #592  call-level `reasoning` is skipped when extraBody sets reasoning_effort
 */
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

describe.skipIf(!HAS_KEY)('request parameters', () => {
  probe(
    {
      id: '548-strict-tool',
      pr: '#548',
      title: 'tool strict: true is sent and accepted',
      model: MODELS.openaiCheap,
    },
    async ({ capture, observe }) => {
      const openrouter = providerFor(capture);
      const result = await generateText({
        model: openrouter.chat(MODELS.openaiCheap),
        tools: {
          set_temperature: tool({
            description: 'Set the thermostat',
            strict: true,
            inputSchema: jsonSchema<{ celsius: number; room: string }>({
              type: 'object',
              properties: {
                celsius: { type: 'number' },
                room: { type: 'string', enum: ['kitchen', 'bedroom'] },
              },
              required: ['celsius', 'room'],
              additionalProperties: false,
            }),
          }),
        },
        toolChoice: { type: 'tool', toolName: 'set_temperature' },
        prompt: 'Set the kitchen to 21 degrees.',
        maxOutputTokens: 64,
        maxRetries: 0,
      });
      assert2xx(capture);
      const sentTool = (lastBody(capture).tools as any[])[0];
      const call = result.toolCalls[0];
      observe({ sentFunction: sentTool?.function, toolCall: call?.input });
      expect(sentTool?.function?.strict).toBe(true);
      expect(call?.toolName).toBe('set_temperature');
      expect(Object.keys(call?.input ?? {}).sort()).toEqual([
        'celsius',
        'room',
      ]);
    },
  );

  probe(
    {
      id: '566-effort-max',
      pr: '#566',
      title: "reasoning effort 'max' is accepted by a model that lists it",
      model: MODELS.anthropic,
      timeoutMs: 180_000,
    },
    async ({ capture, observe }) => {
      const openrouter = providerFor(capture);
      const result = await generateText({
        model: openrouter.chat(MODELS.anthropic, {
          reasoning: { effort: 'max' },
        }),
        prompt: 'What is 17 * 23? Answer with the number only.',
        // Thinking needs headroom; this caps spend at ~$0.001 on Haiku 5.5.
        maxOutputTokens: 2048,
        maxRetries: 0,
      });
      assert2xx(capture);
      const sent = lastBody(capture);
      observe({
        sentReasoning: sent.reasoning,
        text: result.text,
        reasoningTokens: result.usage.outputTokenDetails.reasoningTokens,
        finishReason: result.finishReason,
      });
      expect(sent.reasoning).toMatchObject({ effort: 'max' });
    },
  );

  probe(
    {
      id: '518-call-level-reasoning',
      pr: '#518',
      title: "call-level reasoning: 'low' becomes reasoning.effort",
      model: MODELS.openaiReasoning,
    },
    async ({ capture, observe }) => {
      const openrouter = providerFor(capture);
      const result = await generateText({
        model: openrouter.chat(MODELS.openaiReasoning),
        reasoning: 'low',
        prompt: 'Reply with the single word OK.',
        maxOutputTokens: 512,
        maxRetries: 0,
      });
      assert2xx(capture);
      const sent = lastBody(capture);
      observe({
        sentReasoning: sent.reasoning,
        sentReasoningEffort: sent.reasoning_effort,
        reasoningTokens: result.usage.outputTokenDetails.reasoningTokens,
        text: result.text,
      });
      expect(sent.reasoning).toMatchObject({ effort: 'low' });
    },
  );

  probe(
    {
      id: '592-reasoning-effort-extra-body',
      pr: '#592',
      title:
        'call-level reasoning + extraBody.reasoning_effort sends only reasoning_effort (no 400)',
      model: MODELS.openaiReasoning,
    },
    async ({ capture, observe }) => {
      const openrouter = providerFor(capture);
      await generateText({
        model: openrouter.chat(MODELS.openaiReasoning, {
          extraBody: { reasoning_effort: 'low' },
        }),
        reasoning: 'high',
        prompt: 'Reply with the single word OK.',
        maxOutputTokens: 512,
        maxRetries: 0,
      });
      assert2xx(capture);
      const sent = lastBody(capture);
      observe({
        sentReasoning: sent.reasoning,
        sentReasoningEffort: sent.reasoning_effort,
      });
      expect(sent.reasoning_effort).toBe('low');
      expect((sent.reasoning as any)?.effort).toBeUndefined();
    },
  );
});
