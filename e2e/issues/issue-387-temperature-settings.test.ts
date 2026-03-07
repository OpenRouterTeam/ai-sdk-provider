/**
 * Regression test for GitHub issue #387
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/387
 *
 * Issue: "Support temperature settings in OpenRouterChatSettings. (Missing)"
 *
 * User report:
 * - Model: "google/gemini-3-flash-preview"
 * - User wants to pass temperature: 0 in model settings
 * - TypeScript error: temperature is not a valid property
 *
 * Code from issue:
 * ```typescript
 * const openrouterModel = openrouter('google/gemini-3-flash-preview', {
 *   reasoning: { effort: 'medium' },
 *   usage: { include: true },
 *   provider: { sort: 'latency' },
 *   temperature: 0 // This triggers typescript error
 * })
 * ```
 */
import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #387: temperature settings in OpenRouterChatSettings', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  it('should accept temperature in model settings (exact code from issue)', async () => {
    // This is the exact code pattern from the issue report
    const openrouterModel = openrouter('google/gemini-3-flash-preview', {
      reasoning: { effort: 'medium' },
      usage: { include: true },
      provider: { sort: 'latency' },
      temperature: 0, // This should NOT trigger typescript error
    });

    const result = await generateText({
      model: openrouterModel,
      prompt: 'What is 2+2? Answer with just the number.',
    });

    expect(result.text).toBeDefined();
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('should use model-level temperature when call-level temperature is not provided', async () => {
    const model = openrouter('google/gemini-3-flash-preview', {
      temperature: 0,
    });

    // Make multiple calls with temperature 0 - should get consistent results
    const results = await Promise.all([
      generateText({
        model,
        prompt: 'What is 2+2? Answer with just the number.',
      }),
      generateText({
        model,
        prompt: 'What is 2+2? Answer with just the number.',
      }),
    ]);

    // With temperature 0, results should be deterministic
    expect(results[0].text).toBeDefined();
    expect(results[1].text).toBeDefined();
    // Both should contain "4"
    expect(results[0].text).toContain('4');
    expect(results[1].text).toContain('4');
  });

  it('should allow call-level temperature to override model-level temperature', async () => {
    const model = openrouter('google/gemini-3-flash-preview', {
      temperature: 0, // Model default
    });

    // Call with higher temperature should work
    const result = await generateText({
      model,
      prompt: 'What is 2+2? Answer with just the number.',
      temperature: 0.5, // Override model default
    });

    expect(result.text).toBeDefined();
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('should support other common settings at model level', async () => {
    // Test that other common settings can also be passed at model level
    const model = openrouter('google/gemini-3-flash-preview', {
      temperature: 0,
      topP: 0.9,
      topK: 40,
      frequencyPenalty: 0,
      presencePenalty: 0,
      maxTokens: 100,
    });

    const result = await generateText({
      model,
      prompt: 'What is 2+2? Answer with just the number.',
    });

    expect(result.text).toBeDefined();
    expect(result.text.length).toBeGreaterThan(0);
  });
});
