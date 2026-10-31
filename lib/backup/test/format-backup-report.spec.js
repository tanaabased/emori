import assert from 'node:assert/strict';

import formatBackupReport from '../utils/format-backup-report.js';

describe('lib/backup/utils/format-backup-report', () => {
  const completed = {
    agentId: 'emori',
    status: 'completed',
    delivery: 'confirmed',
    retention: 'completed',
  };

  it('should report verified completion without claiming chat delivery', () => {
    const report = formatBackupReport({ result: completed });
    assert.match(report.stdout, /^## Backup completed\n/);
    assert.match(report.stdout, /Completed: backup archive delivered to Drive and verified/);
    assert.match(report.stdout, /Completed: retention/);
    assert.doesNotMatch(report.stdout, /Pending|Next:|chat|report delivered/i);
    assert.equal(report.stderr, '');
  });

  it('should preserve confirmed delivery and uncertain partial cleanup', () => {
    const result = {
      ...completed,
      retention: 'deferred',
      stage: 'remote-retention',
      code: 'remote-delete-unverified',
      diagnostic: { command: 'google', reason: 'exit', exit: 17 },
    };
    const report = formatBackupReport({ result });
    assert.match(report.stdout, /Backup needs attention/);
    assert.match(report.stdout, /Completed: backup archive delivered to Drive/);
    assert.match(report.stdout, /Pending: retention; cleanup may be incomplete/);
    assert.match(report.stdout, /Next: Inspect/);
    assert.match(report.stderr, /retention deferred at remote-retention/);
    assert.match(report.stderr, /remote-delete-unverified/);
    assert.match(report.stderr, /google: exit; child exit 17/);
    assert.deepEqual(result.diagnostic, { command: 'google', reason: 'exit', exit: 17 });
  });

  it('should report a held lock as a failed skipped execution, not a successful backup', () => {
    const report = formatBackupReport({ failure: new Error('backup-run-locked') });
    assert.match(report.stdout, /Backup failed/);
    assert.match(report.stdout, /not confirmed by this wrapper/);
    assert.match(report.stdout, /Skipped: this backup execution/);
    assert.doesNotMatch(report.stdout, /Completed:/);
    assert.match(report.stderr, /backup-run-locked/);
  });

  it('should retain completed work when lock close fails', () => {
    const report = formatBackupReport({ result: completed, closeFailed: true });
    assert.match(report.stdout, /Backup failed/);
    assert.match(report.stdout, /Completed: backup archive delivered to Drive/);
    assert.match(report.stdout, /Completed: retention/);
    assert.match(report.stdout, /Failed: backup lock descriptor close/);
    assert.match(report.stderr, /Backup lock descriptor close failed/);
  });

  it('should exclude unowned messages and diagnostic fields, even code-shaped secrets', () => {
    const failure = Object.assign(new Error('private-secret'), {
      diagnostic: {
        command: 'google',
        reason: 'private-secret',
        exit: 'private-secret',
        signal: 'private-secret',
        stdout: 'private-secret'.repeat(10000),
        stderr: 'private-secret',
        environment: { TOKEN: 'private-secret' },
      },
    });
    const report = formatBackupReport({ failure });
    assert.match(report.stderr, /task-failed/);
    assert.match(report.stderr, /google: unknown/);
    assert(!JSON.stringify(report).includes('private-secret'));
    assert(JSON.stringify(report).length < 1000);
    const extra = formatBackupReport({
      result: {
        ...completed,
        retention: 'deferred',
        code: 'private-secret',
        stage: 'private-secret',
        archive: 'private-secret',
        diagnostic: { command: 'private-secret' },
      },
    });
    assert(!JSON.stringify(extra).includes('private-secret'));
  });

  it('should expose only bounded known process facts', () => {
    const report = formatBackupReport({
      failure: Object.assign(new Error('managed-command-failed'), {
        diagnostic: { command: 'backup', reason: 'timeout', exit: null, signal: 'SIGKILL' },
      }),
      closeFailed: true,
    });
    assert.match(report.stderr, /managed-command-failed/);
    assert.match(report.stderr, /backup: timeout; signal SIGKILL/);
    assert.match(report.stderr, /lock descriptor close failed/);
    assert.doesNotMatch(report.stderr, /child exit/);
  });
});
