import { access, readFile, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve, sep } from 'node:path';

import { YAML } from 'bun';

import selectSources from './utils/select-sources.js';

const agentManifests = ['agent.yaml', '.agent-system/agent.yaml'];

async function hasAgentManifest(path) {
  for (const manifest of agentManifests) {
    try {
      await access(join(path, manifest));
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    }
  }
  return false;
}

/** Read the owning manifest and inspect configured roots only for Agent System markers. */
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
  const sources = [];
  for (const source of selectSources(local)) {
    if (source.status !== 'candidate') {
      sources.push(source);
      continue;
    }
    const path = expand(source.path);
    if (
      path === workspace ||
      path.startsWith(`${workspace}${sep}`) ||
      workspace.startsWith(`${path}${sep}`)
    )
      continue;
    // Resolve configured roots before reading only their manifest marker.
    try {
      const canonical = await realpath(path);
      if (
        canonical === workspace ||
        canonical.startsWith(`${workspace}${sep}`) ||
        workspace.startsWith(`${canonical}${sep}`)
      )
        continue;
      if (canonical !== path) {
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
  const agentRoots = [];
  for (const source of sources) {
    if (source.status === 'candidate' && (await hasAgentManifest(source.path)))
      agentRoots.push(source.path);
  }
  const reportable = sources.filter(
    (source) =>
      typeof source.path !== 'string' ||
      !agentRoots.some(
        (root) =>
          source.path === root ||
          source.path.startsWith(`${root}${sep}`) ||
          root.startsWith(`${source.path}${sep}`),
      ),
  );
  // Keep Agent System last so its sync cannot affect another source's commands.
  return reportable.sort(
    (a, b) => Number(a.id === 'openclaw-agent-system') - Number(b.id === 'openclaw-agent-system'),
  );
}
