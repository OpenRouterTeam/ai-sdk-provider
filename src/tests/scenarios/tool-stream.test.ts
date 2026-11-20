// Scenarios: #575 (invalid streamed tool args forwarded), #586 (incremental
// JSON scanner) and #548 (tool.strict) through streamText / generateText.
import {
  generateText,
  InvalidToolInputError,
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
} from 'ai';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import {
  chatChunk,
  chatCompletion,
  jsonResponse,
  mockProvider,
  sseResponse,
  USAGE,
} from './helpers';

const searchTool = tool({
  description: 'Search',
  inputSchema: jsonSchema<{ query: string; limit?: number }>({
    type: 'object',
    properties: { query: { type: 'string' }, limit: { type: 'number' } },
    required: ['query'],
  }),
  execute: async ({ query, limit }) => `results for ${query} (${limit ?? 10})`,
});

const noArgTool = tool({
  description: 'Current time',
  inputSchema: jsonSchema<Record<string, never>>({
    type: 'object',
    properties: {},
  }),
  execute: async () => '12:00',
});

function toolStart(index: number, id: string, name: string, args = '') {
  return chatChunk({
    tool_calls: [
      { index, id, type: 'function', function: { name, arguments: args } },
    ],
  });
}

function argDelta(index: number, args: string) {
  return chatChunk({ tool_calls: [{ index, function: { arguments: args } }] });
}

const finishToolCalls = [
  chatChunk({}, { finish_reason: 'tool_calls' }),
  chatChunk(null, { noChoices: true, usage: USAGE }),
];

function splitEvery(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    out.push(text.slice(i, i + size));
  }
  return out;
}

async function collectParts(result: { fullStream: AsyncIterable<unknown> }) {
  const parts: any[] = [];
  for await (const part of result.fullStream) {
    parts.push(part);
  }
  return parts;
}

describe('tool argument streaming', () => {
  it('valid args split across many single-character deltas', async () => {
    const args = '{"query":"weather \\"paris\\" {today}","limit":3}';
    const { provider } = mockProvider(() =>
      sseResponse([
        toolStart(0, 'call_a', 'search'),
        ...splitEvery(args, 1).map((d) => argDelta(0, d)),
        ...finishToolCalls,
      ]),
    );
    const result = streamText({
      model: provider('openai/gpt-4o'),
      prompt: 'q',
      tools: { search: searchTool },
    });
    const parts = await collectParts(result);
    const calls = parts.filter((p) => p.type === 'tool-call');
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toEqual({
      query: 'weather "paris" {today}',
      limit: 3,
    });
    const deltas = parts
      .filter((p) => p.type === 'tool-input-delta')
      .map((p) => p.delta)
      .join('');
    expect(deltas).toBe(args);
    expect(parts.filter((p) => p.type === 'tool-input-end')).toHaveLength(1);
    const results = parts.filter((p) => p.type === 'tool-result');
    expect(results[0]?.output).toBe('results for weather "paris" {today} (3)');
  });

  it('args delivered whole in the first chunk emit the full lifecycle once', async () => {
    const { provider } = mockProvider(() =>
      sseResponse([
        toolStart(0, 'call_w', 'search', '{"query":"x"}'),
        argDelta(0, '  '),
        ...finishToolCalls,
      ]),
    );
    const result = streamText({
      model: provider('openai/gpt-4o'),
      prompt: 'q',
      tools: { search: searchTool },
    });
    const parts = await collectParts(result);
    const types = parts
      .filter((p) => p.type.startsWith('tool-'))
      .map((p) => p.type);
    // Note: the trailing whitespace delta is still forwarded as a
    // tool-input-delta after tool-input-end (pre-existing behaviour).
    expect(types.slice(0, 4)).toEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
    ]);
    expect(types.filter((t) => t === 'tool-call')).toHaveLength(1);
    expect(types.filter((t) => t === 'tool-input-end')).toHaveLength(1);
    expect(parts.find((p) => p.type === 'tool-call').input).toEqual({
      query: 'x',
    });
  });

  it('first chunk with partial args then deltas completes correctly', async () => {
    const { provider } = mockProvider(() =>
      sseResponse([
        toolStart(0, 'call_p', 'search', '{"query":'),
        argDelta(0, '"split'),
        argDelta(0, ' value"}'),
        ...finishToolCalls,
      ]),
    );
    const result = streamText({
      model: provider('openai/gpt-4o'),
      prompt: 'q',
      tools: { search: searchTool },
    });
    const calls = await result.toolCalls;
    expect(calls.map((c) => c.input)).toEqual([{ query: 'split value' }]);
  });

  it('invalid streamed args reach experimental_repairToolCall verbatim (#575)', async () => {
    const broken = '{"query": "paris", "limit": 3';
    const { provider, calls } = mockProvider([
      () =>
        sseResponse([
          toolStart(0, 'call_bad', 'search'),
          ...splitEvery(broken, 4).map((d) => argDelta(0, d)),
          ...finishToolCalls,
        ]),
      () =>
        sseResponse([
          chatChunk({ content: 'fixed' }, { finish_reason: 'stop' }),
        ]),
    ]);
    const repair = vi.fn(async ({ toolCall, error }: any) => {
      expect(InvalidToolInputError.isInstance(error)).toBe(true);
      return { ...toolCall, input: `${toolCall.input}}` };
    });
    const result = streamText({
      model: provider('openai/gpt-4o'),
      prompt: 'q',
      tools: { search: searchTool },
      experimental_repairToolCall: repair,
      stopWhen: stepCountIs(2),
    });
    expect(await result.text).toBe('fixed');
    expect(repair).toHaveBeenCalledTimes(1);
    expect(repair.mock.calls[0]?.[0].toolCall.input).toBe(broken);
    const steps = await result.steps;
    expect(steps[0]?.toolResults[0]?.output).toBe('results for paris (3)');
    // The repaired input is what is replayed to the model.
    const assistant = calls[1]?.body.messages.find(
      (m: any) => m.role === 'assistant',
    );
    expect(JSON.parse(assistant.tool_calls[0].function.arguments)).toEqual({
      query: 'paris',
      limit: 3,
    });
  });

  it('invalid streamed args without repair surface as an invalid tool call with the raw text (#575)', async () => {
    const { provider } = mockProvider(() =>
      sseResponse([
        toolStart(0, 'call_bad', 'search', '{"query": tru'),
        ...finishToolCalls,
      ]),
    );
    const result = streamText({
      model: provider('openai/gpt-4o'),
      prompt: 'q',
      tools: { search: searchTool },
    });
    const parts = await collectParts(result);
    const call = parts.find((p) => p.type === 'tool-call');
    expect(call).toMatchObject({ invalid: true, input: '{"query": tru' });
    expect(InvalidToolInputError.isInstance(call.error)).toBe(true);
    expect(parts.find((p) => p.type === 'tool-error')).toMatchObject({
      toolCallId: 'call_bad',
      input: '{"query": tru',
    });
  });

  it('whitespace-only args for a no-argument tool become {}', async () => {
    const { provider } = mockProvider(() =>
      sseResponse([
        toolStart(0, 'call_ws', 'now', ' '),
        argDelta(0, '\n\t '),
        ...finishToolCalls,
      ]),
    );
    const result = streamText({
      model: provider('openai/gpt-4o'),
      prompt: 'q',
      tools: { now: noArgTool },
    });
    const parts = await collectParts(result);
    const call = parts.find((p) => p.type === 'tool-call');
    expect(call).toMatchObject({ toolName: 'now', input: {} });
    expect(call.invalid).toBeUndefined();
    expect(parts.find((p) => p.type === 'tool-result')?.output).toBe('12:00');
  });

  it('empty args (never streamed) become {}', async () => {
    const { provider } = mockProvider(() =>
      sseResponse([toolStart(0, 'call_e', 'now', ''), ...finishToolCalls]),
    );
    const result = streamText({
      model: provider('openai/gpt-4o'),
      prompt: 'q',
      tools: { now: noArgTool },
    });
    const parts = await collectParts(result);
    const types = parts
      .filter((p) => p.type.startsWith('tool-'))
      .map((p) => p.type);
    expect(types).toEqual([
      'tool-input-start',
      'tool-input-delta',
      'tool-input-end',
      'tool-call',
      'tool-result',
    ]);
    expect(parts.find((p) => p.type === 'tool-input-delta').delta).toBe('{}');
  });

  it('interleaved parallel calls by index are reassembled independently', async () => {
    const a = '{"query":"alpha","limit":1}';
    const b = '{"query":"beta"}';
    const aParts = splitEvery(a, 5);
    const bParts = splitEvery(b, 3);
    const interleaved: unknown[] = [];
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      if (aParts[i]) {
        interleaved.push(argDelta(0, aParts[i] as string));
      }
      if (bParts[i]) {
        interleaved.push(argDelta(1, bParts[i] as string));
      }
    }
    const { provider } = mockProvider(() =>
      sseResponse([
        toolStart(0, 'call_0', 'search'),
        toolStart(1, 'call_1', 'search'),
        ...interleaved,
        ...finishToolCalls,
      ]),
    );
    const result = streamText({
      model: provider('openai/gpt-4o'),
      prompt: 'q',
      tools: { search: searchTool },
    });
    const calls = await result.toolCalls;
    expect(
      calls
        .map((c) => [c.toolCallId, c.input])
        .sort((x, y) => String(x[0]).localeCompare(String(y[0]))),
    ).toEqual([
      ['call_0', { query: 'alpha', limit: 1 }],
      ['call_1', { query: 'beta' }],
    ]);
    const results = await result.toolResults;
    expect(results).toHaveLength(2);
  });

  it('duplicate tool call ids are made unique', async () => {
    const { provider } = mockProvider(() =>
      sseResponse([
        toolStart(0, 'dup', 'search', '{"query":"a"}'),
        toolStart(1, 'dup', 'search', '{"query":"b"}'),
        ...finishToolCalls,
      ]),
    );
    const result = streamText({
      model: provider('openai/gpt-4o'),
      prompt: 'q',
      tools: { search: searchTool },
    });
    const calls = await result.toolCalls;
    expect(calls).toHaveLength(2);
    expect(new Set(calls.map((c) => c.toolCallId)).size).toBe(2);
  });

  it('20k argument deltas re-parse the accumulated arguments a bounded number of times', async () => {
    const DELTAS = 20_000;
    const payload = 'x'.repeat(DELTAS * 10);
    const args = `{"query":"${payload}"}`;
    const chunks = splitEvery(args, 10);
    const { provider } = mockProvider(() =>
      sseResponse([
        toolStart(0, 'call_big', 'search'),
        ...chunks.map((d) => argDelta(0, d)),
        ...finishToolCalls,
      ]),
    );
    const model = provider('openai/gpt-4o');
    // Count full re-parses of the accumulated arguments instead of measuring
    // wall time (which is flaky on slow CI runners). Re-parsing on every delta
    // (the pre-#586 behaviour) would parse the large buffer ~20k times.
    const realParse = JSON.parse;
    let largeParses = 0;
    const parseSpy = vi
      .spyOn(JSON, 'parse')
      .mockImplementation((text: string, reviver?: any) => {
        if (typeof text === 'string' && text.length > 1_000) {
          largeParses++;
        }
        return realParse(text, reviver);
      });
    onTestFinished(() => parseSpy.mockRestore());
    const { stream } = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'q' }] }],
    });
    let toolCall: any;
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value.type === 'tool-call') {
        toolCall = value;
      }
    }
    expect(chunks.length).toBeGreaterThanOrEqual(DELTAS);
    expect(JSON.parse(toolCall.input).query).toHaveLength(payload.length);
    expect(largeParses).toBeLessThan(10);
  }, 30_000);

  it('20k argument deltas through streamText produce one valid tool call', async () => {
    const payload = 'y'.repeat(20_000 * 2);
    const args = `{"query":"${payload}"}`;
    const { provider } = mockProvider(() =>
      sseResponse([
        toolStart(0, 'call_big', 'search'),
        ...splitEvery(args, 2).map((d) => argDelta(0, d)),
        ...finishToolCalls,
      ]),
    );
    const result = streamText({
      model: provider('openai/gpt-4o'),
      prompt: 'q',
      tools: { search: searchTool },
    });
    const calls = await result.toolCalls;
    expect(calls).toHaveLength(1);
    expect((calls[0]?.input as any).query).toHaveLength(payload.length);
  }, 30_000);
});

describe('incremental scanner never hides complete JSON (#586)', () => {
  // With finish_reason 'stop' (some providers send it with tool calls), a tool
  // call is only emitted if the mid-stream completeness check fires, so any
  // false negative from the scanner would silently drop the call.
  function rng(seed: number) {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
  }

  const LEAVES = [
    'plain',
    'q"uo\\te\\"s {[ ]} \\u00e9 é \n \t',
    -12.5e3,
    0,
    true,
    null,
    '',
  ];

  function randomValue(next: () => number, depth = 0): unknown {
    const r = next();
    if (depth > 3 || r < 0.3) {
      return LEAVES[Math.floor(next() * LEAVES.length)];
    }
    if (r < 0.65) {
      const out: Record<string, unknown> = {};
      const n = Math.floor(next() * 4);
      for (let i = 0; i < n; i++) {
        out[`k${i}"}]`] = randomValue(next, depth + 1);
      }
      return out;
    }
    const n = Math.floor(next() * 4);
    return Array.from({ length: n }, () => randomValue(next, depth + 1));
  }

  it('200 random objects split at random points are emitted with finish "stop"', async () => {
    const next = rng(42);
    for (let i = 0; i < 200; i++) {
      const value = { payload: randomValue(next) };
      const args = JSON.stringify(value, null, next() < 0.5 ? 2 : undefined);
      const pieces: string[] = [];
      let pos = 0;
      while (pos < args.length) {
        const size = 1 + Math.floor(next() * 6);
        pieces.push(args.slice(pos, pos + size));
        pos += size;
      }
      const [first = '', ...rest] = pieces;
      const { provider } = mockProvider(() =>
        sseResponse([
          toolStart(0, `call_${i}`, 'search', first),
          ...rest.map((d) => argDelta(0, d)),
          chatChunk({}, { finish_reason: 'stop' }),
        ]),
      );
      const { stream } = await provider('openai/gpt-4o').doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'q' }] }],
      });
      const parts: any[] = [];
      const reader = stream.getReader();
      for (;;) {
        const { done, value: part } = await reader.read();
        if (done) {
          break;
        }
        parts.push(part);
      }
      const calls = parts.filter((p) => p.type === 'tool-call');
      expect(calls, args).toHaveLength(1);
      expect(JSON.parse(calls[0].input)).toEqual(value);
    }
  });
});

describe('tool strict (#548)', () => {
  const cases = [
    { label: 'true', strict: true as boolean | undefined, expected: true },
    { label: 'false', strict: false, expected: false },
    { label: 'absent', strict: undefined, expected: undefined },
  ];
  for (const { label, strict, expected } of cases) {
    it(`forwards strict=${label} to function.strict`, async () => {
      const { provider, calls } = mockProvider(() =>
        jsonResponse(chatCompletion({ content: 'ok' })),
      );
      await generateText({
        model: provider('openai/gpt-4o'),
        prompt: 'q',
        tools: {
          search: tool({
            description: 'Search',
            inputSchema: jsonSchema({ type: 'object', properties: {} }),
            ...(strict !== undefined && { strict }),
          }),
        },
      });
      const fn = calls[0]?.body.tools[0].function;
      if (expected === undefined) {
        expect(fn).not.toHaveProperty('strict');
      } else {
        expect(fn.strict).toBe(expected);
      }
    });
  }

  it('strict coexists with cache_control and eager_input_streaming', async () => {
    const { provider, calls } = mockProvider(() =>
      jsonResponse(chatCompletion({ content: 'ok' })),
    );
    await generateText({
      model: provider('anthropic/claude-sonnet-4.5'),
      prompt: 'q',
      tools: {
        search: tool({
          description: 'Search',
          inputSchema: jsonSchema({ type: 'object', properties: {} }),
          strict: true,
          providerOptions: {
            openrouter: {
              cacheControl: { type: 'ephemeral' },
              eager_input_streaming: true,
            },
          },
        }),
      },
    });
    expect(calls[0]?.body.tools[0]).toEqual({
      type: 'function',
      function: {
        name: 'search',
        description: 'Search',
        parameters: expect.objectContaining({ type: 'object' }),
        strict: true,
      },
      eager_input_streaming: true,
      cache_control: { type: 'ephemeral' },
    });
  });
});
