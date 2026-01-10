import type { ReasoningDetailUnion } from '@/src/schemas/reasoning-details';

// Type for LLMGateway Cache Control following Anthropic's pattern
export type LLMGatewayCacheControl = { type: 'ephemeral' };

export type LLMGatewayChatCompletionsInput = Array<ChatCompletionMessageParam>;

export type ChatCompletionMessageParam =
  | ChatCompletionSystemMessageParam
  | ChatCompletionUserMessageParam
  | ChatCompletionAssistantMessageParam
  | ChatCompletionToolMessageParam;

export interface ChatCompletionSystemMessageParam {
  role: 'system';
  content: string;
  cache_control?: LLMGatewayCacheControl;
}

export interface ChatCompletionUserMessageParam {
  role: 'user';
  content: string | Array<ChatCompletionContentPart>;
  cache_control?: LLMGatewayCacheControl;
}

export type ChatCompletionContentPart =
  | ChatCompletionContentPartText
  | ChatCompletionContentPartImage
  | ChatCompletionContentPartFile;

export interface ChatCompletionContentPartFile {
  type: 'file';
  file: {
    filename: string;
    file_data: string;
  };
  cache_control?: LLMGatewayCacheControl;
}

export interface ChatCompletionContentPartImage {
  type: 'image_url';
  image_url: {
    url: string;
  };
  cache_control?: LLMGatewayCacheControl;
}

export interface ChatCompletionContentPartText {
  type: 'text';
  text: string;
  reasoningText?: string | null;
  cache_control?: LLMGatewayCacheControl;
}

export interface ChatCompletionAssistantMessageParam {
  role: 'assistant';
  content?: string | null;
  reasoningText?: string | null;
  reasoning_details?: ReasoningDetailUnion[];
  tool_calls?: Array<ChatCompletionMessageToolCall>;
  cache_control?: LLMGatewayCacheControl;
}

export interface ChatCompletionMessageToolCall {
  type: 'function';
  id: string;
  function: {
    arguments: string;
    name: string;
  };
}

export interface ChatCompletionToolMessageParam {
  role: 'tool';
  content: string;
  tool_call_id: string;
  cache_control?: LLMGatewayCacheControl;
}
