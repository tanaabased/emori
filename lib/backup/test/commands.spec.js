import assert from 'node:assert/strict';

import backupCommands from '../commands.js';

// Unit evidence: inspect the actual adapter's mapping and redaction with a controlled child result.
describe('lib/backup/commands', () => {
  const storage = { lockFd: 17, assertHeld: async () => {} };

  it('should preserve bound Google execution, the inherited lock and process limits', async () => {
    const calls = [];
    let checks = 0;
    const commands = backupCommands({
      workspace: '/disposable',
      operator: false,
      storage: {
        ...storage,
        assertHeld: async () => {
          checks++;
        },
      },
      environment: { AGENT_SYSTEM_GOG: '/managed/gog', PRIVATE: 'never-print' },
      spawn: (...args) => {
        calls.push(args);
        return { status: 0, stdout: '{"ok":true}' };
      },
    });
    assert.deepEqual(await commands.drive(['drive', 'get', 'file']), { ok: true });
    await commands.backup(['create']);
    assert.equal(checks, 4);
    assert.equal(calls[0][0], '/managed/gog');
    assert.deepEqual(calls[0][1], ['drive', 'get', 'file']);
    assert.deepEqual(calls[1][1], ['agent-system', 'backup', 'create', '--json']);
    for (const [, , options] of calls) {
      assert.equal(options.cwd, '/disposable');
      assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe', 17]);
      assert.equal(options.timeout, 600_000);
      assert.equal(options.maxBuffer, 64 * 1024 * 1024);
      assert.equal(options.killSignal, 'SIGKILL');
    }
  });

  it('should use the explicit managed operator route without a host Google fallback', async () => {
    let call;
    const commands = backupCommands({
      workspace: '/disposable',
      operator: true,
      storage,
      environment: {},
      spawn: (...args) => {
        call = args;
        return { status: 0, stdout: '{}' };
      },
    });
    await commands.drive(['drive', 'ls']);
    assert.equal(call[0], 'openclaw');
    assert.deepEqual(call[1], ['agent-system', 'tool', 'gog', '--', 'drive', 'ls']);
  });

  for (const failure of [
    { status: 7, signal: null },
    { status: null, signal: 'SIGKILL', error: { code: 'ETIMEDOUT' } },
    { status: null, signal: 'SIGKILL', error: { code: 'ENOBUFS' } },
    { status: null, signal: 'private-secret', error: { code: 'private-secret' } },
  ]) {
    it('should report bounded process facts without subprocess output, arguments or secrets', async () => {
      const commands = backupCommands({
        workspace: '/private-secret',
        operator: true,
        storage,
        environment: { SECRET: 'private-secret' },
        spawn: () => ({
          ...failure,
          stdout: 'private-secret'.repeat(10000),
          stderr: 'private-secret',
        }),
      });
      await assert.rejects(commands.backup(['create', 'private-secret']), (error) => {
        assert.equal(error.message, 'managed-command-failed');
        assert.equal(error.diagnostic.command, 'backup');
        assert.equal(error.diagnostic.exit, failure.status);
        assert(!JSON.stringify(error).includes('private-secret'));
        assert(JSON.stringify(error).length < 200);
        if (failure.error?.code === 'ETIMEDOUT') assert.equal(error.diagnostic.reason, 'timeout');
        if (failure.error?.code === 'ENOBUFS')
          assert.equal(error.diagnostic.reason, 'output-limit');
        return true;
      });
    });
  }

  it('should stop before spawning if overlap exclusion is lost and reject invalid JSON', async () => {
    let spawned = false;
    const commands = backupCommands({
      workspace: '/disposable',
      operator: true,
      storage: {
        ...storage,
        assertHeld: async () => {
          throw new Error('backup-lock-lost');
        },
      },
      spawn: () => {
        spawned = true;
      },
    });
    await assert.rejects(commands.backup(['create']), /backup-lock-lost/);
    assert.equal(spawned, false);
    const invalid = backupCommands({
      workspace: '/disposable',
      operator: true,
      storage,
      spawn: () => ({ status: 0, stdout: 'not JSON: private-secret' }),
    });
    await assert.rejects(invalid.backup(['create']), /managed-output-invalid/);
  });
});
