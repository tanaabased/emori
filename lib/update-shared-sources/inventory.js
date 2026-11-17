import { readFile, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve, sep } from 'node:path';

import { YAML } from 'bun';

/** Only the two declared shared sources are inspected, never another agent's workspace. */
export default async function readInventory(workspace, { home = homedir() } = {}) {
  const manifest = YAML.parse(await readFile(join(workspace, '.agent-system/agent.yaml'), 'utf8'));
  if (manifest?.agent?.id !== 'emori' || manifest?.github?.username !== 'emoriwan')
    throw new Error('workspace-identity-invalid');
  const local = manifest?.git?.worktrees?.repositories?.local;
  if (!local || typeof local !== 'object' || Array.isArray(local))
    throw new Error('inventory-invalid');
  return Promise.all(
    ['canon', 'openclaw-agent-system'].map(async (id) => {
      const configured = local[id];
      if (typeof configured !== 'string' || !configured.trim())
        return { id, status: 'checkout-missing' };
      const path = configured.startsWith('~/')
        ? resolve(home, configured.slice(2))
        : isAbsolute(configured)
          ? resolve(configured)
          : resolve(workspace, configured);
      if (
        path === workspace ||
        path.startsWith(`${workspace}${sep}`) ||
        workspace.startsWith(`${path}${sep}`)
      )
        return { id, status: 'noncanonical' };
      try {
        if ((await realpath(path)) !== path) return { id, status: 'noncanonical' };
        return { id, path, status: 'candidate' };
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return { id, status: 'checkout-missing' };
      }
    }),
  );
}
