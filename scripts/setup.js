#!/usr/bin/env node

import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const setupGroups = ['dependencies', 'plugins', 'configuration', 'memory'];

const agentId = 'emori';
const officialPluginPackages = {
  codex: '@openclaw/codex',
  imessage: '@openclaw/imessage',
};
const requiredPlugins = [
  'tanaab',
  'codex',
  'openai',
  'imessage',
  'browser',
  'memory-core',
  'active-memory',
];

export const configurationPatch = {
  agents: {
    entries: {
      [agentId]: {
        heartbeat: {
          every: '30m',
          directPolicy: 'allow',
          isolatedSession: true,
          lightContext: true,
        },
        models: {
          'openai/gpt-5.5': { agentRuntime: { id: 'codex' } },
          'openai/gpt-5.6-sol': { agentRuntime: { id: 'codex' } },
          'openai/gpt-5.6-terra': { agentRuntime: { id: 'codex' } },
          'openai/gpt-6-astra': { agentRuntime: { id: 'codex' } },
        },
        tools: {
          message: {
            actions: { allow: ['send'] },
            crossContext: {
              allowAcrossProviders: true,
              marker: { enabled: true, prefix: '[from {channel}] ' },
            },
          },
          profile: 'coding',
        },
      },
    },
  },
  channels: {
    imessage: {
      accounts: {
        [agentId]: {
          enabled: true,
          name: 'EMORI',
        },
      },
      defaultAccount: agentId,
      enabled: true,
    },
  },
  skills: {
    workshop: {
      autonomous: { mode: 'off' },
    },
  },
  tools: {
    exec: { mode: 'auto' },
    profile: 'coding',
  },
};

export const memoryPatch = {
  agents: {
    entries: {
      [agentId]: {
        memory: {
          search: {
            experimental: { sessionMemory: true },
            fallback: 'none',
            rememberAcrossConversations: true,
            sources: ['memory', 'sessions'],
            store: { vector: { enabled: true } },
          },
        },
      },
    },
  },
  hooks: {
    internal: {
      entries: {
        'session-memory': { enabled: false },
      },
    },
  },
  plugins: {
    entries: {
      'active-memory': {
        config: {
          enabled: true,
          logging: false,
          maxSummaryChars: 220,
          mode: 'escalate',
          persistTranscripts: false,
          timeoutMs: 15000,
        },
        enabled: true,
      },
      'memory-core': {
        config: {
          dreaming: {
            enabled: true,
            timezone: 'America/New_York',
            verboseLogging: false,
          },
        },
        enabled: true,
      },
    },
  },
  tools: {
    sessions: { visibility: 'agent' },
  },
};

function commandResult(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    env: options.env ?? process.env,
    input: options.input,
    maxBuffer: 1024 * 1024,
  });
}

function run(command, args, options = {}) {
  const result = commandResult(command, args, options);
  if (result.error) throw new Error(`${command} is unavailable.`);
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args[0] ?? ''} failed.`);
  }
  return result;
}

function parseJson(output, label) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

function configGet(path) {
  const result = run('openclaw', ['config', 'get', path, '--json'], { allowFailure: true });
  const payload = parseJson(result.stdout, `openclaw config get ${path}`);
  if (result.status === 0) return payload;
  if (payload?.error?.message?.includes('valid but unset')) return undefined;
  throw new Error(`OpenClaw could not inspect ${path}.`);
}

function patchConfig(patch) {
  run('openclaw', ['config', 'patch', '--stdin'], { input: JSON.stringify(patch) });
}

function validateConfig() {
  run('openclaw', ['config', 'validate', '--json']);
}

export function containsSubset(actual, expected) {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((value, index) => containsSubset(actual[index], value))
    );
  }
  if (expected && typeof expected === 'object') {
    return (
      actual !== null &&
      typeof actual === 'object' &&
      !Array.isArray(actual) &&
      Object.entries(expected).every(([key, value]) => containsSubset(actual[key], value))
    );
  }
  return Object.is(actual, expected);
}

function configContains(patch) {
  return Object.entries(patch).every(([path, expected]) =>
    containsSubset(configGet(path), expected),
  );
}

function homePath(...parts) {
  const home = process.env.HOME;
  if (!home) throw new Error('HOME is unavailable.');
  return join(home, ...parts);
}

function canonPath() {
  return homePath('tanaab', 'canon');
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function checkPrerequisites() {
  for (const [command, args] of [
    ['brew', ['--version']],
    ['bun', ['--version']],
    ['git', ['--version']],
    ['npm', ['--version']],
    ['openclaw', ['--version']],
  ]) {
    const result = commandResult(command, args);
    if (result.error || result.status !== 0) throw new Error(`${command} is a prerequisite.`);
  }
  if (process.platform !== 'darwin') throw new Error('EMORI setup requires macOS.');
}

export function homebrewEnvironment(environment = process.env) {
  const {
    AGENT_SYSTEM_EXEC_AUTHORITY: authority,
    AGENT_SYSTEM_EXEC_CAPABILITY: capability,
    ...hostEnvironment
  } = environment;
  if (authority && capability && hostEnvironment.PATH) {
    hostEnvironment.PATH = hostEnvironment.PATH.split(delimiter).slice(1).join(delimiter);
  }
  return { ...hostEnvironment, HOMEBREW_NO_AUTO_UPDATE: '1' };
}

export function sqliteVectorPackage(platform = process.platform, arch = process.arch) {
  if (platform !== 'darwin' || !['arm64', 'x64'].includes(arch)) {
    throw new Error(`SQLite vector support is unavailable for ${platform}-${arch}.`);
  }
  return `sqlite-vec-darwin-${arch}`;
}

function npmPackageInstalled(packageName) {
  const result = run('npm', ['list', '--global', '--depth=0', '--json'], {
    allowFailure: true,
    env: homebrewEnvironment(),
  });
  const packages = parseJson(result.stdout, 'npm list --global');
  return packages.dependencies?.[packageName] !== undefined;
}

function dependenciesHealthy() {
  checkPrerequisites();
  const canon = canonPath();
  if (existsSync(canon) && !isDirectory(join(canon, '.git'))) {
    throw new Error('The Canon path exists but is not a Git checkout.');
  }
  const bundle = run('brew', ['bundle', 'check', '--file', resolve('Brewfile')], {
    allowFailure: true,
    env: homebrewEnvironment(),
  });
  return bundle.status === 0 && isDirectory(join(canon, '.git'));
}

function applyDependencies() {
  checkPrerequisites();
  const vectorPackage = sqliteVectorPackage();
  if (!npmPackageInstalled(vectorPackage)) {
    run('npm', ['install', '--global', vectorPackage], { env: homebrewEnvironment() });
  }
  run('brew', ['bundle', '--file', resolve('Brewfile')], {
    env: homebrewEnvironment(),
  });
  const canon = canonPath();
  if (existsSync(canon)) {
    if (!isDirectory(join(canon, '.git'))) {
      throw new Error('The Canon path exists but is not a Git checkout.');
    }
    return;
  }
  mkdirSync(dirname(canon), { mode: 0o700, recursive: true });
  run('git', ['clone', 'git@github.com:tanaabased/canon.git', canon]);
}

function pluginAvailable(id) {
  return run('openclaw', ['plugins', 'inspect', id, '--json'], { allowFailure: true }).status === 0;
}

function skillsIncludeCanon() {
  const result = run('openclaw', ['skills', 'list', '--agent', agentId, '--json'], {
    allowFailure: true,
  });
  if (result.status !== 0) throw new Error('OpenClaw could not inspect EMORI skills.');
  return result.stdout.includes('tanaab-');
}

function pluginsHealthy() {
  const canon = resolve(canonPath());
  const entries = configGet('plugins.entries') ?? {};
  const paths = configGet('plugins.load.paths') ?? [];
  const extraDirs = configGet('skills.load.extraDirs') ?? [];
  return (
    requiredPlugins.every(pluginAvailable) &&
    requiredPlugins.every((id) => entries[id]?.enabled === true) &&
    paths.map(resolve).includes(canon) &&
    !extraDirs.map(resolve).includes(canon) &&
    skillsIncludeCanon()
  );
}

function setExtraDirs(extraDirs) {
  run('openclaw', [
    'config',
    'set',
    'skills.load.extraDirs',
    JSON.stringify(extraDirs),
    '--strict-json',
    '--replace',
  ]);
}

function applyPlugins() {
  const canon = resolve(canonPath());
  if (!isDirectory(join(canon, '.git'))) throw new Error('Canon is not ready.');
  const paths = configGet('plugins.load.paths') ?? [];
  if (!paths.map(resolve).includes(canon)) {
    run('openclaw', [
      'plugins',
      'install',
      '--link',
      canon,
      '--force',
      '--accept-capabilities',
      '--acknowledge-install-policy-warning',
    ]);
  }
  for (const [id, packageName] of Object.entries(officialPluginPackages)) {
    if (!pluginAvailable(id)) {
      run('openclaw', [
        'plugins',
        'install',
        packageName,
        '--pin',
        '--accept-capabilities',
        '--acknowledge-install-policy-warning',
      ]);
    }
  }
  run('openclaw', ['plugins', 'enable', ...requiredPlugins, '--accept-capabilities']);
  const extraDirs = configGet('skills.load.extraDirs') ?? [];
  const filtered = extraDirs.filter((path) => resolve(path) !== canon);
  if (filtered.length !== extraDirs.length) setExtraDirs(filtered);
}

export function mergeRouteBinding(bindings = []) {
  const desired = {
    type: 'route',
    agentId,
    match: { channel: 'imessage', accountId: agentId },
    session: { dmScope: 'per-account-channel-peer' },
  };
  let found = false;
  const merged = bindings.map((binding) => {
    if (
      binding?.type === 'route' &&
      binding.agentId === agentId &&
      binding.match?.channel === 'imessage' &&
      binding.match?.accountId === agentId
    ) {
      found = true;
      return {
        ...binding,
        match: { ...binding.match, ...desired.match },
        session: { ...binding.session, ...desired.session },
      };
    }
    return binding;
  });
  if (!found) merged.push(desired);
  return merged;
}

function configurationHealthy() {
  const bindings = configGet('bindings') ?? [];
  return (
    configContains(configurationPatch) &&
    bindings.some(
      (binding) =>
        binding?.agentId === agentId &&
        binding.match?.channel === 'imessage' &&
        binding.match?.accountId === agentId &&
        binding.session?.dmScope === 'per-account-channel-peer',
    )
  );
}

function applyConfiguration() {
  patchConfig(configurationPatch);
  const bindings = configGet('bindings');
  const next = mergeRouteBinding(bindings ?? []);
  if (JSON.stringify(bindings ?? []) !== JSON.stringify(next)) {
    const args = ['config', 'set', 'bindings', JSON.stringify(next), '--strict-json', '--replace'];
    if (bindings === undefined) args.push('--expect-current-absent');
    else args.push('--expect-current-json', JSON.stringify(bindings));
    run('openclaw', args);
  }
  validateConfig();
}

function memoryHealthy() {
  return (
    configContains(memoryPatch) &&
    existsSync(resolve('MEMORY.md')) &&
    isDirectory(resolve('memory'))
  );
}

function applyMemory() {
  patchConfig(memoryPatch);
  mkdirSync(resolve('memory'), { mode: 0o700, recursive: true });
  if (!existsSync(resolve('MEMORY.md'))) {
    writeFileSync(resolve('MEMORY.md'), '# Memory\n', { mode: 0o600, flag: 'wx' });
  }
  validateConfig();
}

const handlers = {
  dependencies: { check: dependenciesHealthy, apply: applyDependencies },
  plugins: { check: pluginsHealthy, apply: applyPlugins },
  configuration: { check: configurationHealthy, apply: applyConfiguration },
  memory: { check: memoryHealthy, apply: applyMemory },
};

export function runSetup(mode, group) {
  if (!['check', 'apply'].includes(mode) || !setupGroups.includes(group)) {
    throw new Error('Usage: scripts/setup.js <check|apply> <group>');
  }
  const handler = handlers[group][mode];
  const result = handler();
  return mode === 'check' && result !== true ? 1 : 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  try {
    process.exitCode = runSetup(process.argv[2], process.argv[3]);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Setup failed.'}\n`);
    process.exitCode = 2;
  }
}
