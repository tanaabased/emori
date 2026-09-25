import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { sqliteVectorPackage } from './brew-dependencies.js';
import { parseJson, run } from './command.js';
import { readConfigValue } from './config.js';

const agentId = 'emori';
const configFragmentPath = new URL('../../openclaw.patch.json', import.meta.url);
const configSections = ['agents', 'bindings', 'channels', 'hooks', 'skills', 'tools'];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, label) {
  if (!isObject(value)) throw new Error(`${label} is invalid.`);
  return value;
}

function requireStringArray(value, label, fallback = []) {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new Error(`${label} must be an array of strings.`);
  }
  return value;
}

function configuredPath(path, home) {
  if (path === '~') return resolve(home);
  if (path.startsWith('~/')) return resolve(home, path.slice(2));
  return isAbsolute(path) ? resolve(path) : null;
}

function isOwnedImessageRoute(binding) {
  if (!isObject(binding) || ![undefined, 'route'].includes(binding.type)) return false;
  if (!isObject(binding.match)) return false;
  return (
    binding.match.channel === 'imessage' &&
    binding.match.accountId === agentId &&
    Object.keys(binding.match).every((key) => ['accountId', 'channel'].includes(key))
  );
}

function mergeUniqueStrings(current, desired) {
  return [...new Set([...current, ...desired])];
}

export function loadOpenClawConfigFragment(path = configFragmentPath) {
  return requireObject(
    parseJson(readFileSync(path, 'utf8'), 'openclaw.patch.json'),
    'EMORI OpenClaw config fragment',
  );
}

export function sqliteVectorExtensionPath(
  globalNpmRoot,
  platform = process.platform,
  arch = process.arch,
) {
  return resolve(globalNpmRoot.trim(), sqliteVectorPackage(platform, arch), 'vec0.dylib');
}

export function withoutCanonSkillDir(extraDirs, canon, home) {
  const canonSkills = resolve(canon, 'skills');
  return extraDirs.filter((path) => configuredPath(path, home) !== canonSkills);
}

export function nextImessageBindings(bindings, desiredRoute) {
  let routeAdded = false;
  const next = [];
  for (const binding of bindings) {
    if (!isOwnedImessageRoute(binding)) {
      next.push(binding);
      continue;
    }
    if (routeAdded) continue;
    const route = { ...binding, ...desiredRoute, match: { ...desiredRoute.match } };
    delete route.session;
    next.push(route);
    routeAdded = true;
  }
  if (!routeAdded) next.push(structuredClone(desiredRoute));
  return next;
}

export function buildOpenClawConfigPatch(fragment, current, options) {
  const patch = structuredClone(requireObject(fragment, 'EMORI OpenClaw config fragment'));
  const currentTools = current?.agents?.entries?.[agentId]?.tools;
  if (currentTools !== undefined) requireObject(currentTools, 'OpenClaw EMORI tools config');

  const patchTools = requireObject(
    patch?.agents?.entries?.[agentId]?.tools,
    'EMORI OpenClaw tools fragment',
  );
  patchTools.alsoAllow = mergeUniqueStrings(
    requireStringArray(currentTools?.alsoAllow, 'OpenClaw EMORI additional tool grants'),
    requireStringArray(patchTools.alsoAllow, 'EMORI additional tool grants'),
  );

  const currentModelPolicy = current?.agents?.entries?.[agentId]?.modelPolicy;
  if (currentModelPolicy !== undefined) {
    requireObject(currentModelPolicy, 'OpenClaw EMORI model policy');
  }
  const patchModelPolicy = requireObject(
    patch?.agents?.entries?.[agentId]?.modelPolicy,
    'EMORI model policy fragment',
  );
  patchModelPolicy.allow = mergeUniqueStrings(
    requireStringArray(currentModelPolicy?.allow, 'OpenClaw EMORI model allowlist'),
    requireStringArray(patchModelPolicy.allow, 'EMORI model allowlist'),
  );

  const currentBindings = current?.bindings ?? [];
  if (!Array.isArray(currentBindings)) throw new Error('OpenClaw bindings are invalid.');
  if (!Array.isArray(patch.bindings) || patch.bindings.length !== 1) {
    throw new Error('EMORI OpenClaw bindings fragment is invalid.');
  }
  const desiredRoute = requireObject(patch.bindings[0], 'EMORI iMessage route fragment');
  requireObject(desiredRoute.match, 'EMORI iMessage route match fragment');
  patch.bindings = nextImessageBindings(currentBindings, desiredRoute);

  const currentChannel = current?.channels?.imessage;
  if (currentChannel !== undefined) {
    requireObject(currentChannel, 'OpenClaw iMessage channel config');
    for (const policy of ['dmPolicy', 'groupPolicy']) {
      if (currentChannel[policy] !== undefined) delete patch.channels.imessage[policy];
    }
  }

  const currentExtraDirs = current?.skills?.load?.extraDirs;
  if (currentExtraDirs !== undefined) {
    const extraDirs = requireStringArray(currentExtraDirs, 'OpenClaw extra skill directories');
    const retainedDirs = withoutCanonSkillDir(extraDirs, options.canonPath, options.home);
    if (retainedDirs.length !== extraDirs.length) {
      patch.skills.load = { extraDirs: retainedDirs.length === 0 ? null : retainedDirs };
    }
  }

  patch.agents.entries[agentId].memory.search.store.vector.extensionPath =
    options.vectorExtensionPath;
  return patch;
}

export function configPatchSatisfied(current, patch) {
  if (patch === null) return current === undefined;
  if (Array.isArray(patch) || !isObject(patch)) return isDeepStrictEqual(current, patch);
  if (!isObject(current)) return false;
  return Object.entries(patch).every(([key, value]) => configPatchSatisfied(current[key], value));
}

export function memoryStatusHealthy(statuses, vectorExtensionPath) {
  const status = Array.isArray(statuses)
    ? statuses.find((entry) => entry.agentId === agentId)?.status
    : undefined;
  return (
    status?.vector?.enabled === true &&
    status.vector.extensionPath === vectorExtensionPath &&
    isDeepStrictEqual(status.sources, ['memory', 'sessions'])
  );
}

export function sessionMemoryHookHealthy(hooks) {
  const hook = hooks?.hooks?.find((entry) => entry.name === 'session-memory');
  return hook?.disabled === true && hook.enabledByConfig === false;
}

function inspectConfig() {
  return Object.fromEntries(configSections.map((path) => [path, readConfigValue(path)]));
}

function installedVectorExtensionPath() {
  return sqliteVectorExtensionPath(run('npm', ['root', '--global']).stdout);
}

function desiredConfig() {
  const home = process.env.HOME;
  if (!home) throw new Error('HOME is unavailable.');
  const vectorExtensionPath = installedVectorExtensionPath();
  if (!existsSync(vectorExtensionPath)) throw new Error('SQLite vector extension is unavailable.');
  const current = inspectConfig();
  const patch = buildOpenClawConfigPatch(loadOpenClawConfigFragment(), current, {
    canonPath: resolve(home, 'tanaab', 'canon'),
    home,
    vectorExtensionPath,
  });
  return { current, patch, vectorExtensionPath };
}

export function checkOpenClawConfig() {
  const { current, patch, vectorExtensionPath } = desiredConfig();
  if (!configPatchSatisfied(current, patch)) return false;

  const statuses = parseJson(
    run('openclaw', ['memory', 'status', '--agent', agentId, '--json']).stdout,
    'openclaw memory status',
  );
  const hooks = parseJson(
    run('openclaw', ['hooks', 'list', '--json']).stdout,
    'openclaw hooks list',
  );
  return memoryStatusHealthy(statuses, vectorExtensionPath) && sessionMemoryHookHealthy(hooks);
}

export function applyOpenClawConfig() {
  const { patch } = desiredConfig();
  const input = JSON.stringify(patch);
  run('openclaw', ['config', 'patch', '--stdin', '--dry-run', '--json'], { input });
  run('openclaw', ['config', 'patch', '--stdin'], { input });
}
