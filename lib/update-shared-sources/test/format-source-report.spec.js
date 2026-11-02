import assert from 'node:assert/strict';

import formatSourceReport from '../utils/format-source-report.js';

describe('lib/update-shared-sources/utils/format-source-report', () => {
  it('should separate named exclusions without exposing arbitrary source identifiers', () => {
    const report = formatSourceReport([
      { id: 'emori', status: 'excluded' },
      { id: 'smutlord', status: 'excluded' },
      { id: 'github_pat_private', status: 'excluded' },
    ]);
    assert.match(report.stdout, /## ⏭️ `emori`/);
    assert.match(report.stdout, /## ⏭️ `smutlord`/);
    assert.equal(report.stdout.split('\n---\n').length, 4);
    assert.doesNotMatch(report.stdout, /github_pat_private/);
    assert.match(report.stdout, /Excluded; no inspection or mutation/);
  });

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
    assert.match(report.stdout, /Unchanged `aaaaaaaaaaaa`/);
    assert.match(report.stdout, /\| Dependencies \| Reconciled \(frozen\) \|/);
    assert.doesNotMatch(report.stdout, /Report delivery|Next|a{13}/);
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
    assert.match(report.stdout, /^## UPDATE SHARED SOURCES/);
    assert.match(report.stdout, /Advanced fast-forward/);
    assert.match(report.stdout, /Failed step: `install`; exit 1/);
    assert.match(report.stdout, /\*\*Next:\*\*/);
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

  it('should preserve source order, stable fields and distinct targets without claiming they were reached', () => {
    const report = formatSourceReport([
      {
        id: 'openclaw-agent-system',
        status: 'failed',
        before: 'a'.repeat(40),
        target: 'b'.repeat(40),
        phase: 'advance',
        steps: ['fetched'],
      },
      {
        id: 'canon',
        status: 'completed',
        before: 'c'.repeat(64),
        after: 'd'.repeat(64),
        target: 'd'.repeat(64),
        steps: ['advanced', 'dependencies-installed'],
      },
    ]);
    assert(report.stdout.indexOf('`openclaw-agent-system`') < report.stdout.indexOf('`canon`'));
    const fields = [
      ...report.stdout.matchAll(
        /^\| (Outcome|Source|Dependencies|Build\/sync|Activation\/restart) \|/gm,
      ),
    ].map((match) => match[1]);
    assert.deepEqual(
      fields,
      Array(2)
        .fill(['Outcome', 'Source', 'Dependencies', 'Build/sync', 'Activation/restart'])
        .flat(),
    );
    assert.match(
      report.stdout,
      /Before `aaaaaaaaaaaa`; after unknown; target `bbbbbbbbbbbb` \(not verified as reached\)/,
    );
    assert.match(report.stdout, /`cccccccccccc` → `dddddddddddd`/);
    assert.doesNotMatch(report.stdout, /[a-d]{13}|target `dddd/);
  });

  it('should distinguish pending restart from unknown pending work without changing nonzero semantics', () => {
    const report = formatSourceReport([
      {
        id: 'openclaw-agent-system',
        status: 'pending',
        after: 'a'.repeat(40),
        steps: ['synced', 'dependencies-installed'],
        pending: ['restart'],
      },
    ]);
    assert.equal(report.exitCode, 1);
    assert.match(report.stdout, /## ⚠️ `openclaw-agent-system`/);
    assert.match(report.stdout, /\| Build\/sync \| Complete \|/);
    assert.match(report.stdout, /Gateway restart pending; running build unverified/);
    assert.match(report.stdout, /does not require another source update/);
    const failed = formatSourceReport([
      {
        id: 'openclaw-agent-system',
        status: 'failed',
        phase: 'sync',
        steps: ['dependencies-installed'],
        pending: ['restart'],
        reason: 'operation-failed',
      },
    ]);
    assert.equal(failed.exitCode, 1);
    assert.match(failed.stdout, /Failed; partial build possible/);
    assert.match(
      failed.stdout,
      /Inspect the failed build\/sync.*before arranging any operator restart/,
    );
    const unknown = formatSourceReport([{ id: 'canon', status: 'pending', pending: ['secret'] }]);
    assert.match(unknown.stdout, /Unknown pending work/);
    assert.doesNotMatch(unknown.stdout, /Gateway restart|secret|Successful/);
  });

  it('should prefer observed differing revisions over an inconsistent unchanged label', () => {
    const report = formatSourceReport([
      {
        id: 'canon',
        status: 'completed',
        before: 'a'.repeat(40),
        after: 'b'.repeat(40),
        steps: ['unchanged', 'dependencies-installed'],
      },
    ]);
    assert.match(report.stdout, /`aaaaaaaaaaaa` → `bbbbbbbbbbbb`/);
    assert.doesNotMatch(report.stdout, /Unchanged/);
    const malformed = formatSourceReport([
      { id: 'canon', status: 'pending', before: ['a'.repeat(40)], target: ['b'.repeat(40)] },
    ]);
    assert.doesNotMatch(malformed.stdout, /a{13}|b{13}/);
    const unapproved = formatSourceReport([{ id: 'private', status: 'completed' }]);
    assert.match(unapproved.stdout, /Outcome \| Unknown/);
    assert.doesNotMatch(unapproved.stdout, /✅|Successful|private/);
  });
});
