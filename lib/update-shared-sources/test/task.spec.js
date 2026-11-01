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
      smutlord: '/not-readable',
    };
    for (const id of ['canon', 'openclaw-agent-system'])
      await mkdir(join(local[id], '.git'), { recursive: true });
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

  it('should wire real inventory, inspection, checkpoints and Markdown with restart pending', async () => {
    assert.equal(await run(), 1);
    assert.equal(heads.canon, target);
    assert.match(output, /Advanced fast-forward/);
    assert.match(output, /Revision unchanged/);
    assert.match(output, /Gateway restart/);
    assert.match(output, /Automatic restart is disabled/);
    assert.equal(errors, '');
    assert.ok(calls.every((call) => ['canon', 'openclaw-agent-system'].includes(call.id)));
    assert.deepEqual(
      calls.filter((call) => call.family === 'bun').map(({ id, args }) => [id, args]),
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
    assert.match(output, /canon: failed/);
    assert.match(output, /Advanced fast-forward/);
    assert.match(output, /Agent System sync completed/);
    assert.doesNotMatch(output + errors, /private/);
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
    assert.match(output, /Interrupted source update/);
    assert.match(output, /Advanced fast-forward/);
    assert.match(output, /unfinished steps are unverified/);
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
    assert.match(output, /Interrupted source update/);
    assert.ok(calls.find((call) => call.id === 'canon').args.includes('--show-toplevel'));
  });

  it('should emit Markdown for argument and cleanup failures without losing successes', async () => {
    assert.equal(await run({ argv: ['--unsafe'] }), 1);
    assert.match(output, /## Shared-source update/);
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
    assert.match(output, /Agent System sync completed/);
    assert.match(output, /Journal cleanup failed/);
    assert.doesNotMatch(output + errors, /secret/);
  });
});
