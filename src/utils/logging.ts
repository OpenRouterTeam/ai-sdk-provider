import { z } from "zod";

/**
 * Log unknown finish_reason values from providers for tracking and analysis.
 * This is a placeholder implementation that will be replaced with actual DataDog integration.
 *
 * @param finishReason - The unknown finish_reason value received from the provider
 * @param provider - The provider that returned the unknown finish_reason
 */
export const logUnknownFinishReason = (
  finishReason: string | null | undefined,
  provider: string
): void => {
  // TODO: Replace with actual DataDog logging once credentials are available
  console.warn(
    `[OpenRouter] Unknown finish_reason "${finishReason}" from provider "${provider}"`
  );
};
