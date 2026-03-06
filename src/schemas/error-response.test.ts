import {
  extractErrorMessage,
  OpenRouterErrorResponseSchema,
} from './error-response';

describe('OpenRouterErrorResponseSchema', () => {
  it('should be valid without a type, code, and param', () => {
    const errorWithoutTypeCodeAndParam = {
      error: {
        message: 'Example error message',
        metadata: { provider_name: 'Example Provider' },
      },
      user_id: 'example_1',
    };

    const result = OpenRouterErrorResponseSchema.parse(
      errorWithoutTypeCodeAndParam,
    );

    expect(result).toEqual({
      error: {
        message: 'Example error message',
        code: null,
        type: null,
        param: null,
        metadata: { provider_name: 'Example Provider' },
      },
      user_id: 'example_1',
    });
  });

  it('should be invalid with a type', () => {
    const errorWithType = {
      error: {
        message: 'Example error message with type',
        type: 'invalid_request_error',
        code: 400,
        param: 'canBeAnything',
        metadata: { provider_name: 'Example Provider' },
      },
    };

    const result = OpenRouterErrorResponseSchema.parse(errorWithType);

    expect(result).toEqual({
      error: {
        code: 400,
        message: 'Example error message with type',
        type: 'invalid_request_error',
        param: 'canBeAnything',
        metadata: { provider_name: 'Example Provider' },
      },
    });
  });
});

describe('extractErrorMessage', () => {
  function makeErrorData(message: string, metadata?: Record<string, unknown>) {
    return OpenRouterErrorResponseSchema.parse({
      error: { message, ...(metadata ? { metadata } : {}) },
    });
  }

  it('should return error.message when no metadata is present', () => {
    const data = makeErrorData('Something went wrong');
    expect(extractErrorMessage(data)).toBe('Something went wrong');
  });

  it('should return error.message when metadata has no raw field', () => {
    const data = makeErrorData('Provider returned error', {
      provider_name: 'Anthropic',
    });
    expect(extractErrorMessage(data)).toBe(
      '[Anthropic] Provider returned error',
    );
  });

  it('should extract message from metadata.raw string', () => {
    const data = makeErrorData('Provider returned error', {
      provider_name: 'Anthropic',
      raw: 'Your credit balance is too low',
    });
    expect(extractErrorMessage(data)).toBe(
      '[Anthropic] Your credit balance is too low',
    );
  });

  it('should extract message from metadata.raw object with message field', () => {
    const data = makeErrorData('Provider returned error', {
      provider_name: 'OpenAI',
      raw: { message: 'Rate limit exceeded' },
    });
    expect(extractErrorMessage(data)).toBe('[OpenAI] Rate limit exceeded');
  });

  it('should extract message from nested error object in metadata.raw', () => {
    const data = makeErrorData('Provider returned error', {
      provider_name: 'Anthropic',
      raw: { error: { message: 'Invalid API key provided' } },
    });
    expect(extractErrorMessage(data)).toBe(
      '[Anthropic] Invalid API key provided',
    );
  });

  it('should extract message from JSON-stringified raw field', () => {
    const data = makeErrorData('Provider returned error', {
      raw: JSON.stringify({
        error: { message: 'Model not available' },
      }),
    });
    expect(extractErrorMessage(data)).toBe('Model not available');
  });

  it('should fall back to error.message when raw message matches it', () => {
    const data = makeErrorData('Provider returned error', {
      provider_name: 'Google',
      raw: { message: 'Provider returned error' },
    });
    expect(extractErrorMessage(data)).toBe('[Google] Provider returned error');
  });

  it('should handle metadata.raw with detail field', () => {
    const data = makeErrorData('Provider returned error', {
      raw: { detail: 'Insufficient quota for this request' },
    });
    expect(extractErrorMessage(data)).toBe(
      'Insufficient quota for this request',
    );
  });

  it('should handle metadata.raw with error string field', () => {
    const data = makeErrorData('Provider returned error', {
      raw: { error: 'Bad gateway' },
    });
    expect(extractErrorMessage(data)).toBe('Bad gateway');
  });

  it('should handle empty metadata.raw object by falling back to error.message', () => {
    const data = makeErrorData('Provider returned error', {
      raw: {},
    });
    expect(extractErrorMessage(data)).toBe('Provider returned error');
  });

  it('should omit provider_name brackets when provider_name is not present', () => {
    const data = makeErrorData('Provider returned error', {
      raw: 'Detailed error info',
    });
    expect(extractErrorMessage(data)).toBe('Detailed error info');
  });

  it('should handle metadata.raw as null gracefully', () => {
    const data = makeErrorData('Provider returned error', {
      raw: null,
    });
    expect(extractErrorMessage(data)).toBe('Provider returned error');
  });

  it('should extract message from JSON-stringified nested object in raw', () => {
    const data = makeErrorData('Provider returned error', {
      provider_name: 'Mistral',
      raw: JSON.stringify({
        message: 'Service temporarily unavailable',
      }),
    });
    expect(extractErrorMessage(data)).toBe(
      '[Mistral] Service temporarily unavailable',
    );
  });
});
