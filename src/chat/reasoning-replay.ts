import type { ReasoningDetailUnion } from '../schemas/reasoning-details';

import { ReasoningFormat } from '../schemas/format';

/**
 * Controls which historical `reasoning_details` are replayed to the API.
 *
 * - `all` (default): replay everything verbatim (documented OpenRouter
 *   contract for reasoning continuity).
 * - `same-family`: drop provider-specific details (encrypted blobs,
 *   signed thinking, summaries) whose `format` belongs to a different
 *   provider family than the target model, e.g. OpenAI
 *   `openai-responses-v1` blobs sent to `deepseek/...` (issue #542).
 * - `none`: never replay reasoning (`reasoning` and `reasoning_details`).
 */
export type ReasoningReplayMode = 'all' | 'same-family' | 'none';

/**
 * Formats that each model-slug author prefix can validate. Formats not
 * listed here (and `unknown`/missing formats) are treated as
 * provider-agnostic and are always kept in `same-family` mode.
 *
 * The Bedrock and Meta formats are plain strings until they are part of
 * the `ReasoningFormat` enum.
 */
const FAMILY_FORMATS: Record<string, readonly string[]> = {
  openai: [
    ReasoningFormat.OpenAIResponsesV1,
    ReasoningFormat.AzureOpenAIResponsesV1,
    'bedrock-openai-responses-v1',
  ],
  anthropic: [ReasoningFormat.AnthropicClaudeV1],
  google: [ReasoningFormat.GoogleGeminiV1],
  'x-ai': [ReasoningFormat.XAIResponsesV1, 'bedrock-xai-responses-v1'],
  meta: ['meta-responses-v1'],
};

const PROVIDER_SPECIFIC_FORMATS = new Set(Object.values(FAMILY_FORMATS).flat());

/** `~anthropic/claude-sonnet-latest` -> `anthropic` */
function getModelFamily(modelId: string): string {
  return (modelId.split('/')[0] ?? '').replace(/^~/, '').toLowerCase();
}

/**
 * Returns a predicate that decides whether a reasoning detail may be
 * replayed to the given target model(s) in `same-family` mode, or
 * `undefined` when no filtering should happen (any other mode, or the
 * target family cannot be determined, e.g. `openrouter/auto`).
 *
 * With fallback models, a detail is kept if ANY target can validate it,
 * so a fallback to the original family keeps its reasoning continuity.
 */
export function createReasoningReplayFilter({
  mode,
  modelIds,
}: {
  mode: ReasoningReplayMode | undefined;
  modelIds: ReadonlyArray<string>;
}): ((detail: ReasoningDetailUnion) => boolean) | undefined {
  if (mode !== 'same-family') {
    return undefined;
  }

  const families = modelIds.map(getModelFamily);
  if (families.length === 0 || families.includes('openrouter')) {
    // Router slugs pick the upstream model server-side; we cannot know
    // the target family, so fall back to replaying everything.
    return undefined;
  }

  const allowed = new Set(families.flatMap((f) => FAMILY_FORMATS[f] ?? []));
  return (detail) => {
    const format = detail.format;
    if (!format || !PROVIDER_SPECIFIC_FORMATS.has(format)) {
      return true;
    }
    return allowed.has(format);
  };
}
