import { collectManagedEntries, pathExists, syncEntries } from './codexsync-cache.js';
import { diffHasChanges, previewPaths, summarizeDiff } from './codexsync-diff.js';

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

export async function runCodexSyncSync({ cachePath, cli, repoRoot }) {
  const sourceEntries = await collectManagedEntries(repoRoot);
  const targetEntries = (await pathExists(cachePath))
    ? await collectManagedEntries(cachePath)
    : new Map();
  const postSyncDiff = await syncEntries({
    sourceEntries,
    sourceRoot: repoRoot,
    targetEntries,
    targetRoot: cachePath,
  });

  printPaths(cli, { cachePath, repoRoot });

  if (diffHasChanges(postSyncDiff)) {
    cli.error(
      'cache sync did not converge for managed plugin paths (%s)',
      summarizeDiff(postSyncDiff),
    );
    printDiffDetails(cli, postSyncDiff);
    return { diff: postSyncDiff, ok: false };
  }

  cli.success('managed plugin cache paths synced');
  cli.note('restart or reinstall Codex if refreshed plugin surfaces do not appear immediately');
  return { diff: postSyncDiff, ok: true };
}
