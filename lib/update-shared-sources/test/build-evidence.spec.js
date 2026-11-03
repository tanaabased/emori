import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import buildEvidence from '../build-evidence.js';

describe('lib/update-shared-sources/build-evidence (filesystem component)', () => {
  let root;
  let input;
  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'build-evidence-')));
    await mkdir(join(root, 'node_modules/fixture'), { recursive: true });
    await mkdir(join(root, 'dist/codex'), { recursive: true });
    await writeFile(join(root, 'package.json'), '{}');
    await writeFile(join(root, 'bun.lock'), 'fixture-lock');
    await writeFile(join(root, 'node_modules/fixture/index.js'), 'original');
    await symlink('./fixture', join(root, 'node_modules/alias'));
    for (const name of ['index', 'memory-secret-provider-entry', 'codex/codex-runtime'])
      for (const extension of ['.js', '.js.map'])
        await writeFile(join(root, 'dist', `${name}${extension}`), 'built');
    input = {
      source: { path: root },
      head: 'a'.repeat(40),
      files: ['package.json', 'bun.lock', ''],
      execute: async (family) => (family === 'bun' ? '1.2.3' : 'v24.1.0'),
      budget: () => ({ timeoutMs: 1000 }),
    };
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it('should fingerprint stable content and reject changed source, runtime, lock or dependencies', async () => {
    const initial = await buildEvidence(input);
    assert.deepEqual(await buildEvidence(input), initial);
    assert.notEqual(
      (await buildEvidence({ ...input, head: 'b'.repeat(40) })).inputs,
      initial.inputs,
    );
    assert.notEqual(
      (
        await buildEvidence({
          ...input,
          execute: async (family) => (family === 'bun' ? '1.2.4' : 'v24.1.0'),
        })
      ).inputs,
      initial.inputs,
    );
    assert.notEqual(
      (
        await buildEvidence({
          ...input,
          execute: async (family) => (family === 'bun' ? '1.2.3' : 'v24.2.0'),
        })
      ).inputs,
      initial.inputs,
    );
    await writeFile(join(root, 'bun.lock'), 'different-lock');
    const locked = await buildEvidence(input);
    assert.notEqual(locked.inputs, initial.inputs);
    await writeFile(join(root, 'node_modules/fixture/index.js'), 'mutated!');
    assert.notEqual((await buildEvidence(input)).inputs, locked.inputs);
    assert.ok(!JSON.stringify(initial).includes(root));
  });

  it('should distinguish modified, missing and empty artifacts from a reusable build', async () => {
    const initial = await buildEvidence(input);
    await writeFile(join(root, 'dist/index.js'), 'changed');
    assert.notEqual((await buildEvidence(input)).artifacts, initial.artifacts);
    await rm(join(root, 'dist/codex/codex-runtime.js'));
    assert.equal((await buildEvidence(input)).artifacts, null);
    await writeFile(join(root, 'dist/codex/codex-runtime.js'), '');
    assert.equal((await buildEvidence(input)).artifacts, null);
  });

  it('should refuse links outside dependency inputs and never read linked artifacts', async () => {
    await symlink(tmpdir(), join(root, 'node_modules/external'));
    await assert.rejects(buildEvidence(input), /build-evidence-invalid/);
    await rm(join(root, 'node_modules/external'));
    await rm(join(root, 'dist'), { recursive: true });
    await symlink(tmpdir(), join(root, 'dist'));
    await assert.rejects(buildEvidence(input), /build-evidence-unsafe/);
  });

  it('should propagate the shared deadline and failed runtime commands rather than infer reuse', async () => {
    await assert.rejects(
      buildEvidence({
        ...input,
        budget: () => {
          throw new Error('deadline-exceeded');
        },
      }),
      /deadline-exceeded/,
    );
    await assert.rejects(
      buildEvidence({
        ...input,
        execute: async () => {
          throw new Error('command-failed');
        },
      }),
      /command-failed/,
    );
  });
});
