import assert from 'node:assert/strict';

import updateCommands from '../commands.js';

function fixture({ environment = { AGENT_SYSTEM_GIT: '/bound/git' }, response, now } = {}) {
  const calls = [];
  const commands = updateCommands({
    workspace: '/fixture/emori',
    environment,
    now,
    storage: { lockFds: [10, 11], assertHeld: async () => {} },
    stat: async () => {
      throw Object.assign(new Error(), { code: 'ENOENT' });
    },
    spawn: (command, argv, options) => {
      calls.push({ command, argv, options });
      let stdout = '{}';
      if (argv[0] === 'rev-parse')
        stdout =
          argv[1] === '--show-toplevel'
            ? '/fixture/emori'
            : argv[1] === '--absolute-git-dir'
              ? '/fixture/emori/.git'
              : 'b'.repeat(40);
      if (argv[0] === 'status')
        stdout = `# branch.oid ${'a'.repeat(40)}\n# branch.head main\n# branch.upstream origin/main\n`;
      if (argv[0] === 'remote') stdout = 'git@github.com:tanaabased/emori.git';
      if (argv[0] === 'diff') stdout = '';
      if (argv.includes('doctor')) stdout = '{"status":"healthy"}';
      if (argv.includes('--skip-setup'))
        stdout = '{"agentId":"emori","workspaceDir":"/fixture/emori","outcomes":[],"warnings":[]}';
      return {
        status: 0,
        stdout,
        ...(typeof response === 'function' ? response(command, argv) : response),
      };
    },
  });
  return { commands, calls };
}

describe('lib/update-agent/commands', () => {
  it('should use the strict Git launcher, exact revision and frozen dependency policy', async () => {
    const f = fixture();
    await f.commands.advance('b'.repeat(40), 500);
    await f.commands.dependencies(500);
    assert.equal(f.calls[0].command, '/bound/git');
    assert.deepEqual(f.calls[0].argv, ['merge', '--ff-only', '--no-edit', 'b'.repeat(40)]);
    assert.equal(f.calls[1].command, 'bun');
    assert.deepEqual(f.calls[1].argv, ['install', '--frozen-lockfile', '--ignore-scripts']);
    for (const { options } of f.calls) {
      assert.equal(options.cwd, '/fixture/emori');
      assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe', 10, 11]);
      assert.ok(options.timeout <= 500);
    }
  });

  it('should run same-agent Install skipping setup and Doctor without skipping checks', async () => {
    const f = fixture();
    await f.commands.install(500);
    await f.commands.doctor(500);
    assert.deepEqual(
      f.calls.map(({ command, argv }) => [command, ...argv]),
      [
        ['openclaw', 'agent-system', 'install', '--skip-setup', '--json'],
        ['openclaw', 'agent-system', 'doctor', '--json'],
      ],
    );
  });

  it('should reject an unbound invocation without a raw-client fallback', async () => {
    const f = fixture({ environment: {} });
    await assert.rejects(f.commands.fetch(500), /command-failed/);
    assert.deepEqual(f.calls, []);
  });

  it('should parse managed inspection and detect untracked dirtiness', async () => {
    const f = fixture();
    const observation = await f.commands.inspect(500);
    assert.equal(observation.branch, 'main');
    assert.equal(observation.head, 'a'.repeat(40));
    assert.equal(observation.target, 'b'.repeat(40));
    assert.equal(observation.dirty, false);
    assert.equal(observation.fastForward, true);
    assert.equal(observation.inProgress, false);
    const dirty = fixture({
      response: (_, argv) =>
        argv[0] === 'status'
          ? {
              stdout: `# branch.oid ${'a'.repeat(40)}\n# branch.head main\n# branch.upstream origin/main\n? untracked.txt\n`,
            }
          : {},
    });
    assert.equal((await dirty.commands.inspect(500)).dirty, true);
  });

  it('should refuse unhealthy or malformed Doctor output even on exit zero', async () => {
    for (const stdout of ['{}', '{"status":"pending"}', 'truncated']) {
      await assert.rejects(
        fixture({ response: { stdout } }).commands.doctor(500),
        /command-output-invalid/,
      );
    }
  });

  it('should refuse missing or wrong-agent Install results on exit zero', async () => {
    for (const stdout of [
      '{}',
      '{"status":"blocked"}',
      '{"agentId":"other","workspaceDir":"/fixture/emori","outcomes":[],"warnings":[]}',
    ]) {
      await assert.rejects(
        fixture({ response: { stdout } }).commands.install(500),
        /command-output-invalid/,
      );
    }
  });

  it('should report a missing upstream as unsafe rather than executing a mutation', async () => {
    const f = fixture({
      response: (_, argv) =>
        argv.includes('refs/remotes/origin/main') ? { status: 128, stdout: '' } : {},
    });
    assert.equal((await f.commands.inspect(500)).remoteApproved, false);
    assert.ok(!f.calls.some(({ argv }) => argv[0] === 'merge'));
  });

  it('should report timeout without repeating a possibly completed command', async () => {
    const f = fixture({ response: { error: { code: 'ETIMEDOUT' } } });
    await assert.rejects(f.commands.install(500), { message: 'command-timeout' });
    assert.equal(f.calls.length, 1);
  });

  it('should bound commands by the entire run deadline', async () => {
    let time = 0;
    const f = fixture({ now: () => time });
    time = 1_800_001;
    await assert.rejects(f.commands.fetch(500), /deadline/);
    assert.deepEqual(f.calls, []);
  });

  for (const response of [
    { status: 1, stderr: 'private diagnostic' },
    { status: null, signal: 'SIGTERM' },
    { error: { code: 'ENOBUFS' }, stdout: 'truncated' },
  ]) {
    it('should fail closed on command termination without retaining raw diagnostics', async () => {
      await assert.rejects(fixture({ response }).commands.install(500), {
        message: 'command-failed',
      });
    });
  }

  it('should retain only the known native stale-manifest refusal code', async () => {
    const f = fixture({
      response: { status: 1, stderr: 'secret automation-execution-stale secret' },
    });
    await assert.rejects(f.commands.install(500), { message: 'automation-execution-stale' });
  });

  it('should retain safe partial Install outcomes on nonzero exit without raw messages or replay', async () => {
    const f = fixture({
      response: {
        status: 1,
        stdout: JSON.stringify({
          agentId: 'emori',
          workspaceDir: '/fixture/emori',
          status: 'failed',
          outcomes: [{ status: 'updated', message: 'secret' }, { status: 'skipped' }],
          warnings: [{ message: 'secret' }],
          blocked: { message: 'secret' },
          unattempted: [{ component: 'doctor' }, { component: 'automations' }],
        }),
      },
    });
    await assert.rejects(f.commands.install(500), (error) => {
      assert.equal(error.message, 'command-failed');
      assert.deepEqual(error.lifecycle, { completed: 1, skipped: 1, unattempted: 2 });
      assert.equal(error.warnings, 1);
      assert.ok(!JSON.stringify(error).includes('secret'));
      return true;
    });
    assert.equal(f.calls.length, 1);
  });
});
