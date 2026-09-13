import { mkdir, rename, rm, rmdir } from 'node:fs/promises';

/**
 * Publishes a validated sibling directory. Failed replacement restores the old
 * directory; if restoration fails, its backup is retained at the reported path.
 * The caller owns cleanup of the staged directory.
 */
export default async function publishSkillDirectory(
  stagedDir,
  skillDir,
  { force = false, renameDirectory = rename } = {},
) {
  const backupDir = `${stagedDir}.previous`;
  let backedUp = false;
  let reserved = false;

  if (force) {
    try {
      await renameDirectory(skillDir, backupDir);
      backedUp = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  try {
    if (!backedUp) {
      // Reserve an absent destination without replacing another caller's work.
      await mkdir(skillDir);
      reserved = true;
    }
    await renameDirectory(stagedDir, skillDir);
  } catch (error) {
    try {
      if (reserved) await rmdir(skillDir);
      if (backedUp) await renameDirectory(backupDir, skillDir);
    } catch (restoreError) {
      throw new AggregateError(
        [error, restoreError],
        backedUp
          ? `Skill replacement failed; recovery failed. Original content remains at ${backupDir}.`
          : `Skill publication failed; could not remove the reserved directory at ${skillDir}.`,
        { cause: restoreError },
      );
    }
    throw error;
  }

  if (backedUp) {
    try {
      await rm(backupDir, { recursive: true });
    } catch (error) {
      throw new Error(
        `Skill installed at ${skillDir}, but backup cleanup failed at ${backupDir}.`,
        {
          cause: error,
        },
      );
    }
  }
}
