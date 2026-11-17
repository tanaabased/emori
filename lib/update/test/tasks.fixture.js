import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { YAML } from 'bun';

export default async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'nightly updates ')));
  const workspace = join(root, 'emori');
  const local = Object.fromEntries(
    ['canon', 'openclaw-agent-system', 'emori'].map((id) => [id, join(root, id)]),
  );
  for (const path of Object.values(local)) await mkdir(join(path, '.git'), { recursive: true });
  await mkdir(join(workspace, '.agent-system'));
  await writeFile(
    join(workspace, '.agent-system/agent.yaml'),
    YAML.stringify({
      agent: { id: 'emori' },
      github: { username: 'emoriwan' },
      git: { worktrees: { repositories: { local } } },
    }),
  );
  const states = Object.fromEntries(
    Object.keys(local).map((id) => [id, { head: 'a'.repeat(40), target: 'b'.repeat(40) }]),
  );
  const calls = [];
  const failures = {};
  const native = {
    install: {
      outcomes: [],
      warnings: [{ code: 'setup-skipped', message: 'Setup intentionally skipped.' }],
    },
    doctor: { status: 'healthy', findings: [] },
  };
  const commands =
    ({ cwd, signal }) =>
    async (family, argv) => {
      signal?.throwIfAborted();
      const id = cwd.split('/').at(-1);
      const key = argv.join(' ');
      const failureKey = `${family} ${key}`;
      calls.push({ id, family, argv });
      if (failures[id]?.[failureKey]) throw failures[id][failureKey];
      const state = states[id];
      if (family === 'openclaw') return JSON.stringify(native[argv[1]]);
      if (family === 'bun') return '';
      if (key === 'rev-parse --show-toplevel') return cwd;
      if (key === 'branch --show-current') return state.branch ?? 'main';
      if (argv[0] === 'status')
        return `# branch.oid ${state.head}\n# branch.head ${state.branch === '' ? '(detached)' : (state.branch ?? 'main')}\n# branch.upstream origin/main\n${state.dirty ? '? local-work' : ''}`;
      if (key === 'rev-parse --verify HEAD') return state.head;
      if (argv[0] === 'for-each-ref') return 'origin/main';
      if (key === 'remote') return 'origin';
      if (argv[0] === 'remote') return state.remote ?? `git@github.com:tanaabased/${id}.git`;
      if (argv[0] === 'fetch') return '';
      if (key === 'rev-parse --verify refs/remotes/origin/main') return state.target;
      if (argv[0] === 'rev-list')
        return state.counts ?? (state.head === state.target ? '0 0' : '0 1');
      if (argv[0] === 'merge') {
        state.head = argv.at(-1);
        return '';
      }
      throw new Error(`Unexpected fixture command: ${key}`);
    };
  const run = async (task, options = {}) => {
    let output = '';
    const exitCode = await task({
      cwd: workspace,
      canonicalize: async () => workspace,
      commands,
      environment: { AGENT_SYSTEM_GIT: '/fixture/managed-git' },
      stdout: {
        write: (text) => {
          output += text;
        },
      },
      stderr: { write() {} },
      ...options,
    });
    const document = JSON.parse(output);
    return { exitCode, document, body: document.cards[0].body };
  };
  return {
    root,
    workspace,
    local,
    states,
    calls,
    failures,
    native,
    commands,
    run,
    close: () => rm(root, { recursive: true, force: true }),
  };
}
