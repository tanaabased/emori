import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import packageJson from '../../../package.json' with { type: 'json' };
import runUpdateTask from '../task.js';
import updateStorage from '../storage.js';

describe('lib/update-agent/update-flow (filesystem component)', () => {
  it('should finish with real checkpoints and preloaded code after self-update replaces source files', async () => {
    const workspace = await realpath(await mkdtemp(join(tmpdir(), 'emori-update-flow-')));
    const runPath = join(workspace, 'run.mjs');
    const commandsPath = join(workspace, 'commands.mjs');
    const calls = [];
    const output = { stdout: '', stderr: '' };
    const target = 'b'.repeat(40);
    let head = 'a'.repeat(40);
    try {
      await writeFile(runPath, await readFile(new URL('../run.js', import.meta.url), 'utf8'));
      await writeFile(
        commandsPath,
        await readFile(new URL('../commands.js', import.meta.url), 'utf8'),
      );
      const { default: run } = await import(pathToFileURL(runPath).href);
      const { default: commands } = await import(pathToFileURL(commandsPath).href);
      const exit = await runUpdateTask({
        cwd: workspace,
        runtimeVersion: packageJson.packageManager.slice(4),
        canonicalize: async () => workspace,
        open: updateStorage,
        run,
        commands: (options) =>
          commands({
            ...options,
            environment: {
              AGENT_SYSTEM_GIT: '/fixture/managed-git',
              PRIVATE_VALUE: 'must-not-persist',
            },
            spawn: (command, argv, options) => {
              calls.push([command, ...argv]);
              assert.equal(options.cwd, workspace);
              assert.equal(options.stdio.length, 5);
              let stdout = '';
              if (argv[0] === 'rev-parse')
                stdout =
                  argv[1] === '--show-toplevel'
                    ? workspace
                    : argv[1] === '--absolute-git-dir'
                      ? join(workspace, '.git')
                      : target;
              if (argv[0] === 'status')
                stdout = `# branch.oid ${head}\n# branch.head main\n# branch.upstream origin/main\n`;
              if (argv[0] === 'remote') stdout = 'git@github.com:tanaabased/emori.git';
              if (argv[0] === 'merge') {
                assert.deepEqual(argv, ['merge', '--ff-only', '--no-edit', target]);
                head = target;
                writeFileSync(
                  runPath,
                  'throw new Error("new runner must wait for the next occurrence");',
                );
                writeFileSync(
                  commandsPath,
                  'throw new Error("new commands must wait for the next occurrence");',
                );
              }
              if (argv.includes('--skip-setup'))
                stdout = JSON.stringify({
                  agentId: 'emori',
                  workspaceDir: workspace,
                  outcomes: [],
                  warnings: [],
                });
              if (argv.includes('doctor')) stdout = JSON.stringify({ status: 'healthy' });
              return { status: 0, stdout, stderr: '' };
            },
          }),
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
      });
      assert.equal(exit, 0);
      assert.match(output.stdout, /Agent update completed/);
      assert.equal(output.stderr, '');
      const saved = await readFile(join(workspace, '.private/update-agent/status.json'), 'utf8');
      const result = JSON.parse(saved);
      assert.equal(result.after, target);
      assert.equal(result.pending, undefined);
      assert.equal(result.steps.install.status, 'completed');
      assert.equal(result.steps.doctor.status, 'completed');
      assert.equal(result.loaded, undefined);
      assert.ok(!saved.includes('must-not-persist'));
      assert.deepEqual(
        calls.filter(([command]) => command !== '/fixture/managed-git'),
        [
          ['bun', 'install', '--frozen-lockfile', '--ignore-scripts'],
          ['openclaw', 'agent-system', 'install', '--skip-setup', '--json'],
          ['openclaw', 'agent-system', 'doctor', '--json'],
        ],
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
