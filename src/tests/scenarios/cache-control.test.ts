// Scenarios: #517 (cache_control on tools, ttl), #585 (assistant part-level
// cache control as a block array) and the existing message/user part rules.
import type { ModelMessage } from 'ai';

import { generateText, jsonSchema, stepCountIs, streamText, tool } from 'ai';
import { describe, expect, it } from 'vitest';
import {
  chatChunk,
  chatCompletion,
  jsonResponse,
  mockProvider,
  sseResponse,
} from './helpers';

const EPHEMERAL = { type: 'ephemeral' } as const;
const ONE_HOUR = { type: 'ephemeral', ttl: '1h' } as const;

function chatProvider() {
  return mockProvider(() => jsonResponse(chatCompletion({ content: 'ok' })));
}

function makeTool(providerOptions?: Record<string, any>) {
  return tool({
    description: 'Lookup',
    inputSchema: jsonSchema({ type: 'object', properties: {} }),
    ...(providerOptions && { providerOptions }),
  });
}

describe('cache_control on tools (#517)', () => {
  const cases: Array<[string, Record<string, any>, unknown]> = [
    [
      'openrouter.cacheControl',
      { openrouter: { cacheControl: EPHEMERAL } },
      EPHEMERAL,
    ],
    [
      'openrouter.cache_control',
      { openrouter: { cache_control: EPHEMERAL } },
      EPHEMERAL,
    ],
    [
      'anthropic.cacheControl with ttl 1h',
      { anthropic: { cacheControl: ONE_HOUR } },
      ONE_HOUR,
    ],
    [
      'anthropic.cache_control',
      { anthropic: { cache_control: EPHEMERAL } },
      EPHEMERAL,
    ],
    [
      'openrouter wins over anthropic',
      {
        openrouter: { cacheControl: ONE_HOUR },
        anthropic: { cacheControl: EPHEMERAL },
      },
      ONE_HOUR,
    ],
  ];

  for (const [label, providerOptions, expected] of cases) {
    it(`tool ${label}`, async () => {
      const { provider, calls } = chatProvider();
      await generateText({
        model: provider('anthropic/claude-sonnet-4.5'),
        prompt: 'q',
        tools: { lookup: makeTool(providerOptions) },
      });
      expect(calls[0]?.body.tools[0].cache_control).toEqual(expected);
    });
  }

  it('only the marked tool (last) carries cache_control', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('anthropic/claude-sonnet-4.5'),
      prompt: 'q',
      tools: {
        a: makeTool(),
        b: makeTool({
          openrouter: { cacheControl: { type: 'ephemeral', ttl: '5m' } },
        }),
      },
    });
    const tools = calls[0]?.body.tools;
    expect(tools[0]).not.toHaveProperty('cache_control');
    expect(tools[1].cache_control).toEqual({ type: 'ephemeral', ttl: '5m' });
  });

  it('streamText tool cache_control survives a multi-step tool loop', async () => {
    const { provider, calls } = mockProvider([
      () =>
        sseResponse([
          chatChunk({
            tool_calls: [
              {
                index: 0,
                id: 'c1',
                type: 'function',
                function: { name: 'lookup', arguments: '{}' },
              },
            ],
          }),
          chatChunk({}, { finish_reason: 'tool_calls' }),
        ]),
      () =>
        sseResponse([
          chatChunk({ content: 'done' }, { finish_reason: 'stop' }),
        ]),
    ]);
    const result = streamText({
      model: provider('anthropic/claude-sonnet-4.5'),
      prompt: 'q',
      tools: {
        lookup: tool({
          description: 'Lookup',
          inputSchema: jsonSchema({ type: 'object', properties: {} }),
          providerOptions: { anthropic: { cacheControl: ONE_HOUR } },
          execute: async () => 'value',
        }),
      },
      stopWhen: stepCountIs(2),
    });
    expect(await result.text).toBe('done');
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.body.tools[0].cache_control).toEqual(ONE_HOUR);
    }
  });
});

describe('cache_control on assistant parts (#585)', () => {
  async function send(messages: ModelMessage[]) {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('anthropic/claude-sonnet-4.5'),
      messages,
      tools: { lookup: makeTool() },
    });
    return calls[0]?.body.messages as any[];
  }

  it('part-level cacheControl produces a block array on the exact part', async () => {
    const messages = await send([
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Long context A. ' },
          {
            type: 'text',
            text: 'Long context B.',
            providerOptions: { openrouter: { cacheControl: EPHEMERAL } },
          },
        ],
      },
      { role: 'user', content: 'continue' },
    ]);
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Long context A. ' },
        { type: 'text', text: 'Long context B.', cache_control: EPHEMERAL },
      ],
    });
    expect(messages[1].content[0]).not.toHaveProperty('cache_control');
  });

  it('block array is used alongside tool_calls', async () => {
    const messages = await send([
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Let me look that up.',
            providerOptions: { anthropic: { cacheControl: ONE_HOUR } },
          },
          {
            type: 'tool-call',
            toolCallId: 'tc1',
            toolName: 'lookup',
            input: {},
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tc1',
            toolName: 'lookup',
            output: { type: 'text', value: 'found' },
          },
        ],
      },
    ]);
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me look that up.', cache_control: ONE_HOUR },
      ],
      tool_calls: [
        {
          id: 'tc1',
          type: 'function',
          function: { name: 'lookup', arguments: '{}' },
        },
      ],
    });
    expect(messages[2]).toMatchObject({
      role: 'tool',
      tool_call_id: 'tc1',
      content: 'found',
    });
  });

  it('without part-level cache control assistant content stays a string', async () => {
    const messages = await send([
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'A' },
          { type: 'text', text: 'B' },
          {
            type: 'tool-call',
            toolCallId: 'tc1',
            toolName: 'lookup',
            input: {},
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tc1',
            toolName: 'lookup',
            output: { type: 'text', value: 'x' },
          },
        ],
      },
    ]);
    expect(messages[1].content).toBe('AB');
    expect(messages[1].tool_calls).toHaveLength(1);
  });

  it('tool-call-only assistant message keeps content null', async () => {
    const messages = await send([
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tc1',
            toolName: 'lookup',
            input: {},
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tc1',
            toolName: 'lookup',
            output: { type: 'text', value: 'x' },
          },
        ],
      },
    ]);
    expect(messages[1].content).toBeNull();
  });

  it('message-level assistant cache control stays on the message with string content', async () => {
    const messages = await send([
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Answer' }],
        providerOptions: { openrouter: { cacheControl: EPHEMERAL } },
      },
      { role: 'user', content: 'next' },
    ]);
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Answer',
      cache_control: EPHEMERAL,
    });
  });

  it('part-level cache control coexists with replayed reasoning_details', async () => {
    const messages = await send([
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'thinking',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: 'reasoning.text',
                    text: 'thinking',
                    signature: 'sig',
                    format: 'anthropic-claude-v1',
                  },
                ],
              },
            },
          },
          {
            type: 'text',
            text: 'Final',
            providerOptions: { openrouter: { cacheControl: EPHEMERAL } },
          },
        ],
      },
      { role: 'user', content: 'next' },
    ]);
    expect(messages[1]).toMatchObject({
      content: [{ type: 'text', text: 'Final', cache_control: EPHEMERAL }],
      reasoning: 'thinking',
      reasoning_details: [{ type: 'reasoning.text', signature: 'sig' }],
    });
  });
});

describe('cache_control on system, user and tool messages', () => {
  it('system message-level cache control', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('anthropic/claude-sonnet-4.5'),
      allowSystemInMessages: true,
      messages: [
        {
          role: 'system',
          content: 'You are helpful.',
          providerOptions: { anthropic: { cacheControl: ONE_HOUR } },
        },
        { role: 'user', content: 'hi' },
      ],
    });
    expect(calls[0]?.body.messages[0]).toEqual({
      role: 'system',
      content: [
        { type: 'text', text: 'You are helpful.', cache_control: ONE_HOUR },
      ],
    });
  });

  it('user single text part with part-level cache control becomes a block', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('anthropic/claude-sonnet-4.5'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Big doc',
              providerOptions: { openrouter: { cache_control: EPHEMERAL } },
            },
          ],
        },
      ],
    });
    expect(calls[0]?.body.messages[0].content).toEqual([
      { type: 'text', text: 'Big doc', cache_control: EPHEMERAL },
    ]);
  });

  it('user message-level cache control goes on the last text part only', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('anthropic/claude-sonnet-4.5'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'first' },
            { type: 'text', text: 'second' },
            {
              type: 'file',
              mediaType: 'image/png',
              data: new URL('https://example.com/a.png'),
            },
          ],
          providerOptions: { openrouter: { cacheControl: EPHEMERAL } },
        },
      ],
    });
    const content = calls[0]?.body.messages[0].content;
    expect(content[0]).not.toHaveProperty('cache_control');
    expect(content[1]).toEqual({
      type: 'text',
      text: 'second',
      cache_control: EPHEMERAL,
    });
    expect(content[2]).not.toHaveProperty('cache_control');
  });

  it('tool message cache control', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('anthropic/claude-sonnet-4.5'),
      tools: { lookup: makeTool() },
      messages: [
        { role: 'user', content: 'hi' },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 't',
              toolName: 'lookup',
              input: {},
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 't',
              toolName: 'lookup',
              output: { type: 'json', value: { big: true } },
              providerOptions: { openrouter: { cacheControl: ONE_HOUR } },
            },
          ],
        },
      ],
    });
    expect(calls[0]?.body.messages[2]).toMatchObject({
      role: 'tool',
      content: '{"big":true}',
      cache_control: ONE_HOUR,
    });
  });

  it('top-level providerOptions cacheControl is normalised to cache_control', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('anthropic/claude-sonnet-4.5'),
      prompt: 'q',
      providerOptions: { openrouter: { cacheControl: EPHEMERAL } },
    });
    expect(calls[0]?.body.cache_control).toEqual(EPHEMERAL);
    expect(calls[0]?.body).not.toHaveProperty('cacheControl');
  });
});
