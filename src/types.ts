import type { LanguageModelV1 } from "@ai-sdk/provider";

// Re-export the LanguageModelV1 type to ensure proper type compatibility
export type { LanguageModelV1 };

// Export our model types with explicit type constraints
export type OpenRouterLanguageModel = LanguageModelV1;
