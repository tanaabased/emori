import assert from 'node:assert/strict';

import formatBackupReport from '../utils/format-backup-report.js';

const completed = {
  agentId: 'emori',
  status: 'completed',
  delivery: 'confirmed',
  retention: 'completed',
};
const card = (report) => JSON.parse(report.stdout).cards[0];
const fact = (card, label) => card.facts.find((x) => x.label === label)?.value;
describe('lib/backup/utils/format-backup-report', () => {
  it('should report verified archive delivery and combined or split retention without claiming chat delivery', () => {
    for (const result of [
      completed,
      { ...completed, remoteRetention: 'completed', localRetention: 'completed' },
    ]) {
      const report = formatBackupReport({ result });
      assert.equal(card(report).id, 'backup-agent-nightly');
      assert.equal(card(report).status, 'success');
      assert.match(
        card(report).summary,
        /Archive delivered to Drive and verified; retention complete/,
      );
      assert.equal(report.stderr, '');
      assert.doesNotMatch(report.stdout, /chat|report delivered/i);
    }
  });
  it('should preserve delivery and actionable warning for independently deferred remote/local cleanup', () => {
    for (const [remoteRetention, localRetention] of [
      ['completed', 'deferred'],
      ['deferred', 'completed'],
      ['completed', 'unknown'],
    ]) {
      const result = {
        ...completed,
        retention: 'deferred',
        remoteRetention,
        localRetention,
        stage: 'local-retention',
        code: 'retention-ownership-unconfirmed',
      };
      const report = formatBackupReport({ result });
      assert.equal(card(report).status, 'warning');
      assert.equal(fact(card(report), 'Drive delivery'), 'Verified');
      assert.equal(
        fact(card(report), 'Drive retention'),
        remoteRetention === 'completed' ? 'Complete' : 'Pending',
      );
      assert.equal(
        fact(card(report), 'Local retention'),
        localRetention === 'completed' ? 'Complete' : 'Deferred; local archives may accumulate',
      );
      assert.match(report.stderr, /retention-ownership-unconfirmed/);
      assert(card(report).actions.length);
    }
  });
  it('should preserve safe process diagnostics and never promote unconfirmed backup to success', () => {
    const report = formatBackupReport({
      failure: Object.assign(new Error('managed-command-failed'), {
        diagnostic: { command: 'google', reason: 'exit', exit: 17 },
      }),
    });
    assert.equal(card(report).status, 'error');
    assert.match(report.stderr, /google: exit; child exit 17/);
    assert.equal(fact(card(report), 'Drive delivery'), 'Unconfirmed');
    const locked = formatBackupReport({ failure: new Error('backup-run-locked') });
    assert.equal(card(locked).status, 'error');
    assert.match(locked.stdout, /Wait for the lock owner/);
    const closed = formatBackupReport({ result: completed, closeFailed: true });
    assert.equal(card(closed).status, 'error');
    assert.equal(fact(card(closed), 'Drive delivery'), 'Verified');
    assert.match(closed.stderr, /close failed/);
  });
  it('should select only safe archive basename/size without paths, receipts or credentials', () => {
    const report = formatBackupReport({
      result: {
        ...completed,
        archive: {
          name: 'emori-2026-01-01.tar.gz',
          size: 123456,
          path: '/private/secret',
          token: 'secret',
        },
      },
    });
    assert.equal(fact(card(report), 'Archive'), 'emori-2026-01-01.tar.gz');
    assert.equal(fact(card(report), 'Size'), '123456 bytes');
    assert.doesNotMatch(report.stdout + report.stderr, /secret|private/);
    for (const name of [
      '/private/emori.tar.gz',
      'bad\x60|name.tar.gz',
      'emori-ghp_private.tar.gz',
      'a'.repeat(200) + '.tar.gz',
    ]) {
      const value = card(
        formatBackupReport({ result: { ...completed, archive: { name, size: -1 } } }),
      );
      assert.equal(fact(value, 'Archive'), undefined);
      assert.equal(fact(value, 'Size'), undefined);
    }
    assert.equal(
      fact(
        card(
          formatBackupReport({
            result: { status: 'failed', archive: { name: 'emori-test.tar.gz', size: 2 } },
          }),
        ),
        'Archive',
      ),
      undefined,
    );
  });
  it('should not expose arbitrary errors or unsupported process fields', () => {
    const secret = 'private-secret';
    const report = formatBackupReport({
      failure: Object.assign(new Error(secret), {
        diagnostic: {
          command: 'google',
          reason: secret,
          exit: secret,
          signal: secret,
          stdout: secret.repeat(10000),
          environment: { TOKEN: secret },
        },
      }),
    });
    assert.doesNotMatch(report.stdout + report.stderr, /private-secret/);
    assert.match(report.stderr, /google: unknown/);
    const signal = formatBackupReport({
      failure: Object.assign(new Error('managed-command-failed'), {
        diagnostic: { command: 'backup', reason: 'timeout', exit: null, signal: 'SIGKILL' },
      }),
    });
    assert.match(signal.stderr, /backup: timeout; signal SIGKILL/);
    assert.doesNotMatch(signal.stderr, /child exit/);
  });
});
