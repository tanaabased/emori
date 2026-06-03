import { collectManagedEntries, pathExists } from './codexsync-cache.js';
import { diffEntries, diffHasChanges, previewPaths, summarizeDiff } from './codexsync-diff.js';

function printPaths(cli, { cachePath, repoRoot }) {
  cli.log(`repo: ${repoRoot}`);
  cli.log(`cache: ${cachePath}`);
}

function printDiffDetails(cli, diff) {
  for (const [label, paths] of [
    ['changed', diff.changed],
    ['missing', diff.missing],
    ['extra', diff.extra],
  ]) {
    const preview = previewPaths(paths);
    if (preview.length === 0) {
      continue;
    }

    cli.log(`${label}:`);
    for (const entry of preview) {
      cli.log(`  ${entry}`);
    }
  }
}

export async function runCodexSyncCheck({ cachePath, cli, repoRoot }) {
  const sourceEntries = await collectManagedEntries(repoRoot);
  const targetEntries = (await pathExists(cachePath))
    ? await collectManagedEntries(cachePath)
    : new Map();
  const diff = diffEntries(sourceEntries, targetEntries);

  printPaths(cli, { cachePath, repoRoot });

  if (!diffHasChanges(diff)) {
    cli.success('managed plugin cache paths match source');
    return { diff, ok: true };
  }

  cli.error('cache drift detected for managed plugin paths (%s)', summarizeDiff(diff));
  printDiffDetails(cli, diff);
  return { diff, ok: false };
}
