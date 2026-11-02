import { constants } from 'node:fs';
import { chmod, lstat, mkdir, open, realpath, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { createLocker, Lock } from '@lickle/lock';

import validBuild from './utils/valid-build.js';

/** One updater run at a time, with two bounded private journals. Not a checkout-use lock. */
export default async function openStorage(workspace) {
  let directory = workspace;
  for (const name of ['.private', 'update-shared-sources']) {
    directory = join(directory, name);
    await mkdir(directory, { mode: 0o700 }).catch((error) => {
      if (error.code !== 'EEXIST') throw error;
    });
    if (!(await lstat(directory)).isDirectory() || (await realpath(directory)) !== directory)
      throw new Error('journal-unsafe');
    await chmod(directory, 0o700);
  }
  const path = join(directory, 'run.lock');
  const lock = await open(
    path,
    constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    0o600,
  );
  const identity = await lock.stat();
  let closed = false;
  const assertHeld = async () => {
    const current = await lstat(path);
    if (
      closed ||
      !current.isFile() ||
      current.nlink !== 1 ||
      current.size !== 0 ||
      current.ino !== identity.ino ||
      current.dev !== identity.dev
    )
      throw new Error('journal-lock-lost');
  };
  try {
    await assertHeld();
    if (!(await createLocker().tryLock(lock, Lock.Exclusive))) throw new Error('update-run-active');
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
      const filename = join(directory, 'latest.json');
      try {
        const file = await open(
          filename,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        try {
          const stat = await file.stat();
          if (!stat.isFile() || stat.nlink !== 1 || stat.size > 128 * 1024)
            throw new Error('journal-invalid');
          const value = JSON.parse(await file.readFile('utf8'));
          if (
            value.version !== 1 ||
            typeof value.finished !== 'boolean' ||
            !Array.isArray(value.results) ||
            !value.results.every(
              (result) =>
                result &&
                typeof result.id === 'string' &&
                typeof result.status === 'string' &&
                Array.isArray(result.steps) &&
                result.steps.every((step) => typeof step === 'string') &&
                Array.isArray(result.pending) &&
                result.pending.every((step) => typeof step === 'string') &&
                (result.build === undefined || validBuild(result.build)),
            )
          )
            throw new Error('journal-invalid');
          return value;
        } finally {
          await file.close();
        }
      } catch (error) {
        if (error.code === 'ENOENT') return undefined;
        throw error;
      }
    },
    async write(value, name = 'latest') {
      await assertHeld();
      if (!['latest', 'previous'].includes(name)) throw new Error('journal-invalid');
      const text = `${JSON.stringify(value)}\n`;
      if (Buffer.byteLength(text) > 128 * 1024) throw new Error('journal-invalid');
      const temporary = join(directory, `.${randomUUID()}.json`);
      const file = await open(temporary, 'wx', 0o600);
      try {
        await file.writeFile(text);
        await file.sync();
        await file.close();
        await assertHeld();
        await rename(temporary, join(directory, `${name}.json`));
        const parent = await open(directory, 'r');
        try {
          await parent.sync();
        } finally {
          await parent.close();
        }
      } finally {
        await file.close().catch(() => {});
        await unlink(temporary).catch((error) => {
          if (error.code !== 'ENOENT') throw error;
        });
      }
    },
    async close() {
      if (closed) return;
      closed = true;
      // The waited child inherits this descriptor and retains the lock if the wrapper dies.
      await lock.close();
    },
  };
}
