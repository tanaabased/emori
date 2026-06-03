function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Merge plain-object config trees with override values winning.
 *
 * Arrays and non-object values are replaced instead of merged by index, which
 * keeps local Codex config overrides predictable.
 *
 * @param {object} base Base config tree.
 * @param {object} override Local override tree.
 * @returns {object} A new merged config tree.
 */
export function deepMerge(base = {}, override = {}) {
  const result = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
      continue;
    }

    result[key] = value;
  }

  return result;
}
