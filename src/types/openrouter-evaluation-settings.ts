import type { OpenRouterEmbeddingSettings } from './openrouter-embedding-settings';

// https://openrouter.ai/docs/api-reference/decisions
export type OpenRouterEvaluationModelId = string;

export type OpenRouterEvaluationSettings = {
  /**
   * A unique identifier representing your end-user, which can help OpenRouter to
   * monitor and detect abuse.
   */
  user?: string;

  /**
   * Provider routing preferences to control request routing behavior
   */
  provider?: OpenRouterEmbeddingSettings['provider'];

  /**
   * Extra fields merged into the Decisions request body.
   */
  extraBody?: Record<string, unknown>;
};
