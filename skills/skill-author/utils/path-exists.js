import { stat } from 'node:fs/promises';

/**
 * Checks whether one filesystem path is accessible.
 *
 * @param {string} targetPath Filesystem path to inspect.
 * @returns {Promise<boolean>} Whether the path exists.
 */
export default async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}
