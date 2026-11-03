import assert from 'node:assert/strict';

import formatUpdateReport from '../utils/format-update-report.js';
import { maintenanceBunRange } from '../utils/check-runtime.js';

describe('lib/update-agent/utils/format-update-report', () => {
  const complete = {
    status: 'success',
    before: 'a'.repeat(40),
    after: 'b'.repeat(40),
    target: 'b'.repeat(40),
    steps: Object.fromEntries(
      ['source', 'dependencies', 'install', 'doctor'].map((name) => [
        name,
        { status: 'completed' },
      ]),
    ),
  };

  it('should render compact revisions and ordered facts without reporting boilerplate', () => {
    const report = formatUpdateReport({ result: complete });
    assert.equal(report.exitCode, 0);
    assert.equal(report.stderr, '');
    assert.match(report.stdout, /^## ✅ UPDATE AGENT/);
    assert.deepEqual(
      [...report.stdout.matchAll(/^\| (Source|Dependencies|Install|Doctor) \|/gm)].map(
        (match) => match[1],
      ),
      ['Source', 'Dependencies', 'Install', 'Doctor'],
    );
    assert.match(report.stdout, /`aaaaaaaaaaaa` → `bbbbbbbbbbbb`/);
    assert.match(report.stdout, /Complete; setup skipped/);
    assert.match(report.stdout, /Healthy \(normal checks\)/);
    assert.doesNotMatch(report.stdout, /[ab]{13}|target|Reporting|capture|stderr|Next/);
    const unchanged = formatUpdateReport({
      result: { ...complete, after: complete.before, target: complete.before },
    });
    assert.match(unchanged.stdout, /Unchanged `aaaaaaaaaaaa`/);
    assert.equal(unchanged.stdout.match(/`aaaaaaaaaaaa`/g).length, 1);
  });

  it('should distinguish successful warnings without changing exit semantics', () => {
    const report = formatUpdateReport({
      result: {
        ...complete,
        steps: {
          ...complete.steps,
          install: {
            status: 'completed',
            warnings: 2,
            lifecycle: { completed: 3, skipped: 1, unattempted: 0 },
          },
        },
      },
    });
    assert.equal(report.exitCode, 0);
    assert.match(report.stdout, /^## ⚠️ UPDATE AGENT/);
    assert.match(report.stdout, /Successful with warning/);
    assert.match(report.stdout, /3 completed, 1 skipped, 0 unattempted; 2 warnings/);
    assert.match(report.stdout, /Inspect the Install warnings/);
  });

  it('should not infer a reached target or completed Doctor from an interrupted mutation', () => {
    const report = formatUpdateReport({
      result: {
        status: 'attention',
        before: complete.before,
        target: complete.target,
        pending: 'source',
        reason: 'interrupted-run',
        steps: { source: { status: 'running' } },
      },
    });
    assert.equal(report.exitCode, 1);
    assert.match(
      report.stdout,
      /before `aaaaaaaaaaaa`; after unknown; target `bbbbbbbbbbbb` \(not verified as reached\)/,
    );
    assert.match(report.stdout, /\| Doctor \| Not attempted/);
    assert.match(report.stdout, /Uncertain: Source/);
    assert.doesNotMatch(report.stdout, /Successful|Healthy|→/);
  });

  it('should preserve runner-level failure notices even when all application steps completed', () => {
    const report = formatUpdateReport({ result: complete, closeFailed: true });
    assert.equal(report.exitCode, 1);
    assert.match(report.stdout, /^## ❌ UPDATE AGENT/);
    assert.match(report.stdout, /Failed: exclusion descriptor close/);
    assert.match(report.stdout, /Healthy/);
  });

  it('should show validated runtime facts only on unsupported-runtime failures', () => {
    const failure = new Error('runtime-unsupported');
    const report = formatUpdateReport({
      failure,
      runtime: { version: '0.0.0', executable: '/fixture/bin/bun' },
    });
    assert.match(report.stdout, /\| Actual Bun \| `0.0.0`/);
    assert(
      report.stdout.includes(`| Supported Bun | \`${maintenanceBunRange}\` (stable releases only)`),
    );
    assert.match(report.stdout, /\| Executable \| `\/fixture\/bin\/bun`/);
    assert.match(report.stdout, /Use a stable Bun runtime matching/);
    assert.doesNotMatch(
      formatUpdateReport({ result: complete, runtime: { version: '0.0.0' } }).stdout,
      /Actual Bun/,
    );
  });

  it('should sanitize arbitrary input including inherited status names and Markdown delimiters', () => {
    const secret = 'github_pat_private`|\n[click](https://malicious.test)';
    const report = formatUpdateReport({
      result: {
        status: secret,
        before: secret,
        target: secret,
        after: secret,
        pending: secret,
        reason: secret,
        steps: {
          source: { status: 'toString' },
          install: { status: secret, warnings: secret, lifecycle: { completed: secret } },
        },
      },
      failure: new Error('runtime-unsupported'),
      runtime: { version: secret, executable: secret },
    });
    assert.equal(report.exitCode, 1);
    assert.doesNotMatch(report.stdout + report.stderr, /github_pat|malicious|function|native code/);
    assert.match(report.stdout, /Actual Bun \| `unavailable`/);
    assert.doesNotMatch(report.stdout, /\| Executable \|/);
    assert.match(report.stdout, /Source \| Not attempted/);
  });
});
