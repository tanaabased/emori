import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import openStorage, { inspectArchive } from '../storage.js';
import backupCommands from '../commands.js';

describe('backup task private storage and authority', () => {
  let workspace;
  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'emori-backup-test-'));
  });
  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('rejects an unbound scheduled invocation before any command executes', () => {
    assert.throws(
      () => backupCommands({ workspace, operator: false, environment: {} }),
      /agent-binding-required/,
    );
  });

  it('blocks overlaps, preserves private checkpoints, and releases only its own lock', async () => {
    const storage = await openStorage(workspace);
    try {
      await assert.rejects(openStorage(workspace), /backup-run-locked/);
      await storage.write('journal', { pending: 'exact-archive' });
      assert.deepEqual(await storage.read(), { pending: 'exact-archive' });
      const directory = join(workspace, '.private', 'backup-drive');
      assert.equal((await stat(directory)).mode & 0o777, 0o700);
      assert.equal((await stat(join(directory, 'journal.json'))).mode & 0o777, 0o600);
    } finally {
      await storage.close();
    }
    const next = await openStorage(workspace);
    await next.close();
  });

  it('refuses a stale lock without deleting it', async () => {
    const directory = join(workspace, '.private', 'backup-drive');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'run.lock'), 'interrupted run');
    await assert.rejects(openStorage(workspace), /backup-run-locked/);
    assert.equal(await readFile(join(directory, 'run.lock'), 'utf8'), 'interrupted run');
  });

  it('refuses linked private storage', async () => {
    const target = join(workspace, 'other');
    await mkdir(target);
    await symlink(target, join(workspace, '.private'));
    await assert.rejects(openStorage(workspace), /private-directory-unsafe/);
  });

  it('hashes the exact contained bytes and refuses linked archives or path escapes', async () => {
    const output = join(workspace, '.agent-system', 'backups');
    await mkdir(output, { recursive: true });
    const archive = join(output, 'emori-test.tar.gz');
    const bytes = Buffer.from('synthetic archive bytes');
    await writeFile(archive, bytes);
    assert.equal(
      (await inspectArchive(archive, workspace)).sha256,
      createHash('sha256').update(bytes).digest('hex'),
    );
    await symlink(archive, join(output, 'linked.tar.gz'));
    await assert.rejects(
      inspectArchive(join(output, 'linked.tar.gz'), workspace),
      /archive-unsafe/,
    );
    await assert.rejects(
      inspectArchive(join(workspace, 'outside.tar.gz'), workspace),
      /archive-outside-backups/,
    );
  });
});
