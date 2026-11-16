import {
  experimental_generateSpeech as generateSpeech,
  experimental_transcribe as transcribe,
} from 'ai';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

const TEXT =
  'Hello from OpenRouter. The quick brown fox jumps over the lazy dog.';

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('speech and transcription', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  let mp3: Uint8Array;

  beforeAll(async () => {
    const result = await generateSpeech({
      model: openrouter.speechModel('hexgrad/kokoro-82m'),
      text: TEXT,
      voice: 'af_heart',
      outputFormat: 'mp3',
    });
    mp3 = result.audio.uint8Array;
  });

  it('generates mp3 speech', () => {
    expect(mp3.byteLength).toBeGreaterThan(1000);
  });

  it('generates pcm speech by default', async () => {
    const result = await generateSpeech({
      model: openrouter.speechModel('google/gemini-3.1-flash-tts-preview'),
      text: 'Testing one two three.',
      voice: 'Kore',
    });
    expect(result.audio.uint8Array.byteLength).toBeGreaterThan(1000);
    expect(result.audio.mediaType).toBe('audio/pcm');
    expect(result.providerMetadata.openrouter?.generationId).toMatch(/^gen-/);
  });

  it.each([
    'openai/gpt-4o-transcribe',
    'openai/whisper-1',
    'deepgram/nova-3',
  ])('round-trips speech through %s', async (model) => {
    const result = await transcribe({
      model: openrouter.transcriptionModel(model),
      audio: mp3,
      providerOptions: { openrouter: { language: 'en' } },
    });
    expect(normalize(result.text)).toContain('quick brown fox');
    expect(result.providerMetadata.openrouter?.generationId).toMatch(/^gen-/);
  });

  it.each([
    'openai/whisper-1',
    'deepgram/nova-3',
  ])('returns word and segment timestamps from %s', async (model) => {
    const result = await transcribe({
      model: openrouter.transcriptionModel(model),
      audio: mp3,
      timestampGranularities: ['word', 'segment'],
    });
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.words?.length).toBeGreaterThan(5);
    expect(result.durationInSeconds).toBeGreaterThan(1);
    expect(result.warnings).toEqual([]);
  });

  it('supports diarize', async () => {
    const result = await transcribe({
      model: openrouter.transcriptionModel('elevenlabs/scribe-v2'),
      audio: mp3,
      providerOptions: { openrouter: { diarize: true } },
    });
    expect(result.words?.length).toBeGreaterThan(5);
    const words = result.providerMetadata.openrouter?.words as Array<{
      speaker?: number;
    }>;
    expect(words.length).toBeGreaterThan(5);
    expect(words.every((word) => word.speaker !== undefined)).toBe(true);
  });
});
