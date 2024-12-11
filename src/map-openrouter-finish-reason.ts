import type { LanguageModelV1FinishReason } from "@ai-sdk/provider";
import { logUnknownFinishReason } from "./utils/logging";

export function mapOpenRouterFinishReason(
  finishReason: string | null | undefined,
  provider?: string
): LanguageModelV1FinishReason | null {
  // Handle null/undefined cases
  if (finishReason == null) {
    return null;
  }

  switch (finishReason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content_filter":
      return "content-filter";
    case "function_call":
    case "tool_calls":
      return "tool-calls";
    default:
      // Log unknown values for tracking
      logUnknownFinishReason(finishReason, provider ?? "unknown");
      // Default to "stop" for unrecognized strings
      return "stop";
  }
}
