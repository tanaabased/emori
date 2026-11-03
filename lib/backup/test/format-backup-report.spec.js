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
    assert.match(report.stdout, /^## ✅ BACKUP AGENT NIGHTLY\n/);
    assert.match(report.stdout, /Archive delivered to Drive and verified/);
    assert.match(report.stdout, /\| Retention \| Complete/);
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
    assert.match(report.stdout, /Pending\./);
    assert.match(report.stdout, /Archive delivered to Drive/);
    assert.match(report.stdout, /\| Retention \| Pending; cleanup may be incomplete/);
    assert.match(report.stdout, /\*\*Next:\*\* Inspect/);
    assert.match(report.stderr, /retention deferred at `remote-retention`/);
    assert.match(report.stderr, /remote-delete-unverified/);
    assert.match(report.stderr, /google: exit; child exit 17/);
    assert.deepEqual(result.diagnostic, { command: 'google', reason: 'exit', exit: 17 });
  });

  it('should report completed Drive retention separately from deferred local pruning and its reason', () => {
    const report = formatBackupReport({
      result: {
        ...completed,
        retention: 'deferred',
        remoteRetention: 'completed',
        localRetention: 'deferred',
        stage: 'local-retention',
        code: 'retention-ownership-unconfirmed',
      },
    });
    assert.match(report.stdout, /Pending\./);
    assert.match(report.stdout, /\| Drive retention \| Complete/);
    assert.match(report.stdout, /\| Local retention \| Deferred; local archives may accumulate/);
    assert.match(report.stdout, /`local-retention`: `retention-ownership-unconfirmed`/);
    assert.match(report.stderr, /local pruning deferred/);
    assert.match(report.stderr, /retention-ownership-unconfirmed/);
    assert.match(report.stdout, /\*\*Next:\*\* Inspect/);
    assert.doesNotMatch(report.stdout, /\| Local retention \| Complete/);
  });

  it('should report both cleanup parts complete without a warning', () => {
    const report = formatBackupReport({
      result: { ...completed, remoteRetention: 'completed', localRetention: 'completed' },
    });
    assert.match(report.stdout, /Successful\./);
    assert.match(report.stdout, /\| Drive retention \| Complete/);
    assert.match(report.stdout, /\| Local retention \| Complete/);
    assert.doesNotMatch(report.stdout, /Deferred|Pending|Reason|Next/);
    assert.equal(report.stderr, '');
  });

  it('should not promote remote uncertainty or unknown cleanup states to completion', () => {
    const report = formatBackupReport({
      result: {
        ...completed,
        remoteRetention: 'deferred',
        localRetention: 'private-secret',
        stage: 'remote-retention',
        code: 'remote-delete-unverified',
      },
    });
    assert.match(report.stdout, /Pending\./);
    assert.match(report.stdout, /\| Drive retention \| Pending/);
    assert.match(report.stdout, /\| Local retention \| Deferred/);
    assert.match(report.stderr, /retention deferred at `remote-retention`/);
    assert(!JSON.stringify(report).includes('private-secret'));
    assert.doesNotMatch(report.stdout, /\| (Drive retention|Local retention) \| Complete/);
  });

  it('should report a held lock as a failed skipped execution, not a successful backup', () => {
    const report = formatBackupReport({ failure: new Error('backup-run-locked') });
    assert.match(report.stdout, /^## ❌ BACKUP AGENT NIGHTLY/);
    assert.match(report.stdout, /not confirmed by this wrapper/);
    assert.match(report.stdout, /Skipped: this backup execution/);
    assert.doesNotMatch(report.stdout, /Verified|\| Retention \| Complete/);
    assert.match(report.stderr, /backup-run-locked/);
  });

  it('should retain completed work when lock close fails', () => {
    const report = formatBackupReport({ result: completed, closeFailed: true });
    assert.match(report.stdout, /^## ❌ BACKUP AGENT NIGHTLY/);
    assert.match(report.stdout, /Archive delivered to Drive/);
    assert.match(report.stdout, /\| Retention \| Complete/);
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

  it('should display supplied archive basename and byte size without receipts or private paths', () => {
    const result = {
      ...completed,
      archive: {
        name: 'emori-2026-01-01.tar.gz',
        size: 123456,
        path: '/private/secret',
        token: 'secret',
      },
    };
    const report = formatBackupReport({ result });
    assert.match(report.stdout, /\| Archive \| `emori-2026-01-01.tar.gz` \|/);
    assert.match(report.stdout, /\| Size \| 123456 bytes \|/);
    assert.doesNotMatch(report.stdout + report.stderr, /secret|private/);
    assert.doesNotMatch(formatBackupReport({ result: completed }).stdout, /\| Archive|\| Size/);
  });

  it('should omit malformed, credential-shaped or unconfirmed archive facts', () => {
    for (const name of [
      '/private/emori.tar.gz',
      'bad`|name.tar.gz',
      'emori-ghp_private.tar.gz',
      'a'.repeat(200) + '.tar.gz',
    ]) {
      const report = formatBackupReport({ result: { ...completed, archive: { name, size: -1 } } });
      assert.doesNotMatch(report.stdout, /\| Archive|\| Size/);
      assert(!report.stdout.includes(name));
    }
    const report = formatBackupReport({
      result: { status: 'failed', archive: { name: 'emori-test.tar.gz', size: 2 } },
    });
    assert.doesNotMatch(report.stdout, /\| Archive|\| Size|Verified/);
  });
});
