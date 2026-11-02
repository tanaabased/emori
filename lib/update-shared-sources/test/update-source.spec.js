import assert from 'node:assert/strict';

import updateSource from '../update-source.js';

function fixture({ id = 'canon', unchanged = false, counts = '0\t1' } = {}) {
  const before = 'a'.repeat(40);
  const target = unchanged ? before : 'b'.repeat(40);
  const state = {
    canonical: true,
    identity: `/canonical/${id}`,
    branch: 'main',
    clean: true,
    upstream: 'origin/main',
    remote: `https://github.com/tanaabased/${id}.git`,
    head: before,
  };
  const calls = [];
  const input = {
    source: { id, status: 'candidate', path: `/canonical/${id}` },
    deadline: 1800000,
    now: () => 0,
    evidence: async () => ({
      version: 1,
      inputs: target.padEnd(64, '0'),
      artifacts: 'c'.repeat(64),
    }),
    inspect: async () => ({ ...state }),
    execute: async (family, argv, options) => {
      calls.push({ family, argv, options });
      if (argv[0] === 'rev-parse') return target;
      if (argv[0] === 'ls-files') return 'package.json\0bun.lock\0';
      if (argv[0] === 'rev-list') return unchanged ? '0\t0' : counts;
      if (argv[0] === 'merge') state.head = target;
      return '';
    },
  };
  return { input, state, calls, before, target };
}

describe('lib/update-shared-sources/update-source', () => {
  it('should advance only to the pinned revision then install frozen dependencies', async () => {
    const { input, calls, before, target } = fixture();
    const result = await updateSource(input);
    assert.equal(result.status, 'completed');
    assert.equal(result.before, before);
    assert.equal(result.after, target);
    assert.deepEqual(result.steps, ['fetched', 'advanced', 'dependencies-installed']);
    assert.deepEqual(calls.find((call) => call.argv[0] === 'merge').argv, [
      'merge',
      '--ff-only',
      '--no-edit',
      target,
    ]);
    assert.deepEqual(calls.at(-1).argv, ['install', '--frozen-lockfile']);
  });

  it('should install even when unchanged and sync afterward without claiming runtime readiness', async () => {
    const { input, calls } = fixture({ id: 'openclaw-agent-system', unchanged: true });
    const result = await updateSource(input);
    assert.equal(result.status, 'completed');
    assert.deepEqual(result.pending, ['restart']);
    assert.ok(result.steps.includes('unchanged'));
    assert.equal(
      calls.some((call) => call.argv[0] === 'merge'),
      false,
    );
    assert.deepEqual(
      calls.slice(-2).map(({ argv }) => argv),
      [
        ['install', '--frozen-lockfile'],
        ['run', 'sync'],
      ],
    );
  });

  it('should reuse only a successful matching build while reconciling frozen dependencies', async () => {
    const { input, calls } = fixture({ id: 'openclaw-agent-system', unchanged: true });
    input.previous = await updateSource(input);
    calls.length = 0;
    const result = await updateSource(input);
    assert.equal(result.status, 'completed');
    assert.deepEqual(result.pending, ['restart']);
    assert.ok(result.steps.includes('build-current'));
    assert.ok(calls.some(({ argv }) => argv[0] === 'install'));
    assert.ok(!calls.some(({ argv }) => argv[0] === 'run'));

    // A separately established activated state must not acquire new debt on reuse.
    input.previous = { ...result, pending: [] };
    assert.deepEqual((await updateSource(input)).pending, []);
  });

  it('should rebuild changed, missing or malformed evidence even with unchanged HEAD', async () => {
    for (const build of [
      undefined,
      {},
      { version: 1, inputs: 'f'.repeat(64), artifacts: 'c'.repeat(64) },
      { version: 1, inputs: 'a'.repeat(40).padEnd(64, '0'), artifacts: 'd'.repeat(64) },
    ]) {
      const { input, calls } = fixture({ id: 'openclaw-agent-system', unchanged: true });
      input.previous = { pending: ['restart'], build };
      const result = await updateSource(input);
      assert.equal(result.status, 'completed');
      assert.ok(calls.some(({ argv }) => argv[0] === 'run'));
      assert.deepEqual(result.pending, ['restart']);
    }
  });

  it('should rebuild when the source revision advances beyond the successful build', async () => {
    const old = fixture({ id: 'openclaw-agent-system', unchanged: true });
    const previous = await updateSource(old.input);
    const next = fixture({ id: 'openclaw-agent-system' });
    const result = await updateSource({ ...next.input, previous });
    assert.equal(result.status, 'completed');
    assert.notEqual(result.build.inputs, previous.build.inputs);
    assert.ok(next.calls.some(({ argv }) => argv[0] === 'run'));
  });

  it('should retain activation when a previously built source becomes missing or ineligible', async () => {
    for (const status of ['missing', 'noncanonical']) {
      const result = await updateSource({
        source: { id: 'openclaw-agent-system', status },
        previous: { pending: ['restart'] },
        inspect: () => assert.fail('inspected'),
        execute: () => assert.fail('executed'),
      });
      assert.equal(result.status, 'skipped');
      assert.deepEqual(result.pending, ['restart']);
    }
  });

  it('should invalidate a failed partial sync durably and preserve activation on later failure', async () => {
    const { input } = fixture({ id: 'openclaw-agent-system', unchanged: true });
    const old = await updateSource(input);
    input.previous = old;
    input.evidence = async () => ({ ...old.build, artifacts: 'd'.repeat(64) });
    const checkpoints = [];
    input.checkpoint = async (value) => checkpoints.push(structuredClone(value));
    const execute = input.execute;
    input.execute = async (...args) => {
      if (args[1][0] === 'run') throw new Error('partial-sync');
      return execute(...args);
    };
    const failed = await updateSource(input);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.build, undefined);
    assert.deepEqual(failed.pending, ['restart']);
    assert.equal(checkpoints.findLast(({ phase }) => phase === 'sync').build, undefined);
    input.previous = failed;
    input.execute = async () => {
      throw new Error('fetch-failed');
    };
    assert.deepEqual((await updateSource(input)).pending, ['restart']);
  });

  it('should not mark unstable inputs or incomplete artifacts as a successful build', async () => {
    for (const kind of ['inputs', 'artifacts']) {
      const { input } = fixture({ id: 'openclaw-agent-system' });
      const evidence = input.evidence;
      let captures = 0;
      input.evidence = async () => {
        const value = await evidence();
        return ++captures === 1
          ? value
          : { ...value, [kind]: kind === 'inputs' ? 'd'.repeat(64) : null };
      };
      const result = await updateSource(input);
      assert.equal(result.status, 'failed');
      assert.equal(result.reason, 'build-evidence-invalid');
      assert.equal(result.build, undefined);
      assert.deepEqual(result.pending, ['restart']);
    }
  });

  it('should never inspect or execute excluded and unsupported entries', async () => {
    for (const status of ['excluded', 'unsupported', 'missing']) {
      const result = await updateSource({
        source: { id: 'emori', status },
        inspect: () => assert.fail('inspected'),
        execute: () => assert.fail('executed'),
      });
      assert.equal(result.status, status === 'excluded' ? 'excluded' : 'skipped');
    }
  });

  it('should leave dirty checkouts untouched', async () => {
    for (const change of [{ clean: false }]) {
      const { input, state, calls } = fixture();
      Object.assign(state, change);
      assert.equal((await updateSource(input)).status, 'skipped');
      assert.deepEqual(calls, []);
    }
  });

  it('should skip ahead and diverged main rather than install local changes', async () => {
    for (const [counts, reason] of [
      ['1\t0', 'ahead'],
      ['1\t1', 'diverged'],
    ]) {
      const { input, calls } = fixture({ counts });
      assert.equal((await updateSource(input)).reason, reason);
      assert.equal(
        calls.some((call) => call.argv[0] === 'merge' || call.family === 'bun'),
        false,
      );
    }
  });

  it('should revalidate immediately before mutation and preserve changes arriving during fetch', async () => {
    const { input, state, calls } = fixture();
    const execute = input.execute;
    input.execute = async (...args) => {
      const output = await execute(...args);
      if (args[1][0] === 'fetch') state.clean = false;
      return output;
    };
    assert.equal((await updateSource(input)).reason, 'dirty-or-unknown');
    assert.equal(
      calls.some((call) => call.argv[0] === 'merge' || call.family === 'bun'),
      false,
    );
  });

  for (const [command, completed] of [
    ['fetch', []],
    ['merge', ['fetched']],
    ['install', ['fetched', 'advanced']],
    ['run', ['fetched', 'advanced', 'dependencies-installed']],
  ]) {
    it(`should retain completed phases and stop without retry when ${command} fails`, async () => {
      const { input } = fixture({ id: 'openclaw-agent-system' });
      const execute = input.execute;
      let attempts = 0;
      input.execute = async (...args) => {
        if (args[1][0] === command) {
          attempts += 1;
          throw Object.assign(new Error('private provider output'), { exitCode: 17 });
        }
        return execute(...args);
      };
      const result = await updateSource(input);
      assert.equal(result.status, 'failed');
      assert.equal(result.exitCode, 17);
      assert.deepEqual(result.steps, completed);
      assert.equal(JSON.stringify(result).includes('private provider output'), false);
      assert.equal(attempts, 1);
    });
  }

  it('should spend one remaining budget and stop after expiry', async () => {
    const { input, calls } = fixture();
    let time = 0;
    input.now = () => time;
    const execute = input.execute;
    input.execute = async (...args) => {
      const output = await execute(...args);
      time = input.deadline;
      return output;
    };
    const result = await updateSource(input);
    assert.equal(result.reason, 'deadline-exceeded');
    assert.deepEqual(result.steps, ['fetched']);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.timeoutMs, 1800000);
  });

  it('should not install when advancement cannot be verified', async () => {
    const { input, calls } = fixture();
    const execute = input.execute;
    input.execute = (...args) => (args[1][0] === 'merge' ? '' : execute(...args));
    assert.equal((await updateSource(input)).reason, 'checkout-verification-failed');
    assert.equal(
      calls.some((call) => call.family === 'bun'),
      false,
    );
  });

  it('should run independently after an earlier failure without a success marker', async () => {
    const failed = fixture();
    failed.input.execute = async () => {
      throw null;
    };
    assert.equal((await updateSource(failed.input)).status, 'failed');
    assert.equal((await updateSource(fixture({ unchanged: true }).input)).status, 'completed');
  });

  it('should not install an uncommitted or absent Bun project', async () => {
    const { input, calls } = fixture();
    const execute = input.execute;
    input.execute = (...args) => (args[1][0] === 'ls-files' ? 'package.json\0' : execute(...args));
    const result = await updateSource(input);
    assert.equal(result.reason, 'not-bun');
    assert.ok(result.steps.includes('advanced'));
    assert.equal(
      calls.some((call) => call.family === 'bun'),
      false,
    );
  });

  it('should checkpoint the target and completed steps before installation', async () => {
    const { input, target } = fixture();
    const checkpoints = [];
    input.checkpoint = async (value) => checkpoints.push(value);
    await updateSource(input);
    const installation = checkpoints.find((value) => value.phase === 'install');
    assert.equal(installation.target, target);
    assert.equal(installation.after, target);
    assert.deepEqual(installation.steps, ['fetched', 'advanced']);
    assert.equal(installation.status, 'pending');
  });
});
