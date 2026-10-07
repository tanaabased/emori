import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { verifyDownload } from '../drive-task.js';

describe('download recovery gate', () => {
  let workspace;
  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'emori-download-test-'));
  });
  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  for (const corrupt of [false, true]) {
    it(
      corrupt
        ? 'rejects changed downloaded bytes and clears temporary output'
        : 'verifies privately downloaded bytes before clearing temporary output',
      async () => {
        const bytes = Buffer.from('synthetic verified archive');
        const archive = {
          remoteId: 'exact-owned-id',
          size: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        };
        let verifiedPath;
        const commands = {
          async drive(argv) {
            assert.equal(argv[2], archive.remoteId);
            await writeFile(argv[4], corrupt ? 'wrong bytes' : bytes);
            assert.equal((await stat(join(argv[4], '..'))).mode & 0o777, 0o700);
          },
          async backup(argv) {
            verifiedPath = argv[1];
            assert.equal((await stat(verifiedPath)).mode & 0o777, 0o600);
            return {
              status: 'verified',
              agentId: 'emori',
              archive: verifiedPath,
              capturedAt: '2026-01-01T00:00:00Z',
              coverage: { openclawState: 'captured', stage: 'workspace-and-agent-state' },
              settings: { openclawState: 'required' },
              diagnostics: [],
            };
          },
        };
        if (corrupt)
          await assert.rejects(verifyDownload(commands, archive, workspace), /download-mismatch/);
        else await verifyDownload(commands, archive, workspace);
        assert(verifiedPath);
        assert.deepEqual(await readdir(join(workspace, '.temp')), []);
      },
    );
  }
});
