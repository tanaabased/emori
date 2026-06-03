/**
 * Split a comma-separated option or environment value into trimmed non-empty
 * entries.
 *
 * @param {unknown} value Raw comma-separated value.
 * @returns {string[]} Trimmed entries with empty segments removed.
 */
export function splitCsv(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
