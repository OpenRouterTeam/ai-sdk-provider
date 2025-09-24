export function formatStructuredData(value: unknown): string {
  if (value === undefined || value === null) {
    return '—';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return String(value);
  }
}
