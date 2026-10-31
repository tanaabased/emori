import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import backupCommands from '../commands.js';
import runBackupTask from '../task.js';

const completed = {
  status: 'completed',
  delivery: 'confirmed',
  agentId: 'emori',
  retention: 'completed',
};

function fixture(argv = []) {
  const output = { stdout: '', stderr: '' };
  const calls = [];
  const storage = {
    lockFd: 17,
    assertHeld: async () => {},
    close: async () => {
      calls.push('close');
    },
  };
  const commands = {};
  return {
    output,
    calls,
    storage,
    commands,
    options: {
      argv,
      cwd: '/workspace',
      stdout: {
        write: (value) => {
          output.stdout += value;
        },
      },
      stderr: {
        write: (value) => {
          output.stderr += value;
        },
      },
      canonicalize: async (path) => {
        calls.push(['canonicalize', path]);
        return '/canonical';
      },
      open: async (path) => {
        calls.push(['open', path]);
        return storage;
      },
      commands: (options) => {
        calls.push(['commands', options]);
        return commands;
      },
      run: async (options) => {
        calls.push(['run', options]);
        return completed;
      },
    },
  };
}

describe('lib/backup/task', () => {
  for (const argv of [[], ['--operator'], ['--operator', '--resume-archive', 'archive.tar.gz']]) {
    it(`should preserve JSON and managed wiring for ${JSON.stringify(argv)}`, async () => {
      const original = [...argv];
      const f = fixture(argv);
      assert.equal(await runBackupTask(f.options), 0);
      assert.deepEqual(JSON.parse(f.output.stdout), completed);
      assert.equal(f.output.stderr, '');
      assert.deepEqual(f.calls.slice(0, 2), [
        ['canonicalize', '/workspace'],
        ['open', '/canonical'],
      ]);
      assert.deepEqual(f.calls[2], [
        'commands',
        {
          workspace: '/canonical',
          operator: argv.length > 0,
          storage: f.storage,
        },
      ]);
      assert.deepEqual(f.calls[3], [
        'run',
        {
          workspace: '/canonical',
          commands: f.commands,
          storage: f.storage,
          resumeArchive: argv.length > 1 ? '/workspace/archive.tar.gz' : undefined,
        },
      ]);
      assert.equal(f.calls[4], 'close');
      assert.equal(f.calls.length, 5);
      assert.deepEqual(f.options.argv, original);
    });
  }

  it('should emit Markdown for a successful scheduled execution without changing its result', async () => {
    const f = fixture(['--report']);
    assert.equal(await runBackupTask(f.options), 0);
    assert.match(f.output.stdout, /Backup completed/);
    assert.match(f.output.stdout, /Completed: retention/);
    assert.equal(f.output.stderr, '');
    assert.equal(f.calls.filter((call) => call[0] === 'run').length, 1);
    assert.deepEqual(f.options.argv, ['--report']);
  });

  it('should support report-mode operator recovery with the original archive selection', async () => {
    const f = fixture(['--report', '--operator', '--resume-archive', '/archive.tar.gz']);
    assert.equal(await runBackupTask(f.options), 0);
    assert.equal(f.calls[2][1].operator, true);
    assert.equal(f.calls[3][1].resumeArchive, '/archive.tar.gz');
  });

  it('should keep deferred retention successful while reporting incomplete cleanup', async () => {
    const f = fixture(['--report']);
    f.options.run = async () => ({
      ...completed,
      retention: 'deferred',
      stage: 'local-retention',
      code: 'local-prune-failed',
    });
    assert.equal(await runBackupTask(f.options), 0);
    assert.match(f.output.stdout, /archive delivered to Drive/);
    assert.match(f.output.stdout, /Pending: retention/);
    assert.match(f.output.stderr, /local-prune-failed/);
  });

  for (const argv of [[], ['--report']]) {
    it(`should expose independent retention outcomes without failing delivery: ${JSON.stringify(argv)}`, async () => {
      const f = fixture(argv);
      const result = {
        ...completed,
        retention: 'deferred',
        remoteRetention: 'completed',
        localRetention: 'deferred',
        stage: 'local-retention',
        code: 'retention-ownership-unconfirmed',
      };
      f.options.run = async () => result;
      assert.equal(await runBackupTask(f.options), 0);
      if (argv.length) {
        assert.match(f.output.stdout, /Completed: Drive retention/);
        assert.match(f.output.stdout, /Deferred: local pruning/);
        assert.match(f.output.stderr, /retention-ownership-unconfirmed/);
      } else {
        assert.deepEqual(JSON.parse(f.output.stdout), result);
        assert.equal(f.output.stderr, '');
      }
    });
  }

  for (const argv of [
    ['--resume-archive', '/archive'],
    ['--operator', '--resume-archive'],
    ['--report', '--operator', '--resume-archive', '/archive', 'extra'],
    ['--report', '--report'],
  ]) {
    it(`should reject invalid arguments before opening storage: ${JSON.stringify(argv)}`, async () => {
      const f = fixture(argv);
      assert.equal(await runBackupTask(f.options), 1);
      assert.deepEqual(f.calls, []);
      assert.match(f.output.stderr, /arguments-invalid/);
    });
  }

  it('should not invoke maintenance when lock acquisition fails', async () => {
    const f = fixture(['--report']);
    f.options.open = async () => {
      throw new Error('backup-run-locked');
    };
    assert.equal(await runBackupTask(f.options), 1);
    assert.match(f.output.stdout, /Skipped: this backup execution/);
    assert.equal(f.calls.length, 1);
  });

  it('should preserve nonzero command outcome and bounded child diagnostics without replay', async () => {
    const f = fixture(['--report']);
    let executions = 0;
    f.options.commands = (options) =>
      backupCommands({
        ...options,
        environment: { AGENT_SYSTEM_GOG: '/bound/google' },
        spawn: () => {
          executions++;
          return { status: 17, stdout: 'Everything succeeded!', stderr: 'private-secret' };
        },
      });
    f.options.run = ({ commands }) => commands.backup(['create']);
    assert.equal(await runBackupTask(f.options), 1);
    assert.equal(executions, 1);
    assert.match(f.output.stdout, /Backup failed/);
    assert.match(f.output.stderr, /child exit 17/);
    assert(!JSON.stringify(f.output).includes('private-secret'));
    assert(!JSON.stringify(f.output).includes('Everything succeeded'));
    assert.equal(f.calls.at(-1), 'close');
  });

  for (const argv of [[], ['--report']]) {
    it(`should fail on close without discarding completed work: ${JSON.stringify(argv)}`, async () => {
      const f = fixture(argv);
      f.storage.close = async () => {
        throw new Error('private-secret');
      };
      assert.equal(await runBackupTask(f.options), 1);
      if (argv.length) assert.match(f.output.stdout, /Completed: backup archive/);
      else assert.deepEqual(JSON.parse(f.output.stdout), completed);
      assert.match(f.output.stderr, /close failed/);
      assert(!JSON.stringify(f.output).includes('private-secret'));
    });
  }
});

describe('backup report process boundary', () => {
  it('should expose report streams and the failure exit through the real entrypoint before maintenance', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'emori-backup-report-'));
    try {
      const entrypoint = fileURLToPath(
        new URL('../../../scripts/backup-agent.js', import.meta.url),
      );
      const result = spawnSync(process.execPath, [entrypoint, '--report', '--invalid'], {
        cwd: workspace,
        encoding: 'utf8',
      });
      assert.ifError(result.error);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /Backup failed/);
      assert.match(result.stderr, /arguments-invalid/);
      assert.deepEqual(await readdir(workspace), []);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
