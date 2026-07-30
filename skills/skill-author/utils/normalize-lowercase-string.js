/**
 * Normalizes an optional string into a nonempty lowercase value.
 *
 * @param {unknown} value Candidate string.
 * @returns {string | null} Normalized value or null for non-strings and empty strings.
 */
export default function normalizeLowercaseString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  return value.trim().toLowerCase() || null;
}
