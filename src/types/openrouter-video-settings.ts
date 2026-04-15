export type OpenRouterVideoModelId = string;

export type OpenRouterVideoSettings = {
  /**
   * Whether to generate audio alongside the video.
   * Defaults to the endpoint's generate_audio capability flag, false if not set.
   */
  generateAudio?: boolean;

  /**
   * Polling interval in milliseconds when waiting for video generation to complete.
   * @default 2000
   */
  pollIntervalMs?: number;

  /**
   * Maximum time in milliseconds to wait for video generation to complete.
   * @default 600000 (10 minutes)
   */
  maxPollTimeMs?: number;

  /**
   * Additional body parameters to send with the video generation request.
   */
  extraBody?: Record<string, unknown>;
};
