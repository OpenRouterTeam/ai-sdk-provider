import type {
  LanguageModelV4CallOptions,
  SharedV4ProviderOptions,
} from '@ai-sdk/provider';
import type { OpenRouterProviderOptions } from '../types';

import { isCustomReasoning } from '@ai-sdk/provider-utils';

type ReasoningSettings = OpenRouterProviderOptions['reasoning'];

/**
 * Resolves the `reasoning` request field from the AI SDK call-level
 * `reasoning` option and the model-level `reasoning` settings.
 *
 * Call-level `reasoning` replaces the model-level effort/max_tokens but keeps
 * the model-level `enabled`/`exclude`. It is ignored when
 * `providerOptions.openrouter.reasoning_effort` is set, because OpenRouter
 * rejects conflicting `reasoning_effort` and `reasoning.effort` values.
 * `providerOptions.openrouter.reasoning` is spread over the request body later,
 * so it overrides the result of this function.
 */
export function resolveReasoning({
  reasoning,
  settingsReasoning,
  providerOptions,
}: {
  reasoning: LanguageModelV4CallOptions['reasoning'];
  settingsReasoning: ReasoningSettings;
  providerOptions: SharedV4ProviderOptions | undefined;
}): ReasoningSettings {
  if (!isCustomReasoning(reasoning)) {
    return settingsReasoning;
  }
  if (providerOptions?.openrouter?.reasoning_effort !== undefined) {
    return settingsReasoning;
  }
  return {
    enabled: settingsReasoning?.enabled,
    exclude: settingsReasoning?.exclude,
    effort: reasoning,
  };
}
