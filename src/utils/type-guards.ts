/**
 * Type guard to check if a value is defined and not null
 */
export function isDefinedOrNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
