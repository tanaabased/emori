import { statSync } from 'node:fs';
import { isAbsolute, join, normalize, resolve, sep } from 'node:path';

import { parseJson, run } from './command.js';
import { enablePlugin, inspectPlugin, installPlugin, pluginInspectionHealthy } from './plugin.js';

export const canonSkillName = 'tanaab-project-optimizer';

const extraDirsPath = 'skills.load.extraDirs';

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

export function configPathUnset(result, path) {
  if (result.status === 0) return false;
  try {
    const output = JSON.parse(result.stdout);
    return output?.error?.message?.startsWith(`Config path is valid but unset: ${path}.`) === true;
  } catch {
    return false;
  }
}

function readExtraDirs() {
  const result = run('openclaw', ['config', 'get', extraDirsPath, '--json'], {
    allowFailure: true,
  });
  if (configPathUnset(result, extraDirsPath)) return null;
  if (result.status !== 0)
    throw new Error('OpenClaw skill discovery configuration is unavailable.');

  const extraDirs = parseJson(result.stdout, `openclaw config get ${extraDirsPath}`);
  if (!Array.isArray(extraDirs)) throw new Error('OpenClaw extra skill directories are invalid.');
  return extraDirs;
}

function configuredPath(path, home) {
  if (path === '~') return resolve(home);
  if (path.startsWith('~/')) return resolve(home, path.slice(2));
  return isAbsolute(path) ? resolve(path) : null;
}

export function withoutCanonSkillDir(extraDirs, canon, home) {
  const canonSkills = resolve(canon, 'skills');
  return extraDirs.filter(
    (path) => typeof path !== 'string' || configuredPath(path, home) !== canonSkills,
  );
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
    canonSkillInspectionHealthy(inspectSkill(canonSkillName)) &&
    readExtraDirs() === null
  );
}

export function applyCanonPlugin() {
  const canon = requireCanon();
  if (!canonPluginInspectionHealthy(inspectPlugin('tanaab'), canon)) {
    installPlugin(canon, { force: true, link: true });
  }
  enablePlugin('tanaab');

  const extraDirs = readExtraDirs();
  if (extraDirs === null) return;

  const retainedDirs = withoutCanonSkillDir(extraDirs, canon, process.env.HOME);
  if (retainedDirs.length === extraDirs.length) return;
  if (retainedDirs.length === 0) {
    run('openclaw', ['config', 'unset', extraDirsPath]);
    return;
  }
  run('openclaw', [
    'config',
    'set',
    extraDirsPath,
    JSON.stringify(retainedDirs),
    '--strict-json',
    '--expect-current-json',
    JSON.stringify(extraDirs),
  ]);
}
