import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { YAML } from 'bun';

import readInventory from '../inventory.js';

describe('lib/update-shared-sources/inventory (filesystem component)', () => {
  let root;
  let workspace;
  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'source-inventory-')));
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

  it('should resolve configured sources, omit agent workspaces, and place Agent System last', async () => {
    await mkdir(join(root, 'canon'));
    await mkdir(join(root, 'system'));
    await mkdir(join(root, 'extra'));
    await mkdir(join(root, 'smutlord'));
    await writeFile(join(root, 'smutlord', 'agent.yaml'), 'agent:\n  id: smutlord\n');
    await save({
      'openclaw-agent-system': '~/system',
      canon: '../canon',
      emori: workspace,
      smutlord: '~/smutlord',
      extra: '~/extra',
    });
    const sources = await readInventory(workspace, { home: root });
    assert.deepEqual(
      sources.map(({ id }) => id),
      ['canon', 'extra', 'openclaw-agent-system'],
    );
    assert.equal(sources.at(-1).id, 'openclaw-agent-system');
    assert.equal(sources.find((s) => s.id === 'canon').path, join(root, 'canon'));
    assert.equal(sources.find((s) => s.id === 'extra').path, join(root, 'extra'));
  });

  it('should omit agent workspaces and configured descendants', async () => {
    const agent = join(root, 'agent');
    await mkdir(join(agent, '.agent-system'), { recursive: true });
    await mkdir(join(agent, 'child'), { recursive: true });
    await writeFile(join(agent, '.agent-system/agent.yaml'), 'agent:\n  id: other-agent\n');
    await save({ child: join(agent, 'child'), agent });
    assert.deepEqual(await readInventory(workspace), []);
  });

  it('should reject symlink aliases and visibly account for absent sources', async () => {
    await symlink(workspace, join(root, 'canon'));
    await save({ canon: '../canon', 'openclaw-agent-system': '../absent' });
    const sources = await readInventory(workspace);
    assert.deepEqual(sources, [{ id: 'openclaw-agent-system', status: 'checkout-missing' }]);
  });

  it('should refuse another owning identity', async () => {
    await save({}, 'other');
    await assert.rejects(readInventory(workspace), /workspace-identity-invalid/);
  });
});
