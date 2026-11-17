import assert from 'node:assert/strict';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { YAML } from 'bun';

import fixture from '../../update/test/tasks.fixture.js';
import readInventory from '../inventory.js';

describe('lib/update-shared-sources/inventory (filesystem component)', () => {
  let f;
  beforeEach(async () => {
    f = await fixture();
  });
  afterEach(async () => f.close());
  const save = (local, agent = 'emori') =>
    writeFile(
      join(f.workspace, '.agent-system/agent.yaml'),
      YAML.stringify({
        agent: { id: agent },
        github: { username: 'emoriwan' },
        git: { worktrees: { repositories: { local } } },
      }),
    );
  it('should select only configured Canon and Agent System roots, with Agent System last', async () => {
    await save({ ...f.local, smutlord: '/never-inspect-another-agent', extra: '/unrelated' });
    const sources = await readInventory(f.workspace);
    assert.deepEqual(
      sources.map((source) => source.id),
      ['canon', 'openclaw-agent-system'],
    );
    assert(sources.every((source) => source.status === 'candidate'));
  });
  it('should reject aliases, nested agent paths and missing configured roots', async () => {
    const alias = join(f.root, 'alias');
    await symlink(f.local.canon, alias);
    await save({ canon: alias, 'openclaw-agent-system': join(f.root, 'missing') });
    assert.deepEqual(
      (await readInventory(f.workspace)).map((source) => source.status),
      ['noncanonical', 'checkout-missing'],
    );
    await mkdir(join(f.workspace, 'child'));
    await save({ canon: join(f.workspace, 'child'), 'openclaw-agent-system': f.workspace });
    assert((await readInventory(f.workspace)).every((source) => source.status === 'noncanonical'));
  });
  it('should refuse an incorrect owner before inspecting shared sources', async () => {
    await save(f.local, 'other');
    await assert.rejects(readInventory(f.workspace), /workspace-identity-invalid/);
  });
});
