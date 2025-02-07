export function mergeProviderOptions(
  extraBody?: Record<string, unknown>,
  providerOptions?: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...extraBody };
  
  if (providerOptions?.openrouter) {
    const { provider, ...rest } = providerOptions.openrouter;
    Object.assign(result, rest);
    if (provider && typeof provider === 'object') {
      const providerObj = provider as Record<string, unknown>;
      result.provider = { ...providerObj };
    }
  }
  
  return result;
}
