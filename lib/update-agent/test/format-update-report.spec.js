import assert from 'node:assert/strict';

import formatUpdateReport from '../utils/format-update-report.js';
import { maintenanceBunRange } from '../utils/check-runtime.js';

const complete = {
  status: 'success',
  before: 'a'.repeat(40),
  after: 'b'.repeat(40),
  steps: Object.fromEntries(
    ['source', 'dependencies', 'install', 'doctor'].map((key) => [
      key,
      {
        status: 'completed',
        ...(key === 'doctor' ? { health: { status: 'healthy', findings: [] } } : {}),
      },
    ]),
  ),
};
const card = (report) => JSON.parse(report.stdout).cards[0];
const fact = (value, label) => value.facts.find((item) => item.label.includes(label))?.value;

describe('lib/update-agent/utils/format-update-report', () => {
  it('should emit one structured card with revisions, observed phase times and normal health', () => {
    const report = formatUpdateReport({
      result: {
        ...complete,
        steps: { ...complete.steps, doctor: { ...complete.steps.doctor, elapsedMs: 1250 } },
      },
    });
    assert.equal(report.exitCode, 0);
    const value = card(report);
    assert.equal(value.id, 'update-agent');
    assert.equal(value.status, 'success');
    assert.equal(fact(value, 'Source revision'), 'aaaaaaaaaaaa → bbbbbbbbbbbb');
    assert.match(fact(value, '(Doctor)'), /Doctor status: healthy.*1.3s/);
    assert.match(fact(value, '(Install)'), /setup skipped.*timing unavailable/);
    assert.doesNotMatch(report.stdout, /[ab]{13}|Runner result|chat delivery/);
  });
  it('should keep actionable Install warnings successful without a green application status', () => {
    const report = formatUpdateReport({
      result: {
        ...complete,
        steps: {
          ...complete.steps,
          install: {
            status: 'completed',
            warnings: 2,
            warningDetails: [{ component: 'fixture', code: 'manual', message: 'Inspect fixture' }],
            lifecycle: { completed: 3, skipped: 1, unattempted: 0 },
          },
        },
      },
    });
    assert.equal(report.exitCode, 0);
    assert.equal(card(report).status, 'warning');
    assert.match(
      fact(card(report), '(Install)'),
      /3 completed, 1 skipped, 0 unattempted; 2 warnings/,
    );
    assert.match(card(report).findings.join(' '), /fixture.*Inspect fixture/);
    assert(card(report).actions.length);
  });
  it('should separate applied configuration from a blocked Doctor and preserve safe remediation', () => {
    const report = formatUpdateReport({
      result: {
        ...complete,
        status: 'attention',
        reason: 'doctor-unhealthy',
        steps: {
          ...complete.steps,
          doctor: {
            status: 'blocked',
            health: {
              status: 'blocked',
              findings: [
                {
                  component: 'fixture',
                  code: 'blocked',
                  status: 'blocked',
                  message: 'Blocked fixture',
                  remediation: 'Inspect fixture',
                },
              ],
              omitted: 2,
              warnings: 1,
            },
          },
        },
      },
    });
    assert.equal(report.exitCode, 1);
    assert.equal(card(report).status, 'error');
    assert.match(card(report).summary, /configuration applied; health check failed/);
    assert.match(fact(card(report), '(Doctor)'), /^Blocked/);
    assert.match(
      card(report).findings.join(' '),
      /Inspect fixture.*2 lifecycle detail entries omitted/,
    );
    assert.doesNotMatch(report.stdout, /Pending/);
  });
  it('should not turn completed execution or unfamiliar status into healthy verification', () => {
    for (const health of [
      undefined,
      { findings: [] },
      { status: 'unknown', findings: [] },
      { status: 'drift', findings: [] },
    ]) {
      const report = formatUpdateReport({
        result: {
          ...complete,
          steps: { ...complete.steps, doctor: { status: 'completed', exitCode: 0, health } },
        },
      });
      assert.equal(report.exitCode, 0);
      assert.equal(card(report).status, 'warning');
      assert.match(fact(card(report), '(Doctor)'), /Command completed.*exit 0/);
      assert.doesNotMatch(report.stdout, /Healthy|reports healthy|Reason: command-failed/);
      if (health?.status) assert.match(fact(card(report), '(Doctor)'), new RegExp(health.status));
      else assert.match(fact(card(report), '(Doctor)'), /verification unavailable/);
    }
  });
  it('should keep reported healthy status separate from unavailable findings and failed execution', () => {
    for (const doctor of [
      { ...complete.steps.doctor, exitCode: 0, reporting: ['Doctor findings unavailable.'] },
      {
        ...complete.steps.doctor,
        status: 'blocked',
        exitCode: 1,
        processFailure: { kind: 'exit', exitCode: 1 },
      },
    ]) {
      const report = formatUpdateReport({
        result: { ...complete, steps: { ...complete.steps, doctor } },
      });
      assert.equal(report.exitCode, doctor.status === 'blocked' ? 1 : 0);
      assert.match(fact(card(report), '(Doctor)'), /Doctor status: healthy/);
      assert.doesNotMatch(card(report).summary, /reports healthy/);
    }
  });
  it('should never hide a nonzero Install exit behind a completed step label', () => {
    const report = formatUpdateReport({
      result: {
        ...complete,
        steps: { ...complete.steps, install: { status: 'completed', exitCode: 2 } },
      },
    });
    assert.equal(report.exitCode, 1);
    assert.equal(card(report).status, 'error');
    assert.match(fact(card(report), '(Install)'), /exit 2/);
    assert.doesNotMatch(card(report).summary, /reports healthy/);
  });
  it('should retain original failed attempt when latest verification succeeds', () => {
    const result = {
      ...complete,
      id: 'original',
      status: 'attention',
      steps: { ...complete.steps, doctor: { status: 'blocked', reason: 'doctor-unhealthy' } },
    };
    const report = formatUpdateReport({
      result,
      verification: {
        updateId: 'original',
        status: 'success',
        steps: { doctor: complete.steps.doctor },
      },
      reportOnly: true,
    });
    assert.equal(card(report).status, 'success');
    assert.equal(fact(card(report), 'Original health'), 'Blocked; doctor-unhealthy');
    assert.match(
      card(report).findings.join(' '),
      /no update.*original update attempt is unchanged/,
    );
  });
  it('should not infer a reached target or completed health from interrupted mutation', () => {
    const report = formatUpdateReport({
      result: {
        status: 'attention',
        before: complete.before,
        target: complete.after,
        pending: 'source',
        reason: 'interrupted-run',
        steps: { source: { status: 'running' } },
      },
    });
    assert.equal(report.exitCode, 1);
    assert.match(
      fact(card(report), 'Source revision'),
      /after unknown; target bbbbbbbbbbbb not verified/,
    );
    assert.match(fact(card(report), '(Doctor)'), /^Not attempted/);
    assert.match(report.stdout, /Uncertain/);
    assert.doesNotMatch(report.stdout, /Healthy|→/);
  });
  it('should retain completed work when close fails and only expose safe runtime facts', () => {
    const report = formatUpdateReport({ result: complete, closeFailed: true });
    assert.equal(report.exitCode, 1);
    assert.equal(card(report).status, 'error');
    assert.match(report.stdout, /Doctor reports healthy|exclusion descriptor close/);
    const unsupported = formatUpdateReport({
      failure: new Error('runtime-unsupported'),
      runtime: { version: '0.0.0', executable: '/fixture/bin/bun' },
    });
    assert.equal(fact(card(unsupported), 'Actual Bun'), '0.0.0');
    assert.equal(fact(card(unsupported), 'Supported Bun'), maintenanceBunRange);
    assert.equal(fact(card(unsupported), 'Executable'), '/fixture/bin/bun');
  });
  it('should exclude arbitrary vocabulary, revisions, exception text and unsafe runtime values', () => {
    const secret = 'github_pat_private\n[click](https://malicious.test)';
    const report = formatUpdateReport({
      result: {
        status: secret,
        before: secret,
        target: secret,
        pending: secret,
        steps: { source: { status: 'toString' }, install: { warnings: secret } },
      },
      failure: new Error('runtime-unsupported'),
      runtime: { version: secret, executable: secret },
    });
    assert.equal(report.exitCode, 1);
    assert.doesNotMatch(report.stdout + report.stderr, /github_pat|malicious|native code/);
    assert.equal(fact(card(report), 'Actual Bun'), 'unavailable');
    assert.equal(fact(card(report), 'Executable'), undefined);
  });
});
