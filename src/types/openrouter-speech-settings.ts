import type { OpenRouterImageSettings } from './openrouter-image-settings';

// https://openrouter.ai/models?output_modalities=speech
export type OpenRouterSpeechModelId = string;

export type OpenRouterSpeechSettings = {
  /**
   * Provider routing preferences to control request routing behavior
   */
  provider?: OpenRouterImageSettings['provider'];

  /**
   * A unique identifier representing your end-user.
   */
  user?: string;

  /**
   * Additional body parameters to send with the speech request.
   */
  extraBody?: Record<string, unknown>;
};
