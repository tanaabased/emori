import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import pathExists from '../utils/path-exists.js';

describe('skills/skill-author/utils/path-exists', () => {
  it('should distinguish existing and missing paths', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'emori-path-exists-'));

    try {
      assert.equal(await pathExists(tempDir), true);
      assert.equal(await pathExists(path.join(tempDir, 'missing')), false);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});
