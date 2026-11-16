import type { OpenRouterImageSettings } from './openrouter-image-settings';

// https://openrouter.ai/models?output_modalities=transcription
export type OpenRouterTranscriptionModelId = string;

export type OpenRouterTranscriptionSettings = {
  /**
   * Provider routing preferences to control request routing behavior
   */
  provider?: OpenRouterImageSettings['provider'];

  /**
   * A unique identifier representing your end-user.
   */
  user?: string;

  /**
   * Additional body parameters to send with the transcription request.
   */
  extraBody?: Record<string, unknown>;
};

/**
 * Call-time options for `transcribe()`, passed as
 * `providerOptions.openrouter`. Keys are sent as-is in the request body, so
 * any other `/audio/transcriptions` body field can be set here too.
 */
export type OpenRouterTranscriptionProviderOptions = {
  /** ISO-639-1 language code (e.g. "en"). Auto-detected if omitted. */
  language?: string;
  /** Label each word with its speaker. Requires `verbose_json`. */
  diarize?: boolean;
  /** Domain terms, names, or phrases to bias recognition toward. */
  keyterms?: string[];
  temperature?: number;
  response_format?: 'json' | 'verbose_json';
  timestamp_granularities?: Array<'word' | 'segment'>;
  provider?: OpenRouterTranscriptionSettings['provider'] | null;
  session_id?: string;
  user?: string;
  [key: string]: unknown;
};
