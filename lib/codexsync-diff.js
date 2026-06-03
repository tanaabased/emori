const MAX_DIFF_PREVIEW = 5;

/**
 * Compare managed cache entry maps and return sorted changed, missing, and
 * extra relative paths.
 *
 * @param {Map<string, object>} sourceEntries Source managed-entry map.
 * @param {Map<string, object>} targetEntries Target managed-entry map.
 * @returns {{changed: string[], extra: string[], missing: string[]}} Sorted drift lists.
 */
export function diffEntries(sourceEntries, targetEntries) {
  const changed = [];
  const extra = [];
  const missing = [];

  for (const [relativePath, sourceEntry] of sourceEntries) {
    const targetEntry = targetEntries.get(relativePath);
    if (!targetEntry) {
      missing.push(relativePath);
      continue;
    }

    if (sourceEntry.type !== targetEntry.type) {
      changed.push(relativePath);
      continue;
    }

    if (sourceEntry.type === 'file') {
      if (
        sourceEntry.mode !== targetEntry.mode ||
        !sourceEntry.content.equals(targetEntry.content)
      ) {
        changed.push(relativePath);
      }

      continue;
    }

    if (sourceEntry.type === 'symlink' && sourceEntry.target !== targetEntry.target) {
      changed.push(relativePath);
    }
  }

  for (const relativePath of targetEntries.keys()) {
    if (!sourceEntries.has(relativePath)) {
      extra.push(relativePath);
    }
  }

  changed.sort((left, right) => left.localeCompare(right));
  extra.sort((left, right) => left.localeCompare(right));
  missing.sort((left, right) => left.localeCompare(right));

  return { changed, extra, missing };
}

/**
 * Report whether a managed cache diff has any actionable drift.
 *
 * @param {{changed: string[], extra: string[], missing: string[]}} diff Managed cache diff.
 * @returns {boolean} Whether the diff contains changed, missing, or extra paths.
 */
export function diffHasChanges(diff) {
  return diff.changed.length > 0 || diff.missing.length > 0 || diff.extra.length > 0;
}

/**
 * Keep cache-drift output readable by truncating long path lists with a count.
 *
 * @param {string[]} paths Sorted relative paths.
 * @returns {string[]} The original list or a shortened preview with a remaining-count marker.
 */
export function previewPaths(paths) {
  if (paths.length <= MAX_DIFF_PREVIEW) {
    return paths;
  }

  return [...paths.slice(0, MAX_DIFF_PREVIEW), `... ${paths.length - MAX_DIFF_PREVIEW} more`];
}

/**
 * Render a compact drift summary in the same order used by detailed output.
 *
 * @param {{changed: string[], extra: string[], missing: string[]}} diff Managed cache diff.
 * @returns {string} Human-readable summary such as `changed 2, missing 1`.
 */
export function summarizeDiff(diff) {
  const parts = [];

  if (diff.changed.length > 0) {
    parts.push(`changed ${diff.changed.length}`);
  }

  if (diff.missing.length > 0) {
    parts.push(`missing ${diff.missing.length}`);
  }

  if (diff.extra.length > 0) {
    parts.push(`extra ${diff.extra.length}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'in sync';
}
