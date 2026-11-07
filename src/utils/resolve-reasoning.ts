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
 * the model-level `enabled`/`exclude`. It is ignored when `reasoning_effort`
 * is set via `providerOptions.openrouter` or either `extraBody` (provider or
 * model settings), because OpenRouter rejects conflicting `reasoning_effort`
 * and `reasoning.effort` values.
 * `providerOptions.openrouter.reasoning` is spread over the request body later,
 * so it overrides the result of this function.
 */
export function resolveReasoning({
  reasoning,
  settingsReasoning,
  providerOptions,
  extraBodies = [],
}: {
  reasoning: LanguageModelV4CallOptions['reasoning'];
  settingsReasoning: ReasoningSettings;
  providerOptions: SharedV4ProviderOptions | undefined;
  extraBodies?: Array<Record<string, unknown> | undefined>;
}): ReasoningSettings {
  if (!isCustomReasoning(reasoning)) {
    return settingsReasoning;
  }
  // Merge the layers in request-body order, so a later explicit `undefined`
  // clears an earlier value just as it does in the request body.
  const effectiveBody: Record<string, unknown> = Object.assign(
    {},
    ...extraBodies,
    providerOptions?.openrouter,
  );
  if (effectiveBody.reasoning_effort !== undefined) {
    return settingsReasoning;
  }
  return {
    ...(settingsReasoning?.enabled !== undefined && {
      enabled: settingsReasoning.enabled,
    }),
    ...(settingsReasoning?.exclude !== undefined && {
      exclude: settingsReasoning.exclude,
    }),
    effort: reasoning,
  };
}
