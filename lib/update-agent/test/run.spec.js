import assert from 'node:assert/strict';

import updateHost from '../host.js';
import runUpdate from '../run.js';

const oldRevision = 'a'.repeat(40);
const newRevision = 'b'.repeat(40);

function fixture({
  equal = false,
  observation = {},
  fail,
  readiness = true,
  loaded = true,
  previous,
} = {}) {
  const calls = [];
  const records = [];
  const checkout = {
    workspace: '/fixture/emori',
    canonical: true,
    dirty: false,
    branch: 'main',
    upstream: 'origin/main',
    remoteApproved: true,
    remote: 'approved',
    inProgress: false,
    fastForward: true,
    head: oldRevision,
    target: equal ? oldRevision : newRevision,
    ...observation,
  };
  const commands = Object.fromEntries(
    ['fetch', 'advance', 'dependencies', 'install', 'doctor'].map((name) => [
      name,
      async (...args) => {
        calls.push(name);
        if (fail === name) throw new Error('command-failed');
        if (name === 'advance') checkout.head = args[0];
      },
    ]),
  );
  commands.inspect = async () => ({ ...checkout });
  const host = {
    workspace: '/fixture/emori',
    toolsStable: true,
    runnerStable: true,
    assertHeld: async () => {},
    ready: async () => readiness,
    loaded: async () => loaded,
  };
  const storage = {
    assertHeld: async () => {},
    read: async () => previous,
    write: async (value) => records.push(structuredClone(value)),
  };
  return {
    calls,
    records,
    checkout,
    commands,
    host,
    storage,
    run: () =>
      runUpdate({
        workspace: '/fixture/emori',
        commands,
        host,
        storage,
        now: () => 0,
        id: 'fixture-run',
      }),
  };
}

describe('lib/update-agent/run', () => {
  it('should advance only the observed revision then reconcile dependencies, Install and Doctor', async () => {
    const f = fixture();
    const result = await f.run();
    assert.equal(result.status, 'success');
    assert.equal(result.before, oldRevision);
    assert.equal(result.after, newRevision);
    assert.deepEqual(f.calls, ['fetch', 'advance', 'dependencies', 'install', 'doctor']);
    assert.equal(f.records.find((r) => r.pending === 'source').target, newRevision);
    assert.ok(f.records.find((r) => r.pending === 'install'));
  });

  it('should reconcile unchanged eligible code without advancing', async () => {
    const f = fixture({ equal: true });
    const result = await f.run();
    assert.equal(result.status, 'success');
    assert.equal(result.steps.source.changed, false);
    assert.deepEqual(f.calls, ['fetch', 'dependencies', 'install', 'doctor']);
  });

  for (const [observation, reason] of [
    [{ workspace: '/fixture/other' }, 'unsupported-target'],
    [{ canonical: false }, 'unsupported-target'],
    [{ dirty: true }, 'dirty'],
    [{ dirty: undefined }, 'dirty'],
    [{ branch: 'task' }, 'non-main'],
    [{ branch: undefined }, 'detached'],
    [{ inProgress: true }, 'in-progress'],
    [{ upstream: undefined }, 'unsafe-upstream'],
    [{ remoteApproved: false }, 'unsafe-upstream'],
    [{ fastForward: false }, 'ahead-or-diverged'],
    [{ fastForward: undefined }, 'ahead-or-diverged'],
    [{ target: 'not-a-revision' }, 'unsafe-upstream'],
  ]) {
    it(`should preserve a skipped checkout (${reason}, ${JSON.stringify(observation)})`, async () => {
      const f = fixture({ observation });
      const result = await f.run();
      assert.equal(result.status, 'attention');
      assert.equal(result.reason, reason);
      assert.deepEqual(f.calls, []);
      assert.equal(result.steps.install.status, 'unattempted');
    });
  }

  it('should refuse changed observations immediately before fast-forward', async () => {
    const f = fixture();
    let inspections = 0;
    f.commands.inspect = async () => ({ ...f.checkout, dirty: ++inspections === 3 });
    const result = await f.run();
    assert.equal(result.reason, 'dirty');
    assert.deepEqual(f.calls, ['fetch']);
    assert.equal(f.checkout.head, oldRevision);
  });

  it('should retain the original revision and report an uncertain fast-forward failure', async () => {
    const f = fixture({ fail: 'advance' });
    const result = await f.run();
    assert.equal(result.status, 'attention');
    assert.equal(result.pending, 'source');
    assert.equal(f.checkout.head, oldRevision);
    assert.deepEqual(f.calls, ['fetch', 'advance']);
  });

  for (const failed of ['dependencies', 'install', 'doctor']) {
    it(`should preserve completed source work after ${failed} fails`, async () => {
      const f = fixture({ fail: failed });
      const result = await f.run();
      assert.equal(result.status, 'attention');
      assert.equal(result.after, newRevision);
      assert.equal(result.steps.source.status, 'completed');
      assert.equal(f.checkout.head, newRevision);
      assert.equal(f.calls.at(-1), failed);
    });
  }

  it('should rely on native lifecycle refusal rather than duplicate readiness gating', async () => {
    const f = fixture({ readiness: false });
    f.host.ready = async () => {
      throw new Error('unexpected-preflight');
    };
    assert.equal((await f.run()).status, 'success');
    assert.deepEqual(f.calls, ['fetch', 'advance', 'dependencies', 'install', 'doctor']);
  });

  it('should preserve native stale-manifest refusal without re-admission or rollback', async () => {
    const f = fixture();
    f.commands.install = async () => {
      throw new Error('automation-execution-stale');
    };
    const result = await f.run();
    assert.equal(result.reason, 'automation-execution-stale');
    assert.equal(result.after, newRevision);
    assert.equal(result.steps.doctor.status, 'unattempted');
    assert.equal(result.pending, 'install');
  });

  it('should checkpoint safe partial lifecycle progress and leave Doctor unattempted', async () => {
    const f = fixture();
    f.commands.install = async () => {
      throw Object.assign(new Error('command-failed'), {
        lifecycle: { completed: 3, skipped: 1, unattempted: 2, raw: 'secret' },
        warnings: 1,
      });
    };
    const result = await f.run();
    assert.equal(result.after, newRevision);
    assert.deepEqual(result.steps.install.lifecycle, { completed: 3, skipped: 1, unattempted: 2 });
    assert.equal(result.steps.doctor.status, 'unattempted');
    assert.ok(!JSON.stringify(f.records).includes('secret'));
    assert.equal(f.records.at(-1).steps.install.warnings, 1);
  });

  it('should not promote successful Doctor to proof of loaded state', async () => {
    const result = await fixture({ loaded: false }).run();
    assert.equal(result.steps.doctor.status, 'completed');
    assert.equal(result.status, 'attention');
    assert.equal(result.reason, 'loaded-state-unverified');
  });

  it('should fail closed with the actual unavailable host integration', async () => {
    const f = fixture();
    Object.assign(f.host, updateHost());
    assert.equal((await f.run()).reason, 'maintenance-unavailable');
    assert.deepEqual(f.calls, []);
  });

  it('should stop when exclusion is lost instead of inferring inactivity from Git', async () => {
    const f = fixture();
    f.commands.fetch = async () => {
      f.host.assertHeld = async () => {
        throw new Error('maintenance-unavailable');
      };
    };
    assert.equal((await f.run()).reason, 'maintenance-unavailable');
    assert.equal(f.checkout.head, oldRevision);
  });

  it('should stop before work when the total budget is exhausted', async () => {
    const f = fixture();
    let time = 0;
    const result = await runUpdate({
      ...f,
      workspace: '/fixture/emori',
      now: () => time++,
      budgetMs: 1,
    });
    assert.equal(result.reason, 'deadline');
    assert.deepEqual(f.calls, []);
  });

  it('should preserve malformed checkpoint evidence without writing over it', async () => {
    const f = fixture({ previous: { version: 1, workspace: '/fixture/emori' } });
    const result = await f.run();
    assert.equal(result.reason, 'checkpoint-invalid');
    assert.deepEqual(f.records, []);
    assert.deepEqual(f.calls, []);
  });

  for (const property of ['toolsStable', 'runnerStable']) {
    it(`should refuse mutation without stable execution inputs (${property})`, async () => {
      const f = fixture();
      f.host[property] = false;
      assert.equal((await f.run()).status, 'attention');
      assert.deepEqual(f.calls, []);
    });
  }

  it('should retain interruption ownership and never replay an uncertain mutation', async () => {
    const first = fixture({ fail: 'install' });
    const previous = await first.run();
    const second = fixture({ previous });
    const result = await second.run();
    assert.equal(result.reason, 'interrupted-run');
    assert.equal(result.predecessor, previous.id);
    assert.deepEqual(second.calls, []);
    const third = fixture({ previous: result });
    assert.equal((await third.run()).reason, 'interrupted-run');
    assert.deepEqual(third.calls, []);
  });

  it('should exclude arbitrary command messages from retained diagnostics', async () => {
    const f = fixture();
    f.commands.dependencies = async () => {
      throw new Error('secret-value-from-command');
    };
    const result = await f.run();
    assert.equal(result.reason, 'command-failed');
    assert.ok(!JSON.stringify(f.records).includes('secret-value-from-command'));
  });
});
