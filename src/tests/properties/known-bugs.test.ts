/**
 * Minimal repros of bugs found by the property suite. Each is an `it.fails`
 * asserting the correct behaviour, so it starts failing (and must be flipped
 * to `it`) once the bug is fixed.
 *
 * Repros dropped from the original fuzz run, and why:
 * - WORKFLOW_SERIALIZE needing an API key in the serializing process is
 *   covered by the scenario suite.
 * - reasoning detail dedupe keying a summary and a text with the same string
 *   as duplicates mirrors the OpenRouter API's own dedupe (see
 *   src/utils/reasoning-details-duplicate-tracker.ts), so it is by design.
 * - doStream wall time vs number of tool-arg deltas was timing based; the
 *   scanner property suite asserts parse counts instead.
 */
import { describe, expect, it } from 'vitest';
import { convertToOpenRouterChatMessages } from '../../chat/convert-to-openrouter-chat-messages';
import { createOpenRouter } from '../../provider';
import { runStream, sse } from './harness';

(globalThis as any).AI_SDK_LOG_WARNINGS = false;

const enc = new TextEncoder();
const ch = (delta: any, extra: any = {}) => ({
  id: 'gen-1',
  model: 'm',
  choices: [{ index: 0, delta, ...extra }],
});

function captureBody() {
  const state: { body?: any } = {};
  const fetch = async (_url: any, init: any) => {
    state.body = JSON.parse(init.body);
    return new Response('{"error":{"message":"x","code":400}}', {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { state, fetch: fetch as any };
}

describe('known bugs found by the property suite', () => {
  // KNOWN BUG: once the accumulated arguments parse, the provider emits
  // tool-input-end and the tool-call, but a later whitespace-only delta is
  // still forwarded as a tool-input-delta after tool-input-end. #489 stopped
  // the duplicate tool-call for this case but not the late delta.
  it.fails('emits no tool-input-delta after tool-input-end', async () => {
    const parts = await runStream([
      enc.encode(
        sse([
          ch({
            tool_calls: [
              {
                index: 0,
                id: 'c1',
                type: 'function',
                function: { name: 't', arguments: '{"a":' },
              },
            ],
          }),
          ch({ tool_calls: [{ index: 0, function: { arguments: '1}' } }] }),
          ch({ tool_calls: [{ index: 0, function: { arguments: '\n' } }] }),
          ch({}, { finish_reason: 'tool_calls' }),
        ]),
      ),
    ]);
    const types = parts.map((p) => p.type);
    expect(types).toContain('tool-input-end');
    expect(types.slice(types.indexOf('tool-input-end'))).not.toContain(
      'tool-input-delta',
    );
  });

  // KNOWN BUG: when the stream ends with finish_reason 'length' while tool
  // arguments are still incomplete, tool-input-start is never closed with
  // tool-input-end (or reported as an error). Related: #558 / #569, which
  // cover the finish_reason-less premature EOF case.
  it.fails('closes every started tool input on finish_reason length', async () => {
    const parts = await runStream([
      enc.encode(
        sse([
          ch({
            tool_calls: [
              {
                index: 0,
                id: 'c1',
                type: 'function',
                function: { name: 't', arguments: '{"a":' },
              },
            ],
          }),
          ch({ tool_calls: [{ index: 0, function: { arguments: '"x' } }] }),
          ch({}, { finish_reason: 'length' }),
        ]),
      ),
    ]);
    expect(parts.map((p) => p.type)).toContain('tool-input-start');
    expect(parts.map((p) => p.type)).toContain('tool-input-end');
  });

  // KNOWN BUG: with `extraBody.reasoning_effort` set on the provider or the
  // model settings, a call-level `reasoning` (AI SDK v7, added in #518) adds
  // `reasoning.effort` alongside it, so the request carries two conflicting
  // efforts ('low' and 'high').
  for (const where of ['provider', 'settings'] as const) {
    it.fails(`sends one reasoning effort with extraBody on ${where}`, async () => {
      const { state, fetch } = captureBody();
      const extraBody = { reasoning_effort: 'low' };
      const provider = createOpenRouter({
        apiKey: 'k',
        fetch,
        ...(where === 'provider' ? { extraBody } : {}),
      });
      const model = provider.chat(
        'm',
        where === 'settings' ? { extraBody } : {},
      );
      await model
        .doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'x' }] }],
          reasoning: 'high',
        } as any)
        .catch(() => {});
      const { reasoning_effort, reasoning } = state.body;
      expect(reasoning_effort == null || reasoning?.effort == null).toBe(true);
    });
  }

  // KNOWN BUG: cacheControl values are forwarded without validation, so
  // malformed values ('yes', 0, { type: 'bogus' }) reach the wire on tools
  // (#517) and assistant text parts (#585).
  it.fails('drops invalid cacheControl values', async () => {
    const { state, fetch } = captureBody();
    const model = createOpenRouter({ apiKey: 'k', fetch }).chat('m');
    await model
      .doGenerate({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'x' }] },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'a',
                providerOptions: { openrouter: { cacheControl: 'yes' } },
              },
            ],
            providerOptions: { openrouter: { cacheControl: 0 } },
          },
        ],
        tools: [
          {
            type: 'function',
            name: 't',
            inputSchema: { type: 'object' },
            providerOptions: {
              openrouter: { cacheControl: { type: 'bogus' } },
            },
          },
        ],
      } as any)
      .catch(() => {});
    expect(state.body.tools[0].cache_control).toBeUndefined();
    expect(state.body.messages[1].cache_control).toBeUndefined();
    expect(JSON.stringify(state.body.messages[1].content)).not.toContain(
      'cache_control',
    );
  });

  // KNOWN BUG: an empty openrouter cacheControl ('') takes precedence over a
  // valid anthropic cacheControl on the same part, so the valid one is lost.
  it.fails('an empty openrouter cacheControl does not mask a valid anthropic one', () => {
    const out: any = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'a' },
          {
            type: 'text',
            text: 'b',
            providerOptions: {
              openrouter: { cacheControl: '' },
              anthropic: { cacheControl: { type: 'ephemeral' } },
            },
          },
        ],
      } as any,
    ]);
    expect(out[0].content[1].cache_control).toEqual({ type: 'ephemeral' });
  });

  // KNOWN BUG: when a response has only encrypted reasoning followed by a
  // text answer, no reasoning part is emitted and the encrypted detail only
  // appears on the finish part's providerMetadata, which the AI SDK does not
  // persist on UI messages, so it cannot be sent back on the next turn.
  // Possibly related: #542.
  it.fails('exposes encrypted-only reasoning on a replayable part', async () => {
    const parts = await runStream([
      enc.encode(
        sse([
          ch({
            reasoning_details: [
              {
                type: 'reasoning.encrypted',
                data: 'BLOB',
                id: 'rs_1',
                format: 'openai-responses-v1',
              },
            ],
          }),
          ch({ content: 'hello' }),
          ch({}, { finish_reason: 'stop' }),
        ]),
      ),
    ]);
    const carriers = parts.filter(
      (p) =>
        p.type !== 'finish' &&
        JSON.stringify(p.providerMetadata ?? {}).includes('BLOB'),
    );
    expect(carriers.length).toBeGreaterThan(0);
  });
});
