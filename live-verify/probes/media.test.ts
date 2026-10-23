/**
 * #552  imageDetail 'low' vs 'high' (prompt token comparison)
 * #598  bare `mediaType: 'image'` (URL and inline bytes) maps to image_url
 * #601  video URLs are passed through as video_url.url (no client download)
 * #584  videoProcessing -> video_url.processing on Gemini (optional, SKIP_VIDEO=1)
 */
import { generateText } from 'ai';
import { describe, expect } from 'vitest';
import {
  assert2xx,
  HAS_KEY,
  lastBody,
  probe,
  providerFor,
} from './lib/harness';
import { ASSETS, MODELS, SKIP_VIDEO } from './lib/models';

function sentUserParts(body: Record<string, unknown>): any[] {
  const user = (body.messages as any[]).find((m) => m.role === 'user');
  return Array.isArray(user?.content) ? user.content : [];
}

describe.skipIf(!HAS_KEY)('media', () => {
  probe(
    {
      id: '552-image-detail',
      pr: '#552',
      title:
        "imageDetail 'low' is sent and costs fewer prompt tokens than 'high'",
      model: MODELS.openaiCheap,
    },
    async ({ capture, observe }) => {
      const openrouter = providerFor(capture);
      const tokens: Record<string, number | undefined> = {};
      for (const detail of ['low', 'high'] as const) {
        const result = await generateText({
          model: openrouter.chat(MODELS.openaiCheap),
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'One word: what color dominates?' },
                {
                  type: 'file',
                  data: new URL(ASSETS.imageUrl),
                  mediaType: 'image/png',
                  providerOptions: { openrouter: { imageDetail: detail } },
                },
              ],
            },
          ],
          maxOutputTokens: 16,
          maxRetries: 0,
        });
        const part = sentUserParts(lastBody(capture)).find(
          (p) => p.type === 'image_url',
        );
        expect(part?.image_url?.detail).toBe(detail);
        tokens[detail] = result.usage.inputTokens;
      }
      assert2xx(capture);
      observe({ promptTokens: tokens });
      expect(tokens.low ?? 0).toBeGreaterThan(0);
      expect(tokens.low ?? 0).toBeLessThan(tokens.high ?? 0);
    },
  );

  probe(
    {
      id: '598-bare-image-media-type',
      pr: '#598',
      title: "bare mediaType 'image' (URL and bytes) is sent as image_url",
      model: MODELS.openaiCheap,
    },
    async ({ capture, observe }) => {
      const openrouter = providerFor(capture);
      const bytes = new Uint8Array(
        await (await fetch(ASSETS.imageUrl)).arrayBuffer(),
      );
      const variants = {
        url: new URL(ASSETS.imageUrl),
        bytes,
      };
      const sent: Record<string, unknown> = {};
      for (const [name, data] of Object.entries(variants)) {
        await generateText({
          model: openrouter.chat(MODELS.openaiCheap),
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'One word: is this an image? yes/no' },
                {
                  type: 'file',
                  data,
                  mediaType: 'image',
                  providerOptions: { openrouter: { imageDetail: 'low' } },
                },
              ],
            },
          ],
          maxOutputTokens: 16,
          maxRetries: 0,
        });
        const part = sentUserParts(lastBody(capture)).find(
          (p) => p.type !== 'text',
        );
        sent[name] = {
          type: part?.type,
          urlPrefix: String(part?.image_url?.url ?? '').slice(0, 40),
          detail: part?.image_url?.detail,
        };
        expect(part?.type).toBe('image_url');
        expect(part?.image_url?.detail).toBe('low');
      }
      assert2xx(capture);
      observe({ sent });
      expect((sent.bytes as any).urlPrefix).toMatch(/^data:image\/png;base64,/);
    },
  );

  probe(
    {
      id: '601-video-url-passthrough',
      pr: '#601',
      title: 'video URL is passed through as video_url.url without a download',
      model: MODELS.geminiVideo,
      skipReason: SKIP_VIDEO && 'SKIP_VIDEO=1',
      timeoutMs: 180_000,
    },
    async ({ capture, observe }) => {
      const openrouter = providerFor(capture);
      const downloads: string[] = [];
      const result = await generateText({
        model: openrouter.chat(MODELS.geminiVideo),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'In five words, what animal is shown?' },
              {
                type: 'file',
                data: new URL(ASSETS.videoUrl),
                mediaType: 'video/mp4',
              },
            ],
          },
        ],
        // The AI SDK asks the download hook about every URL; `null` means
        // "pass through". Anything the model does not declare as supported
        // would be downloaded client-side, which #601 must avoid.
        experimental_download: async (requests) =>
          requests.map((r) => {
            if (r.isUrlSupportedByModel) {
              return null;
            }
            downloads.push(r.url.href);
            throw new Error(`would download ${r.url.href} client-side`);
          }),
        maxOutputTokens: 32,
        maxRetries: 0,
      });
      assert2xx(capture);
      const part = sentUserParts(lastBody(capture)).find(
        (p) => p.type !== 'text',
      );
      observe({
        sentPart: part,
        downloads,
        text: result.text,
        inputTokens: result.usage.inputTokens,
        provider: result.providerMetadata?.openrouter?.provider,
      });
      expect(downloads).toEqual([]);
      expect(part).toMatchObject({
        type: 'video_url',
        video_url: { url: ASSETS.videoUrl },
      });
    },
  );

  probe(
    {
      id: '584-video-processing',
      pr: '#584',
      title: "videoProcessing 'agentic' is forwarded as video_url.processing",
      model: MODELS.geminiVideoProcessing,
      optional: true,
      skipReason: SKIP_VIDEO && 'SKIP_VIDEO=1',
      timeoutMs: 240_000,
    },
    async ({ capture, observe }) => {
      const openrouter = providerFor(capture);
      const result = await generateText({
        model: openrouter.chat(MODELS.geminiVideoProcessing),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'In five words, what animal is shown?' },
              {
                type: 'file',
                data: new URL(ASSETS.videoUrl),
                mediaType: 'video/mp4',
                providerOptions: { openrouter: { videoProcessing: 'agentic' } },
              },
            ],
          },
        ],
        maxOutputTokens: 64,
        maxRetries: 0,
      });
      assert2xx(capture);
      const part = sentUserParts(lastBody(capture)).find(
        (p) => p.type === 'video_url',
      );
      const details = result.providerMetadata?.openrouter?.reasoning_details as
        | Array<{ type: string }>
        | undefined;
      observe({
        sentPart: part,
        text: result.text,
        inputTokens: result.usage.inputTokens,
        reasoningDetailTypes: details?.map((d) => d.type),
        provider: result.providerMetadata?.openrouter?.provider,
      });
      expect(part?.video_url?.processing).toBe('agentic');
    },
  );
});
