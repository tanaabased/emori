/**
 * Removes one matching quote pair from a constrained YAML scalar.
 *
 * @param {unknown} value Raw scalar value.
 * @returns {string} Trimmed scalar content.
 */
export default function unquoteYamlScalar(value) {
  const trimmed = String(value ?? '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}
