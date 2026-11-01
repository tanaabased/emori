import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import openBackupStorage from '../../backup/storage.js';
import updateStorage from '../storage.js';

describe('lib/update-agent/storage (filesystem/process component)', () => {
  let workspace;
  beforeEach(async () => {
    workspace = await realpath(await mkdtemp(join(tmpdir(), 'emori-update-test-')));
  });
  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('should persist private checkpoints while excluding backup and updater overlaps', async () => {
    const storage = await updateStorage(workspace);
    try {
      await assert.rejects(openBackupStorage(workspace), /backup-run-locked/);
      await assert.rejects(updateStorage(workspace), /backup-run-locked/);
      await storage.write({ version: 1, id: 'fixture-run', pending: 'install' });
      assert.deepEqual(await storage.read(), { version: 1, id: 'fixture-run', pending: 'install' });
      assert.equal(
        JSON.parse(
          await readFile(join(workspace, '.private/update-agent/runs/fixture-run.json'), 'utf8'),
        ).pending,
        'install',
      );
      assert.equal(
        (await stat(join(workspace, '.private/update-agent/status.json'))).mode & 0o777,
        0o600,
      );
      assert.equal((await stat(join(workspace, '.private/update-agent'))).mode & 0o777, 0o700);
    } finally {
      await storage.close();
    }
    const next = await updateStorage(workspace);
    await next.close();
    await assert.rejects(readFile(join(workspace, '.private/backup-drive/deliveries.json')), {
      code: 'ENOENT',
    });
  });

  it('should not start while backup owns its existing lock', async () => {
    const backup = await openBackupStorage(workspace);
    try {
      await assert.rejects(updateStorage(workspace), /backup-run-locked/);
    } finally {
      await backup.close();
    }
  });

  it('should refuse linked or malformed checkpoints without changing their contents', async () => {
    const storage = await updateStorage(workspace);
    const path = join(workspace, '.private/update-agent/status.json');
    const outside = join(workspace, 'original');
    try {
      await writeFile(outside, 'original');
      await symlink(outside, path);
      await assert.rejects(storage.read(), /checkpoint-invalid/);
      assert.equal(await readFile(outside, 'utf8'), 'original');
      await unlink(path);
      await writeFile(path, 'broken json', { mode: 0o600 });
      await assert.rejects(storage.read(), /checkpoint-invalid/);
      assert.equal(await readFile(path, 'utf8'), 'broken json');
    } finally {
      await storage.close();
    }
  });

  it('should detect lock replacement before writing', async () => {
    const storage = await updateStorage(workspace);
    try {
      const path = join(workspace, '.private/update-agent/run.lock');
      await unlink(path);
      await writeFile(path, '');
      await assert.rejects(storage.write({}), /update-lock-lost/);
    } finally {
      await storage.close();
    }
  });

  it('should keep exclusion in inherited children after the wrapper closes', async () => {
    const storage = await updateStorage(workspace);
    const child = spawn(
      process.execPath,
      ['-e', 'process.stdout.write("ready");process.stdin.resume();'],
      {
        stdio: ['pipe', 'pipe', 'pipe', ...storage.lockFds],
      },
    );
    try {
      await once(child.stdout, 'data');
      await storage.close();
      await assert.rejects(updateStorage(workspace), /backup-run-locked/);
    } finally {
      const exited = once(child, 'exit');
      child.stdin.end();
      await exited;
      await storage.close();
    }
    const next = await updateStorage(workspace);
    await next.close();
  });
});
