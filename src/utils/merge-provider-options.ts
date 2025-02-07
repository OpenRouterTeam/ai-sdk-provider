export function mergeProviderOptions(
  extraBody?: Record<string, unknown>,
  providerOptions?: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const result = { ...extraBody };
  
  if (providerOptions?.openrouter) {
    Object.assign(result, providerOptions.openrouter);
  }
  
  return result;
}
