import type { OpenRouterCacheControl } from '../types/openrouter-chat-completions-input';
import type { OpenRouterChatCompletionsInput } from '../types/openrouter-chat-completions-input';

export interface NvidiaChatCompletionContentPartVideo {
  type: 'video_url';
  video_url: {
    url: string;
  };
  cache_control?: OpenRouterCacheControl;
}

export type NvidiaChatCompletionContentPart =
  | {
      type: 'text';
      text: string;
      cache_control?: OpenRouterCacheControl;
    }
  | {
      type: 'image_url';
      image_url: {
        url: string;
      };
      cache_control?: OpenRouterCacheControl;
    }
  | NvidiaChatCompletionContentPartVideo;

export type NvidiaChatCompletionMessageParam =
  | {
      role: 'system';
      content: string;
      cache_control?: OpenRouterCacheControl;
    }
  | {
      role: 'user';
      content: string | Array<NvidiaChatCompletionContentPart>;
      cache_control?: OpenRouterCacheControl;
    }
  | {
      role: 'assistant';
      content?: string | null;
      reasoning?: string | null;
      tool_calls?: Array<{
        type: 'function';
        id: string;
        function: {
          arguments: string;
          name: string;
        };
      }>;
      cache_control?: OpenRouterCacheControl;
    }
  | {
      role: 'tool';
      content: string;
      tool_call_id: string;
      cache_control?: OpenRouterCacheControl;
    };

export type NvidiaChatCompletionsInput = Array<NvidiaChatCompletionMessageParam>;

/**
 * Converts OpenRouter message format to NVIDIA's expected format.
 * 
 * Key differences:
 * - NVIDIA uses `video_url` type with `video_url: { url }` structure for videos
 * - OpenRouter uses `file` type with `file: { filename, file_data }` structure
 * 
 * This adapter converts file content parts with video media types to NVIDIA's video_url format.
 */
export function convertToNvidiaMessages(
  messages: OpenRouterChatCompletionsInput,
): NvidiaChatCompletionsInput {
  return messages.map((message) => {
    if (message.role === 'user' && Array.isArray(message.content)) {
      const convertedContent: Array<NvidiaChatCompletionContentPart> = message.content.map(
        (part) => {
          if (part.type === 'file') {
            const fileData = part.file.file_data;
            
            const isVideo = fileData.match(/^data:(video\/[^;]+)/);
            
            if (isVideo) {
              return {
                type: 'video_url' as const,
                video_url: {
                  url: fileData,
                },
                cache_control: part.cache_control,
              };
            }
            
            return {
              type: 'text' as const,
              text: `[Unsupported file type: ${part.file.filename}]`,
              cache_control: part.cache_control,
            };
          }
          
          if (part.type === 'image_url') {
            return {
              type: 'image_url' as const,
              image_url: part.image_url,
              cache_control: part.cache_control,
            };
          }
          
          if (part.type === 'text') {
            return {
              type: 'text' as const,
              text: part.text,
              cache_control: part.cache_control,
            };
          }
          
          return {
            type: 'text' as const,
            text: '',
          };
        },
      );
      
      return {
        ...message,
        content: convertedContent,
      };
    }
    
    return message as NvidiaChatCompletionMessageParam;
  });
}
