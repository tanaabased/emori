import { constants } from 'node:fs';
import { chmod, lstat, mkdir, open, realpath } from 'node:fs/promises';
import { join } from 'node:path';

import { createLocker, Lock } from '@lickle/lock';

/** Backup/update exclusion under an OS-held lock; the empty lock file is never removed. */
export default async function openStorage(workspace) {
  let directory = workspace;
  for (const component of ['.private', 'backup-drive']) {
    directory = join(directory, component);
    await mkdir(directory, { mode: 0o700 }).catch((error) => {
      if (error.code !== 'EEXIST') throw error;
    });
    if (!(await lstat(directory)).isDirectory() || (await realpath(directory)) !== directory) {
      throw new Error('private-directory-unsafe');
    }
    await chmod(directory, 0o700);
  }
  const lockPath = join(directory, 'run.lock');
  const lock = await open(
    lockPath,
    constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    0o600,
  ).catch(() => {
    throw new Error('backup-lock-unsafe');
  });
  let closed = false;
  const identity = await lock.stat();
  const assertHeld = async () => {
    const current = await lstat(lockPath);
    if (
      closed ||
      !current.isFile() ||
      current.nlink !== 1 ||
      current.dev !== identity.dev ||
      current.ino !== identity.ino ||
      current.size !== 0
    )
      throw new Error('backup-lock-lost');
  };
  try {
    if (!identity.isFile() || identity.nlink !== 1) throw new Error('backup-lock-unsafe');
    // Old wrappers did not take an OS lock. Never infer their quiescence from a PID.
    if (identity.size !== 0) throw new Error('legacy-backup-lock');
    if (!(await createLocker().tryLock(lock, Lock.Exclusive))) throw new Error('backup-run-locked');
    await assertHeld();
    await lock.chmod(0o600);
  } catch (error) {
    await lock.close();
    throw error;
  }
  return {
    lockFd: lock.fd,
    assertHeld,
    async close() {
      if (closed) return;
      closed = true;
      // Close, do not LOCK_UN: an inherited command descriptor must keep exclusion.
      await lock.close();
    },
  };
}
