import type {
  LanguageModelV2FilePart,
  LanguageModelV2Message,
  LanguageModelV2Prompt,
  LanguageModelV2ReasoningPart,
  LanguageModelV2TextPart,
  LanguageModelV2ToolCallPart,
} from '@ai-sdk/provider';
import type {
  ChatMessageContentItem,
  ChatMessageToolCall,
  Message,
  OpenResponsesEasyInputMessage,
  OpenResponsesFunctionCallOutput,
  OpenResponsesFunctionToolCall,
  OpenResponsesInput,
  OpenResponsesReasoning,
  ResponseInputFile,
  ResponseInputImage,
  ResponseInputText,
} from '@openrouter/sdk/esm/models';

// =============================================================================
// Type Utilities
// =============================================================================

/**
 * Exhaustive check helper - ensures all cases are handled in switch statements.
 * If this function is reached, TypeScript will error because `value` should be `never`.
 */
function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unhandled discriminated union member: ${JSON.stringify(value)}`);
}

// =============================================================================
// Discriminated Union Types for File Data
// =============================================================================

type FileDataUrl = {
  kind: 'url';
  value: string;
};
type FileDataBase64 = {
  kind: 'base64';
  value: string;
};
type FileDataUint8Array = {
  kind: 'uint8array';
  value: Uint8Array;
};
type FileDataUnknown = {
  kind: 'unknown';
  value: unknown;
};

type ClassifiedFileData = FileDataUrl | FileDataBase64 | FileDataUint8Array | FileDataUnknown;

/**
 * Classify file data into a discriminated union for type-safe handling
 */
function classifyFileData(data: string | URL | Uint8Array): ClassifiedFileData {
  if (data instanceof Uint8Array) {
    return {
      kind: 'uint8array',
      value: data,
    };
  }

  if (data instanceof URL) {
    return {
      kind: 'url',
      value: data.toString(),
    };
  }

  if (typeof data === 'string') {
    if (data.startsWith('http://') || data.startsWith('https://')) {
      return {
        kind: 'url',
        value: data,
      };
    }
    if (data.startsWith('data:')) {
      const base64Match = data.match(/base64,(.+)$/);
      return base64Match
        ? {
          kind: 'base64',
          value: base64Match[1],
        }
        : {
          kind: 'base64',
          value: data,
        };
    }
    // Assume raw base64 string
    return {
      kind: 'base64',
      value: data,
    };
  }

  return {
    kind: 'unknown',
    value: data,
  };
}

// =============================================================================
// Tool Output Type Handling
// =============================================================================

type ToolOutputType = 'error-text' | 'error-json' | 'text' | 'json' | 'content';

interface ToolOutputResult {
  type: ToolOutputType;
  value: unknown;
}

function isKnownToolOutputType(type: string): type is ToolOutputType {
  return [
    'error-text',
    'error-json',
    'text',
    'json',
    'content',
  ].includes(type);
}

/**
 * Convert tool output to string based on output type
 */
function toolOutputToString(output: ToolOutputResult): string {
  switch (output.type) {
    case 'error-text':
      return `Error: ${output.value}`;

    case 'error-json':
      return `Error: ${JSON.stringify(output.value)}`;

    case 'text':
      return String(output.value);

    case 'json':
      return JSON.stringify(output.value);

    case 'content': {
      if (!Array.isArray(output.value)) {
        return JSON.stringify(output.value);
      }
      return output.value
        .map((item: { type: string; text?: string; data?: unknown; mediaType?: string }) => {
          switch (item.type) {
            case 'text':
              return item.text ?? '';
            case 'media':
              return `[Image: ${item.mediaType ?? 'image'}]`;
            default:
              return '';
          }
        })
        .filter(Boolean)
        .join('\n');
    }

    default:
      return assertNever(output.type);
  }
}

// =============================================================================
// User Message Part Types and Converters
// =============================================================================

type UserContentPart = LanguageModelV2TextPart | LanguageModelV2FilePart;

interface ConvertedUserPart {
  chatItem: ChatMessageContentItem | null;
  responsesItem: ResponsesContentItem | null;
}

function convertUserTextPart(part: LanguageModelV2TextPart): ConvertedUserPart {
  const providerOpts = part.providerOptions as
    | {
      openrouter?: {
        cache_control?: unknown;
      };
    }
    | undefined;
  const cacheControl = providerOpts?.openrouter?.cache_control;

  const chatItem: ChatMessageContentItem & {
    cache_control?: unknown;
  } = {
    type: 'text',
    text: part.text,
  };
  const responsesItem: ResponseInputText & {
    cache_control?: unknown;
  } = {
    type: 'input_text',
    text: part.text,
  };

  if (cacheControl) {
    chatItem.cache_control = cacheControl;
    responsesItem.cache_control = cacheControl;
  }

  return {
    chatItem,
    responsesItem,
  };
}

function convertUserFilePart(part: LanguageModelV2FilePart): ConvertedUserPart {
  const chatItem = convertFilePartToChatItem(part);
  const responsesItem = convertFilePartToResponsesItem(part);
  return {
    chatItem,
    responsesItem,
  };
}

function convertUserPart(part: UserContentPart): ConvertedUserPart {
  switch (part.type) {
    case 'text':
      return convertUserTextPart(part);

    case 'file':
      return convertUserFilePart(part);

    default:
      return assertNever(
        part,
        `Unsupported user message part type: ${(
          part as {
            type: string;
          }
        ).type
        }`,
      );
  }
}

// =============================================================================
// Assistant Message Part Types and Converters
// =============================================================================

type AssistantContentPart =
  | LanguageModelV2TextPart
  | LanguageModelV2ReasoningPart
  | LanguageModelV2ToolCallPart
  | LanguageModelV2FilePart;

interface AssistantPartResult {
  textContent: string;
  reasoningContent: string;
  chatContentItems: ChatMessageContentItem[];
  responsesContentItems: ResponsesContentItem[];
  chatToolCalls: ChatMessageToolCall[];
  responsesFunctionCalls: OpenResponsesFunctionToolCall[];
}

function createEmptyAssistantResult(): AssistantPartResult {
  return {
    textContent: '',
    reasoningContent: '',
    chatContentItems: [],
    responsesContentItems: [],
    chatToolCalls: [],
    responsesFunctionCalls: [],
  };
}

function processAssistantTextPart(
  part: LanguageModelV2TextPart,
  result: AssistantPartResult,
): void {
  result.textContent += part.text;
}

function processAssistantReasoningPart(
  part: LanguageModelV2ReasoningPart,
  result: AssistantPartResult,
): void {
  result.reasoningContent += part.text;
}

function processAssistantToolCallPart(
  part: LanguageModelV2ToolCallPart,
  result: AssistantPartResult,
): void {
  const args = typeof part.input === 'string' ? part.input : JSON.stringify(part.input);

  result.chatToolCalls.push({
    id: part.toolCallId,
    type: 'function',
    function: {
      name: part.toolName,
      arguments: args,
    },
  });

  // Extract reasoning details from tool call part
  const partWithMeta = part as LanguageModelV2ToolCallPart & {
    providerOptions?: {
      openrouter?: {
        reasoning_details?: OpenResponsesReasoning[];
      };
    };
    providerMetadata?: {
      openrouter?: {
        reasoning_details?: OpenResponsesReasoning[];
      };
    };
    experimental_providerMetadata?: {
      openrouter?: {
        reasoning_details?: OpenResponsesReasoning[];
      };
    };
  };

  const sdkReasoningDetails =
    partWithMeta.providerOptions?.openrouter?.reasoning_details ??
    partWithMeta.providerMetadata?.openrouter?.reasoning_details ??
    partWithMeta.experimental_providerMetadata?.openrouter?.reasoning_details;

  const reasoningItems = transformReasoningToApiFormat(sdkReasoningDetails ?? []);

  const functionCall: OpenResponsesFunctionToolCall & {
    reasoning_details?: ApiReasoningDetailItem[];
  } = {
    type: 'function_call',
    callId: part.toolCallId,
    id: part.toolCallId,
    name: part.toolName,
    arguments: args,
    status: 'completed',
  };

  if (reasoningItems.length > 0) {
    functionCall.reasoning_details = reasoningItems;
  }

  result.responsesFunctionCalls.push(functionCall);
}

function processAssistantFilePart(
  part: LanguageModelV2FilePart,
  result: AssistantPartResult,
): void {
  const chatItem = convertFilePartToChatItem(part);
  const responsesItem = convertFilePartToResponsesItem(part);

  if (chatItem) {
    result.chatContentItems.push(chatItem);
  }
  if (responsesItem) {
    result.responsesContentItems.push(responsesItem);
  }
}

function processAssistantPart(part: AssistantContentPart, result: AssistantPartResult): void {
  switch (part.type) {
    case 'text':
      processAssistantTextPart(part, result);
      break;

    case 'reasoning':
      processAssistantReasoningPart(part, result);
      break;

    case 'tool-call':
      processAssistantToolCallPart(part, result);
      break;

    case 'file':
      processAssistantFilePart(part, result);
      break;

    default:
  }
}

// =============================================================================
// File Part Converters
// =============================================================================

type MediaCategory = 'image' | 'other';

function categorizeMediaType(mediaType: string): MediaCategory {
  return mediaType.startsWith('image/') ? 'image' : 'other';
}

function convertFilePartToChatItem(part: LanguageModelV2FilePart): ChatMessageContentItem | null {
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

function convertFilePartToResponsesItem(
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

/**
 * Convert classified file data to a URL (either http URL or data URL)
 */
function classifiedDataToUrl(classifiedData: ClassifiedFileData, mediaType: string): string | null {
  switch (classifiedData.kind) {
    case 'url':
      return classifiedData.value;

    case 'base64':
      return `data:${mediaType ?? 'application/octet-stream'};base64,${classifiedData.value}`;

    case 'uint8array': {
      const base64 = Buffer.from(classifiedData.value).toString('base64');
      return `data:${mediaType ?? 'application/octet-stream'};base64,${base64}`;
    }

    case 'unknown':
      return null;

    default:
      return assertNever(classifiedData);
  }
}

// =============================================================================
// Content Collapse Utilities
// =============================================================================

type ResponsesContentItem = ResponseInputText | ResponseInputImage | ResponseInputFile;

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

function buildResponsesContent(
  items: ResponsesContentItem[],
): OpenResponsesEasyInputMessage['content'] {
  if (items.length === 0) {
    return '';
  }

  // Only collapse to string if single text item without extra properties
  if (items.length === 1 && items[0].type === 'input_text') {
    const item = items[0] as ResponseInputText & {
      cache_control?: unknown;
    };
    if (!item.cache_control) {
      return item.text;
    }
  }

  return items;
}

// =============================================================================
// Message Role Converters
// =============================================================================

type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Convert user message to OpenRouter Chat format
 */
function convertUserMessage(
  message: LanguageModelV2Message & {
    role: 'user';
  },
): Message {
  if (typeof message.content === 'string') {
    return {
      role: 'user',
      content: message.content,
    };
  }

  const contentItems: ChatMessageContentItem[] = [];

  for (const part of message.content) {
    const { chatItem } = convertUserPart(part);
    if (chatItem) {
      contentItems.push(chatItem);
    }
  }

  return {
    role: 'user',
    content: collapseChatContent(contentItems) ?? '',
  };
}

/**
 * Convert assistant message to OpenRouter Chat format
 */
function convertAssistantMessage(
  message: LanguageModelV2Message & {
    role: 'assistant';
  },
): Message {
  const result = createEmptyAssistantResult();

  for (const part of message.content) {
    // Filter to only assistant-relevant parts (skip tool-result which belongs in tool messages)
    if (part.type === 'tool-result') {
      continue;
    }
    processAssistantPart(part as AssistantContentPart, result);
  }

  // Add accumulated text content
  if (result.textContent) {
    result.chatContentItems.push({
      type: 'text',
      text: result.textContent,
    });
  }

  const assistantMessage: Extract<
    Message,
    {
      role: 'assistant';
    }
  > = {
    role: 'assistant',
  };

  const content = collapseChatContent(result.chatContentItems);
  if (content !== undefined) {
    assistantMessage.content = content;
  } else if (result.chatToolCalls.length === 0) {
    assistantMessage.content = '';
  }

  if (result.reasoningContent) {
    assistantMessage.reasoning = result.reasoningContent;
  }

  if (result.chatToolCalls.length > 0) {
    assistantMessage.toolCalls = result.chatToolCalls;
  }

  return assistantMessage;
}

/**
 * Convert tool message to OpenRouter Chat format
 */
function convertToolMessage(
  message: LanguageModelV2Message & {
    role: 'tool';
  },
): Message[] {
  return message.content
    .filter(
      (
        part,
      ): part is typeof part & {
        type: 'tool-result';
      } => part.type === 'tool-result',
    )
    .map((part) => {
      const output = part.output as {
        type: string;
        value: unknown;
      };
      const content = isKnownToolOutputType(output.type)
        ? toolOutputToString(output as ToolOutputResult)
        : JSON.stringify(output);

      return {
        role: 'tool' as const,
        content,
        toolCallId: part.toolCallId,
      };
    });
}

// =============================================================================
// Main Conversion Functions
// =============================================================================

/**
 * Convert AI SDK V2 prompt to OpenRouter messages
 */
export function convertToOpenRouterMessages(prompt: LanguageModelV2Prompt): Message[] {
  const messages: Message[] = [];

  for (const message of prompt) {
    const role = message.role as MessageRole;

    switch (role) {
      case 'system':
        messages.push({
          role: 'system',
          content: (
            message as LanguageModelV2Message & {
              role: 'system';
            }
          ).content,
        });
        break;

      case 'user':
        messages.push(
          convertUserMessage(
            message as LanguageModelV2Message & {
              role: 'user';
            },
          ),
        );
        break;

      case 'assistant':
        messages.push(
          convertAssistantMessage(
            message as LanguageModelV2Message & {
              role: 'assistant';
            },
          ),
        );
        break;

      case 'tool':
        messages.push(
          ...convertToolMessage(
            message as LanguageModelV2Message & {
              role: 'tool';
            },
          ),
        );
        break;

      default:
        assertNever(role, `Unsupported message role: ${role}`);
    }
  }

  return messages;
}

/**
 * Extract reasoning content from OpenRouter response
 */
export function extractReasoningFromResponse(message: {
  content?: string;
  reasoning_content?: string;
  reasoning_details?: {
    content?: string;
  };
}): {
  content: string;
  reasoningContent?: string;
} {
  const reasoningContent = message.reasoning_content ?? message.reasoning_details?.content;

  return {
    content: message.content ?? '',
    ...(reasoningContent && {
      reasoningContent,
    }),
  };
}

// =============================================================================
// Responses API Converters
// =============================================================================

/**
 * Convert user message to Responses API format
 */
function convertUserToResponsesInput(
  message: LanguageModelV2Message & {
    role: 'user';
  },
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
    const { responsesItem } = convertUserPart(part);
    if (responsesItem) {
      content.push(responsesItem);
    }
  }

  return {
    type: 'message',
    role: 'user',
    content: buildResponsesContent(content),
  };
}


/**
 * API format reasoning detail item.
 * Items have types like 'reasoning.summary', 'reasoning.text', 'reasoning.encrypted'.
 */
type ApiReasoningDetailItem = {
  type: 'reasoning.text' | 'reasoning.summary' | 'reasoning.encrypted';
  id: string;
  format?: string | null;
  index: number;
  // For reasoning.text
  text?: string;
  signature?: string | null;
  // For reasoning.summary
  summary?: string;
  // For reasoning.encrypted
  data?: string;
};

/**
 * Transform SDK format reasoning to API format.
 * SDK format: { type: "reasoning", content: [...], summary: [...], encryptedContent: "..." }
 * API format: [{ type: "reasoning.text", ... }, { type: "reasoning.summary", ... }, { type: "reasoning.encrypted", ... }]
 */
function transformReasoningToApiFormat(
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
 * Extract reasoning details from message metadata.
 * Transforms from SDK format to API format for sending back to the API.
 */
function extractReasoningDetails(
  message: LanguageModelV2Message & {
    role: 'assistant';
  },
): ApiReasoningDetailItem[] {
  type OpenRouterMeta = {
    reasoning_details?: OpenResponsesReasoning[];
  };

  // Check multiple locations for reasoning_details
  const messageWithMeta = message as LanguageModelV2Message & {
    role: 'assistant';
    providerOptions?: {
      openrouter?: OpenRouterMeta;
    };
    providerMetadata?: {
      openrouter?: OpenRouterMeta;
    };
    experimental_providerMetadata?: {
      openrouter?: OpenRouterMeta;
    };
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
          providerOptions?: {
            openrouter?: OpenRouterMeta;
          };
          providerMetadata?: {
            openrouter?: OpenRouterMeta;
          };
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
 * Convert assistant message to Responses API format
 */
function convertAssistantToResponsesInput(
  message: LanguageModelV2Message & {
    role: 'assistant';
  },
): {
  assistantMessage: OpenResponsesEasyInputMessage;
  functionCalls: OpenResponsesFunctionToolCall[];
  reasoningItems: ApiReasoningDetailItem[];
} {
  const result = createEmptyAssistantResult();

  for (const part of message.content) {
    // Filter to only assistant-relevant parts (skip tool-result which belongs in tool messages)
    if (part.type === 'tool-result') {
      continue;
    }
    processAssistantPart(part as AssistantContentPart, result);
  }

  // Add accumulated text content
  if (result.textContent) {
    result.responsesContentItems.push({
      type: 'input_text',
      text: result.textContent,
    });
  }

  // Append reasoning content to text if present
  if (result.reasoningContent) {
    const lastTextItem = [
      ...result.responsesContentItems,
    ]
      .reverse()
      .find((item): item is ResponseInputText => item.type === 'input_text');

    if (lastTextItem) {
      lastTextItem.text = lastTextItem.text
        ? `${lastTextItem.text}\n${result.reasoningContent}`
        : result.reasoningContent;
    } else {
      result.responsesContentItems.push({
        type: 'input_text',
        text: result.reasoningContent,
      });
    }
  }

  const reasoningItems = extractReasoningDetails(message);

  return {
    assistantMessage: {
      type: 'message',
      role: 'assistant',
      content: buildResponsesContent(result.responsesContentItems),
    },
    functionCalls: result.responsesFunctionCalls,
    reasoningItems,
  };
}

/**
 * Convert tool message to Responses API format
 */
function convertToolToResponsesInput(
  message: LanguageModelV2Message & {
    role: 'tool';
  },
): OpenResponsesFunctionCallOutput[] {
  return message.content
    .filter(
      (
        part,
      ): part is typeof part & {
        type: 'tool-result';
      } => part.type === 'tool-result',
    )
    .map((part) => {
      const output = part.output as {
        type: string;
        value: unknown;
      };
      const outputString = isKnownToolOutputType(output.type)
        ? toolOutputToString(output as ToolOutputResult)
        : JSON.stringify(output);

      return {
        type: 'function_call_output' as const,
        callId: part.toolCallId,
        id: part.toolCallId,
        output: outputString,
        status: 'completed' as const,
      };
    });
}

/**
 * Convert AI SDK V2 prompt to Responses API input format
 */
export function convertToResponsesInput(prompt: LanguageModelV2Prompt): OpenResponsesInput {
  type ResponsesArray = Exclude<OpenResponsesInput, string>;
  const messages: ResponsesArray = [];

  for (const message of prompt) {
    const role = message.role as MessageRole;

    switch (role) {
      case 'system':
        messages.push({
          type: 'message',
          role: 'system',
          content: (
            message as LanguageModelV2Message & {
              role: 'system';
            }
          ).content,
        });
        break;

      case 'user':
        messages.push(
          convertUserToResponsesInput(
            message as LanguageModelV2Message & {
              role: 'user';
            },
          ),
        );
        break;

      case 'assistant': {
        const { assistantMessage, functionCalls, reasoningItems } =
          convertAssistantToResponsesInput(
            message as LanguageModelV2Message & {
              role: 'assistant';
            },
          );

        // Map reasoning_details to their corresponding function calls by ID
        // reasoning_details can have an 'id' field that matches the function call's callId
        if (reasoningItems.length > 0 && functionCalls.length > 0) {
          // Group reasoning_details by their id
          const reasoningByToolId = new Map<string, ApiReasoningDetailItem[]>();
          const reasoningWithoutId: ApiReasoningDetailItem[] = [];

          for (const reasoningItem of reasoningItems) {
            if (reasoningItem.id) {
              const existing = reasoningByToolId.get(reasoningItem.id) || [];
              existing.push(reasoningItem);
              reasoningByToolId.set(reasoningItem.id, existing);
            } else {
              reasoningWithoutId.push(reasoningItem);
            }
          }

          // Attach reasoning_details to matching function calls
          for (const functionCall of functionCalls) {
            const functionCallWithReasoning = functionCall as OpenResponsesFunctionToolCall & {
              reasoning_details?: ApiReasoningDetailItem[];
            };
            const matchingReasoning = reasoningByToolId.get(functionCall.callId);
            if (matchingReasoning && matchingReasoning.length > 0) {
              // Only add if not already present (avoid duplicates from tool call part extraction)
              if (
                !functionCallWithReasoning.reasoning_details ||
                functionCallWithReasoning.reasoning_details.length === 0
              ) {
                functionCallWithReasoning.reasoning_details = matchingReasoning;
              }
            }
          }

          // If there are reasoning_details without IDs, add them to the assistant message
          if (reasoningWithoutId.length > 0) {
            (
              assistantMessage as OpenResponsesEasyInputMessage & {
                reasoning_details?: ApiReasoningDetailItem[];
              }
            ).reasoning_details = reasoningWithoutId;
          }
        } else if (reasoningItems.length > 0) {
          // No function calls, add all reasoning_details to assistant message
          (
            assistantMessage as OpenResponsesEasyInputMessage & {
              reasoning_details?: ApiReasoningDetailItem[];
            }
          ).reasoning_details = reasoningItems;
        }

        messages.push(assistantMessage);
        messages.push(...functionCalls);
        break;
      }

      case 'tool':
        messages.push(
          ...convertToolToResponsesInput(
            message as LanguageModelV2Message & {
              role: 'tool';
            },
          ),
        );
        break;

      default:
        assertNever(role, `Unsupported message role: ${role}`);
    }
  }

  return messages;
}
