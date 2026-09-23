/**
 * Regression test for GitHub issue #525
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/525
 *
 * Reported error: WorkflowRuntimeError: Failed to serialize step arguments at
 * path ".args[1]".
 *
 * `@ai-sdk/workflow`'s `WorkflowAgent` runs each model call as a durable step
 * and serializes the model as a step argument. First-party providers implement
 * the `WORKFLOW_SERIALIZE` / `WORKFLOW_DESERIALIZE` hooks so their models
 * round-trip across the durable (e.g. world-postgres) boundary. This test
 * verifies the OpenRouter model classes implement the same contract: the
 * serialized payload is structured-clone-safe (no closures), and the model
 * reconstructs with its `modelId`, `settings`, and resolved config intact.
 */
import {
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE,
} from '@ai-sdk/provider-utils';
import { describe, expect, it } from 'vitest';
import { OpenRouterChatLanguageModel } from './chat';
import { OpenRouterCompletionLanguageModel } from './completion';
import { createOpenRouter } from './provider';

const provider = createOpenRouter({ apiKey: 'test-api-key' });

// The workflow runtime hands the deserialize hook the persisted payload,
// whose `config` has been reduced to a plain JSON object. Chaining the two
// hooks directly in a test therefore needs a cast to model that boundary.
type ChatDeserializeInput = Parameters<
  (typeof OpenRouterChatLanguageModel)[typeof WORKFLOW_DESERIALIZE]
>[0];
type CompletionDeserializeInput = Parameters<
  (typeof OpenRouterCompletionLanguageModel)[typeof WORKFLOW_DESERIALIZE]
>[0];

describe('Issue #525: durable-execution model serialization', () => {
  describe('OpenRouterChatLanguageModel', () => {
    it('exposes the workflow serde hooks as static methods', () => {
      expect(typeof OpenRouterChatLanguageModel[WORKFLOW_SERIALIZE]).toBe(
        'function',
      );
      expect(typeof OpenRouterChatLanguageModel[WORKFLOW_DESERIALIZE]).toBe(
        'function',
      );
    });

    it('serializes to a structured-clone-safe payload', () => {
      const model = provider.chat('anthropic/claude-3.5-sonnet', {
        temperature: 0.7,
        provider: { order: ['anthropic'] },
        extraBody: { transforms: ['middle-out'] },
      });

      const serialized = OpenRouterChatLanguageModel[WORKFLOW_SERIALIZE](model);

      // Closures must be stripped; a resolved headers object is kept.
      expect(serialized.config.url).toBeUndefined();
      expect(serialized.config.fetch).toBeUndefined();
      expect(serialized.config.provider).toBe('openrouter.chat');
      expect(
        (serialized.config.headers as Record<string, string>).Authorization,
      ).toBe('Bearer test-api-key');

      // The whole payload must survive the durable boundary.
      expect(() => structuredClone(serialized)).not.toThrow();
      expect(() => JSON.stringify(serialized)).not.toThrow();
    });

    it('round-trips modelId and settings across the durable boundary', () => {
      const settings = {
        temperature: 0.7,
        provider: { order: ['anthropic'], allow_fallbacks: false },
        extraBody: { transforms: ['middle-out'] },
      };
      const model = provider.chat('anthropic/claude-3.5-sonnet', settings);

      const serialized = OpenRouterChatLanguageModel[WORKFLOW_SERIALIZE](model);
      const restored = OpenRouterChatLanguageModel[WORKFLOW_DESERIALIZE](
        structuredClone(serialized) as unknown as ChatDeserializeInput,
      );

      expect(restored).toBeInstanceOf(OpenRouterChatLanguageModel);
      expect(restored.modelId).toBe('anthropic/claude-3.5-sonnet');
      expect(restored.settings).toEqual(settings);
      expect(restored.provider).toBe('openrouter');
    });
  });

  describe('OpenRouterCompletionLanguageModel', () => {
    it('exposes the workflow serde hooks as static methods', () => {
      expect(typeof OpenRouterCompletionLanguageModel[WORKFLOW_SERIALIZE]).toBe(
        'function',
      );
      expect(
        typeof OpenRouterCompletionLanguageModel[WORKFLOW_DESERIALIZE],
      ).toBe('function');
    });

    it('round-trips modelId and settings across the durable boundary', () => {
      const settings = { temperature: 0.5, suffix: '\n\n' };
      const model = provider.completion(
        'openai/gpt-3.5-turbo-instruct',
        settings,
      );

      const serialized =
        OpenRouterCompletionLanguageModel[WORKFLOW_SERIALIZE](model);

      expect(serialized.config.url).toBeUndefined();
      expect(serialized.config.fetch).toBeUndefined();
      expect(() => structuredClone(serialized)).not.toThrow();

      const restored = OpenRouterCompletionLanguageModel[WORKFLOW_DESERIALIZE](
        structuredClone(serialized) as unknown as CompletionDeserializeInput,
      );

      expect(restored).toBeInstanceOf(OpenRouterCompletionLanguageModel);
      expect(restored.modelId).toBe('openai/gpt-3.5-turbo-instruct');
      expect(restored.settings).toEqual(settings);
    });
  });
});
