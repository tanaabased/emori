import { createReadStream } from 'node:fs';
import { chmod, lstat, mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';

/** Private, durable checkpoints and a lock that requires operator review after interruption. */
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
  const lock = await open(lockPath, 'wx', 0o600).catch(() => {
    throw new Error('backup-run-locked');
  });
  await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  await lock.sync();
  return {
    async read() {
      try {
        const path = join(directory, 'journal.json');
        if (!(await lstat(path)).isFile() || (await realpath(path)) !== path) {
          throw new Error('journal-unsafe');
        }
        return JSON.parse(await readFile(path, 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return undefined;
        throw error;
      }
    },
    async write(name, value) {
      const temporary = join(directory, `.${randomUUID()}.json`);
      const file = await open(temporary, 'wx', 0o600);
      try {
        await file.writeFile(`${JSON.stringify(value, null, 2)}\n`);
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporary, join(directory, `${name}.json`));
      const parent = await open(directory, 'r');
      try {
        await parent.sync();
      } finally {
        await parent.close();
      }
    },
    async close() {
      await lock.close();
      await unlink(lockPath);
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
