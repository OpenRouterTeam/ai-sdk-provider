import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../provider';
import { OpenRouterSpeechModel } from './index';

const AUDIO_BYTES = new Uint8Array([0xff, 0xf3, 0x01, 0x02]);

function createCapturingMockFetch(
  responseHeaders: Record<string, string> = {},
) {
  const captured: { url?: string; body?: Record<string, unknown> } = {};
  const fetch = async (
    url: URL | RequestInfo,
    init?: RequestInit,
  ): Promise<Response> => {
    captured.url = url.toString();
    captured.body = JSON.parse(init?.body as string);
    return new Response(AUDIO_BYTES, {
      status: 200,
      headers: { 'content-type': 'audio/mpeg', ...responseHeaders },
    });
  };
  return { fetch, captured };
}

describe('OpenRouterSpeechModel', () => {
  it('is exposed on the provider', () => {
    const provider = createOpenRouter({ apiKey: 'test-key' });
    const model = provider.speechModel('hexgrad/kokoro-82m');
    expect(model).toBeInstanceOf(OpenRouterSpeechModel);
    expect(model.specificationVersion).toBe('v4');
    expect(model.modelId).toBe('hexgrad/kokoro-82m');
  });

  it('sends the speech request and returns raw audio bytes', async () => {
    const { fetch, captured } = createCapturingMockFetch({
      'x-generation-id': 'gen-tts-123',
    });
    const provider = createOpenRouter({ apiKey: 'test-key', fetch });
    const result = await provider.speechModel('hexgrad/kokoro-82m').doGenerate({
      text: 'Hello world',
      voice: 'af_heart',
      outputFormat: 'mp3',
      instructions: 'Speak slowly',
      speed: 1.25,
    });

    expect(captured.url).toBe('https://openrouter.ai/api/v1/audio/speech');
    expect(captured.body).toStrictEqual({
      model: 'hexgrad/kokoro-82m',
      input: 'Hello world',
      voice: 'af_heart',
      response_format: 'mp3',
      instructions: 'Speak slowly',
      speed: 1.25,
    });
    expect(result.audio).toStrictEqual(AUDIO_BYTES);
    expect(result.warnings).toStrictEqual([]);
    expect(result.response.headers?.['content-type']).toBe('audio/mpeg');
    expect(result.providerMetadata?.openrouter).toStrictEqual({
      generationId: 'gen-tts-123',
    });
  });

  it('omits unset options', async () => {
    const { fetch, captured } = createCapturingMockFetch();
    const provider = createOpenRouter({ apiKey: 'test-key', fetch });
    await provider
      .speechModel('hexgrad/kokoro-82m')
      .doGenerate({ text: 'Hello' });
    expect(captured.body).toStrictEqual({
      model: 'hexgrad/kokoro-82m',
      input: 'Hello',
    });
  });

  it('warns that language is unsupported', async () => {
    const { fetch, captured } = createCapturingMockFetch();
    const provider = createOpenRouter({ apiKey: 'test-key', fetch });
    const result = await provider
      .speechModel('hexgrad/kokoro-82m')
      .doGenerate({ text: 'Hola', language: 'es' });
    expect(captured.body).not.toHaveProperty('language');
    expect(result.warnings).toMatchObject([
      { type: 'unsupported', feature: 'language' },
    ]);
  });

  it('merges settings, extraBody, provider options and routing', async () => {
    const { fetch, captured } = createCapturingMockFetch();
    const provider = createOpenRouter({
      apiKey: 'test-key',
      fetch,
      extraBody: { session_id: 'session-1' },
    });
    await provider
      .speechModel('google/gemini-3.1-flash-tts-preview', {
        user: 'user-1',
        provider: { order: ['google'], allow_fallbacks: false },
      })
      .doGenerate({
        text: 'Hello',
        voice: 'Kore',
        providerOptions: {
          openrouter: {
            response_format: 'pcm',
            provider: { order: ['google-ai-studio'] },
          },
        },
      });
    expect(captured.body).toStrictEqual({
      model: 'google/gemini-3.1-flash-tts-preview',
      input: 'Hello',
      voice: 'Kore',
      user: 'user-1',
      session_id: 'session-1',
      response_format: 'pcm',
      provider: { order: ['google-ai-studio'], allow_fallbacks: false },
    });
  });

  it('throws an APICallError on error responses', async () => {
    const fetch = async () =>
      new Response(
        JSON.stringify({
          error: { message: 'An explicit voice is required', code: 400 },
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    const provider = createOpenRouter({ apiKey: 'test-key', fetch });
    await expect(
      provider.speechModel('hexgrad/kokoro-82m').doGenerate({ text: 'Hello' }),
    ).rejects.toThrow('An explicit voice is required');
  });
});
