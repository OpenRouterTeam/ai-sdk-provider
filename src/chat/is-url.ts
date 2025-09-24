/**
 * Checks if a given string is a URL with a valid protocol.
 *
 * @param {object} options - The options for checking the URL.
 * @param {string | URL} options.url - The URL to check.
 * @param {Set<`${string}:`>} options.protocols - A set of allowed protocols.
 * @returns {boolean} True if the URL is valid and has an allowed protocol, false otherwise.
 */
export function isUrl({
  url,
  protocols,
}: {
  url: string | URL;
  protocols: Set<`${string}:`>;
}): boolean {
  try {
    const urlObj = new URL(url);
    // Cast to the literal string due to Set inferred input type
    return protocols.has(urlObj.protocol as `${string}:`);
  } catch (_) {
    return false;
  }
}
