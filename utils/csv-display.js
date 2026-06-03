/**
 * Render a list for CLI defaults, using `none` when no value will be applied.
 *
 * @param {string[]} values Values to show in a CLI help default.
 * @returns {string} A comma-joined display value or `none`.
 */
export function csvDisplay(values) {
  return values.length > 0 ? values.join(',') : 'none';
}
