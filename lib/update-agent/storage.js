import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, open, realpath, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { createLocker, Lock } from '@lickle/lock';

import openBackupStorage from '../backup/storage.js';

/** Hold backup exclusion first, then updater exclusion; never alter backup records. */
export default async function updateStorage(workspace) {
  const backup = await openBackupStorage(workspace);
  let lock;
  try {
    const directory = join(workspace, '.private', 'update-agent');
    await mkdir(directory, { mode: 0o700 }).catch((error) => {
      if (error.code !== 'EEXIST') throw error;
    });
    const stat = await lstat(directory);
    if (
      !stat.isDirectory() ||
      (await realpath(directory)) !== directory ||
      stat.uid !== process.getuid()
    )
      throw new Error('private-directory-unsafe');
    await chmod(directory, 0o700);
    const runs = join(directory, 'runs');
    await mkdir(runs, { mode: 0o700 }).catch((error) => {
      if (error.code !== 'EEXIST') throw error;
    });
    const runsStat = await lstat(runs);
    if (
      !runsStat.isDirectory() ||
      (await realpath(runs)) !== runs ||
      runsStat.uid !== process.getuid()
    )
      throw new Error('private-directory-unsafe');
    await chmod(runs, 0o700);
    const path = join(directory, 'run.lock');
    lock = await open(
      path,
      constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      0o600,
    );
    const identity = await lock.stat();
    if (
      !identity.isFile() ||
      identity.nlink !== 1 ||
      identity.size ||
      identity.uid !== process.getuid()
    )
      throw new Error('update-lock-unsafe');
    if (!(await createLocker().tryLock(lock, Lock.Exclusive))) throw new Error('update-run-locked');
    await lock.chmod(0o600);
    let closed = false;
    const assertHeld = async () => {
      await backup.assertHeld();
      const current = await lstat(path);
      if (
        closed ||
        !current.isFile() ||
        current.nlink !== 1 ||
        current.size ||
        current.dev !== identity.dev ||
        current.ino !== identity.ino
      )
        throw new Error('update-lock-lost');
    };
    const statusPath = join(directory, 'status.json');
    return {
      lockFds: [backup.lockFd, lock.fd],
      assertHeld,
      async read() {
        await assertHeld();
        let file;
        try {
          file = await open(
            statusPath,
            constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
          );
          const value = await file.stat();
          if (
            !value.isFile() ||
            value.nlink !== 1 ||
            value.uid !== process.getuid() ||
            value.size > 65536 ||
            value.mode & 0o077
          )
            throw new Error('checkpoint-invalid');
          return JSON.parse(await file.readFile('utf8'));
        } catch (error) {
          if (error.code !== 'ENOENT') throw new Error('checkpoint-invalid', { cause: error });
        } finally {
          await file?.close();
        }
      },
      async write(value) {
        await assertHeld();
        if (!/^[a-zA-Z0-9-]{1,80}$/.test(value.id)) throw new Error('checkpoint-invalid');
        const contents = `${JSON.stringify(value, null, 2)}\n`;
        if (Buffer.byteLength(contents) > 65536) throw new Error('checkpoint-invalid');
        for (const destination of [join(runs, `${value.id}.json`), statusPath]) {
          const temporary = join(directory, `.${randomUUID()}.json`);
          const file = await open(temporary, 'wx', 0o600);
          try {
            await file.writeFile(contents);
            await file.sync();
          } finally {
            await file.close();
          }
          try {
            await assertHeld();
            await rename(temporary, destination);
            const parent = await open(destination === statusPath ? directory : runs, 'r');
            try {
              await parent.sync();
            } finally {
              await parent.close();
            }
          } finally {
            await unlink(temporary).catch(() => {});
          }
        }
      },
      async close() {
        if (closed) return;
        closed = true;
        try {
          await lock.close();
        } finally {
          await backup.close();
        }
      },
    };
  } catch (error) {
    await lock?.close();
    await backup.close();
    throw error;
  }
}
