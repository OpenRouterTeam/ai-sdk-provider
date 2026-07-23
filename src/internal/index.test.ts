import { describe, expect, it } from 'vitest';
import * as internal from './index';

describe('internal exports', () => {
  it('exports the internal provider models and utilities', () => {
    expect(internal.OpenRouterChatLanguageModel).toBeTypeOf('function');
    expect(internal.OpenRouterCompletionLanguageModel).toBeTypeOf('function');
    expect(internal.OpenRouterEmbeddingModel).toBeTypeOf('function');
  });
});
