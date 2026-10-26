import { constants, createReadStream } from 'node:fs';
import { chmod, lstat, mkdir, open, readFile, realpath, rename } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';

import { createLocker, Lock } from '@lickle/lock';

/** Private checkpoints under an OS-held lock; the empty lock file is never removed. */
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
    async read() {
      await assertHeld();
      try {
        const path = join(directory, 'deliveries.json');
        if (!(await lstat(path)).isFile() || (await realpath(path)) !== path) {
          throw new Error('delivery-record-unsafe');
        }
        return JSON.parse(await readFile(path, 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return undefined;
        throw error;
      }
    },
    async write(name, value) {
      await assertHeld();
      if (!['deliveries', 'status'].includes(name)) throw new Error('record-name-invalid');
      const temporary = join(directory, `.${randomUUID()}.json`);
      const file = await open(temporary, 'wx', 0o600);
      try {
        await file.writeFile(`${JSON.stringify(value, null, 2)}\n`);
        await file.sync();
      } finally {
        await file.close();
      }
      await assertHeld();
      await rename(temporary, join(directory, `${name}.json`));
      const parent = await open(directory, 'r');
      try {
        await parent.sync();
      } finally {
        await parent.close();
      }
    },
    async close() {
      if (closed) return;
      closed = true;
      // Close, do not LOCK_UN: an inherited command descriptor must keep exclusion.
      await lock.close();
    },
  };
}

/** Hash one contained regular archive; refuse links or files changed during the read. */
export async function inspectArchive(
  path,
  workspace,
  output = join(workspace, '.agent-system', 'backups'),
) {
  if (resolve(path) !== path || !path.startsWith(`${output}/`) || !path.endsWith('.tar.gz')) {
    throw new Error('archive-outside-backups');
  }
  const before = await lstat(path);
  if (!before.isFile() || before.nlink !== 1 || (await realpath(path)) !== path) {
    throw new Error('archive-unsafe');
  }
  const sha256 = createHash('sha256');
  const md5 = createHash('md5');
  for await (const chunk of createReadStream(path)) {
    sha256.update(chunk);
    md5.update(chunk);
  }
  const after = await lstat(path);
  if (['ino', 'dev', 'size', 'mtimeMs', 'ctimeMs'].some((key) => before[key] !== after[key])) {
    throw new Error('archive-changed');
  }
  return { size: before.size, sha256: sha256.digest('hex'), md5: md5.digest('hex') };
}
