import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import packageJson from '../../../package.json' with { type: 'json' };
import runUpdateTask from '../task.js';

const complete = {
  status: 'success',
  before: 'a'.repeat(40),
  after: 'b'.repeat(40),
  steps: {
    source: { status: 'completed', changed: true },
    dependencies: { status: 'completed' },
    install: { status: 'completed' },
    doctor: { status: 'completed' },
    loaded: { status: 'completed' },
  },
};

function fixture(result = complete) {
  const output = { stdout: '', stderr: '' };
  const calls = [];
  const storage = {
    close: async () => {
      calls.push('close');
    },
  };
  return {
    output,
    calls,
    storage,
    options: {
      cwd: '/fixture',
      runtimeVersion: packageJson.packageManager.slice(4),
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
      canonicalize: async () => {
        calls.push('canonicalize');
        return '/canonical';
      },
      open: async () => {
        calls.push('open');
        return storage;
      },
      commands: () => ({}),
      host: () => ({}),
      run: async () => {
        calls.push('run');
        return result;
      },
    },
  };
}

describe('lib/update-agent/task', () => {
  it('should execute once and emit the completed Markdown result after closing storage', async () => {
    const f = fixture();
    f.options.stdout.write = (text) => {
      assert.equal(f.calls.at(-1), 'close');
      f.output.stdout += text;
    };
    assert.equal(await runUpdateTask(f.options), 0);
    assert.deepEqual(f.calls, ['canonicalize', 'open', 'run', 'close']);
    assert.match(f.output.stdout, /^## Agent update completed/);
    assert.match(f.output.stdout, /aaaaaaaaaaaa → bbbbbbbbbbbb/);
    assert.equal(f.output.stderr, '');
    assert.match(f.output.stdout, /not delivery confirmation/);
  });

  it('should retain unchanged source and warnings without claiming failure', async () => {
    const result = structuredClone(complete);
    result.steps.source.changed = false;
    result.steps.install.warnings = 2;
    const f = fixture(result);
    assert.equal(await runUpdateTask(f.options), 0);
    assert.match(f.output.stdout, /Source \(unchanged\)/);
    assert.match(f.output.stdout, /Warnings: Install reported 2/);
  });

  it('should preserve skips and truthful nonzero status without running recovery', async () => {
    const f = fixture({
      status: 'attention',
      reason: 'dirty',
      steps: { source: { status: 'skipped' } },
    });
    assert.equal(await runUpdateTask(f.options), 1);
    assert.match(f.output.stdout, /Skipped: Source/);
    assert.match(f.output.stdout, /Not attempted: Install/);
    assert.match(f.output.stderr, /dirty/);
    assert.equal(f.calls.filter((value) => value === 'run').length, 1);
  });

  it('should report partial Install work and uncertainty without exposing raw fields', async () => {
    const f = fixture({
      ...complete,
      status: 'attention',
      reason: 'automation-execution-stale',
      pending: 'install',
      steps: {
        ...complete.steps,
        install: {
          status: 'blocked',
          lifecycle: { completed: 3, skipped: 1, unattempted: 2 },
          message: 'secret',
        },
        doctor: { status: 'unattempted' },
        loaded: { status: 'unattempted' },
      },
    });
    assert.equal(await runUpdateTask(f.options), 1);
    assert.match(f.output.stdout, /Install components completed: 3/);
    assert.match(f.output.stdout, /Install components unattempted: 2/);
    assert.match(f.output.stdout, /Uncertain: Install/);
    assert.match(f.output.stdout, /Reconcile the changed configuration/);
    assert.ok(!JSON.stringify(f.output).includes('secret'));
  });

  for (const [changes, code] of [
    [{ argv: ['--unknown'] }, 'arguments-invalid'],
    [{ runtimeVersion: '0.0.0' }, 'runtime-unsupported'],
    [{ runtimeVersion: '' }, 'runtime-unsupported'],
  ]) {
    it(`should emit actionable Markdown before state access for ${JSON.stringify(changes)}`, async () => {
      const f = fixture();
      Object.assign(f.options, changes);
      assert.equal(await runUpdateTask(f.options), 1);
      assert.deepEqual(f.calls, []);
      assert.match(f.output.stdout, /^## Agent update failed/);
      assert.ok(f.output.stdout.includes(code));
      assert.match(f.output.stdout, /Next:/);
    });
  }

  it('should report lock refusal without invoking maintenance or claiming chat delivery', async () => {
    const f = fixture();
    f.options.open = async () => {
      throw new Error('backup-run-locked');
    };
    assert.equal(await runUpdateTask(f.options), 1);
    assert.deepEqual(f.calls, ['canonicalize']);
    assert.match(f.output.stdout, /Skipped: this execution/);
  });

  it('should include close failure in the final result and never replay maintenance', async () => {
    const f = fixture();
    f.storage.close = async () => {
      throw new Error('secret close failure');
    };
    assert.equal(await runUpdateTask(f.options), 1);
    assert.match(f.output.stdout, /Failed: exclusion descriptor close/);
    assert.match(f.output.stderr, /exclusion-close-failed/);
    assert.ok(!JSON.stringify(f.output).includes('secret'));
    assert.equal(f.calls.filter((value) => value === 'run').length, 1);
  });

  it('should sanitize unexpected task exceptions', async () => {
    const f = fixture();
    f.options.run = async () => {
      throw new Error('private credential');
    };
    assert.equal(await runUpdateTask(f.options), 1);
    assert.match(f.output.stderr, /command-failed/);
    assert.ok(!JSON.stringify(f.output).includes('private credential'));
    assert.equal(f.calls.at(-1), 'close');
  });

  it('should not promote an incomplete success-labelled result to successful exit', async () => {
    const f = fixture({ ...complete, steps: { source: complete.steps.source } });
    assert.equal(await runUpdateTask(f.options), 1);
    assert.match(f.output.stdout, /needs attention/);
  });

  it('should expose the actual entrypoint early-error Markdown and process exit contract', () => {
    const child = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('../../../scripts/update-agent-task.js', import.meta.url)),
        '--invalid',
      ],
      { encoding: 'utf8' },
    );
    assert.equal(child.status, 1);
    assert.match(child.stdout, /^## Agent update failed/);
    assert.match(child.stdout, /arguments-invalid/);
    assert.match(child.stderr, /arguments-invalid/);
  });
});
