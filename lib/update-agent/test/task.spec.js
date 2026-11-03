import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import packageJson from '../../../package.json' with { type: 'json' };
import runUpdateTask from '../task.js';
import { maintenanceBunRange } from '../utils/check-runtime.js';

const complete = {
  status: 'success',
  before: 'a'.repeat(40),
  after: 'b'.repeat(40),
  steps: {
    source: { status: 'completed', changed: true },
    dependencies: { status: 'completed' },
    install: { status: 'completed' },
    doctor: { status: 'completed' },
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
      run: async () => {
        calls.push('run');
        return result;
      },
    },
  };
}

describe('lib/update-agent/task', () => {
  for (const runtimeVersion of ['1.4.2', '1.4.3']) {
    it(`should reach normal updates with compatible nonpreferred patch ${runtimeVersion}`, async () => {
      const f = fixture();
      f.options.runtimeVersion = runtimeVersion;
      assert.equal(await runUpdateTask(f.options), 0);
      assert.ok(f.calls.includes('run'));
    });
  }

  for (const runtimeVersion of ['1.4.1', '1.5.0', '1.4.4-beta.1', 'invalid', '']) {
    it(`should report runtime facts before any updates for ${JSON.stringify(runtimeVersion)}`, async () => {
      const f = fixture();
      f.options.runtimeVersion = runtimeVersion;
      f.options.runtimeExecutable = '/fixture/bin/bun';
      f.options.commands = () => {
        assert.fail('commands must not be constructed');
      };
      assert.equal(await runUpdateTask(f.options), 1);
      assert.deepEqual(f.calls, []);
      assert.match(f.output.stderr, /runtime-unsupported/);
      assert.ok(f.output.stdout.includes(runtimeVersion || 'unavailable'));
      assert.ok(f.output.stdout.includes(maintenanceBunRange));
      assert.ok(f.output.stdout.includes('/fixture/bin/bun'));
      assert.ok(!f.output.stdout.includes('engines.bun'));
    });
  }

  it('should not print unsafe runtime diagnostics or arbitrary exception text', async () => {
    const f = fixture();
    f.options.runtimeVersion = 'private\n- injected';
    f.options.runtimeExecutable = '/tmp/`secret`/bun';
    assert.equal(await runUpdateTask(f.options), 1);
    assert.deepEqual(f.calls, []);
    assert.equal(
      JSON.parse(f.output.stdout).cards[0].facts.find(({ label }) => label === 'Actual Bun').value,
      'unavailable',
    );
    assert.ok(!f.output.stdout.includes('| Executable |'));
    assert.ok(!JSON.stringify(f.output).match(/private|secret|injected/));
  });

  it('should execute once and emit the completed structured report result after closing storage', async () => {
    const f = fixture();
    f.options.stdout.write = (text) => {
      assert.equal(f.calls.at(-1), 'close');
      f.output.stdout += text;
    };
    assert.equal(await runUpdateTask(f.options), 0);
    assert.deepEqual(f.calls, ['canonicalize', 'canonicalize', 'open', 'run', 'close']);
    assert.equal(JSON.parse(f.output.stdout).cards[0].status, 'success');
    assert.match(f.output.stdout, /aaaaaaaaaaaa → bbbbbbbbbbbb/);
    assert.equal(f.output.stderr, '');
    assert.doesNotMatch(f.output.stdout, /Reporting:|delivery confirmation/);
  });

  it('should retain unchanged source and warnings without claiming failure', async () => {
    const result = structuredClone(complete);
    result.steps.source.changed = false;
    result.after = result.before;
    result.steps.install.warnings = 2;
    const f = fixture(result);
    assert.equal(await runUpdateTask(f.options), 0);
    assert.match(f.output.stdout, /Unchanged aaaaaaaaaaaa/);
    assert.equal(JSON.parse(f.output.stdout).cards[0].status, 'warning');
    assert.match(f.output.stdout, /2 warnings/);
  });

  it('should preserve skips and truthful nonzero status without running recovery', async () => {
    const f = fixture({
      status: 'attention',
      reason: 'dirty',
      steps: { source: { status: 'skipped' } },
    });
    assert.equal(await runUpdateTask(f.options), 1);
    assert.match(
      JSON.parse(f.output.stdout).cards[0].facts.find(
        ({ label }) => label === 'Check for source changes',
      ).value,
      /^Skipped/,
    );
    assert.match(
      JSON.parse(f.output.stdout).cards[0].facts.find(({ label }) => label.includes('(Install)'))
        .value,
      /^Not attempted/,
    );
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
      },
    });
    assert.equal(await runUpdateTask(f.options), 1);
    assert.match(f.output.stdout, /components: 3 completed, 1 skipped, 2 unattempted/);
    assert.match(f.output.stdout, /Uncertain: Apply agent configuration/);
    assert.match(f.output.stdout, /Reconcile the changed configuration/);
    assert.ok(!JSON.stringify(f.output).includes('secret'));
  });

  for (const [changes, code] of [
    [{ argv: ['--unknown'] }, 'arguments-invalid'],
    [{ runtimeVersion: '0.0.0' }, 'runtime-unsupported'],
    [{ runtimeVersion: '' }, 'runtime-unsupported'],
  ]) {
    it(`should emit actionable structured report before state access for ${JSON.stringify(changes)}`, async () => {
      const f = fixture();
      Object.assign(f.options, changes);
      assert.equal(await runUpdateTask(f.options), 1);
      assert.deepEqual(f.calls, []);
      assert.equal(JSON.parse(f.output.stdout).cards[0].status, 'error');
      assert.ok(f.output.stdout.includes(code));
      assert(JSON.parse(f.output.stdout).cards[0].actions.length);
      if (code === 'runtime-unsupported') {
        assert(f.output.stdout.includes(changes.runtimeVersion || 'unavailable'));
        assert(f.output.stdout.includes(maintenanceBunRange));
      }
    });
  }

  it('should report lock refusal without invoking updates or claiming chat delivery', async () => {
    const f = fixture();
    f.options.open = async () => {
      throw new Error('backup-run-locked');
    };
    assert.equal(await runUpdateTask(f.options), 1);
    assert.deepEqual(f.calls, ['canonicalize', 'canonicalize']);
    assert.match(f.output.stdout, /Wait for the lock owner/);
  });

  it('should reject a checkout other than the executing source directory before opening state', async () => {
    const f = fixture();
    f.options.canonicalize = async (path) => (path === '/fixture' ? '/elsewhere' : '/source');
    assert.equal(await runUpdateTask(f.options), 1);
    assert.deepEqual(f.calls, []);
    assert.match(f.output.stdout, /unsupported-target/);
  });

  it('should include close failure in the final result and never replay updates', async () => {
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
    assert.equal(JSON.parse(f.output.stdout).cards[0].status, 'error');
  });

  it('should expose the actual entrypoint early-error structured report and process exit contract', () => {
    const child = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('../../../scripts/update-agent-task.js', import.meta.url)),
        '--invalid',
      ],
      { encoding: 'utf8' },
    );
    assert.equal(child.status, 1);
    assert.equal(JSON.parse(child.stdout).cards[0].status, 'error');
    assert.match(child.stdout, /arguments-invalid/);
    assert.match(child.stderr, /arguments-invalid/);
  });
});
