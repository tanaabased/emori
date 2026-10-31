import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import inspectSource from '../inspect.js';

describe('lib/update-shared-sources/inspect (filesystem component, injected Git)', () => {
  let root;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'source-inspect-'));
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));
  it('should reject task worktrees before any Git command', async () => {
    await writeFile(join(root, '.git'), 'gitdir: /elsewhere');
    assert.deepEqual(
      await inspectSource({
        source: { path: root },
        execute: () => assert.fail('Git called'),
        timeoutMs: 1000,
      }),
      { canonical: false },
    );
  });
  it('should inspect untracked files, branch, identity and the complete origin URL set', async () => {
    await mkdir(join(root, '.git'));
    const calls = [];
    const snapshot = await inspectSource({
      source: { path: root },
      timeoutMs: 1000,
      execute: async (family, args, options) => {
        assert.equal(family, 'git');
        assert.ok(options.timeoutMs > 0 && options.timeoutMs <= 1000);
        calls.push(args);
        return {
          'rev-parse --show-toplevel': root,
          'branch --show-current': 'main',
          'status --porcelain=v1 --untracked-files=all': '?? keep-me',
          'rev-parse --verify HEAD': 'a'.repeat(40),
          'for-each-ref --format=%(upstream:short) refs/heads/main': 'origin/main',
          remote: 'origin',
          'remote get-url --all origin': 'https://github.com/tanaabased/canon.git',
        }[args.join(' ')];
      },
    });
    assert.equal(snapshot.canonical, true);
    assert.equal(snapshot.clean, false);
    assert.equal(snapshot.branch, 'main');
    assert.equal(snapshot.upstream, 'origin/main');
    assert.ok(calls.some((args) => args.includes('--all')));
    assert.equal(Object.hasOwn(snapshot, 'reserved'), false);
  });
});
