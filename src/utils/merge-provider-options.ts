export function mergeProviderOptions(
  extraBody?: Record<string, unknown>,
  providerOptions?: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const result = { ...extraBody };
  
  if (providerOptions?.openrouter) {
    const { provider, ...rest } = providerOptions.openrouter;
    Object.assign(result, rest);
    if (provider) {
      result.provider = {};
      Object.assign(result.provider, provider);
    }
  }
  
  return result;
}
