import type { LanguageModelV3FilePart } from '@ai-sdk/provider';
import type { OpenRouterAudioFormat } from '../types/openrouter-chat-completions-input';

import { convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils';
import { OPENROUTER_AUDIO_FORMATS } from '../types/openrouter-chat-completions-input';
import { isUrl } from './is-url';

export function buildFileDataUrl({
  data,
  mediaType,
  defaultMediaType,
}: {
  data: string | Uint8Array;
  mediaType?: string;
  defaultMediaType: string;
}): string {
  if (data instanceof Uint8Array) {
    const base64 = convertUint8ArrayToBase64(data);
    return `data:${mediaType ?? defaultMediaType};base64,${base64}`;
  }

  const stringData = data.toString();

  if (
    isUrl({
      url: stringData,
      protocols: new Set(['http:', 'https:'] as const),
    })
  ) {
    return stringData;
  }

  return stringData.startsWith('data:')
    ? stringData
    : `data:${mediaType ?? defaultMediaType};base64,${stringData}`;
}

export function getFileUrl({
  part,
  defaultMediaType,
}: {
  part: LanguageModelV3FilePart;
  defaultMediaType: string;
}) {
  const data = part.data instanceof URL ? part.data.toString() : part.data;
  return buildFileDataUrl({
    data,
    mediaType: part.mediaType,
    defaultMediaType,
  });
}

export function getMediaType(
  dataUrl: string,
  defaultMediaType: string,
): string {
  const match = dataUrl.match(/^data:([^;]+)/);
  return match ? (match[1] ?? defaultMediaType) : defaultMediaType;
}

export function getBase64FromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:[^;]*;base64,(.+)$/);
  return match ? match[1]! : dataUrl;
}

/** MIME type to format mapping for normalization */
export const MIME_TO_FORMAT: Record<string, OpenRouterAudioFormat> = {
  // MP3 variants
  mpeg: 'mp3',
  mp3: 'mp3',
  // WAV variants
  'x-wav': 'wav',
  wave: 'wav',
  wav: 'wav',
  // OGG variants
  ogg: 'ogg',
  vorbis: 'ogg',
  // AAC variants
  aac: 'aac',
  'x-aac': 'aac',
  // M4A variants
  m4a: 'm4a',
  'x-m4a': 'm4a',
  mp4: 'm4a',
  // AIFF variants
  aiff: 'aiff',
  'x-aiff': 'aiff',
  // FLAC
  flac: 'flac',
  'x-flac': 'flac',
  // PCM variants
  pcm16: 'pcm16',
  pcm24: 'pcm24',
};

/**
 * Converts an audio file part to OpenRouter's input_audio data format.
 *
 * This function extracts base64-encoded audio data from a file part and
 * normalizes the format to one of the supported OpenRouter audio formats.
 *
 * @param part - The file part containing audio data. Must have a mediaType
 *   starting with "audio/" and contain either base64 data or a data URL.
 *
 * @returns An object with `data` (base64-encoded audio) and `format`
 *   suitable for use in OpenRouter's `input_audio` field.
 *
 * @throws {Error} When audio is provided as an HTTP/HTTPS URL. OpenRouter requires
 *   audio to be base64-encoded inline. The error message includes instructions for
 *   downloading and encoding the audio locally.
 *
 * @throws {Error} When the audio format is not supported.
 *
 * @example
 * ```ts
 * const audioData = getInputAudioData(filePart);
 * // Returns: { data: "base64string...", format: "mp3" }
 * ```
 */
export function getInputAudioData(part: LanguageModelV3FilePart): {
  data: string;
  format: OpenRouterAudioFormat;
} {
  const fileData = getFileUrl({
    part,
    defaultMediaType: 'audio/mpeg',
  });

  // OpenRouter's input_audio doesn't support URLs directly
  if (
    isUrl({
      url: fileData,
      protocols: new Set(['http:', 'https:'] as const),
    })
  ) {
    throw new Error(
      `Audio files cannot be provided as URLs.\n\n` +
        `OpenRouter requires audio to be base64-encoded. Please:\n` +
        `1. Download the audio file locally\n` +
        `2. Read it as a Buffer or Uint8Array\n` +
        `3. Pass it as the data parameter\n\n` +
        `The AI SDK will automatically handle base64 encoding.\n\n` +
        `Learn more: https://openrouter.ai/docs/features/multimodal/audio`,
    );
  }

  // Extract base64 data (handles both data URLs and raw base64)
  const data = getBase64FromDataUrl(fileData);

  // Map media type to format
  const mediaType = part.mediaType || 'audio/mpeg';
  const rawFormat = mediaType.replace('audio/', '');

  // Normalize format names for OpenRouter using MIME type mapping
  const format = MIME_TO_FORMAT[rawFormat];

  if (format === undefined) {
    const supportedList = OPENROUTER_AUDIO_FORMATS.join(', ');
    throw new Error(
      `Unsupported audio format: "${mediaType}"\n\n` +
        `OpenRouter supports the following audio formats: ${supportedList}\n\n` +
        `Learn more: https://openrouter.ai/docs/features/multimodal/audio`,
    );
  }

  return { data, format };
}
