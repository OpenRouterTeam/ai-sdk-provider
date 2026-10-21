import type { OpenRouterSharedSettings } from '..';
import type { OpenRouterEvaluationProviderPreferences } from './openrouter-evaluation-settings';

// https://openrouter.ai/models?output_modalities=rerank
export type OpenRouterRerankingModelId = string;

export type OpenRouterRerankingSettings = {
  /**
   * Provider routing preferences to control request routing behavior
   */
  provider?: OpenRouterEvaluationProviderPreferences;
} & OpenRouterSharedSettings;
