import {
  chmod,
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  rm,
  symlink,
} from 'node:fs/promises';
import path from 'node:path';

import { MANAGED_PATHS } from './codexsync-context.js';
import { diffEntries } from './codexsync-diff.js';

const IGNORED_NAMES = new Set(['.DS_Store', '.git', 'node_modules']);

/**
 * Check for a filesystem path without treating missing paths as exceptional.
 *
 * @param {string} targetPath Path to check.
 * @returns {Promise<boolean>} Whether the path currently exists.
 */
export async function pathExists(targetPath) {
  try {
    await lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Collect file, directory, and symlink metadata for paths managed by the plugin
 * cache sync contract.
 *
 * @param {string} rootDir Root directory to scan.
 * @param {Map<string, object>} [entryMap] Existing entry map to append to.
 * @returns {Promise<Map<string, object>>} Relative managed paths mapped to entry metadata.
 */
export async function collectManagedEntries(rootDir, entryMap = new Map()) {
  for (const managedPath of MANAGED_PATHS) {
    await collectEntry(rootDir, managedPath, entryMap);
  }

  return entryMap;
}

async function collectEntry(rootDir, relativePath, entryMap) {
  const absolutePath = path.join(rootDir, relativePath);

  let stats;
  try {
    stats = await lstat(absolutePath);
  } catch {
    return;
  }

  if (stats.isSymbolicLink()) {
    entryMap.set(relativePath, {
      target: await readlink(absolutePath),
      type: 'symlink',
    });
    return;
  }

  if (stats.isDirectory()) {
    entryMap.set(relativePath, { type: 'dir' });
    const dirents = await readdir(absolutePath, { withFileTypes: true });

    for (const dirent of dirents.sort((left, right) => left.name.localeCompare(right.name))) {
      if (IGNORED_NAMES.has(dirent.name)) {
        continue;
      }

      await collectEntry(rootDir, path.join(relativePath, dirent.name), entryMap);
    }

    return;
  }

  if (stats.isFile()) {
    entryMap.set(relativePath, {
      content: await readFile(absolutePath),
      mode: stats.mode & 0o777,
      type: 'file',
    });
  }
}

async function ensureParentDirectory(targetPath) {
  await mkdir(path.dirname(targetPath), { recursive: true });
}

/**
 * Make the target plugin cache entries match the source entries.
 *
 * Side effects: removes extra target paths, recreates directories, files, and
 * symlinks, preserves file modes, and returns a post-sync diff for convergence
 * checks.
 *
 * @param {object} options Sync options.
 * @param {Map<string, object>} options.sourceEntries Source managed-entry map.
 * @param {string} options.sourceRoot Root directory for source paths.
 * @param {Map<string, object>} options.targetEntries Target managed-entry map.
 * @param {string} options.targetRoot Root directory for target paths.
 * @returns {Promise<{changed: string[], extra: string[], missing: string[]}>} Post-sync diff.
 */
export async function syncEntries({ sourceEntries, sourceRoot, targetEntries, targetRoot }) {
  const diff = diffEntries(sourceEntries, targetEntries);
  const extraPaths = [...diff.extra].sort((left, right) => {
    const leftDepth = left.split(path.sep).length;
    const rightDepth = right.split(path.sep).length;
    return rightDepth - leftDepth || right.length - left.length;
  });

  for (const relativePath of extraPaths) {
    await rm(path.join(targetRoot, relativePath), { force: true, recursive: true });
  }

  const sortedEntries = [...sourceEntries.entries()].sort(
    ([leftPath, leftEntry], [rightPath, rightEntry]) => {
      const leftDepth = leftPath.split(path.sep).length;
      const rightDepth = rightPath.split(path.sep).length;

      if (leftDepth !== rightDepth) {
        return leftDepth - rightDepth;
      }

      if (leftEntry.type === 'dir' && rightEntry.type !== 'dir') {
        return -1;
      }

      if (leftEntry.type !== 'dir' && rightEntry.type === 'dir') {
        return 1;
      }

      return leftPath.localeCompare(rightPath);
    },
  );

  await mkdir(targetRoot, { recursive: true });

  for (const [relativePath, sourceEntry] of sortedEntries) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);

    if (sourceEntry.type === 'dir') {
      await mkdir(targetPath, { recursive: true });
      continue;
    }

    await ensureParentDirectory(targetPath);
    await rm(targetPath, { force: true, recursive: true });

    if (sourceEntry.type === 'symlink') {
      await symlink(sourceEntry.target, targetPath);
      continue;
    }

    await cp(sourcePath, targetPath, { force: true });
    await chmod(targetPath, sourceEntry.mode);
  }

  const refreshedTargetEntries = await collectManagedEntries(targetRoot);
  return diffEntries(sourceEntries, refreshedTargetEntries);
}
