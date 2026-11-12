import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { enablePlugin, inspectPlugin, installPlugin, pluginInspectionHealthy } from './plugin.js';

export { configPathUnset } from './config.js';

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

export function canonPluginInspectionHealthy(inspection, canon) {
  return (
    pluginInspectionHealthy(inspection, 'tanaab') &&
    inspection.plugin.status === 'loaded' &&
    inspection.plugin.rootDir === canon &&
    inspection.install?.source === 'path' &&
    inspection.install.sourcePath === canon &&
    Array.isArray(inspection.install.acceptedSurface?.skills) &&
    inspection.install.acceptedSurface.skills.length > 0
  );
}

export function checkCanonPlugin() {
  const canon = requireCanon();
  return canonPluginInspectionHealthy(inspectPlugin('tanaab'), canon);
}

export function applyCanonPlugin() {
  const canon = requireCanon();
  if (!canonPluginInspectionHealthy(inspectPlugin('tanaab'), canon)) {
    installPlugin(canon, { force: true, link: true });
  }
  enablePlugin('tanaab');
}
