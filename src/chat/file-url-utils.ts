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
      protocols: new Set(['http:', 'https:']),
    })
  ) {
    return stringUrl;
  }

  return stringUrl.startsWith('data:')
    ? stringUrl
    : `data:${part.mediaType ?? defaultMediaType};base64,${stringUrl}`;
}

export function getMediaType(dataUrl: string, defaultMediaType: string): string {
  const match = dataUrl.match(/^data:([^;]+)/);
  return match ? match[1] ?? defaultMediaType : defaultMediaType;
}

export function getBase64FromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:[^;]*;base64,(.+)$/);
  return match ? match[1]! : dataUrl;
}
