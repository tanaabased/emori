import assert from 'node:assert/strict';

import runBackupDrive, { destinationFolder } from '../drive-task.js';

function pilot({ count = 1 } = {}) {
  const workspace = '/workspace';
  const archives = Array.from({ length: count }, (_, index) => ({
    path: `${workspace}/.agent-system/backups/emori-${index}.tar.gz`,
    name: `emori-${index}.tar.gz`,
    capturedAt: `2026-01-${String(10 - index).padStart(2, '0')}T00:00:00.000Z`,
    size: 123,
    sha256: (index + 1).toString(16).padStart(64, '0'),
    md5: (index + 1).toString(16).padStart(32, '0'),
  }));
  const files = new Map();
  const local = new Map(archives.map((archive) => [archive.path, archive]));
  const events = [];
  const writes = {};
  const file = (a) => ({
    id: `id-${a.name}`,
    name: a.name,
    size: String(a.size),
    sha256Checksum: a.sha256,
    md5Checksum: a.md5,
    parents: [destinationFolder],
    ownedByMe: true,
    mimeType: 'application/gzip',
  });
  const capture = (a, status) => ({
    ...a,
    archive: a.path,
    status,
    agentId: 'emori',
    format: 'agent-system-backup',
    version: 2,
    diagnostics: [],
    coverage: { openclawState: 'captured', stage: 'workspace-and-agent-state' },
    settings: { openclawState: 'required' },
  });
  const receipt = (a) => ({ ...a, remoteId: file(a).id, status: 'delivered' });
  const storage = {
    read: async () => structuredClone(writes.deliveries),
    write: async (name, value) => {
      events.push(`write-${name}`);
      writes[name] = structuredClone(value);
    },
  };
  const commands = {
    async backup(argv) {
      const command = argv[0];
      events.push(command === 'prune' && argv.includes('--dry-run') ? 'preview' : command);
      if (command === 'create') return capture(archives[0], 'created');
      if (command === 'verify')
        return capture(
          archives.find((a) => a.path === argv[1]),
          'verified',
        );
      const eligible = [...local.values()].sort(
        (a, b) =>
          Date.parse(b.capturedAt) - Date.parse(a.capturedAt) || a.name.localeCompare(b.name),
      );
      const kept = eligible.slice(0, 5).map((a) => a.path);
      const excess = eligible.slice(5).map((a) => a.path);
      if (!argv.includes('--dry-run')) excess.forEach((path) => local.delete(path));
      return {
        status: argv.includes('--dry-run') ? 'preview' : 'pruned',
        agentId: 'emori',
        keep: 5,
        output: `${workspace}/.agent-system/backups`,
        kept,
        wouldDelete: excess,
        deleted: argv.includes('--dry-run') ? [] : excess,
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
          files: [...files.values()].filter((f) => !f.trashed),
          has_more: false,
          nextPageToken: '',
        };
      if (argv[1] === 'upload') {
        const remote = file(archives.find((a) => a.path === argv[2]));
        files.set(remote.id, remote);
        return { file: remote };
      }
      if (argv[1] === 'delete') {
        assert.equal(argv[3], '--force');
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
    inspect: async (path) => {
      events.push(`inspect-${path}`);
      return archives.find((a) => a.path === path);
    },
  };
  const seed = () => {
    writes.deliveries = {
      version: 1,
      folder: destinationFolder,
      receipts: archives.slice(1).map(receipt),
    };
    archives.slice(1).forEach((a) => files.set(file(a).id, file(a)));
  };
  return { args, archives, files, local, events, writes, file, receipt, capture, seed };
}

// Unit evidence: execute owned orchestration with controlled managed-command results.
describe('lib/backup/drive-task', () => {
  it('should deliver fresh bytes even when an old-schema archive breaks retention preview', async () => {
    const p = pilot();
    const backup = p.args.commands.backup;
    p.args.commands.backup = async (argv) => {
      if (argv[0] === 'prune') throw new Error('backup-retained-verification-failed');
      return backup(argv);
    };
    const result = await runBackupDrive(p.args);
    assert.equal(result.status, 'completed');
    assert.equal(result.delivery, 'confirmed');
    assert.equal(result.retention, 'deferred');
    assert(p.events.includes('upload'));
    assert(!p.events.includes('prune'));
  });

  it('should record delivery before any history inspection and omit redundant verification/download', async () => {
    const p = pilot();
    assert.equal((await runBackupDrive(p.args)).retention, 'completed');
    assert(p.events.indexOf('preview') > p.events.indexOf('write-status'));
    assert(p.events.indexOf('ls') > p.events.indexOf('write-status'));
    assert.equal(p.events.filter((e) => e.startsWith('inspect-')).length, 1);
    assert(!p.events.includes('verify') && !p.events.includes('download'));
    assert.equal(p.writes.deliveries.receipts[0].status, 'delivered');
  });

  it('should ignore obsolete malformed journal state without rewriting it', async () => {
    const p = pilot();
    p.writes.journal = 'obsolete malformed state';
    await runBackupDrive(p.args);
    assert.equal(p.writes.journal, 'obsolete malformed state');
  });

  it('should deliver without reuploading a missing historical remote file', async () => {
    const p = pilot({ count: 2 });
    p.seed();
    p.files.clear();
    const result = await runBackupDrive(p.args);
    assert.equal(result.delivery, 'confirmed');
    assert.equal(result.retention, 'deferred');
    assert.equal(p.events.filter((e) => e === 'upload').length, 1);
    assert(!p.events.includes('delete') && !p.events.includes('prune'));
  });

  for (const command of ['preview', 'delete', 'prune']) {
    it(`should preserve delivery and stop remaining cleanup after ${command} fails`, async () => {
      const p = pilot({ count: 6 });
      p.seed();
      const backup = p.args.commands.backup;
      const drive = p.args.commands.drive;
      p.args.commands.backup = async (argv) => {
        if (
          (command === 'preview' && argv.includes('--dry-run')) ||
          (command === 'prune' && argv[0] === 'prune' && !argv.includes('--dry-run'))
        )
          throw new Error('cleanup-failed');
        return backup(argv);
      };
      p.args.commands.drive = async (argv) => {
        if (argv[1] === command) throw new Error('cleanup-failed');
        return drive(argv);
      };
      const result = await runBackupDrive(p.args);
      assert.equal(result.delivery, 'confirmed');
      assert.equal(result.retention, 'deferred');
      assert.equal(p.writes.status.status, 'completed');
      assert.equal(p.writes.status.code, 'cleanup-failed');
      assert.equal(result.remoteRetention, command === 'delete' ? 'deferred' : 'completed');
      assert.equal(result.localRetention, 'deferred');
      if (command === 'preview') assert.equal(p.files.get(p.file(p.archives[5]).id).trashed, true);
      if (command !== 'prune') assert(!p.events.includes('prune'));
    });
  }

  for (const failure of [
    'create',
    'coverage',
    'upload',
    'size',
    'sha256Checksum',
    'md5Checksum',
    'ownedByMe',
    'parents',
    'id',
  ]) {
    it(`should claim no delivery and never prune after ${failure} failure`, async () => {
      const p = pilot();
      const backup = p.args.commands.backup;
      const drive = p.args.commands.drive;
      p.args.commands.backup = async (argv) => {
        if (failure === 'create') throw new Error('create-failed');
        const result = await backup(argv);
        if (failure === 'coverage') result.coverage.openclawState = 'absent';
        return result;
      };
      p.args.commands.drive = async (argv) => {
        if (argv[1] === 'upload' && failure === 'upload') throw new Error('upload-failed');
        const result = await drive(argv);
        if (argv[1] === 'get' && argv[2] !== destinationFolder && failure in result.file)
          result.file[failure] = 'wrong';
        return result;
      };
      await assert.rejects(runBackupDrive(p.args));
      assert.equal(p.writes.status.delivery, 'unconfirmed');
      assert(!p.events.some((e) => ['preview', 'prune', 'delete'].includes(e)));
    });
  }

  for (const outcome of ['accepted', 'absent', 'duplicate', 'foreign', 'corrupt']) {
    it(`should recover only exact owned bytes after an uncertain ${outcome} upload`, async () => {
      const p = pilot();
      const drive = p.args.commands.drive;
      p.args.commands.drive = async (argv) => {
        if (argv[1] === 'upload') {
          if (outcome !== 'absent') await drive(argv);
          throw new Error('upload-timeout');
        }
        return drive(argv);
      };
      await assert.rejects(runBackupDrive(p.args));
      assert.equal(p.writes.deliveries.receipts[0].status, 'pending');
      p.args.commands.drive = drive;
      if (outcome === 'duplicate')
        p.files.set('duplicate', { ...p.file(p.archives[0]), id: 'duplicate' });
      if (outcome === 'foreign') p.files.get(p.file(p.archives[0]).id).ownedByMe = false;
      if (outcome === 'corrupt') p.files.get(p.file(p.archives[0]).id).sha256Checksum = 'wrong';
      p.args.resumeArchive = p.archives[0].path;
      if (outcome === 'accepted')
        assert.equal((await runBackupDrive(p.args)).delivery, 'confirmed');
      else await assert.rejects(runBackupDrive(p.args));
      assert.equal(p.events.filter((e) => e === 'upload').length, outcome === 'absent' ? 0 : 1);
      if (outcome !== 'accepted') assert(!p.events.includes('prune'));
    });
  }

  it('should capture a distinct fresh archive after uncertainty without inspecting or replaying the old one', async () => {
    const p = pilot({ count: 2 });
    const backup = p.args.commands.backup;
    const drive = p.args.commands.drive;
    p.args.commands.drive = async (argv) => {
      if (argv[1] === 'upload') throw new Error('upload-timeout');
      return drive(argv);
    };
    await assert.rejects(runBackupDrive(p.args));
    const pending = structuredClone(p.writes.deliveries.receipts[0]);
    p.events.length = 0;
    p.args.commands.drive = drive;
    p.args.commands.backup = async (argv) =>
      argv[0] === 'create' ? p.capture(p.archives[1], 'created') : backup(argv);
    const result = await runBackupDrive(p.args);
    assert.equal(result.delivery, 'confirmed');
    assert.equal(result.retention, 'deferred');
    assert.deepEqual(p.writes.deliveries.receipts[0], pending);
    assert(
      !p.events.some((e) =>
        ['ls', 'preview', 'verify', 'prune', 'delete', `inspect-${pending.path}`].includes(e),
      ),
    );
  });

  it('should keep five proven owned copies and preserve unrelated files', async () => {
    const p = pilot({ count: 6 });
    p.seed();
    p.files.set('unrelated', { id: 'unrelated', name: 'somebody-else.tar.gz' });
    const result = await runBackupDrive(p.args);
    assert.equal(result.retention, 'completed');
    assert.equal(result.remoteRetention, 'completed');
    assert.equal(result.localRetention, 'completed');
    assert.equal(p.files.get(p.file(p.archives[5]).id).trashed, true);
    assert.equal(p.files.get('unrelated').trashed, undefined);
    assert.equal(p.writes.deliveries.receipts.length, 5);
    assert(p.events.indexOf('delete') > p.events.indexOf('write-status'));
  });

  for (const capturedAt of ['2026-01-01T00:00:00.000Z', '2026-01-09T12:00:00.000Z']) {
    it(`should clean up Drive and preserve an unreceipted local archive from ${capturedAt}`, async () => {
      const p = pilot({ count: 6 });
      p.seed();
      const manual = {
        ...p.archives[5],
        path: '/workspace/.agent-system/backups/manual.tar.gz',
        name: 'manual.tar.gz',
        capturedAt,
      };
      p.local.set(manual.path, manual);
      const result = await runBackupDrive(p.args);
      assert.equal(result.delivery, 'confirmed');
      assert.equal(result.retention, 'deferred');
      assert.equal(result.remoteRetention, 'completed');
      assert.equal(result.localRetention, 'deferred');
      assert.equal(result.code, 'retention-ownership-unconfirmed');
      assert.equal(p.files.get(p.file(p.archives[5]).id).trashed, true);
      assert(p.archives.slice(0, 5).every((a) => !p.files.get(p.file(a).id).trashed));
      assert.deepEqual(p.local.get(manual.path), manual);
      assert(!p.events.includes('prune'));
      assert.equal(
        p.writes.deliveries.receipts.find((r) => r.path === p.archives[5].path).status,
        'deleting',
      );
    });
  }

  for (const ambiguity of [
    'listing',
    'local-plan',
    'legacy-archive',
    'foreign-file',
    'invalid-preview',
  ]) {
    it(`should defer only the affected cleanup on ${ambiguity} ambiguity after delivery`, async () => {
      const p = pilot({ count: 6 });
      p.seed();
      const backup = p.args.commands.backup;
      const drive = p.args.commands.drive;
      let previews = 0;
      p.args.commands.backup = async (argv) => {
        const result = await backup(argv);
        if (argv[0] === 'prune') {
          if (ambiguity === 'local-plan' && ++previews === 2) result.wouldDelete = [];
          if (ambiguity === 'legacy-archive')
            result.wouldDelete.push('/workspace/.agent-system/backups/legacy.tar.gz');
          if (ambiguity === 'invalid-preview') result.output = '/wrong-directory';
        }
        return result;
      };
      p.args.commands.drive = async (argv) => {
        if (argv[1] === 'ls' && ambiguity === 'listing')
          return { files: [], has_more: true, nextPageToken: '' };
        return drive(argv);
      };
      if (ambiguity === 'foreign-file') p.files.get(p.file(p.archives[5]).id).ownedByMe = false;
      const result = await runBackupDrive(p.args);
      assert.equal(result.delivery, 'confirmed');
      assert.equal(result.retention, 'deferred');
      const remoteUnsafe = ['listing', 'foreign-file'].includes(ambiguity);
      assert.equal(result.remoteRetention, remoteUnsafe ? 'deferred' : 'completed');
      assert.equal(result.localRetention, 'deferred');
      assert.equal(p.events.includes('delete'), !remoteUnsafe);
      assert(!p.events.includes('prune'));
    });
  }

  it('should reconcile prior Drive cleanup across fresh runs while preserving manual archives', async () => {
    const p = pilot({ count: 6 });
    p.seed();
    const manual = {
      ...p.archives[5],
      path: '/workspace/.agent-system/backups/manual.tar.gz',
      name: 'manual.tar.gz',
      capturedAt: '2026-01-01T00:00:00.000Z',
    };
    p.local.set(manual.path, manual);
    assert.equal((await runBackupDrive(p.args)).remoteRetention, 'completed');
    const next = {
      ...p.archives[0],
      path: '/workspace/.agent-system/backups/next.tar.gz',
      name: 'next.tar.gz',
      capturedAt: '2026-01-11T00:00:00.000Z',
    };
    p.archives.push(next);
    p.local.set(next.path, next);
    const backup = p.args.commands.backup;
    p.args.commands.backup = (argv) =>
      argv[0] === 'create' ? p.capture(next, 'created') : backup(argv);
    const result = await runBackupDrive(p.args);
    assert.equal(result.remoteRetention, 'completed');
    assert.equal(result.localRetention, 'deferred');
    assert.equal(p.events.filter((e) => e === 'delete').length, 2);
    assert.equal(p.writes.deliveries.receipts.filter((r) => r.status === 'deleting').length, 2);
    assert.deepEqual(p.local.get(manual.path), manual);
    assert(p.local.has(p.archives[5].path));
    assert(!p.events.includes('prune'));

    // Simulate the operator moving the manual archive out of the global prune set.
    p.local.delete(manual.path);
    p.args.resumeArchive = next.path;
    assert.equal((await runBackupDrive(p.args)).retention, 'completed');
    assert.equal(p.events.filter((e) => e === 'delete').length, 2);
    assert(!p.local.has(p.archives[5].path) && !p.local.has(p.archives[4].path));
    assert.equal(p.writes.deliveries.receipts.length, 5);
  });

  for (const checkpoint of ['deleting', 'compacted']) {
    it(`should retain recovery evidence when the ${checkpoint} retention checkpoint fails`, async () => {
      const p = pilot({ count: 6 });
      p.seed();
      const write = p.args.storage.write;
      p.args.storage.write = async (name, value) => {
        if (
          name === 'deliveries' &&
          (checkpoint === 'deleting'
            ? value.receipts.some((r) => r.status === 'deleting')
            : value.receipts.length === 5)
        )
          throw new Error('checkpoint-failed');
        return write(name, value);
      };
      const result = await runBackupDrive(p.args);
      assert.equal(result.retention, 'deferred');
      assert.equal(result.localRetention, 'deferred');
      assert.equal(result.remoteRetention, checkpoint === 'deleting' ? 'deferred' : 'completed');
      assert.equal(p.writes.deliveries.receipts.length, 6);
      assert.equal(p.events.includes('delete'), checkpoint === 'compacted');
      p.args.storage.write = write;
      p.args.resumeArchive = p.archives[0].path;
      assert.equal((await runBackupDrive(p.args)).retention, 'completed');
      assert.equal(p.events.filter((e) => e === 'delete').length, 1);
    });
  }

  it('should preserve deletion evidence if trash succeeds but its acknowledgment is lost', async () => {
    const p = pilot({ count: 6 });
    p.seed();
    const drive = p.args.commands.drive;
    p.args.commands.drive = async (argv) => {
      const result = await drive(argv);
      if (argv[1] === 'delete') throw new Error('cleanup-timeout');
      return result;
    };
    assert.equal((await runBackupDrive(p.args)).retention, 'deferred');
    assert.equal(
      p.writes.deliveries.receipts.find((r) => r.path === p.archives[5].path).status,
      'deleting',
    );
    assert(!p.events.includes('prune'));
    p.args.commands.drive = drive;
    p.args.resumeArchive = p.archives[0].path;
    assert.equal((await runBackupDrive(p.args)).retention, 'completed');
    assert.equal(p.events.filter((e) => e === 'delete').length, 1);
  });

  it('should fail closed on unsafe destination or invalid current ledger before upload', async () => {
    for (const invalid of ['folder', 'ledger']) {
      const p = pilot();
      if (invalid === 'ledger') p.writes.deliveries = { version: 99 };
      else p.args.commands.drive = async () => ({ file: { id: destinationFolder } });
      await assert.rejects(runBackupDrive(p.args));
      assert(!p.events.includes('create') && !p.events.includes('upload'));
    }
  });

  it('should stop partial cleanup at the first failed deletion and preserve remaining evidence', async () => {
    const p = pilot({ count: 8 });
    p.seed();
    const drive = p.args.commands.drive;
    let deletes = 0;
    p.args.commands.drive = async (argv) => {
      if (argv[1] === 'delete' && ++deletes === 2) throw new Error('cleanup-failed');
      return drive(argv);
    };
    const result = await runBackupDrive(p.args);
    assert.equal(result.delivery, 'confirmed');
    assert.equal(result.retention, 'deferred');
    assert.equal(deletes, 2);
    assert.equal(p.files.get(p.file(p.archives[5]).id).trashed, true);
    assert.equal(p.files.get(p.file(p.archives[6]).id).trashed, undefined);
    assert.equal(p.files.get(p.file(p.archives[7]).id).trashed, undefined);
    assert.equal(p.writes.deliveries.receipts.length, 8);
    assert(!p.events.includes('prune'));
  });

  it('should not claim delivery when durable confirmation fails', async () => {
    const p = pilot();
    const write = p.args.storage.write;
    p.args.storage.write = async (name, value) => {
      if (name === 'deliveries' && value.receipts.some((r) => r.status === 'delivered'))
        throw new Error('record-write-failed');
      await write(name, value);
    };
    await assert.rejects(runBackupDrive(p.args));
    assert.equal(p.writes.status.delivery, 'unconfirmed');
    assert(!p.events.includes('preview'));
  });
});
