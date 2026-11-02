import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sourceCommands from '../commands.js';
import openStorage from '../storage.js';

describe('lib/update-shared-sources/commands (process component, synthetic launcher)', () => {
  let root;
  let storage;
  let launcher;
  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'source-commands-')));
    storage = await openStorage(root);
    launcher = join(root, 'managed-git');
    await writeFile(
      launcher,
      '#!/usr/bin/env bun\nconsole.log(JSON.stringify(process.argv.slice(2)));\n',
      { mode: 0o700 },
    );
  });
  afterEach(async () => {
    await storage?.close();
    await rm(root, { recursive: true, force: true });
  });
  const make = (options = {}) =>
    sourceCommands({
      cwd: root,
      storage,
      environment: {
        PATH: process.env.PATH,
        AGENT_SYSTEM_GIT: launcher,
        GH_TOKEN: 'secret-fixture',
      },
      ...options,
    });

  it('should pass argv unchanged to the strict launcher, with no shell or raw fallback', async () => {
    const result = await make()('git', ['status', '--short', '; echo do-not-execute'], {
      timeoutMs: 1000,
    });
    assert.deepEqual(JSON.parse(result), ['status', '--short', '; echo do-not-execute']);
    assert.throws(() => make({ environment: {} }), /agent-binding-required/);
  });

  it('should preserve useful sanitized errors and reject nonzero commands', async () => {
    const diagnostics = [];
    await assert.rejects(
      make({ diagnostic: (text) => diagnostics.push(text) })(
        'bun',
        [
          '-e',
          'console.error("lockfile mismatch secret-fixture token=other-secret"); process.exit(17)',
        ],
        { timeoutMs: 1000 },
      ),
      { exitCode: 17 },
    );
    assert.match(diagnostics.join(''), /lockfile mismatch/);
    assert.doesNotMatch(diagnostics.join(''), /secret-fixture|other-secret/);
  });

  it('should select the Node version probe without admitting other Node commands', async () => {
    await writeFile(join(root, 'node'), '#!/usr/bin/env bun\nconsole.log("v24.1.0");\n', {
      mode: 0o700,
    });
    const execute = make({
      environment: { PATH: `${root}:${process.env.PATH}`, AGENT_SYSTEM_GIT: launcher },
    });
    assert.equal((await execute('node', ['--version'], { timeoutMs: 1000 })).trim(), 'v24.1.0');
    await assert.rejects(
      make()('node', ['-e', 'throw new Error()'], { timeoutMs: 1000 }),
      /command-invalid/,
    );
  });

  it('should terminate an over-budget child group without retry', async () => {
    const diagnostics = [];
    let starts = 0;
    const execute = make({
      diagnostic: (text) => diagnostics.push(text),
      start: (...args) => {
        starts++;
        return spawn(...args);
      },
    });
    await assert.rejects(
      execute('bun', ['-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 50 }),
      /operation-failed/,
    );
    assert.equal(starts, 1);
    assert.match(diagnostics.join(''), /timeout/);
  });

  it('should refuse already cancelled work before starting a process', async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      make({ signal: controller.signal, start: () => assert.fail('spawned') })('git', ['status'], {
        timeoutMs: 1000,
      }),
    );
  });

  it('should keep the updater lock held by a child after its wrapper closes it', async () => {
    const controller = new AbortController();
    let started;
    const spawned = new Promise((resolve) => {
      started = resolve;
    });
    const execute = make({
      signal: controller.signal,
      start: (...args) => {
        const child = spawn(...args);
        child.once('spawn', started);
        return child;
      },
    });
    const pending = assert.rejects(
      execute('bun', ['-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 1000 }),
    );
    await spawned;
    await storage.close();
    await assert.rejects(openStorage(root), /update-run-active/);
    controller.abort();
    await pending;
    storage = await openStorage(root);
  });
});
