import type {
  LanguageModelV2Prompt,
  LanguageModelV2Message,
  LanguageModelV2FilePart,
} from '@ai-sdk/provider';
import type {
  ChatMessageContentItem,
  ChatMessageToolCall,
  Message,
  OpenResponsesEasyInputMessage,
  OpenResponsesFunctionCallOutput,
  OpenResponsesFunctionToolCall,
  OpenResponsesInput,
  ResponseInputFile,
  ResponseInputImage,
  ResponseInputText,
} from '@openrouter/sdk/esm/models';

/**
 * Convert AI SDK V2 prompt to OpenRouter messages
 */
export function convertToOpenRouterMessages(
  prompt: LanguageModelV2Prompt,
): Message[] {
  const messages: Message[] = [];

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
): Message {
  if (typeof message.content === 'string') {
    return {
      role: 'user',
      content: message.content,
    };
  }

  const contentItems: ChatMessageContentItem[] = [];

  for (const part of message.content) {
    if (part.type === 'text') {
      const item: ChatMessageContentItem = { type: 'text', text: part.text };
      const cacheControl = (part.providerOptions as any)?.openrouter?.cache_control;
      if (cacheControl) {
        (item as any).cache_control = cacheControl;
      }
      contentItems.push(item);
      continue;
    }

    if (part.type === 'file') {
      const item = convertFilePartToChatItem(part);
      if (item) {
        contentItems.push(item);
        continue;
      }
    }

    throw new Error(`Unsupported user message part type: ${(part as any).type}`);
  }

  const content = collapseChatContent(contentItems);

  return {
    role: 'user',
    content: content ?? '',
  };
}

/**
 * Convert assistant message to OpenRouter format
 */
function convertAssistantMessage(
  message: LanguageModelV2Message & { role: 'assistant' },
): Message {
  const contentItems: ChatMessageContentItem[] = [];
  const toolCalls: ChatMessageToolCall[] = [];
  let textContent = '';
  let reasoningContent = '';

  for (const part of message.content) {
    switch (part.type) {
      case 'text':
        textContent += part.text;
        break;
      case 'reasoning':
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
      case 'file': {
        const item = convertFilePartToChatItem(part);
        if (item) {
          contentItems.push(item);
        }
        break;
      }
      default:
        console.warn(`Unknown assistant message part type: ${(part as any).type}`);
    }
  }

  if (textContent) {
    contentItems.push({ type: 'text', text: textContent });
  }

  const assistantMessage: Extract<Message, { role: 'assistant' }> = {
    role: 'assistant',
  };

  const content = collapseChatContent(contentItems);
  if (content !== undefined) {
    assistantMessage.content = content;
  } else if (toolCalls.length === 0) {
    assistantMessage.content = '';
  }

  if (reasoningContent) {
    assistantMessage.reasoning = reasoningContent;
  }

  if (toolCalls.length > 0) {
    assistantMessage.toolCalls = toolCalls;
  }

  return assistantMessage;
}

/**
 * Convert tool message to OpenRouter format
 */
function convertToolMessage(
  message: LanguageModelV2Message & { role: 'tool' },
): Message[] {
  const messages: Message[] = [];

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
      toolCallId: part.toolCallId,
    });
  }

  return messages;
}

function collapseChatContent(
  items: ChatMessageContentItem[],
): string | ChatMessageContentItem[] | undefined {
  if (items.length === 0) {
    return undefined;
  }

  if (items.length === 1 && items[0].type === 'text') {
    return items[0].text;
  }

  return items;
}

function convertFilePartToChatItem(
  part: LanguageModelV2FilePart,
): ChatMessageContentItem | null {
  if (part.mediaType.startsWith('image/')) {
    const imageUrl = convertFileToUrl(part);
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

  const fileData = convertFileToBase64(part);
  if (fileData) {
    return {
      type: 'file',
      file: {
        fileData,
        filename: part.filename,
      },
    };
  }

  const dataAsUrl =
    typeof part.data === 'string' && part.data.startsWith('http')
      ? part.data
      : part.data instanceof URL
        ? part.data.toString()
        : undefined;

  if (dataAsUrl) {
    return {
      type: 'text',
      text: `[File: ${part.filename || 'file'} - ${dataAsUrl}]`,
    };
  }

  return null;
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
    // If it's a data URI, extract the base64 part
    if (part.data.startsWith('data:')) {
      const base64Match = part.data.match(/base64,(.+)$/);
      if (base64Match) {
        return base64Match[1];
      }
    }
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



/**
 * Convert AI SDK V2 prompt to Responses API input format
 */
export function convertToResponsesInput(
  prompt: LanguageModelV2Prompt,
): OpenResponsesInput {
  type ResponsesArray = Exclude<OpenResponsesInput, string>;
  const messages: ResponsesArray = [];

  for (const message of prompt) {
    switch (message.role) {
      case 'system':
        messages.push({
          type: 'message',
          role: 'system',
          content: message.content,
        });
        break;
      case 'user':
        messages.push(convertUserToResponsesInput(message));
        break;
      case 'assistant': {
        const { assistantMessage, functionCalls, reasoningItems } = convertAssistantToResponsesInput(message);
        // Include reasoning items first (for Gemini multi-turn support with encryptedContent)
        messages.push(...reasoningItems as unknown as ResponsesArray);
        messages.push(assistantMessage);
        messages.push(...functionCalls);
        break;
      }
      case 'tool':
        messages.push(...convertToolToResponsesInput(message));
        break;
      default:
        throw new Error(`Unsupported message role: ${(message as any).role}`);
    }
  }

  return messages;
}

type ResponsesContentItem = ResponseInputText | ResponseInputImage | ResponseInputFile;

/**
 * Convert user message to Responses API format
 */
function convertUserToResponsesInput(
  message: LanguageModelV2Message & { role: 'user' },
): OpenResponsesEasyInputMessage {
  if (typeof message.content === 'string') {
    return {
      type: 'message',
      role: 'user',
      content: message.content,
    };
  }

  const content: ResponsesContentItem[] = [];

  for (const part of message.content) {
    if (part.type === 'text') {
      const item: ResponseInputText = { type: 'input_text', text: part.text };
      const cacheControl = (part.providerOptions as any)?.openrouter?.cache_control;
      if (cacheControl) {
        (item as any).cache_control = cacheControl;
      }
      content.push(item);
    } else if (part.type === 'file') {
      const fileItem = convertFilePartToResponsesItem(part);
      if (fileItem) {
        content.push(fileItem);
      }
    } else {
      throw new Error(`Unsupported user message part type: ${(part as any).type}`);
    }
  }

  return {
    type: 'message',
    role: 'user',
    content: buildResponsesContent(content),
  };
}

// Type for reasoning items from Gemini that must be preserved in multi-turn conversations
interface ReasoningItem {
  type: 'reasoning';
  id?: string;
  encryptedContent?: string;
  summary?: unknown;
  format?: string;
}

/**
 * Convert assistant message to Responses API format
 * Returns the assistant message, function_call items, and reasoning items
 */
function convertAssistantToResponsesInput(
  message: LanguageModelV2Message & { role: 'assistant' },
): {
  assistantMessage: OpenResponsesEasyInputMessage;
  functionCalls: OpenResponsesFunctionToolCall[];
  reasoningItems: ReasoningItem[];
} {
  const content: ResponsesContentItem[] = [];
  const functionCalls: OpenResponsesFunctionToolCall[] = [];
  let textContent = '';
  let reasoningContent = '';

  // Extract reasoning_details from providerOptions (for Gemini multi-turn support)
  const reasoningDetails = (message as any).providerOptions?.openrouter?.reasoning_details as ReasoningItem[] | undefined;
  const reasoningItems: ReasoningItem[] = reasoningDetails || [];

  for (const part of message.content) {
    switch (part.type) {
      case 'text':
        textContent += part.text;
        break;
      case 'reasoning':
        reasoningContent += part.text;
        break;
      case 'file': {
        const fileItem = convertFilePartToResponsesItem(part);
        if (fileItem) {
          content.push(fileItem);
        }
        break;
      }
      case 'tool-call': {
        const functionCall: OpenResponsesFunctionToolCall = {
          type: 'function_call',
          callId: part.toolCallId,
          id: part.toolCallId,
          name: part.toolName,
          arguments: typeof part.input === 'string' ? part.input : JSON.stringify(part.input),
          status: 'completed',
        };
        functionCalls.push(functionCall);
        break;
      }
      default:
        break;
    }
  }

  if (textContent) {
    content.push({ type: 'input_text', text: textContent });
  }

  if (reasoningContent) {
    let existingText: ResponseInputText | undefined;
    for (let i = content.length - 1; i >= 0; i -= 1) {
      const item = content[i];
      if (item.type === 'input_text') {
        existingText = item;
        break;
      }
    }

    if (existingText) {
      existingText.text = existingText.text
        ? `${existingText.text}\n${reasoningContent}`
        : reasoningContent;
    } else {
      content.push({ type: 'input_text', text: reasoningContent });
    }
  }

  const assistantMessage: OpenResponsesEasyInputMessage = {
    type: 'message',
    role: 'assistant',
    content: buildResponsesContent(content),
  };

  return { assistantMessage, functionCalls, reasoningItems };
}

/**
 * Convert tool message to Responses API format
 */
function convertToolToResponsesInput(
  message: LanguageModelV2Message & { role: 'tool' },
): OpenResponsesFunctionCallOutput[] {
  const results: OpenResponsesFunctionCallOutput[] = [];

  for (const part of message.content) {
    if (part.type !== 'tool-result') {
      continue;
    }

    let output: string;

    if (part.output.type === 'error-text') {
      output = `Error: ${part.output.value}`;
    } else if (part.output.type === 'error-json') {
      output = `Error: ${JSON.stringify(part.output.value)}`;
    } else if (part.output.type === 'text') {
      output = part.output.value;
    } else if (part.output.type === 'json') {
      output = JSON.stringify(part.output.value);
    } else if (part.output.type === 'content' && Array.isArray(part.output.value)) {
      const contentParts: string[] = [];
      for (const contentItem of part.output.value) {
        if (contentItem.type === 'text' && contentItem.text) {
          contentParts.push(contentItem.text);
        }
      }
      output = contentParts.join('\n');
    } else {
      output = JSON.stringify(part.output);
    }

    results.push({
      type: 'function_call_output',
      callId: part.toolCallId,
      id: part.toolCallId,
      output,
      status: 'completed',
    });
  }

  return results;
}

function buildResponsesContent(
  items: ResponsesContentItem[],
): OpenResponsesEasyInputMessage['content'] {
  if (items.length === 0) {
    return '';
  }

  // Only collapse to string if no extra properties like cache_control
  if (items.length === 1 && items[0].type === 'input_text') {
    const item = items[0] as any;
    if (!item.cache_control) {
      return items[0].text;
    }
  }

  return items;
}

function convertFilePartToResponsesItem(
  part: LanguageModelV2FilePart,
): ResponsesContentItem | null {
  if (part.mediaType.startsWith('image/')) {
    const imageUrl = convertFileToUrl(part);
    if (!imageUrl) {
      return null;
    }
    const imageItem: ResponseInputImage = {
      type: 'input_image',
      detail: 'auto',
      imageUrl,
    };
    return imageItem;
  }

  const fileItem: ResponseInputFile = {
    type: 'input_file',
    filename: part.filename,
  };

  const base64Data = convertFileToBase64(part);
  if (base64Data) {
    fileItem.fileData = base64Data;
    return fileItem;
  }

  const dataStr =
    typeof part.data === 'string' && part.data.startsWith('http')
      ? part.data
      : part.data instanceof URL
        ? part.data.toString()
        : undefined;

  if (dataStr) {
    fileItem.fileUrl = dataStr;
    return fileItem;
  }

  return null;
}