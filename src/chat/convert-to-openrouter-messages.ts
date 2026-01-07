import type {
  JSONValue,
  LanguageModelV3FilePart,
  LanguageModelV3Message,
  LanguageModelV3Prompt,
  LanguageModelV3ReasoningPart,
  LanguageModelV3TextPart,
  LanguageModelV3ToolCallPart,
  LanguageModelV3ToolResultOutput,
  LanguageModelV3ToolResultPart,
} from '@ai-sdk/provider';

/**
 * OpenRouter Responses API input item types.
 * These match the OpenResponsesEasyInputMessage format used by the Responses API.
 */
export type OpenRouterInputItem =
  | OpenRouterEasyInputMessage
  | OpenRouterFunctionCall
  | OpenRouterFunctionCallOutput;

/**
 * Reasoning details item format for API requests.
 * Used to preserve reasoning context across multi-turn conversations.
 */
export interface OpenRouterReasoningDetailItem {
  type: 'reasoning.text' | 'reasoning.summary' | 'reasoning.encrypted';
  id?: string;
  format?: string | null;
  index: number;
  text?: string; // For reasoning.text
  signature?: string | null; // For reasoning.text (Claude)
  summary?: string; // For reasoning.summary
  data?: string; // For reasoning.encrypted (Gemini)
}

/**
 * Reasoning object for assistant messages.
 * Contains the reasoning details to send back to the API.
 */
export interface OpenRouterReasoning {
  text?: string;
  summary?: string;
  encrypted?: string;
}

/**
 * Easy input message format for Responses API.
 * Supports user, system, assistant, and developer roles.
 */
export interface OpenRouterEasyInputMessage {
  type?: 'message';
  role: 'user' | 'system' | 'assistant' | 'developer';
  content: string | OpenRouterInputContent[];
  reasoning?: OpenRouterReasoning;
}

export interface OpenRouterFunctionCall {
  type: 'function_call';
  callId: string;
  name: string;
  arguments: string;
}

export interface OpenRouterFunctionCallOutput {
  type: 'function_call_output';
  callId: string;
  output: string;
  status: 'completed' | 'incomplete';
}

/**
 * Input content types for Responses API.
 * Uses 'input_text', 'input_image', 'input_file' type prefixes.
 */
export type OpenRouterInputContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; imageUrl: string; detail?: 'auto' | 'low' | 'high' }
  | { type: 'input_file'; fileUrl: string; filename?: string };

/**
 * Converts AI SDK V3 prompt format to OpenRouter Responses API input format.
 *
 * Mapping table:
 * - system { content } -> { role: 'system', content: string }
 * - user text -> { role: 'user', content: [{ type: 'input_text', text }] }
 * - user image -> { role: 'user', content: [{ type: 'input_image', imageUrl }] }
 * - user file -> { role: 'user', content: [{ type: 'input_file', fileUrl }] }
 * - assistant text -> { role: 'assistant', content: string }
 * - assistant tool-call -> { type: 'function_call', ... }
 * - tool result -> { type: 'function_call_output', ... }
 *
 * @param prompt - The AI SDK V3 prompt
 * @returns Array of input items in OpenRouter Responses API format
 */
export function convertToOpenRouterMessages(
  prompt: LanguageModelV3Prompt,
): OpenRouterInputItem[] {
  const result: OpenRouterInputItem[] = [];

  for (const message of prompt) {
    const converted = convertMessage(message);
    result.push(...converted);
  }

  return result;
}

/**
 * Convert a single V3 message to OpenRouter Responses API format.
 * May return multiple items (e.g., when assistant has text + tool calls).
 */
function convertMessage(
  message: LanguageModelV3Message,
): OpenRouterInputItem[] {
  // Extract providerOptions from the message for reasoning_details
  const messageWithOptions = message as LanguageModelV3Message & {
    providerOptions?: Record<string, Record<string, unknown>>;
    providerMetadata?: Record<string, Record<string, unknown>>;
  };
  const providerOptions = messageWithOptions.providerOptions;
  const providerMetadata = messageWithOptions.providerMetadata;

  switch (message.role) {
    case 'system':
      return [{ role: 'system', content: message.content }];

    case 'user':
      return [convertUserMessage(message.content)];

    case 'assistant':
      return convertAssistantMessage(
        message.content,
        providerMetadata,
        providerOptions,
      );

    case 'tool':
      return convertToolMessage(message.content);

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = message;
      throw new Error(
        `Unknown message role: ${(_exhaustive as { role: string }).role}`,
      );
    }
  }
}

/**
 * Convert user message content parts to OpenRouter Responses API format.
 */
function convertUserMessage(
  content: Array<LanguageModelV3TextPart | LanguageModelV3FilePart>,
): OpenRouterEasyInputMessage {
  const convertedContent: OpenRouterInputContent[] = [];

  for (const part of content) {
    switch (part.type) {
      case 'text': {
        convertedContent.push({ type: 'input_text', text: part.text });
        break;
      }

      case 'file':
        convertedContent.push(convertFilePart(part));
        break;

      default: {
        // TypeScript exhaustiveness check
        const _exhaustive: never = part;
        throw new Error(
          `Unknown user content type: ${(_exhaustive as { type: string }).type}`,
        );
      }
    }
  }

  return { role: 'user', content: convertedContent };
}

/**
 * Convert a file part to the appropriate OpenRouter Responses API format.
 *
 * OpenRouter's Responses API uses 'input_image' for images and 'input_file' for other files.
 */
function convertFilePart(
  part: LanguageModelV3FilePart,
): OpenRouterInputContent {
  const url = convertDataContent(part.data, part.mediaType);

  // Check if it's an image based on media type
  if (part.mediaType.startsWith('image/')) {
    return {
      type: 'input_image',
      imageUrl: url,
      detail: 'auto',
    };
  }

  // For other file types (PDF, etc.), use input_file
  return {
    type: 'input_file',
    fileUrl: url,
  };
}

/**
 * Convert data content (URL, string, or Uint8Array) to a string URL or data URI.
 */
function convertDataContent(
  data: URL | string | Uint8Array,
  mediaType: string,
): string {
  if (data instanceof URL) {
    return data.toString();
  }

  if (data instanceof Uint8Array) {
    // Convert Uint8Array to base64 data URI
    const base64 = uint8ArrayToBase64(data);
    return `data:${mediaType};base64,${base64}`;
  }

  // String - could be URL or base64 data
  // If it starts with http(s) or data:, treat as URL/data URI
  if (
    data.startsWith('http://') ||
    data.startsWith('https://') ||
    data.startsWith('data:')
  ) {
    return data;
  }

  // Otherwise assume it's base64 encoded data
  return `data:${mediaType};base64,${data}`;
}

/**
 * Convert Uint8Array to base64 string.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Use browser-compatible base64 encoding
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * SDK format for reasoning items returned from OpenRouter.
 * Used when extracting reasoning_details from providerMetadata.
 */
interface SdkReasoningItem {
  type?: string;
  id?: string;
  format?: string | null;
  signature?: string | null;
  content?: Array<{ type: string; text: string }>;
  summary?: Array<{ type: string; text: string }>;
  encryptedContent?: string;
  // Also support flattened API format
  text?: string;
  data?: string;
  index?: number;
}

/**
 * Extract reasoning_details from providerMetadata or providerOptions.
 * Checks multiple locations for backwards compatibility.
 */
function extractReasoningDetails(
  content: Array<
    | LanguageModelV3TextPart
    | LanguageModelV3FilePart
    | LanguageModelV3ReasoningPart
    | LanguageModelV3ToolCallPart
    | LanguageModelV3ToolResultPart
  >,
  providerMetadata?: Record<string, Record<string, unknown>>,
  providerOptions?: Record<string, Record<string, unknown>>,
): JSONValue[] | undefined {
  // Check message-level metadata first
  const messageLevel =
    providerOptions?.openrouter?.reasoning_details ??
    providerMetadata?.openrouter?.reasoning_details;

  if (messageLevel && Array.isArray(messageLevel) && messageLevel.length > 0) {
    return messageLevel as JSONValue[];
  }

  // Check reasoning content parts for part-level metadata
  for (const part of content) {
    if (part.type === 'reasoning') {
      const partWithMeta = part as LanguageModelV3ReasoningPart & {
        providerMetadata?: Record<string, { reasoning_details?: JSONValue[] }>;
        providerOptions?: Record<string, { reasoning_details?: JSONValue[] }>;
      };
      const partLevel =
        partWithMeta.providerOptions?.openrouter?.reasoning_details ??
        partWithMeta.providerMetadata?.openrouter?.reasoning_details;
      if (partLevel && Array.isArray(partLevel) && partLevel.length > 0) {
        return partLevel as JSONValue[];
      }
    }
  }

  return undefined;
}

/**
 * Transform SDK reasoning format to API request format.
 * Flattens the structure for sending back to OpenRouter.
 */
function transformReasoningToApiFormat(
  sdkItems: JSONValue[],
): OpenRouterReasoningDetailItem[] {
  const apiItems: OpenRouterReasoningDetailItem[] = [];

  for (const rawItem of sdkItems) {
    if (typeof rawItem !== 'object' || rawItem === null) {
      continue;
    }
    const item = rawItem as SdkReasoningItem;

    const baseProps = {
      id: item.id,
      format: item.format ?? null,
    };

    let index = item.index ?? 0;

    // Handle already-flattened API format (reasoning.text, reasoning.summary, reasoning.encrypted)
    if (item.type === 'reasoning.text' && item.text !== undefined) {
      apiItems.push({
        type: 'reasoning.text',
        text: item.text,
        signature: item.signature ?? null,
        index: index,
        ...baseProps,
      });
      continue;
    }

    if (item.type === 'reasoning.summary' && item.summary !== undefined) {
      apiItems.push({
        type: 'reasoning.summary',
        summary: typeof item.summary === 'string' ? item.summary : '',
        index: index,
        ...baseProps,
      });
      continue;
    }

    if (item.type === 'reasoning.encrypted' && item.data !== undefined) {
      apiItems.push({
        type: 'reasoning.encrypted',
        data: item.data,
        index: index,
        ...baseProps,
      });
      continue;
    }

    // Handle SDK format (type: 'reasoning' with content/summary/encryptedContent)
    if (
      item.type === 'reasoning' ||
      item.content ||
      item.summary ||
      item.encryptedContent
    ) {
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

      // Transform encryptedContent to reasoning.encrypted (Gemini)
      if (item.encryptedContent) {
        apiItems.push({
          type: 'reasoning.encrypted',
          data: item.encryptedContent,
          index: index++,
          ...baseProps,
        });
      }
    }
  }

  return apiItems;
}

/**
 * Build OpenRouterReasoning object from reasoning detail items.
 * Combines all items into a single reasoning object for the API.
 */
function buildReasoningFromDetails(
  items: OpenRouterReasoningDetailItem[],
): OpenRouterReasoning | undefined {
  if (items.length === 0) {
    return undefined;
  }

  const reasoning: OpenRouterReasoning = {};

  // Collect all text items
  const textItems = items.filter((i) => i.type === 'reasoning.text' && i.text);
  if (textItems.length > 0) {
    reasoning.text = textItems.map((i) => i.text).join('');
  }

  // Collect all summary items
  const summaryItems = items.filter(
    (i) => i.type === 'reasoning.summary' && i.summary,
  );
  if (summaryItems.length > 0) {
    reasoning.summary = summaryItems.map((i) => i.summary).join('');
  }

  // Collect encrypted content (should be only one)
  const encryptedItem = items.find(
    (i) => i.type === 'reasoning.encrypted' && i.data,
  );
  if (encryptedItem?.data) {
    reasoning.encrypted = encryptedItem.data;
  }

  // Return undefined if no content
  if (!reasoning.text && !reasoning.summary && !reasoning.encrypted) {
    return undefined;
  }

  return reasoning;
}

/**
 * Convert assistant message content parts to OpenRouter Responses API format.
 * Tool calls become separate items in the output array.
 * Extracts reasoning_details from providerMetadata for multi-turn continuation.
 */
function convertAssistantMessage(
  content: Array<
    | LanguageModelV3TextPart
    | LanguageModelV3FilePart
    | LanguageModelV3ReasoningPart
    | LanguageModelV3ToolCallPart
    | LanguageModelV3ToolResultPart
  >,
  providerMetadata?: Record<string, Record<string, unknown>>,
  providerOptions?: Record<string, Record<string, unknown>>,
): OpenRouterInputItem[] {
  const result: OpenRouterInputItem[] = [];
  let textContent = '';

  // Extract reasoning details for multi-turn continuation
  const sdkReasoningDetails = extractReasoningDetails(
    content,
    providerMetadata,
    providerOptions,
  );
  const reasoningItems = sdkReasoningDetails
    ? transformReasoningToApiFormat(sdkReasoningDetails)
    : [];
  const reasoning = buildReasoningFromDetails(reasoningItems);

  for (const part of content) {
    switch (part.type) {
      case 'text':
        textContent += part.text;
        break;

      case 'reasoning':
        // Include reasoning as part of text
        textContent += part.text;
        break;

      case 'tool-call':
        // Tool calls are separate items in Responses API
        result.push({
          type: 'function_call',
          callId: part.toolCallId,
          name: part.toolName,
          arguments:
            typeof part.input === 'string'
              ? part.input
              : JSON.stringify(part.input),
        });
        break;

      case 'file':
        // Files in assistant messages - skip for now as they're typically for output
        break;

      case 'tool-result':
        // Tool results in assistant messages (provider-executed tools)
        result.push(convertToolResult(part));
        break;

      default: {
        // TypeScript exhaustiveness check
        const _exhaustive: never = part;
        throw new Error(
          `Unknown assistant content type: ${(_exhaustive as { type: string }).type}`,
        );
      }
    }
  }

  // If there's text content, add it as an assistant message first
  // Responses API uses simple string content for assistant messages
  if (textContent) {
    const assistantMessage: OpenRouterEasyInputMessage = {
      role: 'assistant',
      content: textContent,
    };
    // Attach reasoning for multi-turn continuation
    if (reasoning) {
      assistantMessage.reasoning = reasoning;
    }
    result.unshift(assistantMessage);
  } else if (reasoning) {
    // Even without text, include reasoning if present (for tool-call only messages)
    const assistantMessage: OpenRouterEasyInputMessage = {
      role: 'assistant',
      content: '',
    };
    assistantMessage.reasoning = reasoning;
    result.unshift(assistantMessage);
  }

  return result;
}

/**
 * Convert tool message content parts to OpenRouter Responses API format.
 */
function convertToolMessage(
  content: Array<
    | LanguageModelV3ToolResultPart
    | {
        type: 'tool-approval-response';
        approvalId: string;
        approved: boolean;
        reason?: string;
      }
  >,
): OpenRouterInputItem[] {
  const result: OpenRouterInputItem[] = [];

  for (const part of content) {
    if (part.type === 'tool-result') {
      result.push(convertToolResult(part));
    }
    // Skip tool-approval-response as it's not directly mapped to OpenRouter format
  }

  return result;
}

/**
 * Convert a tool result part to OpenRouter function_call_output format.
 */
function convertToolResult(
  part: LanguageModelV3ToolResultPart,
): OpenRouterFunctionCallOutput {
  const output = convertToolResultOutput(part.output);

  return {
    type: 'function_call_output',
    callId: part.toolCallId,
    output: output.value,
    status: output.isError ? 'incomplete' : 'completed',
  };
}

/**
 * Convert tool result output to a string value.
 */
function convertToolResultOutput(output: LanguageModelV3ToolResultOutput): {
  value: string;
  isError: boolean;
} {
  switch (output.type) {
    case 'text':
      return { value: output.value, isError: false };

    case 'json':
      return { value: JSON.stringify(output.value), isError: false };

    case 'execution-denied':
      return {
        value: `Execution denied: ${output.reason ?? 'No reason provided'}`,
        isError: true,
      };

    case 'error-text':
      return { value: output.value, isError: true };

    case 'error-json':
      return { value: JSON.stringify(output.value), isError: true };

    case 'content': {
      // For content array, convert to string representation
      const textParts = output.value
        .filter(
          (item): item is { type: 'text'; text: string } =>
            item.type === 'text',
        )
        .map((item) => item.text);
      return { value: textParts.join('\n'), isError: false };
    }

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = output;
      throw new Error(
        `Unknown tool result output type: ${(_exhaustive as { type: string }).type}`,
      );
    }
  }
}
