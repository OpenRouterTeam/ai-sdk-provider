export enum ReasoningFormat {
  Unknown = 'unknown',
  OpenAIResponsesV1 = 'openai-responses-v1',
  AzureOpenAIResponsesV1 = 'azure-openai-responses-v1',
  BedrockOpenAIResponsesV1 = 'bedrock-openai-responses-v1',
  BedrockXAIResponsesV1 = 'bedrock-xai-responses-v1',
  XAIResponsesV1 = 'xai-responses-v1',
  MetaResponsesV1 = 'meta-responses-v1',
  AnthropicClaudeV1 = 'anthropic-claude-v1',
  GoogleGeminiV1 = 'google-gemini-v1',
}

// Anthropic Claude was the first reasoning that we're
// passing back and forth
export const DEFAULT_REASONING_FORMAT = ReasoningFormat.AnthropicClaudeV1;
