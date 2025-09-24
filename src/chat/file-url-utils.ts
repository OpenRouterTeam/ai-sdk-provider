import type { LanguageModelV2FilePart } from '@ai-sdk/provider';

import { convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils';
import { isUrl } from './is-url';

/**
 * Gets a URL for a file part, converting it to a data URL if necessary.
 *
 * @param {object} options - The options for getting the file URL.
 * @param {LanguageModelV2FilePart} options.part - The file part to get the URL for.
 * @param {string} options.defaultMediaType - The default media type to use if the part doesn't have one.
 * @returns {string} The URL for the file part.
 */
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
      protocols: new Set(['http:', 'https:']),
    })
  ) {
    return stringUrl;
  }

  return stringUrl.startsWith('data:')
    ? stringUrl
    : `data:${part.mediaType ?? defaultMediaType};base64,${stringUrl}`;
}

/**
 * Gets the media type from a data URL.
 *
 * @param {string} dataUrl - The data URL to get the media type from.
 * @param {string} defaultMediaType - The default media type to use if it can't be determined from the URL.
 * @returns {string} The media type of the data URL.
 */
export function getMediaType(dataUrl: string, defaultMediaType: string): string {
  const match = dataUrl.match(/^data:([^;]+)/);
  return match ? match[1] ?? defaultMediaType : defaultMediaType;
}

/**
 * Gets the base64 content from a data URL.
 *
 * @param {string} dataUrl - The data URL to get the base64 content from.
 * @returns {string} The base64 content of the data URL.
 */
export function getBase64FromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:[^;]*;base64,(.+)$/);
  return match ? match[1]! : dataUrl;
}
