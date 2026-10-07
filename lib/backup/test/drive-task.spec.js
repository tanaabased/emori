import assert from 'node:assert/strict';

import runBackupDrive, { destinationFolder } from '../drive-task.js';

function pilot({ count = 1, remote = false } = {}) {
  const workspace = '/workspace';
  const archives = Array.from({ length: count }, (_, index) => ({
    path: `/workspace/.agent-system/backups/emori-${index}.tar.gz`,
    name: `emori-${index}.tar.gz`,
    capturedAt: `2026-01-${String(10 - index).padStart(2, '0')}T00:00:00.000Z`,
    size: 123,
    sha256: `sha-${index}`,
    md5: `md5-${index}`,
  }));
  const files = new Map();
  const events = [];
  let journal;
  let status;
  const receipt = (archive) => ({ ...archive, remoteId: `id-${archive.sha256}`, verified: true });
  const makeFile = (archive) => ({
    id: `id-${archive.sha256}`,
    name: archive.name,
    size: String(archive.size),
    sha256Checksum: archive.sha256,
    md5Checksum: archive.md5,
    parents: [destinationFolder],
    ownedByMe: true,
    mimeType: 'application/gzip',
  });
  if (remote) {
    journal = {
      version: 1,
      folder: destinationFolder,
      run: null,
      receipts: Object.fromEntries(archives.map((archive) => [archive.sha256, receipt(archive)])),
    };
    archives.forEach((archive) => files.set(`id-${archive.sha256}`, makeFile(archive)));
  }
  const storage = {
    read: async () => structuredClone(journal),
    write: async (name, value) => {
      if (name === 'journal') journal = structuredClone(value);
      else status = structuredClone(value);
    },
  };
  const commands = {
    async backup(argv) {
      const command = argv[0];
      events.push(
        command === 'prune' ? (argv.includes('--dry-run') ? 'preview' : 'prune') : command,
      );
      if (command === 'create')
        return { status: 'created', agentId: 'emori', archive: archives[0].path };
      if (command === 'verify')
        return {
          status: 'verified',
          agentId: 'emori',
          archive: argv[1],
          capturedAt: archives.find((a) => a.path === argv[1]).capturedAt,
          coverage: { openclawState: 'captured', stage: 'workspace-and-agent-state' },
          settings: { openclawState: 'required' },
          diagnostics: [],
        };
      return {
        status: argv.includes('--dry-run') ? 'preview' : 'pruned',
        agentId: 'emori',
        keep: 5,
        output: `${workspace}/.agent-system/backups`,
        kept: archives.slice(0, 5).map((a) => a.path),
        wouldDelete: archives.slice(5).map((a) => a.path),
        deleted: argv.includes('--dry-run') ? [] : archives.slice(5).map((a) => a.path),
      };
    },
    async drive(argv) {
      events.push(argv[1]);
      if (argv[1] === 'get' && argv[2] === destinationFolder)
        return {
          file: {
            id: destinationFolder,
            mimeType: 'application/vnd.google-apps.folder',
            capabilities: { canAddChildren: true },
            permissions: [{ type: 'user' }],
          },
        };
      if (argv[1] === 'get') return { file: files.get(argv[2]) };
      if (argv[1] === 'ls')
        return {
          files: [...files.values()]
            .filter((f) => !f.trashed)
            .map((f) => ({ id: f.id, name: f.name })),
          has_more: false,
          nextPageToken: '',
        };
      if (argv[1] === 'upload') {
        const file = makeFile(archives.find((a) => a.path === argv[2]));
        files.set(file.id, file);
        return { file };
      }
      if (argv[1] === 'delete') {
        files.get(argv[2]).trashed = true;
        return {};
      }
      throw new Error('unexpected-command');
    },
  };
  const args = {
    workspace,
    commands,
    storage,
    inspect: async (path) => archives.find((a) => a.path === path),
    roundTrip: async () => {
      events.push('round-trip');
    },
  };
  return {
    args,
    archives,
    files,
    events,
    receipt,
    makeFile,
    journal: () => journal,
    status: () => status,
  };
}

describe('backup Drive orchestration safety', () => {
  it('stops both retention commands if the local plan changes', async () => {
    const p = pilot({ count: 6, remote: true });
    const backup = p.args.commands.backup;
    let previews = 0;
    p.args.commands.backup = async (argv) => {
      const result = await backup(argv);
      if (argv.includes('--dry-run') && ++previews === 2) result.wouldDelete = [];
      return result;
    };
    await assert.rejects(runBackupDrive(p.args), /local-retention-changed/);
    assert.equal(p.events.includes('delete') || p.events.includes('prune'), false);
  });

  it('does not locally prune if remote retention fails', async () => {
    const p = pilot({ count: 6, remote: true });
    const drive = p.args.commands.drive;
    p.args.commands.drive = async (argv) => {
      if (argv[1] === 'delete') throw new Error('drive-denied');
      return drive(argv);
    };
    await assert.rejects(runBackupDrive(p.args), /drive-denied/);
    assert.equal(p.events.includes('prune'), false);
    assert.equal(p.status().stage, 'remote-retention');
  });

  it('adopts the exact owned pilot upload and prunes only after recovery verification', async () => {
    const p = pilot();
    p.files.set('id-sha-0', p.makeFile(p.archives[0]));
    assert.equal((await runBackupDrive(p.args)).status, 'completed');
    assert.equal(p.events.includes('upload'), false);
    assert(p.events.indexOf('prune') > p.events.indexOf('round-trip'));
    assert.equal(p.journal().run, null);
  });

  it('keeps five, trashes only verified owned excess IDs, and leaves unrelated files untouched', async () => {
    const p = pilot({ count: 6, remote: true });
    p.files.set('unrelated', { id: 'unrelated', name: 'other-person.tar.gz' });
    await runBackupDrive(p.args);
    assert.equal(p.files.get('id-sha-5').trashed, true);
    assert.equal(p.files.get('unrelated').trashed, undefined);
    assert.equal(Object.keys(p.journal().receipts).length, 5);
    assert(p.events.indexOf('delete') > p.events.indexOf('round-trip'));
  });

  it('reconciles an upload accepted before timeout without another create or duplicate upload', async () => {
    const p = pilot();
    const drive = p.args.commands.drive;
    let failed = false;
    p.args.commands.drive = async (argv) => {
      const result = await drive(argv);
      if (argv[1] === 'upload' && !failed) {
        failed = true;
        throw new Error('timeout');
      }
      return result;
    };
    await assert.rejects(runBackupDrive(p.args), /timeout/);
    assert.equal(p.events.includes('prune'), false);
    await runBackupDrive(p.args);
    assert.equal(p.events.filter((e) => e === 'create').length, 1);
    assert.equal(p.events.filter((e) => e === 'upload').length, 1);
  });

  it('does not replay an uncertain upload absent from a complete listing', async () => {
    const p = pilot();
    const drive = p.args.commands.drive;
    p.args.commands.drive = async (argv) => {
      if (argv[1] === 'upload') {
        p.events.push('upload');
        throw new Error('timeout');
      }
      return drive(argv);
    };
    await assert.rejects(runBackupDrive(p.args));
    await assert.rejects(runBackupDrive(p.args), /upload-outcome-unknown/);
    assert.equal(p.events.filter((e) => e === 'upload').length, 1);
    assert.equal(p.events.includes('delete') || p.events.includes('prune'), false);
  });

  for (const phase of ['create', 'verify', 'upload', 'round-trip']) {
    it(`preserves backups after ${phase} failure`, async () => {
      const p = pilot();
      const backup = p.args.commands.backup;
      const drive = p.args.commands.drive;
      if (phase === 'round-trip')
        p.args.roundTrip = async () => {
          throw new Error('corrupt-download');
        };
      else if (phase === 'upload')
        p.args.commands.drive = async (argv) => {
          if (argv[1] === phase) throw new Error('failed-upload');
          return drive(argv);
        };
      else
        p.args.commands.backup = async (argv) => {
          if (argv[0] === phase) throw new Error('backup-failed');
          return backup(argv);
        };
      await assert.rejects(runBackupDrive(p.args));
      assert.equal(p.events.includes('delete') || p.events.includes('prune'), false);
      assert.equal(p.status().status, 'failed');
    });
  }

  it('stops before creating or pruning on incomplete listings', async () => {
    const p = pilot();
    const drive = p.args.commands.drive;
    p.args.commands.drive = async (argv) =>
      argv[1] === 'ls' ? { files: [], has_more: true, nextPageToken: '' } : drive(argv);
    await assert.rejects(runBackupDrive(p.args), /drive-list-incomplete/);
    assert.equal(p.events.includes('create') || p.events.includes('prune'), false);
  });

  it('refuses duplicate names or corrupted remote bytes without deleting anything', async () => {
    for (const duplicate of [false, true]) {
      const p = pilot();
      p.files.set('id-sha-0', { ...p.makeFile(p.archives[0]), sha256Checksum: 'corrupt' });
      if (duplicate) p.files.set('second', { ...p.makeFile(p.archives[0]), id: 'second' });
      await assert.rejects(
        runBackupDrive(p.args),
        duplicate ? /duplicate-remote-archive/ : /remote-integrity-failed/,
      );
      assert.equal(
        p.events.includes('upload') || p.events.includes('delete') || p.events.includes('prune'),
        false,
      );
    }
  });

  it('recovers a completed trash operation whose acknowledgment was lost', async () => {
    const p = pilot({ count: 6, remote: true });
    const drive = p.args.commands.drive;
    let failed = false;
    p.args.commands.drive = async (argv) => {
      const result = await drive(argv);
      if (argv[1] === 'delete' && !failed) {
        failed = true;
        throw new Error('timeout');
      }
      return result;
    };
    await assert.rejects(runBackupDrive(p.args));
    assert.equal(p.events.includes('prune'), false);
    await runBackupDrive(p.args);
    assert.equal(p.events.filter((e) => e === 'delete').length, 1);
  });
});
