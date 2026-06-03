import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const MANAGED_PATHS = [
  '.codex-plugin',
  '.mcp.json',
  'AGENTS.md',
  'assets',
  'bin',
  'lib',
  'package.json',
  'skills',
  'utils',
];

async function readJson(targetPath) {
  return JSON.parse(await readFile(targetPath, 'utf8'));
}

/**
 * Resolve the repo and installed plugin-cache paths used by check and sync.
 *
 * The default cache path follows the installed plugin cache layout using the
 * plugin name and package version from the repo.
 *
 * @param {object} options Context options.
 * @param {string | null} [options.cachePathOverride] Explicit cache path.
 * @param {string} options.repoRoot Repository root containing package and plugin manifests.
 * @returns {Promise<{cachePath: string, repoRoot: string}>} Resolved sync context.
 */
export async function resolveCodexSyncContext({ cachePathOverride = null, repoRoot }) {
  const packageJson = await readJson(path.join(repoRoot, 'package.json'));
  const pluginJson = await readJson(path.join(repoRoot, '.codex-plugin', 'plugin.json'));

  return {
    cachePath:
      cachePathOverride ??
      path.join(
        os.homedir(),
        '.codex',
        'plugins',
        'cache',
        'tanaabstore',
        pluginJson.name,
        packageJson.version,
      ),
    repoRoot,
  };
}
