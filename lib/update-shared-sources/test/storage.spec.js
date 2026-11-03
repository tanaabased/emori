import assert from 'node:assert/strict';
import { lstat, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import openStorage from '../storage.js';

describe('lib/update-shared-sources/storage (filesystem component)', () => {
  let root;
  let storage;
  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'source-storage-')));
  });
  afterEach(async () => {
    await storage?.close();
    await rm(root, { recursive: true, force: true });
  });
  it('should persist partial facts privately and prevent overlapping updater runs', async () => {
    storage = await openStorage(root);
    const record = {
      version: 1,
      finished: false,
      results: [{ id: 'canon', status: 'pending', steps: ['fetched'], pending: [] }],
    };
    await storage.write(record);
    assert.deepEqual(await storage.read(), record);
    await assert.rejects(openStorage(root), /update-run-active/);
    assert.equal(
      (await lstat(join(root, '.private/update-shared-sources/latest.json'))).mode & 0o777,
      0o600,
    );
    await storage.close();
    storage = await openStorage(root);
    assert.deepEqual(await storage.read(), record);
  });
  it('should reject linked journal directories and files', async () => {
    await symlink(root, join(root, '.private'));
    await assert.rejects(openStorage(root), /journal-unsafe/);
  });
  it('should reject corrupted and oversized journal records', async () => {
    storage = await openStorage(root);
    const path = join(root, '.private/update-shared-sources/latest.json');
    await writeFile(path, '{"version":1,"finished":false,"results":null}');
    await assert.rejects(storage.read(), /journal-invalid/);
    await assert.rejects(storage.write({ text: 'x'.repeat(129 * 1024) }), /journal-invalid/);
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        finished: true,
        results: [
          {
            id: 'openclaw-agent-system',
            status: 'completed',
            steps: [],
            pending: [],
            build: { version: 1, inputs: 'not-a-digest', artifacts: 'c'.repeat(64) },
          },
        ],
      }),
    );
    await assert.rejects(storage.read(), /journal-invalid/);
  });
});
