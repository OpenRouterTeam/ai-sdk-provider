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
 * OpenRouter Responses API input item types.
 * These match the OpenResponsesEasyInputMessage format used by the Responses API.
 */
export type OpenRouterInputItem =
  | OpenRouterEasyInputMessage
  | OpenRouterFunctionCall
  | OpenRouterFunctionCallOutput;

/**
 * Easy input message format for Responses API.
 * Supports user, system, assistant, and developer roles.
 */
export interface OpenRouterEasyInputMessage {
  type?: 'message';
  role: 'user' | 'system' | 'assistant' | 'developer';
  content: string | OpenRouterInputContent[];
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
  prompt: LanguageModelV3Prompt
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
function convertMessage(message: LanguageModelV3Message): OpenRouterInputItem[] {
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
 * Convert user message content parts to OpenRouter Responses API format.
 */
function convertUserMessage(
  content: Array<LanguageModelV3TextPart | LanguageModelV3FilePart>
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
        throw new Error(`Unknown user content type: ${(_exhaustive as { type: string }).type}`);
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
function convertFilePart(part: LanguageModelV3FilePart): OpenRouterInputContent {
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
 * Convert assistant message content parts to OpenRouter Responses API format.
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
): OpenRouterInputItem[] {
  const result: OpenRouterInputItem[] = [];
  let textContent = '';

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
          `Unknown assistant content type: ${(_exhaustive as { type: string }).type}`
        );
      }
    }
  }

  // If there's text content, add it as an assistant message first
  // Responses API uses simple string content for assistant messages
  if (textContent) {
    result.unshift({ role: 'assistant', content: textContent });
  }

  return result;
}

/**
 * Convert tool message content parts to OpenRouter Responses API format.
 */
function convertToolMessage(
  content: Array<LanguageModelV3ToolResultPart | { type: 'tool-approval-response'; approvalId: string; approved: boolean; reason?: string }>
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
function convertToolResult(part: LanguageModelV3ToolResultPart): OpenRouterFunctionCallOutput {
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
