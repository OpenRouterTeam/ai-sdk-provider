import type { JSONValue, SharedV2ProviderMetadata } from '@ai-sdk/provider';
import type { OpenResponsesUsage } from '@openrouter/sdk/esm/models';

import { pruneUndefined } from './utils';

/**
 * Build usage metadata from OpenRouter response usage.
 * Transforms OpenRouter's usage format to the AI SDK's expected format.
 */
export function buildUsageMetadata(
  usage?: OpenResponsesUsage,
): Record<string, JSONValue> | undefined {
  if (!usage) {
    return undefined;
  }

  const metadata: Record<string, JSONValue> = {
    promptTokens: usage.inputTokens,
    completionTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  };

  if (usage.inputTokensDetails) {
    metadata.promptTokensDetails = usage.inputTokensDetails;
  }

  if (usage.outputTokensDetails) {
    metadata.completionTokensDetails = usage.outputTokensDetails;
  }

  if (usage.cost !== undefined && usage.cost !== null) {
    metadata.cost = usage.cost;
  }

  if (usage.isByok !== undefined) {
    metadata.isByok = usage.isByok;
  }

  if (usage.costDetails) {
    metadata.costDetails = pruneUndefined(usage.costDetails);
  }

  return metadata;
}

/**
 * Build provider metadata for AI SDK responses.
 * Includes model info, usage data, and reasoning details for multi-turn support.
 */
export function buildProviderMetadata({
  modelId,
  usage,
  output,
  messageReasoningDetails,
}: {
  modelId: string | undefined;
  usage?: OpenResponsesUsage;
  output?: unknown[];
  messageReasoningDetails?: JSONValue[];
}): SharedV2ProviderMetadata {
  const providerRecord: Record<string, JSONValue> = {
    provider: modelId?.split('/')[0] || 'unknown',
  };

  if (modelId) {
    providerRecord.model_id = modelId;
  }

  const usageMetadata = buildUsageMetadata(usage);
  if (usageMetadata) {
    providerRecord.usage = usageMetadata;
  }

  // Include reasoning_details from the message for multi-turn support
  // First try the message's reasoning_details, then fallback to output items
  if (messageReasoningDetails && messageReasoningDetails.length > 0) {
    providerRecord.reasoning_details = messageReasoningDetails;
  } else if (output) {
    // Fallback: extract reasoning_details from output message
    for (const item of output) {
      if (
        typeof item === 'object' &&
        item !== null &&
        'type' in item &&
        (
          item as {
            type: string;
          }
        ).type === 'message'
      ) {
        const msg = item as {
          reasoning_details?: JSONValue[];
        };
        if (
          msg.reasoning_details &&
          Array.isArray(msg.reasoning_details) &&
          msg.reasoning_details.length > 0
        ) {
          providerRecord.reasoning_details = msg.reasoning_details;
          break;
        }
      }
    }
  }

  return {
    openrouter: providerRecord,
  };
}
