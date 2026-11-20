// Scenarios: #518 (call-level `reasoning` option), #566 ('max' effort), #536
// (completion model v7 lifecycle + toolChoice) and #550 on completions.
import type { OpenRouterProviderOptions } from '../../types';

import { UnsupportedFunctionalityError } from '@ai-sdk/provider';
import { generateText, streamText } from 'ai';
import { describe, expect, it } from 'vitest';
import { OpenRouterCompletionLanguageModel } from '../../completion';
import {
  chatChunk,
  chatCompletion,
  jsonResponse,
  mockProvider,
  sseResponse,
  USAGE,
} from './helpers';

// Compile-time checks for #566 (verified by tsc over this file).
const maxEffortProviderOptions = {
  reasoning: { effort: 'max' },
} satisfies OpenRouterProviderOptions;
const maxEffortSettings: NonNullable<OpenRouterProviderOptions['reasoning']> = {
  effort: 'max',
};

function chatProvider() {
  return mockProvider(() => jsonResponse(chatCompletion({ content: 'ok' })));
}

describe('reasoning call option matrix (#518)', () => {
  it('call-level reasoning becomes reasoning.effort', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('openai/gpt-5'),
      prompt: 'q',
      reasoning: 'high',
    });
    expect(calls[0]?.body.reasoning).toEqual({ effort: 'high' });
  });

  it('no call-level reasoning keeps model settings untouched', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('openai/gpt-5', {
        reasoning: { max_tokens: 2048, exclude: true },
      }),
      prompt: 'q',
    });
    expect(calls[0]?.body.reasoning).toEqual({
      max_tokens: 2048,
      exclude: true,
    });
  });

  it('call-level reasoning replaces settings effort/max_tokens but keeps enabled/exclude', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('anthropic/claude-sonnet-4.5', {
        reasoning: { enabled: true, exclude: true, max_tokens: 1000 },
      }),
      prompt: 'q',
      reasoning: 'low',
    });
    expect(calls[0]?.body.reasoning).toEqual({
      enabled: true,
      exclude: true,
      effort: 'low',
    });
  });

  it("call-level 'none' is forwarded as effort none", async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('openai/gpt-5', { reasoning: { effort: 'high' } }),
      prompt: 'q',
      reasoning: 'none',
    });
    expect(calls[0]?.body.reasoning).toEqual({ effort: 'none' });
  });

  it("'provider-default' leaves the settings value", async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('openai/gpt-5', { reasoning: { effort: 'minimal' } }),
      prompt: 'q',
      reasoning: 'provider-default',
    });
    expect(calls[0]?.body.reasoning).toEqual({ effort: 'minimal' });
  });

  it('providerOptions.openrouter.reasoning_effort suppresses the call-level option', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('openai/gpt-5'),
      prompt: 'q',
      reasoning: 'low',
      providerOptions: { openrouter: { reasoning_effort: 'high' } },
    });
    expect(calls[0]?.body.reasoning_effort).toBe('high');
    expect(calls[0]?.body).not.toHaveProperty('reasoning');
  });

  it('providerOptions.openrouter.reasoning overrides the call-level option', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('openai/gpt-5', {
        reasoning: { enabled: true, effort: 'medium' },
      }),
      prompt: 'q',
      reasoning: 'low',
      providerOptions: { openrouter: { reasoning: { effort: 'xhigh' } } },
    });
    expect(calls[0]?.body.reasoning).toEqual({ effort: 'xhigh' });
  });

  it('streamText forwards the call-level reasoning option too', async () => {
    const { provider, calls } = mockProvider(() =>
      sseResponse([chatChunk({ content: 'ok' }, { finish_reason: 'stop' })]),
    );
    const result = streamText({
      model: provider('openai/gpt-5'),
      prompt: 'q',
      reasoning: 'xhigh',
    });
    await result.consumeStream();
    expect(calls[0]?.body.reasoning).toEqual({ effort: 'xhigh' });
    expect(calls[0]?.body.stream).toBe(true);
  });

  it('completion model honours the call-level reasoning option', async () => {
    const { provider, calls } = mockProvider(() =>
      jsonResponse({
        id: 'cmpl-1',
        choices: [{ text: 'ok', finish_reason: 'stop', index: 0 }],
        usage: USAGE,
      }),
    );
    await generateText({
      model: provider.completion('openai/gpt-3.5-turbo-instruct', {
        reasoning: { exclude: true, effort: 'low' },
      }),
      prompt: 'q',
      reasoning: 'medium',
    });
    expect(calls[0]?.body.reasoning).toEqual({
      exclude: true,
      effort: 'medium',
    });
  });
});

describe("'max' reasoning effort (#566)", () => {
  it('model settings with effort max reach the request', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('anthropic/claude-opus-4.1', {
        reasoning: maxEffortSettings,
      }),
      prompt: 'q',
    });
    expect(calls[0]?.body.reasoning).toEqual({ effort: 'max' });
  });

  it('providerOptions with effort max reach the request', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('anthropic/claude-opus-4.1'),
      prompt: 'q',
      providerOptions: { openrouter: maxEffortProviderOptions },
    });
    expect(calls[0]?.body.reasoning).toEqual({ effort: 'max' });
  });

  it('settings max + call-level high: call-level wins', async () => {
    const { provider, calls } = chatProvider();
    await generateText({
      model: provider('anthropic/claude-opus-4.1', {
        reasoning: { effort: 'max', enabled: true },
      }),
      prompt: 'q',
      reasoning: 'high',
    });
    expect(calls[0]?.body.reasoning).toEqual({ enabled: true, effort: 'high' });
  });
});

function completionProvider(responders: Parameters<typeof mockProvider>[0]) {
  return mockProvider(responders);
}

describe('completion model through ai (#536)', () => {
  const completionBody = {
    id: 'cmpl-abc',
    model: 'openai/gpt-3.5-turbo-instruct',
    provider: 'OpenAI',
    choices: [{ text: 'Hello there', finish_reason: 'stop', index: 0 }],
    usage: { ...USAGE, is_byok: true },
  };

  it('provider() picks the completion model for gpt-3.5-turbo-instruct', () => {
    const { provider } = completionProvider(() => jsonResponse(completionBody));
    expect(provider('openai/gpt-3.5-turbo-instruct')).toBeInstanceOf(
      OpenRouterCompletionLanguageModel,
    );
  });

  it('generateText returns text, usage and isByok', async () => {
    const { provider, calls } = completionProvider(() =>
      jsonResponse(completionBody),
    );
    const result = await generateText({
      model: provider.completion('openai/gpt-3.5-turbo-instruct'),
      prompt: 'Say hello',
    });
    expect(result.text).toBe('Hello there');
    expect(result.finishReason).toBe('stop');
    expect(result.usage.totalTokens).toBe(30);
    expect(result.providerMetadata?.openrouter?.usage).toMatchObject({
      isByok: true,
      cost: 0.0012,
    });
    expect(calls[0]?.url).toBe('https://openrouter.ai/api/v1/completions');
    expect(calls[0]?.body.prompt).toContain('Say hello');
  });

  it('streamText emits text-start/delta/end with one stable id', async () => {
    const { provider } = completionProvider(() =>
      sseResponse([
        { id: 'cmpl-s', choices: [{ text: 'Hel', index: 0 }] },
        { id: 'cmpl-s', choices: [{ text: 'lo', index: 0 }] },
        {
          id: 'cmpl-s',
          choices: [{ text: '!', index: 0, finish_reason: 'stop' }],
        },
        { id: 'cmpl-s', choices: [], usage: { ...USAGE, is_byok: false } },
      ]),
    );
    const result = streamText({
      model: provider.completion('openai/gpt-3.5-turbo-instruct'),
      prompt: 'Say hello',
    });
    const parts: any[] = [];
    for await (const part of result.fullStream) {
      parts.push(part);
    }
    const textParts = parts.filter((p) => p.type.startsWith('text-'));
    expect(textParts.map((p) => p.type)).toEqual([
      'text-start',
      'text-delta',
      'text-delta',
      'text-delta',
      'text-end',
    ]);
    expect(new Set(textParts.map((p) => p.id)).size).toBe(1);
    expect(await result.text).toBe('Hello!');
    expect(await result.finishReason).toBe('stop');
    expect((await result.providerMetadata)?.openrouter?.usage).toMatchObject({
      isByok: false,
    });
    expect((await result.usage).totalTokens).toBe(30);
  });

  it('streamText with no text emits no text-start/text-end', async () => {
    const { provider } = completionProvider(() =>
      sseResponse([
        {
          id: 'cmpl-e',
          choices: [{ text: '', index: 0, finish_reason: 'length' }],
        },
      ]),
    );
    const result = streamText({
      model: provider.completion('openai/gpt-3.5-turbo-instruct'),
      prompt: 'x',
    });
    const parts: any[] = [];
    for await (const part of result.fullStream) {
      parts.push(part);
    }
    // An empty-string text chunk still opens a text block; it must be closed.
    const starts = parts.filter((p) => p.type === 'text-start').length;
    const ends = parts.filter((p) => p.type === 'text-end').length;
    expect(starts).toBe(ends);
    expect(await result.finishReason).toBe('length');
  });

  it('toolChoice auto (default) and none are accepted without tools', async () => {
    const { provider, calls } = completionProvider(() =>
      jsonResponse(completionBody),
    );
    const model = provider.completion('openai/gpt-3.5-turbo-instruct');
    await generateText({ model, prompt: 'a' });
    await generateText({ model, prompt: 'b', toolChoice: 'auto' });
    await generateText({ model, prompt: 'c', toolChoice: 'none' });
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.body).not.toHaveProperty('tool_choice');
      expect(call.body).not.toHaveProperty('tools');
    }
  });

  it('toolChoice required is rejected as unsupported', async () => {
    const { provider, calls } = completionProvider(() =>
      jsonResponse(completionBody),
    );
    await expect(
      generateText({
        model: provider.completion('openai/gpt-3.5-turbo-instruct'),
        prompt: 'x',
        toolChoice: 'required',
      }),
    ).rejects.toSatisfy((error: unknown) =>
      UnsupportedFunctionalityError.isInstance(error),
    );
    expect(calls).toHaveLength(0);
  });

  it('streamText toolChoice none works; required errors', async () => {
    const { provider } = completionProvider(() =>
      sseResponse([
        { id: 'c', choices: [{ text: 'ok', index: 0, finish_reason: 'stop' }] },
      ]),
    );
    const ok = streamText({
      model: provider.completion('openai/gpt-3.5-turbo-instruct'),
      prompt: 'x',
      toolChoice: 'none',
    });
    expect(await ok.text).toBe('ok');

    const errors: unknown[] = [];
    const bad = streamText({
      model: provider.completion('openai/gpt-3.5-turbo-instruct'),
      prompt: 'x',
      toolChoice: 'required',
      onError: ({ error }) => {
        errors.push(error);
      },
    });
    await bad.consumeStream();
    expect(
      errors.some((e) => UnsupportedFunctionalityError.isInstance(e)),
    ).toBe(true);
  });
});
