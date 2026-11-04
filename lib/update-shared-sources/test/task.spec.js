import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { YAML } from 'bun';

import openStorage from '../storage.js';
import runSourceTask from '../task.js';

describe('lib/update-shared-sources/task (filesystem component, injected commands)', () => {
  let root;
  let workspace;
  let output;
  let errors;
  let calls;
  let heads;
  const target = 'b'.repeat(40);
  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'source-task-')));
    workspace = join(root, 'emori');
    await mkdir(join(workspace, '.agent-system'), { recursive: true });
    const local = {
      'openclaw-agent-system': join(root, 'openclaw-agent-system'),
      canon: join(root, 'canon'),
      emori: workspace,
      smutlord: join(root, 'smutlord'),
    };
    await mkdir(local.smutlord, { recursive: true });
    await writeFile(join(local.smutlord, 'agent.yaml'), 'agent:\n  id: smutlord\n');
    for (const id of ['canon', 'openclaw-agent-system']) {
      await mkdir(join(local[id], '.git'), { recursive: true });
      await mkdir(join(local[id], 'node_modules'), { recursive: true });
      await mkdir(join(local[id], 'dist/codex'), { recursive: true });
      await writeFile(join(local[id], 'package.json'), '{}');
      await writeFile(join(local[id], 'bun.lock'), 'locked');
      for (const name of ['index', 'memory-secret-provider-entry', 'codex/codex-runtime'])
        for (const ext of ['.js', '.js.map'])
          await writeFile(join(local[id], 'dist', `${name}${ext}`), 'fixture');
    }
    await writeFile(
      join(workspace, '.agent-system/agent.yaml'),
      YAML.stringify({
        agent: { id: 'emori' },
        github: { username: 'emoriwan' },
        git: { worktrees: { repositories: { local } } },
      }),
    );
    output = '';
    errors = '';
    calls = [];
    heads = { canon: 'a'.repeat(40), 'openclaw-agent-system': target };
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));
  const commands =
    ({ cwd }) =>
    async (family, args) => {
      const id = cwd.split('/').at(-1);
      calls.push({ id, family, args });
      if (args[0] === '--version') return family === 'bun' ? '1.2.3' : 'v24.1.0';
      if (family === 'bun') return '';
      if (args[0] === 'rev-parse')
        return args.includes('--show-toplevel') ? cwd : args.at(-1) === 'HEAD' ? heads[id] : target;
      if (args[0] === 'branch') return 'main';
      if (args[0] === 'status' || args[0] === 'fetch') return '';
      if (args[0] === 'for-each-ref') return 'origin/main';
      if (args[0] === 'remote')
        return args.length === 1 ? 'origin' : `https://github.com/tanaabased/${id}.git`;
      if (args[0] === 'rev-list') return heads[id] === target ? '0\t0' : '0\t1';
      if (args[0] === 'ls-files') return 'package.json\0bun.lock\0';
      if (args[0] === 'merge') {
        heads[id] = args.at(-1);
        return '';
      }
      assert.fail(`unexpected ${family} command`);
    };
  const run = (options = {}) =>
    runSourceTask({
      cwd: workspace,
      commands,
      stdout: {
        write: (text) => {
          output += text;
        },
      },
      stderr: {
        write: (text) => {
          errors += text;
        },
      },
      ...options,
    });

  it('should wire real inventory, inspection, checkpoints and structured JSON with restart pending', async () => {
    assert.equal(await run(), 0);
    assert.equal(heads.canon, target);
    assert.match(output, /aaaaaaaaaaaa → bbbbbbbbbbbb/);
    assert.match(output, /Unchanged bbbbbbbbbbbb/);
    assert.match(output, /Gateway restart/);
    assert.match(output, /Automatic restart is disabled/);
    assert.equal(errors, '');
    assert.ok(calls.every((call) => ['canon', 'openclaw-agent-system'].includes(call.id)));
    assert.deepEqual(
      calls
        .filter((call) => call.family === 'bun' && call.args[0] !== '--version')
        .map(({ id, args }) => [id, args]),
      [
        ['canon', ['install', '--frozen-lockfile']],
        ['openclaw-agent-system', ['install', '--frozen-lockfile']],
        ['openclaw-agent-system', ['run', 'sync']],
      ],
    );
    const journal = JSON.parse(
      await readFile(join(workspace, '.private/update-shared-sources/latest.json')),
    );
    assert.equal(journal.finished, true);
    assert.deepEqual(journal.results.at(-1).pending, ['restart']);
    assert.ok(!JSON.stringify(journal).includes(root));
  });

  it('should preserve an earlier source failure and still run the independent source', async () => {
    assert.equal(
      await run({
        commands: (options) => {
          const execute = commands(options);
          return (family, args) => {
            if (options.cwd.endsWith('/canon') && family === 'bun')
              throw Object.assign(new Error('private'), { exitCode: 4 });
            return execute(family, args);
          };
        },
      }),
      1,
    );
    assert.equal(
      JSON.parse(output).cards.find(({ id }) => id === 'shared-source:canon').status,
      'error',
    );
    assert.match(output, /aaaaaaaaaaaa → bbbbbbbbbbbb/);
    assert.equal(
      JSON.parse(output)
        .cards.find(({ id }) => id === 'shared-source:openclaw-agent-system')
        .facts.find(({ label }) => label === 'Build and sync shared tools').value,
      'Complete',
    );
    assert.doesNotMatch(output + errors, /private/);
  });

  it('should retain activation across successful reuse and a failed partial sync', async () => {
    assert.equal(await run(), 0);
    calls.length = 0;
    output = '';
    assert.equal(await run(), 0);
    assert.ok(!calls.some(({ args }) => args[0] === 'run'));
    assert.match(output, /running build unverified/);
    await writeFile(join(root, 'openclaw-agent-system/dist/index.js'), 'stale');
    const failedCommands = (options) => {
      const execute = commands(options);
      return (family, args) => {
        if (args[0] === 'run') throw new Error('partial sync');
        return execute(family, args);
      };
    };
    assert.equal(await run({ commands: failedCommands }), 1);
    const state = JSON.parse(
      await readFile(join(workspace, '.private/update-shared-sources/latest.json')),
    );
    const agent = state.results.find(({ id }) => id === 'openclaw-agent-system');
    assert.equal(agent.build, undefined);
    assert.deepEqual(agent.pending, ['restart']);
    calls.length = 0;
    assert.equal(await run(), 0);
    assert.ok(calls.some(({ args }) => args[0] === 'run'));
  });

  it('should retain another source activation debt when cancelled before processing it', async () => {
    await run();
    const controller = new AbortController();
    assert.equal(
      await run({
        signal: controller.signal,
        commands: (options) => {
          const execute = commands(options);
          return async (family, args) => {
            const result = await execute(family, args);
            if (options.cwd.endsWith('/canon') && args[0] === 'install') controller.abort();
            return result;
          };
        },
      }),
      1,
    );
    const state = JSON.parse(
      await readFile(join(workspace, '.private/update-shared-sources/latest.json')),
    );
    const agent = state.results.find(({ id }) => id === 'openclaw-agent-system');
    assert.equal(state.finished, false);
    assert.equal(agent.status, 'pending');
    assert.deepEqual(agent.pending, ['restart']);
    calls.length = 0;
    assert.equal(await run(), 0);
    assert.ok(!calls.some(({ args }) => args[0] === 'run'));
  });

  it('should rebuild a missing artifact and report success without rerunning updates for delivery', async () => {
    await run();
    const artifact = join(root, 'openclaw-agent-system/dist/index.js');
    await rm(artifact);
    calls.length = 0;
    assert.equal(
      await run({
        commands: (options) => {
          const execute = commands(options);
          return async (family, args) => {
            if (args[0] === 'run') await writeFile(artifact, 'rebuilt');
            return execute(family, args);
          };
        },
      }),
      0,
    );
    assert.ok(calls.some(({ args }) => args[0] === 'run'));
    output = '';
    assert.equal(
      await run({ argv: ['--report-only'], commands: () => assert.fail('updates rerun') }),
      0,
    );
    assert.match(output, /running build unverified/);
    const report = JSON.parse(output);
    assert.ok(
      !report.cards.some(({ id }) =>
        ['shared-source:emori', 'shared-source:smutlord'].includes(id),
      ),
    );
  });

  it('should render retained partial facts without rerunning commands', async () => {
    const storage = await openStorage(workspace);
    await storage.write({
      version: 1,
      finished: false,
      results: [{ id: 'canon', status: 'pending', steps: ['advanced'], pending: [] }],
    });
    await storage.close();
    assert.equal(
      await run({
        argv: ['--report-only'],
        commands: () => assert.fail('command boundary called'),
      }),
      1,
    );
    assert.match(output, /previous interrupted (?:source )?update/);
    assert.match(output, /after unknown/);
    assert.match(output, /unfinished steps are unverified/);
    assert.equal(
      JSON.parse(output).cards.filter(({ id }) => id === 'shared-source:canon').length,
      1,
    );
    assert.doesNotMatch(output, /## UPDATE SHARED SOURCES/);
  });

  it('should retain an interrupted predecessor and freshly inspect before a new update', async () => {
    const storage = await openStorage(workspace);
    await storage.write({
      version: 1,
      finished: false,
      results: [
        { id: 'canon', status: 'pending', phase: 'advance', steps: ['fetched'], pending: [] },
      ],
    });
    await storage.close();
    await run();
    const previous = JSON.parse(
      await readFile(join(workspace, '.private/update-shared-sources/previous.json')),
    );
    assert.equal(previous.finished, false);
    assert.deepEqual(previous.results[0].steps, ['fetched']);
    assert.match(output, /previous interrupted (?:source )?update/);
    assert.equal(
      JSON.parse(output).cards.filter(({ id }) => id === 'shared-source:canon').length,
      1,
    );
    assert.equal(JSON.parse(output).cards[0].id, 'shared-source:canon');
    assert.equal(
      JSON.parse(output).cards.find(({ id }) => id === 'shared-source:canon').status,
      'success',
    );
    assert.ok(calls.find((call) => call.id === 'canon').args.includes('--show-toplevel'));
  });

  it('should emit structured JSON for argument and cleanup failures without losing successes', async () => {
    assert.equal(await run({ argv: ['--unsafe'] }), 1);
    assert.equal(JSON.parse(output).cards[0].status, 'error');
    assert.equal(calls.length, 0);
    output = '';
    assert.equal(
      await run({
        open: async (path) => {
          const storage = await openStorage(path);
          return {
            ...storage,
            close: async () => {
              await storage.close();
              throw new Error('secret');
            },
          };
        },
      }),
      1,
    );
    assert.equal(
      JSON.parse(output)
        .cards.find(({ id }) => id === 'shared-source:openclaw-agent-system')
        .facts.find(({ label }) => label === 'Build and sync shared tools').value,
      'Complete',
    );
    assert.match(output, /Journal cleanup failed/);
    assert.doesNotMatch(output + errors, /secret/);
  });
});
