import type {
  LanguageModelV2Prompt,
  LanguageModelV2Message,
  LanguageModelV2FilePart,
} from '@ai-sdk/provider';

/**
 * OpenRouter message format (OpenAI-compatible)
 */
export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | Array<OpenRouterContentPart>;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  reasoning_content?: string; // OpenRouter-specific for reasoning
}

/**
 * OpenRouter content part for multimodal messages
 */
export type OpenRouterContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

/**
 * Convert AI SDK V2 prompt to OpenRouter messages
 */
export function convertToOpenRouterMessages(
  prompt: LanguageModelV2Prompt,
): OpenRouterMessage[] {
  const messages: OpenRouterMessage[] = [];

  for (const message of prompt) {
    switch (message.role) {
      case 'system':
        messages.push({
          role: 'system',
          content: message.content,
        });
        break;

      case 'user':
        messages.push(convertUserMessage(message));
        break;

      case 'assistant':
        messages.push(convertAssistantMessage(message));
        break;

      case 'tool':
        // Tool messages need special handling for OpenRouter
        const toolMessages = convertToolMessage(message);
        messages.push(...toolMessages);
        break;

      default:
        throw new Error(`Unsupported message role: ${(message as any).role}`);
    }
  }

  return messages;
}

/**
 * Convert user message to OpenRouter format
 */
function convertUserMessage(
  message: LanguageModelV2Message & { role: 'user' },
): OpenRouterMessage {
  // If content is a string, return simple message
  if (typeof message.content === 'string') {
    return {
      role: 'user',
      content: message.content,
    };
  }

  // Handle multimodal content
  const content: OpenRouterContentPart[] = [];

  for (const part of message.content) {
    switch (part.type) {
      case 'text':
        content.push({
          type: 'text',
          text: part.text,
        });
        break;

      case 'file':
        // Convert file to image URL
        const imageUrl = convertFileToUrl(part);
        if (imageUrl) {
          content.push({
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'auto',
            },
          });
        }
        break;

      default:
        throw new Error(`Unsupported user message part type: ${(part as any).type}`);
    }
  }

  return {
    role: 'user',
    content: content.length === 1 && content[0].type === 'text'
      ? content[0].text
      : content,
  };
}

/**
 * Convert assistant message to OpenRouter format
 */
function convertAssistantMessage(
  message: LanguageModelV2Message & { role: 'assistant' },
): OpenRouterMessage {
  const openRouterMessage: OpenRouterMessage = {
    role: 'assistant',
  };

  let textContent = '';
  let reasoningContent = '';
  const toolCalls: OpenRouterMessage['tool_calls'] = [];

  for (const part of message.content) {
    switch (part.type) {
      case 'text':
        textContent += part.text;
        break;

      case 'reasoning':
        // Collect reasoning content separately for OpenRouter
        reasoningContent += part.text;
        break;

      case 'tool-call':
        toolCalls.push({
          id: part.toolCallId,
          type: 'function',
          function: {
            name: part.toolName,
            arguments: typeof part.input === 'string'
              ? part.input
              : JSON.stringify(part.input),
          },
        });
        break;

      case 'file':
        // Assistant files are less common but handle them as text
        // You might want to handle this differently based on your needs
        const fileData = convertFileToBase64(part);
        if (fileData) {
          textContent += `[File: ${part.filename || 'unnamed'} - ${part.mediaType}]`;
        }
        break;

      default:
        // Ignore unknown part types or handle as needed
        console.warn(`Unknown assistant message part type: ${(part as any).type}`);
    }
  }

  // Set content if there's text
  if (textContent) {
    openRouterMessage.content = textContent;
  }

  // Add reasoning content as OpenRouter-specific field
  if (reasoningContent) {
    openRouterMessage.reasoning_content = reasoningContent;
  }

  // Add tool calls if any
  if (toolCalls.length > 0) {
    openRouterMessage.tool_calls = toolCalls;
  }

  // Ensure at least content or tool_calls is present
  if (!openRouterMessage.content && !openRouterMessage.tool_calls?.length && !openRouterMessage.reasoning_content) {
    openRouterMessage.content = '';
  }

  return openRouterMessage;
}

/**
 * Convert tool message to OpenRouter format
 */
function convertToolMessage(
  message: LanguageModelV2Message & { role: 'tool' },
): OpenRouterMessage[] {
  const messages: OpenRouterMessage[] = [];

  for (const part of message.content) {
    if (part.type !== 'tool-result') {
      continue;
    }

    let content: string;

    // Handle different output formats based on V2 spec
    if (part.output.type === 'error-text') {
      content = `Error: ${part.output.value}`;
    } else if (part.output.type === 'error-json') {
      content = `Error: ${JSON.stringify(part.output.value)}`;
    } else if (part.output.type === 'text') {
      content = part.output.value;
    } else if (part.output.type === 'json') {
      content = JSON.stringify(part.output.value);
    } else if (part.output.type === 'content' && Array.isArray(part.output.value)) {
      // Handle rich content results
      const contentParts: string[] = [];
      for (const contentItem of part.output.value) {
        if (contentItem.type === 'text' && contentItem.text) {
          contentParts.push(contentItem.text);
        } else if (contentItem.type === 'media' && 'data' in contentItem && contentItem.data) {
          contentParts.push(`[Image: ${contentItem.mediaType || 'image'}]`);
        }
      }
      content = contentParts.join('\n');
    } else {
      content = JSON.stringify(part.output);
    }

    messages.push({
      role: 'tool',
      content,
      tool_call_id: part.toolCallId,
      name: part.toolName,
    });
  }

  return messages;
}

/**
 * Convert file part to URL for OpenRouter
 */
function convertFileToUrl(part: LanguageModelV2FilePart): string | null {
  // If data is already a URL, return it
  if (typeof part.data === 'string' && part.data.startsWith('http')) {
    return part.data;
  }

  // If data is base64 string, create data URL
  if (typeof part.data === 'string') {
    return `data:${part.mediaType || 'application/octet-stream'};base64,${part.data}`;
  }

  // If data is Uint8Array, convert to base64
  if (part.data instanceof Uint8Array) {
    const base64 = Buffer.from(part.data).toString('base64');
    return `data:${part.mediaType || 'application/octet-stream'};base64,${base64}`;
  }

  return null;
}

/**
 * Convert file part to base64 string
 */
function convertFileToBase64(part: LanguageModelV2FilePart): string | null {
  if (typeof part.data === 'string') {
    // If it's already base64 or a URL, return as is
    return part.data;
  }

  if (part.data instanceof Uint8Array) {
    return Buffer.from(part.data).toString('base64');
  }

  return null;
}

/**
 * Extract reasoning content from OpenRouter response
 */
export function extractReasoningFromResponse(message: any): {
  content: string;
  reasoningContent?: string;
} {
  const result = {
    content: message.content || '',
    reasoningContent: undefined as string | undefined,
  };

  // Check for reasoning_content field (OpenRouter-specific)
  if (message.reasoning_content) {
    result.reasoningContent = message.reasoning_content;
  }

  // Check for reasoning_details (alternative format)
  if (message.reasoning_details?.content) {
    result.reasoningContent = message.reasoning_details.content;
  }

  return result;
}