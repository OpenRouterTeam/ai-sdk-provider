import type { ReasoningDetailUnion } from '@/src/schemas/reasoning-details';

/**
 * Type for OpenRouter Cache Control, following Anthropic's pattern.
 */
export type OpenRouterCacheControl = { type: 'ephemeral' };

/**
 * The input for the OpenRouter chat completions API.
 */
export type OpenRouterChatCompletionsInput = Array<ChatCompletionMessageParam>;

/**
 * A message in the chat completion.
 */
export type ChatCompletionMessageParam =
  | ChatCompletionSystemMessageParam
  | ChatCompletionUserMessageParam
  | ChatCompletionAssistantMessageParam
  | ChatCompletionToolMessageParam;

/**
 * A system message in the chat completion.
 */
export interface ChatCompletionSystemMessageParam {
  /**
   * The role of the message.
   */
  role: 'system';
  /**
   * The content of the message.
   */
  content: string;
  /**
   * The cache control for the message.
   */
  cache_control?: OpenRouterCacheControl;
}

/**
 * A user message in the chat completion.
 */
export interface ChatCompletionUserMessageParam {
  /**
   * The role of the message.
   */
  role: 'user';
  /**
   * The content of the message.
   */
  content: string | Array<ChatCompletionContentPart>;
  /**
   * The cache control for the message.
   */
  cache_control?: OpenRouterCacheControl;
}

/**
 * A part of the content of a user message.
 */
export type ChatCompletionContentPart =
  | ChatCompletionContentPartText
  | ChatCompletionContentPartImage
  | ChatCompletionContentPartFile;

/**
 * A file part of the content of a user message.
 */
export interface ChatCompletionContentPartFile {
  /**
   * The type of the content part.
   */
  type: 'file';
  /**
   * The file content.
   */
  file: {
    /**
     * The name of the file.
     */
    filename: string;
    /**
     * The data of the file.
     */
    file_data: string;
  };
  /**
   * The cache control for the content part.
   */
  cache_control?: OpenRouterCacheControl;
}

/**
 * An image part of the content of a user message.
 */
export interface ChatCompletionContentPartImage {
  /**
   * The type of the content part.
   */
  type: 'image_url';
  /**
   * The image URL.
   */
  image_url: {
    /**
     * The URL of the image.
     */
    url: string;
  };
  /**
   * The cache control for the content part.
   */
  cache_control?: OpenRouterCacheControl;
}

/**
 * A text part of the content of a user message.
 */
export interface ChatCompletionContentPartText {
  /**
   * The type of the content part.
   */
  type: 'text';
  /**
   * The text content.
   */
  text: string;
  /**
   * The reasoning for the text.
   */
  reasoning?: string | null;
  /**
   * The cache control for the content part.
   */
  cache_control?: OpenRouterCacheControl;
}

/**
 * An assistant message in the chat completion.
 */
export interface ChatCompletionAssistantMessageParam {
  /**
   * The role of the message.
   */
  role: 'assistant';
  /**
   * The content of the message.
   */
  content?: string | null;
  /**
   * The reasoning for the message.
   */
  reasoning?: string | null;
  /**
   * Details about the reasoning.
   */
  reasoning_details?: ReasoningDetailUnion[];
  /**
   * The tool calls in the message.
   */
  tool_calls?: Array<ChatCompletionMessageToolCall>;
  /**
   * The cache control for the message.
   */
  cache_control?: OpenRouterCacheControl;
}

/**
 * A tool call in an assistant message.
 */
export interface ChatCompletionMessageToolCall {
  /**
   * The type of the tool call.
   */
  type: 'function';
  /**
   * The ID of the tool call.
   */
  id: string;
  /**
   * The function that was called.
   */
  function: {
    /**
     * The arguments of the function.
     */
    arguments: string;
    /**
     * The name of the function.
     */
    name: string;
  };
}

/**
 * A tool message in the chat completion.
 */
export interface ChatCompletionToolMessageParam {
  /**
   * The role of the message.
   */
  role: 'tool';
  /**
   * The content of the message.
   */
  content: string;
  /**
   * The ID of the tool call that this message is a response to.
   */
  tool_call_id: string;
  /**
   * The cache control for the message.
   */
  cache_control?: OpenRouterCacheControl;
}
