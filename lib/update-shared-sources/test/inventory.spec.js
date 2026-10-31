import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { YAML } from 'bun';

import readInventory from '../inventory.js';

describe('lib/update-shared-sources/inventory (filesystem component)', () => {
  let root;
  let workspace;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'source-inventory-'));
    workspace = join(root, 'emori');
    await mkdir(join(workspace, '.agent-system'), { recursive: true });
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));
  const save = (local, agent = 'emori') =>
    writeFile(
      join(workspace, '.agent-system/agent.yaml'),
      YAML.stringify({
        agent: { id: agent },
        github: { username: 'emoriwan' },
        git: { worktrees: { repositories: { local } } },
      }),
    );

  it('should resolve the manifest inventory and place Agent System last', async () => {
    await mkdir(join(root, 'canon'));
    await mkdir(join(root, 'system'));
    await save({
      'openclaw-agent-system': '~/system',
      canon: '../canon',
      emori: workspace,
      smutlord: '/not-readable',
    });
    const sources = await readInventory(workspace, { home: root });
    assert.equal(sources.at(-1).id, 'openclaw-agent-system');
    assert.equal(sources.find((s) => s.id === 'canon').path, join(root, 'canon'));
    assert.equal(sources.find((s) => s.id === 'smutlord').path, undefined);
  });

  it('should exclude aliases and descendants of agent roots without opening them', async () => {
    await save({ canon: '/not-readable/agent/child', smutlord: '/not-readable/agent' });
    assert.equal(
      (await readInventory(workspace)).find((s) => s.id === 'canon').status,
      'path-excluded',
    );
  });

  it('should reject symlink aliases and visibly account for absent sources', async () => {
    await symlink(workspace, join(root, 'canon'));
    await save({ canon: '../canon', 'openclaw-agent-system': '../absent' });
    const sources = await readInventory(workspace);
    assert.equal(sources[0].status, 'noncanonical');
    assert.equal(sources[1].status, 'checkout-missing');
  });

  it('should refuse another owning identity', async () => {
    await save({}, 'other');
    await assert.rejects(readInventory(workspace), /workspace-identity-invalid/);
  });
});
