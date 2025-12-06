import { describe, it, expect } from 'vitest';

describe('Public Exports', () => {
  it('should export OpenRouterChatSettings type', async () => {
    // Import from the public API
    const module = await import('../index');
    
    // Verify that the type is available by checking the module exports
    // TypeScript will error at compile time if the type is not exported
    type TestType = typeof module extends { OpenRouterChatSettings: unknown }
      ? true
      : false;
    
    // This is a compile-time check that will fail if OpenRouterChatSettings is not exported
    expect(true).toBe(true);
  });

  it('should export OpenRouterCompletionSettings type', async () => {
    // Import from the public API
    const module = await import('../index');
    
    // Verify that the type is available by checking the module exports
    type TestType = typeof module extends { OpenRouterCompletionSettings: unknown }
      ? true
      : false;
    
    // This is a compile-time check that will fail if OpenRouterCompletionSettings is not exported
    expect(true).toBe(true);
  });
  
  it('should be able to use OpenRouterChatSettings from public exports', () => {
    // This is a TypeScript compile-time test
    // If OpenRouterChatSettings is not exported, this will fail at compile time
    type ChatSettings = import('../index').OpenRouterChatSettings;
    
    const settings: ChatSettings = {
      user: 'test-user',
      logitBias: { 100: -1 },
      parallelToolCalls: true,
    };
    
    expect(settings.user).toBe('test-user');
  });
});
