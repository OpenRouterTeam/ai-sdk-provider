/**
 * Utility function to get environment variables with support for both
 * LLMGATEWAY_ and LLM_GATEWAY_ prefixes.
 *
 * @param key The environment variable key without the prefix (e.g., 'API_KEY')
 * @returns The environment variable value or undefined if not found
 */
export function getEnvVar(key: string): string | undefined {
  // Try LLMGATEWAY_ prefix first
  const llmgatewayKey = `LLMGATEWAY_${key}`;
  const llmgatewayValue = process.env[llmgatewayKey];

  if (llmgatewayValue !== undefined) {
    return llmgatewayValue;
  }

  // Fallback to LLM_GATEWAY_ prefix
  const llmGatewayKey = `LLM_GATEWAY_${key}`;
  return process.env[llmGatewayKey];
}
