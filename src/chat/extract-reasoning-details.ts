/**
 * Reasoning details extraction for multi-turn conversations.
 *
 * WHY: Reasoning models (Claude, Gemini 3, o1) return encrypted/signed reasoning
 * content that MUST be sent back verbatim in subsequent turns. Without preserving
 * and re-sending reasoning_details, the model loses context about its previous
 * thought process, breaking extended reasoning chains.
 *
 * This module handles extraction from OpenRouter Responses API responses and
 * attachment to AI SDK content parts via providerMetadata.
 */

import type { JSONObject, JSONValue } from '@ai-sdk/provider';
import type {
  OpenResponsesNonStreamingResponse,
  OpenResponsesReasoning,
} from '@openrouter/sdk/models';

// =============================================================================
// Types
// =============================================================================

/**
 * Raw reasoning item from OpenRouter response output.
 */
export interface ReasoningOutputItem {
  type: 'reasoning';
  id?: string;
  format?: string | null;
  signature?: string | null;
  content?: Array<{ type: string; text: string }>;
  summary?: Array<{ type: string; text: string }>;
  encryptedContent?: string;
}

/**
 * Reasoning details in SDK format (as returned by OpenRouter).
 * This is the format we store in providerMetadata for round-tripping.
 */
export type ReasoningDetails = JSONValue[];

// =============================================================================
// Extraction Functions
// =============================================================================

/**
 * Extract reasoning details from a non-streaming OpenRouter Responses API response.
 *
 * Reasoning details can come from:
 * 1. Output items with type 'reasoning' (Responses API format)
 * 2. Message-level reasoning_details field (Chat Completions API format)
 *
 * @param response - The full OpenRouter Responses API response
 * @returns Reasoning details array, or undefined if none found
 */
export function extractReasoningDetails(
  response: OpenResponsesNonStreamingResponse,
): ReasoningDetails | undefined {
  const extractedDetails: JSONValue[] = [];

  // Extract from output items (Responses API format)
  for (const outputItem of response.output) {
    if ('type' in outputItem && outputItem.type === 'reasoning') {
      const reasoningItem = outputItem as ReasoningOutputItem;

      // Store the full reasoning item structure for round-tripping
      // This preserves all provider-specific fields (signature, encryptedContent, etc.)
      extractedDetails.push({
        type: 'reasoning',
        id: reasoningItem.id,
        content: reasoningItem.content,
        summary: reasoningItem.summary,
        encryptedContent: reasoningItem.encryptedContent,
        signature: reasoningItem.signature,
        format: reasoningItem.format,
      } as JSONValue);
    }
  }

  return extractedDetails.length > 0 ? extractedDetails : undefined;
}

/**
 * Extract reasoning details from streaming response output items.
 *
 * Called at the end of streaming when we have the full response.
 *
 * @param outputItems - The output items from the completed stream response
 * @returns Reasoning details array, or undefined if none found
 */
export function extractReasoningDetailsFromOutput(
  outputItems: Array<{ type: string; [key: string]: unknown }>,
): ReasoningDetails | undefined {
  const extractedDetails: JSONValue[] = [];

  for (const outputItem of outputItems) {
    if (outputItem.type === 'reasoning') {
      const reasoningItem = outputItem as unknown as ReasoningOutputItem;

      extractedDetails.push({
        type: 'reasoning',
        id: reasoningItem.id,
        content: reasoningItem.content,
        summary: reasoningItem.summary,
        encryptedContent: reasoningItem.encryptedContent,
        signature: reasoningItem.signature,
        format: reasoningItem.format,
      } as JSONValue);
    }
  }

  return extractedDetails.length > 0 ? extractedDetails : undefined;
}

// =============================================================================
// Provider Detection
// =============================================================================

/**
 * Check if reasoning details contain encrypted content (Gemini thoughtSignature).
 *
 * This is important for Gemini 3 models which return 'completed' status
 * but expect continuation when tool calls exist with encrypted reasoning.
 *
 * @param reasoningDetails - The extracted reasoning details
 * @returns True if encrypted content is present
 */
export function hasEncryptedReasoning(
  reasoningDetails: ReasoningDetails | undefined,
): boolean {
  if (!reasoningDetails) {
    return false;
  }

  return reasoningDetails.some((d) => {
    if (typeof d === 'object' && d !== null) {
      const obj = d as Record<string, unknown>;
      return obj.encryptedContent != null || obj.type === 'reasoning.encrypted';
    }
    return false;
  });
}

/**
 * Build provider metadata object with reasoning details.
 *
 * @param reasoningDetails - The reasoning details to include
 * @returns Provider metadata object for attachment to content parts (SharedV3ProviderMetadata compatible)
 */
export function buildReasoningProviderMetadata(
  reasoningDetails: ReasoningDetails | undefined,
): Record<string, JSONObject> | undefined {
  if (!reasoningDetails || reasoningDetails.length === 0) {
    return undefined;
  }

  return {
    openrouter: {
      reasoning_details: reasoningDetails,
    } as JSONObject,
  };
}

// =============================================================================
// Re-export types for convenience
// =============================================================================

export type { OpenResponsesReasoning };
