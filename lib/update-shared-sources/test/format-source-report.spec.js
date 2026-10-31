import assert from 'node:assert/strict';

import formatSourceReport from '../utils/format-source-report.js';

describe('lib/update-shared-sources/utils/format-source-report', () => {
  it('should report unchanged reconciliation without inventing delivery success', () => {
    const report = formatSourceReport([
      {
        id: 'canon',
        status: 'completed',
        steps: ['unchanged', 'dependencies-installed'],
        after: 'a'.repeat(40),
      },
    ]);
    assert.equal(report.exitCode, 0);
    assert.equal(report.stderr, '');
    assert.match(report.stdout, /Revision unchanged/);
    assert.match(report.stdout, /Frozen dependencies installed/);
    assert.match(report.stdout, /Report delivery is separate/);
  });

  it('should retain completed phases and actionable errors in Markdown', () => {
    const report = formatSourceReport([
      {
        id: 'canon',
        status: 'failed',
        steps: ['advanced'],
        phase: 'install',
        exitCode: 1,
        reason: 'operation-failed',
      },
    ]);
    assert.equal(report.exitCode, 1);
    assert.match(report.stdout, /^## Shared-source update/);
    assert.match(report.stdout, /Advanced fast-forward/);
    assert.match(report.stdout, /Failed step: install; exit 1/);
    assert.match(report.stdout, /Next:/);
    assert.match(report.stderr, /install failed; exit 1/);
  });

  it('should not report required skips, pending work or unknown outcomes as success', () => {
    for (const result of [
      { id: 'canon', status: 'skipped', reason: 'dirty-or-unknown' },
      {
        id: 'openclaw-agent-system',
        status: 'pending',
        steps: ['synced'],
        pending: ['runtime-handoff'],
      },
      { id: 'canon', status: 'completed', pending: ['unknown'] },
      { id: 'canon', status: 'completed', steps: ['unknown'] },
      { id: 'unapproved', status: 'completed' },
      { id: 'canon', status: 'invented' },
    ])
      assert.equal(formatSourceReport([result]).exitCode, 1);
    assert.equal(formatSourceReport([]).exitCode, 1);
  });

  it('should not echo arbitrary input into either output stream', () => {
    const secret = 'SECRET\n[click](https://malicious.test)';
    const report = formatSourceReport([
      {
        id: secret,
        status: secret,
        steps: [secret],
        reason: secret,
        before: secret,
        phase: secret,
        exitCode: secret,
        pending: [secret],
      },
    ]);
    assert.equal(`${report.stdout}${report.stderr}`.includes(secret), false);
    assert.equal(report.exitCode, 1);
  });

  it('should treat inherited property names as unknown vocabulary', () => {
    const report = formatSourceReport([
      { id: 'canon', status: 'completed', steps: ['toString'], reason: 'constructor' },
    ]);
    assert.equal(report.exitCode, 1);
    assert.doesNotMatch(report.stdout, /function|native code/);
  });
});
