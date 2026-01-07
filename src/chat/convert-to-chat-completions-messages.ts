import type {
  LanguageModelV3Prompt,
  LanguageModelV3Message,
  LanguageModelV3TextPart,
  LanguageModelV3FilePart,
  LanguageModelV3ReasoningPart,
  LanguageModelV3ToolCallPart,
  LanguageModelV3ToolResultPart,
  LanguageModelV3ToolResultOutput,
} from '@ai-sdk/provider';

/**
 * OpenRouter Chat Completions API message types.
 * This format is used for streaming via the /chat/completions endpoint.
 */
export type ChatCompletionsMessage =
  | ChatCompletionsSystemMessage
  | ChatCompletionsUserMessage
  | ChatCompletionsAssistantMessage
  | ChatCompletionsFunctionCall
  | ChatCompletionsFunctionCallOutput;

export interface ChatCompletionsSystemMessage {
  role: 'system';
  content: string;
}

export interface ChatCompletionsUserMessage {
  role: 'user';
  content: string | ChatCompletionsInputContent[];
}

export interface ChatCompletionsAssistantMessage {
  role: 'assistant';
  content: string | ChatCompletionsOutputContent[];
}

export interface ChatCompletionsFunctionCall {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
}

export interface ChatCompletionsFunctionCallOutput {
  type: 'function_call_output';
  call_id: string;
  output: string;
  status?: 'incomplete';
}

/**
 * Cache control directive for Anthropic prompt caching.
 */
export interface CacheControl {
  type: 'ephemeral';
}

export type ChatCompletionsInputContent =
  | { type: 'text'; text: string; cache_control?: CacheControl }
  | { type: 'image_url'; imageUrl: { url: string; detail?: 'auto' | 'low' | 'high' }; cache_control?: CacheControl };

export type ChatCompletionsOutputContent = { type: 'text'; text: string };

/**
 * Converts AI SDK V3 prompt format to OpenRouter Chat Completions API message format.
 * This is used for streaming via the /chat/completions endpoint.
 *
 * Mapping table:
 * - system { content } -> { role: 'system', content: string }
 * - user text -> { role: 'user', content: [{ type: 'text', text }] }
 * - user image -> { role: 'user', content: [{ type: 'image_url', imageUrl }] }
 * - assistant text -> { role: 'assistant', content: [{ type: 'text', text }] }
 * - assistant tool-call -> { type: 'function_call', ... }
 * - tool result -> { type: 'function_call_output', ... }
 *
 * @param prompt - The AI SDK V3 prompt
 * @returns Array of messages in OpenRouter Chat Completions format
 */
export function convertToChatCompletionsMessages(
  prompt: LanguageModelV3Prompt
): ChatCompletionsMessage[] {
  const result: ChatCompletionsMessage[] = [];

  for (const message of prompt) {
    const converted = convertMessage(message);
    result.push(...converted);
  }

  return result;
}

/**
 * Convert a single V3 message to Chat Completions format.
 * May return multiple messages (e.g., when assistant has text + tool calls).
 */
function convertMessage(message: LanguageModelV3Message): ChatCompletionsMessage[] {
  switch (message.role) {
    case 'system':
      return [{ role: 'system', content: message.content }];

    case 'user':
      return [convertUserMessage(message.content)];

    case 'assistant':
      return convertAssistantMessage(message.content);

    case 'tool':
      return convertToolMessage(message.content);

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = message;
      throw new Error(`Unknown message role: ${(_exhaustive as { role: string }).role}`);
    }
  }
}

/**
 * Convert user message content parts to Chat Completions format.
 */
function convertUserMessage(
  content: Array<LanguageModelV3TextPart | LanguageModelV3FilePart>
): ChatCompletionsUserMessage {
  const convertedContent: ChatCompletionsInputContent[] = [];

  for (const part of content) {
    switch (part.type) {
      case 'text': {
        const textContent: ChatCompletionsInputContent = { type: 'text', text: part.text };
        // Extract cache_control from providerOptions.openrouter
        const cacheControl = (part.providerOptions?.openrouter as Record<string, unknown> | undefined)?.cache_control as CacheControl | undefined;
        if (cacheControl) {
          textContent.cache_control = cacheControl;
        }
        convertedContent.push(textContent);
        break;
      }

      case 'file':
        convertedContent.push(convertFilePart(part));
        break;

      default: {
        // TypeScript exhaustiveness check
        const _exhaustive: never = part;
        throw new Error(`Unknown user content type: ${(_exhaustive as { type: string }).type}`);
      }
    }
  }

  return { role: 'user', content: convertedContent };
}

/**
 * Convert a file part to the appropriate Chat Completions format.
 *
 * OpenRouter's Chat API uses `image_url` type for all URL-based content.
 * The file-parser plugin handles non-image files (PDFs, etc.) automatically
 * when URLs are provided in the message content.
 */
function convertFilePart(part: LanguageModelV3FilePart): ChatCompletionsInputContent {
  // OpenRouter Chat API uses image_url type for all file URLs
  // The file-parser plugin handles non-image files (PDFs, etc.)
  return {
    type: 'image_url',
    imageUrl: {
      url: convertDataContent(part.data, part.mediaType),
      detail: 'auto',
    },
  };
}

/**
 * Convert data content (URL, string, or Uint8Array) to a string URL or data URI.
 */
function convertDataContent(
  data: URL | string | Uint8Array,
  mediaType: string
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
  if (data.startsWith('http://') || data.startsWith('https://') || data.startsWith('data:')) {
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
 * Convert assistant message content parts to Chat Completions format.
 * Tool calls become separate items in the output array.
 */
function convertAssistantMessage(
  content: Array<
    | LanguageModelV3TextPart
    | LanguageModelV3FilePart
    | LanguageModelV3ReasoningPart
    | LanguageModelV3ToolCallPart
    | LanguageModelV3ToolResultPart
  >
): ChatCompletionsMessage[] {
  const result: ChatCompletionsMessage[] = [];
  const textContent: ChatCompletionsOutputContent[] = [];

  for (const part of content) {
    switch (part.type) {
      case 'text':
        textContent.push({ type: 'text', text: part.text });
        break;

      case 'reasoning':
        // Include reasoning as text
        textContent.push({ type: 'text', text: part.text });
        break;

      case 'tool-call':
        // Tool calls are separate items
        result.push({
          type: 'function_call',
          call_id: part.toolCallId,
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
          `Unknown assistant content type: ${(_exhaustive as { type: string }).type}`
        );
      }
    }
  }

  // If there's text content, add it as an assistant message first
  if (textContent.length > 0) {
    result.unshift({ role: 'assistant', content: textContent });
  }

  return result;
}

/**
 * Convert tool message content parts to Chat Completions format.
 */
function convertToolMessage(
  content: Array<LanguageModelV3ToolResultPart | { type: 'tool-approval-response'; approvalId: string; approved: boolean; reason?: string }>
): ChatCompletionsMessage[] {
  const result: ChatCompletionsMessage[] = [];

  for (const part of content) {
    if (part.type === 'tool-result') {
      result.push(convertToolResult(part));
    }
    // Skip tool-approval-response as it's not directly mapped to OpenRouter format
  }

  return result;
}

/**
 * Convert a tool result part to Chat Completions function_call_output format.
 */
function convertToolResult(part: LanguageModelV3ToolResultPart): ChatCompletionsFunctionCallOutput {
  const output = convertToolResultOutput(part.output);

  const result: ChatCompletionsFunctionCallOutput = {
    type: 'function_call_output',
    call_id: part.toolCallId,
    output: output.value,
  };

  if (output.isError) {
    result.status = 'incomplete';
  }

  return result;
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
        .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
        .map((item) => item.text);
      return { value: textParts.join('\n'), isError: false };
    }

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = output;
      throw new Error(`Unknown tool result output type: ${(_exhaustive as { type: string }).type}`);
    }
  }
}
