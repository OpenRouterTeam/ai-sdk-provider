/**
 * Reasoning extraction and transformation for multi-turn conversations.
 *
 * WHY: Claude and other reasoning models (like o1) return encrypted/signed reasoning
 * content that MUST be sent back verbatim in subsequent turns. Without preserving and
 * re-sending reasoning_details, the model loses context about its previous thought
 * process, breaking extended reasoning chains.
 *
 * This module handles the transformation between the SDK format (returned by OpenRouter)
 * and the API format (required for sending back to OpenRouter).
 */

import type {
  LanguageModelV2Message,
  LanguageModelV2ReasoningPart,
} from '@ai-sdk/provider';
import type { OpenResponsesReasoning } from '@openrouter/sdk/esm/models';

// =============================================================================
// API Format Types
// =============================================================================

/**
 * API format reasoning detail item.
 *
 * Items have types like 'reasoning.summary', 'reasoning.text', 'reasoning.encrypted'.
 * This format is what OpenRouter's API expects when sending reasoning back.
 */
export type ApiReasoningDetailItem = {
  type: 'reasoning.text' | 'reasoning.summary' | 'reasoning.encrypted';
  id: string;
  format?: string | null;
  index: number;
  // For reasoning.text - visible thinking content
  text?: string;
  signature?: string | null;
  // For reasoning.summary - condensed context
  summary?: string;
  // For reasoning.encrypted - opaque continuation data
  data?: string;
};

// =============================================================================
// Transformation Functions
// =============================================================================

/**
 * Transform SDK format reasoning to API format.
 *
 * SDK format (returned by OpenRouter):
 * ```
 * { type: "reasoning", content: [...], summary: [...], encryptedContent: "..." }
 * ```
 *
 * API format (required for sending back):
 * ```
 * [
 *   { type: "reasoning.text", text: "...", ... },
 *   { type: "reasoning.summary", summary: "...", ... },
 *   { type: "reasoning.encrypted", data: "...", ... }
 * ]
 * ```
 */
export function transformReasoningToApiFormat(
  sdkItems: OpenResponsesReasoning[],
): ApiReasoningDetailItem[] {
  const apiItems: ApiReasoningDetailItem[] = [];

  for (const item of sdkItems) {
    const baseProps = {
      id: item.id,
      format: item.format ?? null,
    };

    let index = 0;

    // Transform content items to reasoning.text
    if (item.content && Array.isArray(item.content)) {
      for (const contentItem of item.content) {
        if (contentItem.type === 'reasoning_text' && contentItem.text) {
          apiItems.push({
            type: 'reasoning.text',
            text: contentItem.text,
            signature: item.signature ?? null,
            index: index++,
            ...baseProps,
          });
        }
      }
    }

    // Transform summary items to reasoning.summary
    if (item.summary && Array.isArray(item.summary)) {
      for (const summaryItem of item.summary) {
        if (summaryItem.type === 'summary_text' && summaryItem.text) {
          apiItems.push({
            type: 'reasoning.summary',
            summary: summaryItem.text,
            index: index++,
            ...baseProps,
          });
        }
      }
    }

    // Transform encryptedContent to reasoning.encrypted
    if (item.encryptedContent) {
      apiItems.push({
        type: 'reasoning.encrypted',
        data: item.encryptedContent,
        index: index++,
        ...baseProps,
      });
    }
  }

  return apiItems;
}

/**
 * Extract reasoning details from an assistant message's metadata.
 *
 * The AI SDK stores provider metadata in multiple possible locations:
 * - providerOptions (newer API)
 * - providerMetadata (current API)
 * - experimental_providerMetadata (legacy API)
 *
 * We also check reasoning content parts for attached metadata.
 */
export function extractReasoningDetails(
  message: LanguageModelV2Message & { role: 'assistant' },
): ApiReasoningDetailItem[] {
  type OpenRouterMeta = {
    reasoning_details?: OpenResponsesReasoning[];
  };

  // Check multiple locations for reasoning_details
  const messageWithMeta = message as LanguageModelV2Message & {
    role: 'assistant';
    providerOptions?: { openrouter?: OpenRouterMeta };
    providerMetadata?: { openrouter?: OpenRouterMeta };
    experimental_providerMetadata?: { openrouter?: OpenRouterMeta };
  };

  let sdkReasoningDetails: OpenResponsesReasoning[] | undefined =
    messageWithMeta.providerOptions?.openrouter?.reasoning_details ??
    messageWithMeta.providerMetadata?.openrouter?.reasoning_details ??
    messageWithMeta.experimental_providerMetadata?.openrouter?.reasoning_details;

  // Check reasoning content parts for providerOptions
  if (!sdkReasoningDetails) {
    for (const part of message.content) {
      if (part.type === 'reasoning') {
        const partWithMeta = part as LanguageModelV2ReasoningPart & {
          providerOptions?: { openrouter?: OpenRouterMeta };
          providerMetadata?: { openrouter?: OpenRouterMeta };
        };

        sdkReasoningDetails =
          partWithMeta.providerOptions?.openrouter?.reasoning_details ??
          partWithMeta.providerMetadata?.openrouter?.reasoning_details;

        if (sdkReasoningDetails) {
          break;
        }
      }
    }
  }

  // Transform from SDK format to API format
  return transformReasoningToApiFormat(sdkReasoningDetails ?? []);
}

/**
 * Extract reasoning content from OpenRouter response (legacy helper).
 */
export function extractReasoningFromResponse(message: {
  content?: string;
  reasoning_content?: string;
  reasoning_details?: { content?: string };
}): {
  content: string;
  reasoningContent?: string;
} {
  const reasoningContent = message.reasoning_content ?? message.reasoning_details?.content;

  return {
    content: message.content ?? '',
    ...(reasoningContent && { reasoningContent }),
  };
}
