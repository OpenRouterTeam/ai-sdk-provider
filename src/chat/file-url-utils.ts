import type { LanguageModelV2FilePart } from '@ai-sdk/provider';

import { convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils';
import { isUrl } from './is-url';

export function getFileUrl({
  part,
  defaultMediaType,
}: {
  part: LanguageModelV2FilePart;
  defaultMediaType: string;
}) {
  if (part.data instanceof Uint8Array) {
    const base64 = convertUint8ArrayToBase64(part.data);
    return `data:${part.mediaType ?? defaultMediaType};base64,${base64}`;
  }

  const stringUrl = part.data.toString();

  if (
    isUrl({
      url: stringUrl,
      protocols: new Set(['http:', 'https:'] as const),
    })
  ) {
    return stringUrl;
  }

  return stringUrl.startsWith('data:')
    ? stringUrl
    : `data:${part.mediaType ?? defaultMediaType};base64,${stringUrl}`;
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

/**
 * Converts an audio file part to OpenRouter's input_audio data format.
 *
 * This function extracts base64-encoded audio data from a file part and
 * normalizes the format to one of the supported OpenRouter audio formats.
 *
 * @param part - The file part containing audio data. Must have a mediaType
 *   starting with "audio/" and contain either base64 data or a data URL.
 *
 * @returns An object with `data` (base64-encoded audio) and `format` ("mp3" or "wav")
 *   suitable for use in OpenRouter's `input_audio` field.
 *
 * @throws {Error} When audio is provided as an HTTP/HTTPS URL. OpenRouter requires
 *   audio to be base64-encoded inline. The error message includes instructions for
 *   downloading and encoding the audio locally.
 *
 * @throws {Error} When the audio format is not supported. OpenRouter only accepts
 *   MP3 and WAV formats. Supported MIME types:
 *   - MP3: "audio/mpeg", "audio/mp3"
 *   - WAV: "audio/wav", "audio/x-wav", "audio/wave"
 *
 * @example
 * ```ts
 * const audioData = getInputAudioData(filePart);
 * // Returns: { data: "base64string...", format: "mp3" }
 * ```
 */
export function getInputAudioData(part: LanguageModelV2FilePart): {
  data: string;
  format: 'mp3' | 'wav';
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
  let format = mediaType.replace('audio/', '');

  // Normalize format names for OpenRouter
  // Common MIME types: audio/mpeg, audio/mp3 -> mp3
  // audio/wav, audio/x-wav, audio/wave -> wav
  if (format === 'mpeg' || format === 'mp3') {
    format = 'mp3';
  } else if (format === 'x-wav' || format === 'wave' || format === 'wav') {
    format = 'wav';
  }

  // Validate format - OpenRouter only supports mp3 and wav
  if (format !== 'mp3' && format !== 'wav') {
    throw new Error(
      `Unsupported audio format: "${mediaType}"\n\n` +
        `OpenRouter only supports MP3 and WAV audio formats.\n` +
        `• For MP3: use "audio/mpeg" or "audio/mp3"\n` +
        `• For WAV: use "audio/wav" or "audio/x-wav"\n\n` +
        `Learn more: https://openrouter.ai/docs/features/multimodal/audio`,
    );
  }

  return { data, format };
}
