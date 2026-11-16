import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../provider';
import { mediaTypeToAudioFormat, OpenRouterTranscriptionModel } from './index';

const AUDIO = new Uint8Array([1, 2, 3, 4]);
const AUDIO_BASE64 = 'AQIDBA==';

function createCapturingMockFetch(
  responseBody: Record<string, unknown>,
  responseHeaders: Record<string, string> = {},
) {
  const captured: { url?: string; body?: Record<string, unknown> } = {};
  const fetch = async (
    url: URL | RequestInfo,
    init?: RequestInit,
  ): Promise<Response> => {
    captured.url = url.toString();
    captured.body = JSON.parse(init?.body as string);
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'content-type': 'application/json', ...responseHeaders },
    });
  };
  return { fetch, captured };
}

const VERBOSE_RESPONSE = {
  text: 'Hello world.',
  language: 'en',
  duration: 1.5,
  usage: { seconds: 1.5, cost: 0.0001 },
  segments: [{ id: 0, start: 0, end: 1.5, text: 'Hello world.' }],
  words: [
    { word: 'Hello', start: 0, end: 0.6, speaker: 0, speaker_label: 'A' },
    { word: '(laughs)', start: 0.6, end: 0.8, type: 'audio_event' },
    { word: 'world.', start: 0.8, end: 1.5, speaker: 1, speaker_label: 'B' },
  ],
};

describe('OpenRouterTranscriptionModel', () => {
  it('is exposed on the provider', () => {
    const provider = createOpenRouter({ apiKey: 'test-key' });
    const model = provider.transcriptionModel('openai/whisper-1');
    expect(model).toBeInstanceOf(OpenRouterTranscriptionModel);
    expect(model.specificationVersion).toBe('v4');
    expect(model.modelId).toBe('openai/whisper-1');
  });

  it('sends base64 JSON audio with json format by default', async () => {
    const { fetch, captured } = createCapturingMockFetch({
      text: 'Hello world.',
      usage: { seconds: 1.5, cost: 0.0001 },
    });
    const provider = createOpenRouter({ apiKey: 'test-key', fetch });
    const result = await provider
      .transcriptionModel('openai/gpt-4o-transcribe')
      .doGenerate({ audio: AUDIO, mediaType: 'audio/mpeg' });

    expect(captured.url).toBe(
      'https://openrouter.ai/api/v1/audio/transcriptions',
    );
    expect(captured.body).toStrictEqual({
      model: 'openai/gpt-4o-transcribe',
      input_audio: { data: AUDIO_BASE64, format: 'mp3' },
    });
    expect(result.text).toBe('Hello world.');
    expect(result.segments).toStrictEqual([]);
    expect(result.words).toBeUndefined();
    expect(result.durationInSeconds).toBe(1.5);
    expect(result.usage).toStrictEqual({ seconds: 1.5, cost: 0.0001 });
    expect(result.warnings).toStrictEqual([]);
  });

  it('passes base64 string audio through unchanged', async () => {
    const { fetch, captured } = createCapturingMockFetch({ text: 'hi' });
    const provider = createOpenRouter({ apiKey: 'test-key', fetch });
    await provider
      .transcriptionModel('openai/whisper-1')
      .doGenerate({ audio: AUDIO_BASE64, mediaType: 'audio/wav' });
    expect(captured.body?.input_audio).toStrictEqual({
      data: AUDIO_BASE64,
      format: 'wav',
    });
  });

  it('requests verbose_json when timestamp granularities are set and maps segments and words', async () => {
    const { fetch, captured } = createCapturingMockFetch(VERBOSE_RESPONSE, {
      'x-generation-id': 'gen-stt-123',
    });
    const provider = createOpenRouter({ apiKey: 'test-key', fetch });
    const result = await provider
      .transcriptionModel('openai/whisper-1')
      .doGenerate({
        audio: AUDIO,
        mediaType: 'audio/wav',
        timestampGranularities: ['word', 'segment'],
      });

    expect(captured.body).toMatchObject({
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
    });
    expect(result.language).toBe('en');
    expect(result.segments).toStrictEqual([
      { text: 'Hello world.', startSecond: 0, endSecond: 1.5 },
    ]);
    expect(result.words).toStrictEqual([
      { text: 'Hello', startSecond: 0, endSecond: 0.6 },
      { text: 'world.', startSecond: 0.8, endSecond: 1.5 },
    ]);
    expect(result.providerMetadata?.openrouter).toStrictEqual({
      generationId: 'gen-stt-123',
      cost: 0.0001,
      words: VERBOSE_RESPONSE.words,
    });
  });

  it('does not send timestamp granularities for an empty array', async () => {
    const { fetch, captured } = createCapturingMockFetch({ text: 'hi' });
    const provider = createOpenRouter({ apiKey: 'test-key', fetch });
    await provider.transcriptionModel('openai/whisper-1').doGenerate({
      audio: AUDIO,
      mediaType: 'audio/wav',
      timestampGranularities: [],
    });
    expect(captured.body).not.toHaveProperty('response_format');
    expect(captured.body).not.toHaveProperty('timestamp_granularities');
  });

  it('warns when requested timestamps are missing from the response', async () => {
    const { fetch } = createCapturingMockFetch({ text: 'hi' });
    const provider = createOpenRouter({ apiKey: 'test-key', fetch });
    const result = await provider
      .transcriptionModel('openai/whisper-1')
      .doGenerate({
        audio: AUDIO,
        mediaType: 'audio/wav',
        timestampGranularities: ['word'],
      });
    expect(result.warnings).toStrictEqual([
      {
        type: 'unsupported',
        feature: 'timestampGranularities: word',
        details: 'openai/whisper-1 did not return word-level timestamps.',
      },
    ]);
  });

  it('forwards provider options and lets them override derived fields', async () => {
    const { fetch, captured } = createCapturingMockFetch(VERBOSE_RESPONSE);
    const provider = createOpenRouter({ apiKey: 'test-key', fetch });
    await provider.transcriptionModel('deepgram/nova-3').doGenerate({
      audio: AUDIO,
      mediaType: 'audio/wav',
      timestampGranularities: ['word'],
      providerOptions: {
        openrouter: {
          language: 'en',
          diarize: true,
          keyterms: ['OpenRouter'],
          temperature: 0,
          timestamp_granularities: ['segment'],
          provider: { only: ['deepgram'] },
        },
      },
    });
    expect(captured.body).toStrictEqual({
      model: 'deepgram/nova-3',
      input_audio: { data: AUDIO_BASE64, format: 'wav' },
      response_format: 'verbose_json',
      language: 'en',
      diarize: true,
      keyterms: ['OpenRouter'],
      temperature: 0,
      timestamp_granularities: ['segment'],
      provider: { only: ['deepgram'] },
    });
  });

  it('requests verbose_json when diarize is set', async () => {
    const { fetch, captured } = createCapturingMockFetch(VERBOSE_RESPONSE);
    const provider = createOpenRouter({ apiKey: 'test-key', fetch });
    await provider.transcriptionModel('elevenlabs/scribe-v2').doGenerate({
      audio: AUDIO,
      mediaType: 'audio/wav',
      providerOptions: { openrouter: { diarize: true } },
    });
    expect(captured.body).toMatchObject({
      diarize: true,
      response_format: 'verbose_json',
    });
  });

  it('requests verbose_json when diarize or timestamps come from extraBody', async () => {
    const { fetch, captured } = createCapturingMockFetch(VERBOSE_RESPONSE);
    const provider = createOpenRouter({
      apiKey: 'test-key',
      fetch,
      extraBody: { diarize: true },
    });
    await provider
      .transcriptionModel('elevenlabs/scribe-v2')
      .doGenerate({ audio: AUDIO, mediaType: 'audio/wav' });
    expect(captured.body).toMatchObject({
      diarize: true,
      response_format: 'verbose_json',
    });

    await provider
      .transcriptionModel('openai/whisper-1', {
        extraBody: { diarize: false, timestamp_granularities: ['segment'] },
      })
      .doGenerate({
        audio: AUDIO,
        mediaType: 'audio/wav',
        timestampGranularities: ['word'],
      });
    expect(captured.body).toMatchObject({
      diarize: false,
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });
  });

  it('merges settings, extraBody and provider routing', async () => {
    const { fetch, captured } = createCapturingMockFetch({ text: 'hi' });
    const provider = createOpenRouter({
      apiKey: 'test-key',
      fetch,
      extraBody: { session_id: 'session-1' },
    });
    await provider
      .transcriptionModel('openai/whisper-1', {
        user: 'user-1',
        provider: { order: ['openai'], allow_fallbacks: false },
      })
      .doGenerate({
        audio: AUDIO,
        mediaType: 'audio/wav',
        providerOptions: { openrouter: { provider: { order: ['groq'] } } },
      });
    expect(captured.body).toMatchObject({
      user: 'user-1',
      session_id: 'session-1',
      provider: { order: ['groq'], allow_fallbacks: false },
    });
  });

  it('throws an APICallError on error responses', async () => {
    const fetch = async () =>
      new Response(
        JSON.stringify({ error: { message: 'bad audio', code: 400 } }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    const provider = createOpenRouter({ apiKey: 'test-key', fetch });
    await expect(
      provider
        .transcriptionModel('openai/whisper-1')
        .doGenerate({ audio: AUDIO, mediaType: 'audio/wav' }),
    ).rejects.toThrow('bad audio');
  });
});

describe('mediaTypeToAudioFormat', () => {
  it.each([
    ['audio/mpeg', 'mp3'],
    ['audio/mp3', 'mp3'],
    ['audio/wav', 'wav'],
    ['audio/x-wav', 'wav'],
    ['audio/wave', 'wav'],
    ['audio/mp4', 'm4a'],
    ['audio/x-m4a', 'm4a'],
    ['audio/flac', 'flac'],
    ['audio/ogg', 'ogg'],
    ['audio/webm', 'webm'],
    ['audio/aac', 'aac'],
    ['audio/pcm;rate=16000', 'pcm'],
  ])('%s -> %s', (mediaType, format) => {
    expect(mediaTypeToAudioFormat(mediaType)).toBe(format);
  });
});
