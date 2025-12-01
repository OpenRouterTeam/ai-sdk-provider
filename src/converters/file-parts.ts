/**
 * File part converters for transforming AI SDK file parts to OpenRouter formats.
 *
 * This module handles the conversion of images, PDFs, and other files from
 * AI SDK's LanguageModelV2FilePart to both OpenRouter Chat API and Responses API formats.
 */

import type { LanguageModelV2FilePart } from '@ai-sdk/provider';
import type {
  ChatMessageContentItem,
  ResponseInputFile,
  ResponseInputImage,
  ResponseInputText,
} from '@openrouter/sdk/esm/models';

import {
  assertNever,
  categorizeMediaType,
  classifiedDataToUrl,
  classifyFileData,
  type ClassifiedFileData,
} from './types';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Content items that can appear in Responses API messages.
 */
export type ResponsesContentItem = ResponseInputText | ResponseInputImage | ResponseInputFile;

// =============================================================================
// Chat API File Converters
// =============================================================================

/**
 * Convert an AI SDK file part to OpenRouter Chat API format.
 *
 * Images become image_url content items, other files become file content items
 * or text placeholders depending on their data format.
 */
export function convertFilePartToChatItem(
  part: LanguageModelV2FilePart,
): ChatMessageContentItem | null {
  const mediaCategory = categorizeMediaType(part.mediaType);
  const classifiedData = classifyFileData(part.data);

  switch (mediaCategory) {
    case 'image':
      return convertImageToChatItem(part, classifiedData);

    case 'other':
      return convertFileToChatItem(part, classifiedData);

    default:
      return assertNever(mediaCategory);
  }
}

function convertImageToChatItem(
  part: LanguageModelV2FilePart,
  classifiedData: ClassifiedFileData,
): ChatMessageContentItem | null {
  const imageUrl = classifiedDataToUrl(classifiedData, part.mediaType);
  if (!imageUrl) {
    return null;
  }

  return {
    type: 'image_url',
    imageUrl: {
      url: imageUrl,
      detail: 'auto',
    },
  };
}

function convertFileToChatItem(
  part: LanguageModelV2FilePart,
  classifiedData: ClassifiedFileData,
): ChatMessageContentItem | null {
  switch (classifiedData.kind) {
    case 'base64':
      return {
        type: 'file',
        file: {
          fileData: classifiedData.value,
          filename: part.filename,
        },
      };

    case 'uint8array':
      return {
        type: 'file',
        file: {
          fileData: Buffer.from(classifiedData.value).toString('base64'),
          filename: part.filename,
        },
      };

    case 'url':
      // Chat API doesn't have native URL file support, use text placeholder
      return {
        type: 'text',
        text: `[File: ${part.filename ?? 'file'} - ${classifiedData.value}]`,
      };

    case 'unknown':
      return null;

    default:
      return assertNever(classifiedData);
  }
}

// =============================================================================
// Responses API File Converters
// =============================================================================

/**
 * Convert an AI SDK file part to OpenRouter Responses API format.
 *
 * The Responses API has native support for files via URLs and base64,
 * providing richer file handling than the Chat API.
 */
export function convertFilePartToResponsesItem(
  part: LanguageModelV2FilePart,
): ResponsesContentItem | null {
  const mediaCategory = categorizeMediaType(part.mediaType);
  const classifiedData = classifyFileData(part.data);

  switch (mediaCategory) {
    case 'image':
      return convertImageToResponsesItem(part, classifiedData);

    case 'other':
      return convertFileToResponsesItem(part, classifiedData);

    default:
      return assertNever(mediaCategory);
  }
}

function convertImageToResponsesItem(
  part: LanguageModelV2FilePart,
  classifiedData: ClassifiedFileData,
): ResponseInputImage | null {
  const imageUrl = classifiedDataToUrl(classifiedData, part.mediaType);
  if (!imageUrl) {
    return null;
  }

  return {
    type: 'input_image',
    detail: 'auto',
    imageUrl,
  };
}

function convertFileToResponsesItem(
  part: LanguageModelV2FilePart,
  classifiedData: ClassifiedFileData,
): ResponseInputFile | null {
  const baseFile: ResponseInputFile = {
    type: 'input_file',
    filename: part.filename,
  };

  switch (classifiedData.kind) {
    case 'base64':
      return {
        ...baseFile,
        fileData: classifiedData.value,
      };

    case 'uint8array':
      return {
        ...baseFile,
        fileData: Buffer.from(classifiedData.value).toString('base64'),
      };

    case 'url':
      return {
        ...baseFile,
        fileUrl: classifiedData.value,
      };

    case 'unknown':
      return null;

    default:
      return assertNever(classifiedData);
  }
}
