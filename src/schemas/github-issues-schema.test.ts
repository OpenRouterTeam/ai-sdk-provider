/**
 * RGRTDD Schema Tests - Verifying GitHub Issue Scenarios
 *
 * These tests attempt to invalidate or verify fixes for schema-related GitHub issues.
 * Each test uses actual error payloads from the issues to verify the schemas handle them.
 *
 * Issue Reference: .tasks/issue-patterns/schema-issues.md
 */

import { describe, expect, it } from 'vitest';
import {
  OpenRouterNonStreamChatCompletionResponseSchema,
  OpenRouterStreamChatCompletionChunkSchema,
} from '../chat/schemas';
import { OpenRouterErrorResponseSchema } from './error-response';

describe('GitHub Issue Schema Verification', () => {
  /**
   * ============================================================================
   * Category 1: Error Response Schema Issues (#50, #82)
   * ============================================================================
   * Root Cause: Error `code` can be number OR string, schema was too strict
   */
  describe('Error Response Schema (#50, #82)', () => {
    it('#50 - should accept error code as NUMBER (o1-pro temperature error)', () => {
      // From issue #50: o1-pro returns error with numeric code
      const errorResponse = {
        error: {
          message:
            "Unsupported parameter: 'temperature' is not supported with this model.",
          type: 'invalid_request_error',
          param: 'temperature',
          code: null, // Can be null
        },
        user_id: 'user_xxx',
      };

      const result = OpenRouterErrorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
    });

    it('#82 - should accept error code as NUMBER 400', () => {
      // From issue #82: error code is number not string
      const errorResponse = {
        error: {
          message: 'Provider returned error',
          code: 400, // NUMBER not string
          type: 'invalid_request_error',
        },
        user_id: 'user_xxx',
      };

      const result = OpenRouterErrorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.error.code).toBe(400);
      }
    });

    it('#82 - should accept error code as STRING', () => {
      const errorResponse = {
        error: {
          message: 'Some error',
          code: 'invalid_api_key',
          type: 'authentication_error',
        },
      };

      const result = OpenRouterErrorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
    });

    it('#50, #82 - should handle response with error and NO choices', () => {
      // When there's an error, choices is undefined - this should parse as error response
      const responseWithError = {
        error: {
          message: 'Internal Server Error',
          code: 500,
        },
        user_id: 'org_abc123',
      };

      // The union schema should match error response, not require choices
      const result =
        OpenRouterNonStreamChatCompletionResponseSchema.safeParse(
          responseWithError,
        );
      expect(result.success).toBe(true);
    });

    it('#82 - should handle error without type field', () => {
      const errorWithoutType = {
        error: {
          message: 'Example error message',
          code: 500,
          // no type field
        },
        user_id: 'example_1',
      };

      const result = OpenRouterErrorResponseSchema.safeParse(errorWithoutType);
      expect(result.success).toBe(true);
    });
  });

  /**
   * ============================================================================
   * Category 2: Annotation Type Enum (#159, #183, #249)
   * ============================================================================
   * Root Cause: Annotation type only accepted `url_citation`, missing `file` etc
   */
  describe('Annotation Type Schema (#159, #183, #249)', () => {
    it('#183 - should accept annotation type "file" from Mistral', () => {
      // From issue #183: Mistral returns type: "file"
      const response = {
        id: 'gen-xxx',
        provider: 'Mistral',
        model: 'mistralai/mistral-small-3.2-24b-instruct',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Test response',
              annotations: [
                {
                  type: 'file' as const,
                  file: {
                    hash: 'abc123',
                    name: 'document.pdf',
                    content: [
                      {
                        type: 'text',
                        text: 'Extracted PDF content',
                      },
                    ],
                  },
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };

      const result =
        OpenRouterNonStreamChatCompletionResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('#249 - should accept annotation type "file_annotation"', () => {
      // From issue #249: Claude Haiku returns file_annotation
      const response = {
        id: 'gen-xxx',
        provider: 'Anthropic',
        model: 'anthropic/claude-haiku-4.5',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Test response',
              annotations: [
                {
                  type: 'file_annotation' as const,
                  file_annotation: {
                    file_id: 'file_abc123',
                    quote: 'extracted text',
                  },
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };

      const result =
        OpenRouterNonStreamChatCompletionResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('#159 - should accept url_citation annotation', () => {
      // Standard url_citation should still work
      const response = {
        id: 'gen-xxx',
        provider: 'OpenAI',
        model: 'openai/gpt-4.1',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Test response',
              annotations: [
                {
                  type: 'url_citation' as const,
                  url_citation: {
                    end_index: 100,
                    start_index: 0,
                    title: 'Example Page',
                    url: 'https://example.com',
                  },
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };

      const result =
        OpenRouterNonStreamChatCompletionResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('#183 - should handle file annotation with image_url content type', () => {
      // From issue #183: Mistral OCR can return image_url in content array
      const response = {
        id: 'gen-xxx',
        provider: 'Mistral',
        model: 'mistralai/mistral-small-3.2-24b-instruct',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Test response',
              annotations: [
                {
                  type: 'file' as const,
                  file: {
                    hash: 'abc123',
                    name: 'document.pdf',
                    content: [
                      {
                        type: 'text',
                        text: 'Some text',
                      },
                      {
                        type: 'image_url',
                        // Note: no text field for image_url type
                        image_url: { url: 'data:image/png;base64,...' },
                      },
                    ],
                  },
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };

      const result =
        OpenRouterNonStreamChatCompletionResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  /**
   * ============================================================================
   * Category 3: logprobs Structure Varies (#41)
   * ============================================================================
   * Root Cause: Different providers return different logprobs structures
   */
  describe('logprobs Schema Flexibility (#41)', () => {
    it('#41 - should accept NEW format logprobs with content array', () => {
      const response = {
        id: 'gen-xxx',
        provider: 'OpenAI',
        model: 'openai/gpt-4.1',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Hello',
            },
            finish_reason: 'stop',
            logprobs: {
              content: [
                {
                  token: 'Hello',
                  logprob: -0.5,
                  top_logprobs: [{ token: 'Hello', logprob: -0.5 }],
                },
              ],
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 1,
          total_tokens: 11,
        },
      };

      const result =
        OpenRouterNonStreamChatCompletionResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('#41 - should accept logprobs as null', () => {
      const response = {
        id: 'gen-xxx',
        provider: 'OpenAI',
        model: 'openai/gpt-4.1',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Hello',
            },
            finish_reason: 'stop',
            logprobs: null,
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 1,
          total_tokens: 11,
        },
      };

      const result =
        OpenRouterNonStreamChatCompletionResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('#41 - should accept LEGACY format logprobs from Nineteen provider', () => {
      // From issue #41: Nineteen provider returns legacy logprobs format
      // This is the OpenAI legacy format, not the newer content array format
      const response = {
        id: 'gen-xxx',
        provider: 'Nineteen',
        model: 'qwen/qwq-32b',
        object: 'chat.completion.chunk',
        created: 1741364013,
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant' as const,
              content: '',
              reasoning: null,
            },
            finish_reason: 'stop',
            native_finish_reason: 'stop',
            logprobs: {
              // Legacy format - different structure
              text_offset: [567],
              token_logprobs: [-0.00012766500003635883],
              tokens: [''],
              top_logprobs: [{ '': -0.00012766500003635883 }],
            },
          },
        ],
      };

      // This tests stream chunk schema since the issue was with streaming
      const result =
        OpenRouterStreamChatCompletionChunkSchema.safeParse(response);

      // Note: Current schema may not support legacy format - this test documents expected behavior
      // If this fails, the schema needs to be updated to support legacy logprobs
      expect(result.success).toBe(true);
    });
  });

  /**
   * ============================================================================
   * Category 4: providerMetadata Contains undefined (#262)
   * ============================================================================
   * Note: This is more of a runtime issue than schema - testing the data shape
   */
  describe('providerMetadata undefined handling (#262)', () => {
    it('#262 - response with usage.cost as number should parse', () => {
      const response = {
        id: 'gen-xxx',
        provider: 'Google AI Studio',
        model: 'google/gemini-3-pro-preview',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Hello',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 2,
          completion_tokens: 233,
          total_tokens: 235,
          cost: 0.001, // defined cost
          cost_details: {
            upstream_inference_cost: 0,
          },
        },
      };

      const result =
        OpenRouterNonStreamChatCompletionResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('#262 - response with usage.cost missing should parse', () => {
      // When cost is not provided (will become undefined in JS)
      const response = {
        id: 'gen-xxx',
        provider: 'Google AI Studio',
        model: 'google/gemini-3-pro-preview',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Hello',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 2,
          completion_tokens: 233,
          total_tokens: 235,
          // no cost field
          cost_details: {
            upstream_inference_cost: 0,
          },
        },
      };

      const result =
        OpenRouterNonStreamChatCompletionResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  /**
   * ============================================================================
   * Category 5: Streaming Schema Edge Cases
   * ============================================================================
   */
  describe('Streaming Schema Edge Cases', () => {
    it('should handle stream chunk with annotations', () => {
      const chunk = {
        id: 'gen-xxx',
        provider: 'OpenAI',
        model: 'openai/gpt-4.1',
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant' as const,
              content: 'Hello',
              annotations: [
                {
                  type: 'url_citation' as const,
                  url_citation: {
                    end_index: 100,
                    start_index: 0,
                    title: 'Example',
                    url: 'https://example.com',
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      };

      const result =
        OpenRouterStreamChatCompletionChunkSchema.safeParse(chunk);
      expect(result.success).toBe(true);
    });

    it('should handle stream chunk with file annotation', () => {
      const chunk = {
        id: 'gen-xxx',
        provider: 'Mistral',
        model: 'mistralai/mistral-small',
        choices: [
          {
            index: 0,
            delta: {
              content: 'Response text',
              annotations: [
                {
                  type: 'file' as const,
                  file: {
                    hash: 'abc123',
                    name: 'doc.pdf',
                    content: [{ type: 'text', text: 'content' }],
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      };

      const result =
        OpenRouterStreamChatCompletionChunkSchema.safeParse(chunk);
      expect(result.success).toBe(true);
    });

    it('should handle error in stream response', () => {
      const errorChunk = {
        error: {
          message: 'Rate limit exceeded',
          code: 429,
          type: 'rate_limit_error',
        },
      };

      const result =
        OpenRouterStreamChatCompletionChunkSchema.safeParse(errorChunk);
      expect(result.success).toBe(true);
    });
  });

  /**
   * ============================================================================
   * Real-world Issue Payloads (verbatim from GitHub issues)
   * ============================================================================
   */
  describe('Real-world Issue Payloads', () => {
    it('#82 - exact error from issue should parse', () => {
      // Exact structure from issue #82
      const payload = {
        error: {
          code: 400,
          message: 'The maximum file size is 20MB.',
          metadata: {
            provider_name: 'OpenAI',
            raw: '{"error":{"message":"The maximum file size is 20MB."}}',
          },
        },
        user_id: 'user_xxx',
      };

      const result = OpenRouterErrorResponseSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('#50 - o1-pro unsupported temperature error should parse', () => {
      // From issue #50 - note: actual error returns before SDK parses
      const payload = {
        error: {
          message:
            "Unsupported parameter: 'temperature' is not supported with this model.",
          type: 'invalid_request_error',
          param: 'temperature',
          code: null,
        },
      };

      const result = OpenRouterErrorResponseSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });
});
