import {
  APICallError,
  InvalidResponseDataError,
  InvalidPromptError,
  InvalidArgumentError,
  LoadAPIKeyError,
} from '@ai-sdk/provider';

/**
 * OpenRouter error response structure
 */
export interface OpenRouterErrorResponse {
  error?: {
    message: string;
    type?: string;
    code?: string;
    param?: string;
    internal_message?: string;
  };
}

/**
 * Handle OpenRouter API errors
 */
export function handleOpenRouterError(error: unknown): never {
  // Handle fetch/network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    throw new APICallError({
      message: 'Failed to connect to OpenRouter API',
      url: 'https://openrouter.ai/api/v1',
      requestBodyValues: {},
      statusCode: 0,
      cause: error,
      isRetryable: true,
    });
  }

  // Handle Response objects (HTTP errors)
  if (error instanceof Response) {
    const status = error.status;
    const url = error.url || 'https://openrouter.ai/api/v1';

    // Rate limiting
    if (status === 429) {
      const retryAfter = error.headers.get('retry-after');
      throw new APICallError({
        message: 'OpenRouter API rate limit exceeded',
        url,
        requestBodyValues: {},
        statusCode: status,
        responseHeaders: Object.fromEntries(error.headers.entries()),
        cause: error,
        isRetryable: true,
        data: { retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined },
      });
    }

    // Authentication errors
    if (status === 401) {
      throw new LoadAPIKeyError({
        message: 'Invalid OpenRouter API key',
      });
    }

    // Model not found
    if (status === 404) {
      throw new InvalidArgumentError({
        argument: 'modelId',
        message: 'Model not found on OpenRouter',
      });
    }

    // Invalid request
    if (status === 400) {
      throw new InvalidPromptError({
        prompt: 'unknown',
        message: 'Invalid request to OpenRouter API',
      });
    }

    // Server errors (retryable)
    if (status >= 500 && status < 600) {
      throw new APICallError({
        message: `OpenRouter API server error: ${status}`,
        url,
        requestBodyValues: {},
        statusCode: status,
        cause: error,
        isRetryable: true,
      });
    }

    // Other HTTP errors
    throw new APICallError({
      message: `OpenRouter API error: ${status}`,
      url,
      requestBodyValues: {},
      statusCode: status,
      cause: error,
      isRetryable: false,
    });
  }

  // Handle structured error responses
  if (isOpenRouterErrorResponse(error)) {
    const errorInfo = error.error!;

    // Map error types to appropriate AI SDK errors
    switch (errorInfo.type) {
      case 'invalid_request_error':
        if (errorInfo.param?.includes('tool')) {
          throw new InvalidArgumentError({
            argument: 'tools',
            message: errorInfo.message,
          });
        }
        throw new InvalidPromptError({
          prompt: 'unknown',
          message: errorInfo.message,
        });

      case 'authentication_error':
        throw new LoadAPIKeyError({
          message: errorInfo.message,
        });

      case 'rate_limit_error':
        throw new APICallError({
          message: errorInfo.message,
          url: 'https://openrouter.ai/api/v1',
          requestBodyValues: {},
          statusCode: 429,
          isRetryable: true,
        });

      case 'model_not_found':
        throw new InvalidArgumentError({
          argument: 'modelId',
          message: errorInfo.message,
        });

      case 'server_error':
        throw new APICallError({
          message: errorInfo.message,
          url: 'https://openrouter.ai/api/v1',
          requestBodyValues: {},
          statusCode: 500,
          isRetryable: true,
        });

      default:
        throw new APICallError({
          message: errorInfo.message || 'Unknown OpenRouter error',
          url: 'https://openrouter.ai/api/v1',
          requestBodyValues: {},
          statusCode: 500,
          isRetryable: false,
        });
    }
  }

  // Handle invalid response data
  if (error instanceof SyntaxError) {
    throw new InvalidResponseDataError({
      data: 'unknown',
      message: 'Invalid JSON response from OpenRouter API',
    });
  }

  // Default error handling
  throw new APICallError({
    message: error instanceof Error ? error.message : 'Unknown error occurred',
    url: 'https://openrouter.ai/api/v1',
    requestBodyValues: {},
    statusCode: 500,
    cause: error,
    isRetryable: false,
  });
}

/**
 * Type guard for OpenRouter error responses
 */
function isOpenRouterErrorResponse(value: unknown): value is OpenRouterErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as any).error === 'object' &&
    'message' in (value as any).error
  );
}

/**
 * Get retry delay from response headers
 */
export function getRetryAfter(response: Response): number | undefined {
  const retryAfterHeader = response.headers.get('retry-after');
  if (!retryAfterHeader) {
    return undefined;
  }

  // Parse as seconds (number) or HTTP date
  const retryAfterSeconds = parseInt(retryAfterHeader, 10);
  if (!isNaN(retryAfterSeconds)) {
    return retryAfterSeconds * 1000; // Convert to milliseconds
  }

  // Try parsing as HTTP date
  const retryAfterDate = new Date(retryAfterHeader);
  if (!isNaN(retryAfterDate.getTime())) {
    return Math.max(0, retryAfterDate.getTime() - Date.now());
  }

  return undefined;
}