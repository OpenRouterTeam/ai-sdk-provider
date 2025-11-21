import type {
  LanguageModelV2StreamPart,
  LanguageModelV2CallWarning,
  LanguageModelV2Usage,
} from '@ai-sdk/provider';
import type { OpenRouterStreamChunk } from './types';
import { mapOpenRouterFinishReason } from './map-openrouter-finish-reason';

/**
 * Transformer for OpenRouter streaming responses
 */
export class OpenRouterStreamTransformer {
  private generateId: () => string;

  constructor(generateId?: () => string) {
    this.generateId = generateId || (() => crypto.randomUUID());
  }

  /**
   * Parse SSE events from the stream
   */
  createParser(): TransformStream<string, ParsedSSEEvent> {
    let buffer = '';

    return new TransformStream<string, ParsedSSEEvent>({
      transform(chunk, controller) {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            // Skip [DONE] marker
            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              controller.enqueue({ type: 'data', data: parsed });
            } catch (error) {
              console.warn('Failed to parse SSE data:', data, error);
            }
          }
        }
      },

      flush(controller) {
        // Process any remaining buffer
        if (buffer.length > 0 && buffer.startsWith('data: ')) {
          const data = buffer.slice(6);
          if (data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              controller.enqueue({ type: 'data', data: parsed });
            } catch (error) {
              console.warn('Failed to parse final SSE data:', data, error);
            }
          }
        }
      },
    });
  }

  /**
   * Transform parsed SSE events to AI SDK stream parts
   */
  createTransformer(
    warnings: LanguageModelV2CallWarning[],
  ): TransformStream<ParsedSSEEvent, LanguageModelV2StreamPart> {
    let isFirstChunk = true;
    let accumulatedReasoningText = '';
    let currentTextId: string | undefined;
    let currentReasoningId: string | undefined;
    let currentToolCalls: Map<number, ToolCallAccumulator> = new Map();
    let hasReasoningContent = false;
    const generateId = this.generateId;

    return new TransformStream<ParsedSSEEvent, LanguageModelV2StreamPart>({
      async transform(event, controller) {
        if (event.type !== 'data') {
          return;
        }

        const chunk = event.data as OpenRouterStreamChunk;

        // Send stream-start event with warnings on first chunk
        if (isFirstChunk) {
          controller.enqueue({
            type: 'stream-start',
            warnings,
          });
          isFirstChunk = false;
        }

        // Process the chunk
        if (chunk.choices && chunk.choices.length > 0) {
          const choice = chunk.choices[0];
          const delta = choice.delta;

          // Handle text content
          if (delta.content) {
            // Start text if we haven't yet
            if (!currentTextId) {
              currentTextId = generateId();
              controller.enqueue({
                type: 'text-start',
                id: currentTextId,
              });
            }

            controller.enqueue({
              type: 'text-delta',
              id: currentTextId,
              delta: delta.content,
            });
          }

          // Handle reasoning content (OpenRouter-specific)
          if (delta.reasoning_content) {
            hasReasoningContent = true;
            accumulatedReasoningText += delta.reasoning_content;

            // Start reasoning if we haven't yet
            if (!currentReasoningId) {
              currentReasoningId = generateId();
              controller.enqueue({
                type: 'reasoning-start',
                id: currentReasoningId,
              });
            }

            controller.enqueue({
              type: 'reasoning-delta',
              id: currentReasoningId,
              delta: delta.reasoning_content,
            });
          }

          // Handle tool calls
          if (delta.tool_calls) {
            for (const toolCall of delta.tool_calls) {
              const index = toolCall.index;

              // Initialize accumulator if needed
              if (!currentToolCalls.has(index)) {
                currentToolCalls.set(index, {
                  id: generateId(),
                  toolCallId: '',
                  name: '',
                  args: '',
                  started: false,
                });
              }

              const accumulator = currentToolCalls.get(index)!;

              // Update accumulator
              if (toolCall.id) {
                accumulator.toolCallId = toolCall.id;
              }
              if (toolCall.function?.name) {
                accumulator.name = toolCall.function.name;
              }
              if (toolCall.function?.arguments) {
                accumulator.args += toolCall.function.arguments;
              }

              // Send tool input start if we have id and name
              if (accumulator.toolCallId && accumulator.name && !accumulator.started) {
                accumulator.started = true;
                controller.enqueue({
                  type: 'tool-input-start',
                  id: accumulator.id,
                  toolName: accumulator.name,
                });
              }

              // Send tool input delta for arguments
              if (toolCall.function?.arguments && accumulator.started) {
                controller.enqueue({
                  type: 'tool-input-delta',
                  id: accumulator.id,
                  delta: toolCall.function.arguments,
                });
              }
            }
          }

          // Handle finish reason
          if (choice.finish_reason) {
            // End text if we started it
            if (currentTextId) {
              controller.enqueue({
                type: 'text-end',
                id: currentTextId,
              });
            }

            // End reasoning if we started it
            if (currentReasoningId) {
              controller.enqueue({
                type: 'reasoning-end',
                id: currentReasoningId,
              });
            }

            // End all tool calls and send the final tool-call events
            for (const [, accumulator] of currentToolCalls) {
              if (accumulator.started) {
                controller.enqueue({
                  type: 'tool-input-end',
                  id: accumulator.id,
                });
              }

              // Send the full tool call
              controller.enqueue({
                type: 'tool-call',
                toolCallId: accumulator.toolCallId,
                toolName: accumulator.name,
                input: accumulator.args,
              });
            }

            // Send response metadata if available
            if (chunk.model || chunk.id) {
              controller.enqueue({
                type: 'response-metadata',
                id: chunk.id,
                modelId: chunk.model,
                timestamp: chunk.created ? new Date(chunk.created * 1000) : undefined,
              });
            }

            // Prepare usage information
            const usage: LanguageModelV2Usage = {
              inputTokens: chunk.usage?.prompt_tokens,
              outputTokens: chunk.usage?.completion_tokens,
              totalTokens: chunk.usage?.total_tokens,
              reasoningTokens: chunk.usage?.reasoning_tokens,
              cachedInputTokens: chunk.usage?.cached_tokens,
            };

            // Send finish event
            controller.enqueue({
              type: 'finish',
              finishReason: mapOpenRouterFinishReason(choice.finish_reason),
              usage,
              providerMetadata: {
                openrouter: {
                  ...(accumulatedReasoningText && {
                    reasoning: {
                      content: accumulatedReasoningText,
                      tokens: chunk.usage?.reasoning_tokens || 0,
                    },
                  }),
                  ...(chunk.reasoning_details && {
                    reasoning: {
                      content: chunk.reasoning_details.content || accumulatedReasoningText,
                      tokens: chunk.reasoning_details.tokens || chunk.usage?.reasoning_tokens || 0,
                    },
                  }),
                },
              },
            });
          }
        }

        // Handle response-level reasoning details (if not already handled)
        if (chunk.reasoning_details && !hasReasoningContent) {
          hasReasoningContent = true;
          if (chunk.reasoning_details.content) {
            if (!currentReasoningId) {
              currentReasoningId = generateId();
              controller.enqueue({
                type: 'reasoning-start',
                id: currentReasoningId,
              });
            }
            controller.enqueue({
              type: 'reasoning-delta',
              id: currentReasoningId,
              delta: chunk.reasoning_details.content,
            });
            accumulatedReasoningText = chunk.reasoning_details.content;
          }
        }
      },

      flush(controller) {
        // Handle any error or incomplete stream
        if (isFirstChunk) {
          // Stream never started properly
          controller.enqueue({
            type: 'error',
            error: new Error('Stream ended without data'),
          });
        }
      },
    });
  }
}

/**
 * Parsed SSE event
 */
interface ParsedSSEEvent {
  type: 'data' | 'error';
  data?: any;
  error?: Error;
}

/**
 * Tool call accumulator for streaming
 */
interface ToolCallAccumulator {
  id: string;
  toolCallId: string;
  name: string;
  args: string;
  started: boolean;
}