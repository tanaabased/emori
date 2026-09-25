import { statSync } from 'node:fs';
import { join, normalize, resolve, sep } from 'node:path';

import { parseJson, run } from './command.js';
import { enablePlugin, inspectPlugin, installPlugin, pluginInspectionHealthy } from './plugin.js';

export { configPathUnset } from './config.js';

export const canonSkillName = 'tanaab-project-optimizer';

function canonPath() {
  const home = process.env.HOME;
  if (!home) throw new Error('HOME is unavailable.');
  return resolve(home, 'tanaab', 'canon');
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function requireCanon() {
  const canon = canonPath();
  if (!isDirectory(join(canon, '.git'))) throw new Error('Canon is not ready.');
  return canon;
}

function inspectSkill(name) {
  const result = run('openclaw', ['skills', 'info', name, '--agent', 'emori', '--json'], {
    allowFailure: true,
  });
  return result.status === 0 ? parseJson(result.stdout, `openclaw skills info ${name}`) : null;
}

export function canonPluginInspectionHealthy(inspection, canon) {
  return (
    pluginInspectionHealthy(inspection, 'tanaab') &&
    inspection.plugin.rootDir === canon &&
    inspection.install?.source === 'path' &&
    inspection.install.sourcePath === canon &&
    inspection.install.acceptedSurface?.skills?.includes('./skills') === true
  );
}

export function canonSkillInspectionHealthy(inspection, name = canonSkillName) {
  const pathSegments =
    typeof inspection?.filePath === 'string' ? normalize(inspection.filePath).split(sep) : [];
  return (
    inspection?.name === name &&
    inspection.eligible === true &&
    inspection.disabled === false &&
    pathSegments.includes('plugin-skills')
  );
}

export function checkCanonPlugin() {
  const canon = requireCanon();
  return (
    canonPluginInspectionHealthy(inspectPlugin('tanaab'), canon) &&
    canonSkillInspectionHealthy(inspectSkill(canonSkillName))
  );
}

export function applyCanonPlugin() {
  const canon = requireCanon();
  if (!canonPluginInspectionHealthy(inspectPlugin('tanaab'), canon)) {
    installPlugin(canon, { force: true, link: true });
  }
  enablePlugin('tanaab');
}
