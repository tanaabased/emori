import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { enablePlugin, inspectPlugin, installPlugin, pluginInspectionHealthy } from './plugin.js';

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

export function checkCanonPlugin() {
  requireCanon();
  return pluginInspectionHealthy(inspectPlugin('tanaab'), 'tanaab');
}

export function applyCanonPlugin() {
  const canon = requireCanon();
  if (!inspectPlugin('tanaab')) installPlugin(canon, { force: true, link: true });
  enablePlugin('tanaab');
}
