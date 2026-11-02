import { readFile, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve, sep } from 'node:path';

import { YAML } from 'bun';

import selectSources from './utils/select-sources.js';

/** Read the owning workspace's manifest only; never visit excluded inventory entries. */
export default async function readInventory(workspace, { home = homedir() } = {}) {
  const manifest = YAML.parse(await readFile(join(workspace, '.agent-system/agent.yaml'), 'utf8'));
  if (manifest?.agent?.id !== 'emori' || manifest?.github?.username !== 'emoriwan')
    throw new Error('workspace-identity-invalid');
  const local = manifest?.git?.worktrees?.repositories?.local;
  if (!local || typeof local !== 'object' || Array.isArray(local))
    throw new Error('inventory-invalid');
  const expand = (path) =>
    typeof path === 'string'
      ? path.startsWith('~/')
        ? resolve(home, path.slice(2))
        : isAbsolute(path)
          ? resolve(path)
          : resolve(workspace, path)
      : undefined;
  const excluded = [
    workspace,
    ...Object.entries(local)
      .filter(([id]) => !['canon', 'openclaw-agent-system'].includes(id))
      .map(([, path]) => expand(path))
      .filter(Boolean),
  ];
  const sources = [];
  for (const source of selectSources(local)) {
    if (source.status !== 'candidate') {
      sources.push(source);
      continue;
    }
    const path = expand(source.path);
    if (
      excluded.some(
        (root) =>
          path === root || path.startsWith(`${root}${sep}`) || root.startsWith(`${path}${sep}`),
      )
    ) {
      sources.push({ id: source.id, status: 'path-excluded' });
      continue;
    }
    // Resolve only approved roots, not any excluded agent directory or its contents.
    try {
      if ((await realpath(path)) !== path) {
        sources.push({ id: source.id, status: 'noncanonical' });
        continue;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      sources.push({ id: source.id, status: 'checkout-missing' });
      continue;
    }
    sources.push({ ...source, path });
  }
  // Keep Agent System last so its sync cannot affect another source's commands.
  return sources.sort(
    (a, b) => Number(a.id === 'openclaw-agent-system') - Number(b.id === 'openclaw-agent-system'),
  );
}
