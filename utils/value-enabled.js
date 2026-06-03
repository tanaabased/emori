/**
 * Normalize human-facing env or option text into an enabled/disabled boolean.
 *
 * Empty values plus `0`, `false`, `no`, and `off` are disabled; every other
 * normalized value is intentionally enabled so new truthy words do not need
 * parser changes.
 *
 * @param {unknown} value Value from an environment variable, CLI option, or default.
 * @returns {boolean} Whether the normalized value should be treated as enabled.
 */
export function valueEnabled(value) {
  switch (
    String(value ?? '')
      .trim()
      .toLowerCase()
  ) {
    case '':
    case '0':
    case 'false':
    case 'no':
    case 'off':
      return false;
    default:
      return true;
  }
}
