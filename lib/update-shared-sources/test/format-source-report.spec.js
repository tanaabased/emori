import assert from 'node:assert/strict';

import formatSourceReport from '../utils/format-source-report.js';

const current = {
  id: 'canon',
  status: 'completed',
  before: 'a'.repeat(40),
  after: 'a'.repeat(40),
  target: 'a'.repeat(40),
  steps: ['fetched', 'unchanged', 'dependencies-installed'],
  pending: [],
};
const cards = (report) => JSON.parse(report.stdout).cards;
const fact = (card, label) => card.facts.find((item) => item.label === label)?.value;
describe('lib/update-shared-sources/utils/format-source-report', () => {
  it('should preserve unique ordered source cards and safe exclusions without exposing names or paths', () => {
    const results = [
      'canon',
      'openclaw-agent-system',
      'emori',
      'smutlord',
      'github_pat_private',
    ].map((id) => ({ id, status: 'excluded', path: '/private/hidden' }));
    const report = formatSourceReport(results);
    const values = cards(report);
    assert.equal(values.length, 5);
    assert.deepEqual(
      values.slice(0, 4).map((x) => x.id),
      results.slice(0, 4).map((x) => 'shared-source:' + x.id),
    );
    assert.equal(new Set(values.map((x) => x.id)).size, 5);
    assert.equal(values.at(-1).id, cards(formatSourceReport(results)).at(-1).id);
    assert(values.every((x) => x.summary.includes('no inspection or mutation')));
    assert.doesNotMatch(report.stdout, /github_pat_private|private|hidden/);
  });
  it('should report a verified current source as success without hiding dependency work', () => {
    const report = formatSourceReport([current]);
    assert.equal(report.exitCode, 0);
    assert.equal(cards(report)[0].status, 'success');
    assert.equal(cards(report)[0].summary, 'Already up to date.');
    assert.equal(fact(cards(report)[0], 'Install required dependencies'), 'Reconciled (frozen)');
    assert.equal(fact(cards(report)[0], 'Source revision'), 'Unchanged aaaaaaaaaaaa');
  });
  it('should keep activation debt warning with successful exit on unchanged/reused builds', () => {
    const result = {
      ...current,
      id: 'openclaw-agent-system',
      steps: [...current.steps, 'synced'],
      pending: ['restart'],
    };
    for (const steps of [result.steps, [...current.steps, 'build-current']]) {
      const report = formatSourceReport([{ ...result, steps }]);
      assert.equal(report.exitCode, 0);
      assert.equal(cards(report)[0].status, 'warning');
      assert.match(report.stdout, /running build unverified|Loaded-build evidence unavailable/);
      assert.match(cards(report)[0].actions.join(' '), /operator restart when work is idle/);
    }
    for (const change of [
      { status: 'failed' },
      { exitCode: 17 },
      { status: 'pending' },
      { steps: ['unchanged'] },
      { pending: ['restart', 'unknown'] },
    ]) {
      const report = formatSourceReport([{ ...result, ...change }]);
      assert.equal(report.exitCode, 1);
      assert.notEqual(cards(report)[0].status, 'success');
    }
    assert.equal(cards(formatSourceReport([{ ...result, pending: [] }]))[0].status, 'warning');
  });
  it('should preserve mixed source outcomes, disjoint phase timing and failed partial build evidence', () => {
    const report = formatSourceReport([
      current,
      {
        id: 'openclaw-agent-system',
        status: 'failed',
        before: 'b'.repeat(40),
        target: 'c'.repeat(40),
        steps: ['dependencies-installed'],
        phase: 'sync',
        exitCode: 17,
        pending: ['restart'],
        timings: [{ phase: 'sync', elapsedMs: 1500 }],
      },
    ]);
    const values = cards(report);
    assert.equal(report.exitCode, 1);
    assert.deepEqual(
      values.map((x) => x.status),
      ['success', 'error'],
    );
    assert.match(
      fact(values[1], 'Source revision'),
      /after unknown; target cccccccccccc not verified/,
    );
    assert.equal(fact(values[1], 'Build and sync shared tools'), 'Failed; partial build possible');
    assert.equal(fact(values[1], 'Build and sync shared tools (sync)'), '1.5s');
    assert.match(report.stderr, /sync failed; exit 17/);
    assert.match(report.stdout, /do not interrupt active work/);
  });
  it('should never promote skips, pending work, unknown vocabulary or absent outcomes to success', () => {
    for (const result of [
      { id: 'canon', status: 'skipped', reason: 'dirty-or-unknown' },
      { ...current, pending: ['unknown'] },
      { ...current, steps: ['toString'], reason: 'constructor' },
      { id: 'unapproved', status: 'completed' },
      { id: 'canon', status: 'invented' },
    ]) {
      const report = formatSourceReport([result]);
      assert.equal(report.exitCode, 1);
      assert.notEqual(cards(report)[0].status, 'success');
      assert.doesNotMatch(report.stdout, /function|native code/);
    }
    const absent = formatSourceReport([]);
    assert.equal(absent.exitCode, 1);
    assert.equal(cards(absent).length, 1);
    assert.equal(cards(absent)[0].status, 'unknown');
    assert.equal(
      cards(formatSourceReport([], { failure: new Error('secret') }))[0].status,
      'error',
    );
  });
  it('should retain interrupted evidence and wrapper failure in the same batch, without duplication', () => {
    const report = formatSourceReport([current], {
      historical: true,
      closeFailed: true,
      previous: [current],
    });
    assert.equal(cards(report).length, 1);
    assert.equal(cards(report)[0].status, 'warning');
    assert.match(report.stdout, /Historical record|Journal cleanup failed/);
  });
  it('should not echo unowned identifiers, diagnostic text, malformed revisions or pending values', () => {
    const secret = 'SECRET\n[click](https://malicious.test)';
    const report = formatSourceReport([
      {
        id: secret,
        status: secret,
        steps: [secret],
        reason: secret,
        before: secret,
        target: ['a'.repeat(40)],
        phase: secret,
        pending: [secret],
      },
    ]);
    assert.equal(report.exitCode, 1);
    assert.doesNotMatch(report.stdout + report.stderr, /SECRET|malicious|a{13}/);
  });
  it('should prefer differing observed revisions over an inconsistent unchanged label', () => {
    const report = formatSourceReport([{ ...current, after: 'b'.repeat(40) }]);
    assert.match(fact(cards(report)[0], 'Source revision'), /aaaaaaaaaaaa → bbbbbbbbbbbb/);
    assert.notEqual(cards(report)[0].summary, 'Already up to date.');
  });
});
