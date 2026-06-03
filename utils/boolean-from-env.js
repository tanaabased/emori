import { valueEnabled } from './value-enabled.js';

/**
 * Read a boolean-style environment value while preserving the caller's default
 * only when the variable is missing.
 *
 * @param {unknown} value Raw environment value; only `undefined` uses the fallback.
 * @param {boolean} fallback Default returned when the variable is missing.
 * @returns {boolean} The fallback or normalized boolean-style environment value.
 */
export function booleanFromEnv(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return valueEnabled(value);
}
