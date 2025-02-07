export function mergeProviderOptions(
  extraBody?: Record<string, unknown>,
  providerOptions?: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...extraBody };
  
  if (providerOptions?.openrouter) {
    const { provider, ...rest } = providerOptions.openrouter;
    if (provider && typeof provider === 'object') {
      result.provider = { ...provider as Record<string, unknown> };
    }
    Object.assign(result, rest);
  }
  
  return result;
}
