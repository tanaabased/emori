#!/usr/bin/env node

import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const setupIds = ['brew-dependencies', 'canon-checkout', 'canon-plugin'];

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

function requireCommand(command) {
  const result = commandResult(command, ['--version']);
  if (result.error || result.status !== 0) throw new Error(`${command} is a prerequisite.`);
}

function requireMacos() {
  if (process.platform !== 'darwin') throw new Error('EMORI setup requires macOS.');
}

export function homebrewEnvironment(environment = process.env) {
  return { ...environment, HOMEBREW_NO_AUTO_UPDATE: '1' };
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

function checkBrewPrerequisites() {
  requireMacos();
  requireCommand('brew');
  requireCommand('npm');
}

function brewDependenciesHealthy() {
  checkBrewPrerequisites();
  const bundle = run('brew', ['bundle', 'check', '--file', resolve('Brewfile')], {
    allowFailure: true,
    env: homebrewEnvironment(),
  });
  return bundle.status === 0 && npmPackageInstalled(sqliteVectorPackage());
}

function applyBrewDependencies() {
  checkBrewPrerequisites();
  const vectorPackage = sqliteVectorPackage();
  if (!npmPackageInstalled(vectorPackage)) {
    run('npm', ['install', '--global', vectorPackage], { env: homebrewEnvironment() });
  }
  run('brew', ['bundle', '--file', resolve('Brewfile')], {
    env: homebrewEnvironment(),
  });
}

function canonCheckoutHealthy() {
  requireCommand('git');
  const canon = canonPath();
  if (existsSync(canon) && !isDirectory(join(canon, '.git'))) {
    throw new Error('The Canon path exists but is not a Git checkout.');
  }
  return isDirectory(join(canon, '.git'));
}

function applyCanonCheckout() {
  requireCommand('git');
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

function inspectPlugin(id) {
  const result = run('openclaw', ['plugins', 'inspect', id, '--json'], { allowFailure: true });
  return result.status === 0 ? parseJson(result.stdout, `openclaw plugins inspect ${id}`) : null;
}

export function pluginInspectionHealthy(inspection, id) {
  return (
    inspection?.plugin?.id === id &&
    inspection.plugin.enabled === true &&
    inspection.plugin.status !== 'error'
  );
}

function canonPluginHealthy() {
  const canon = resolve(canonPath());
  if (!isDirectory(join(canon, '.git'))) throw new Error('Canon is not ready.');
  return pluginInspectionHealthy(inspectPlugin('tanaab'), 'tanaab');
}

function applyCanonPlugin() {
  const canon = resolve(canonPath());
  if (!isDirectory(join(canon, '.git'))) throw new Error('Canon is not ready.');
  if (!inspectPlugin('tanaab')) {
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
  run('openclaw', ['plugins', 'enable', 'tanaab', '--accept-capabilities']);
}

const handlers = {
  'brew-dependencies': { check: brewDependenciesHealthy, apply: applyBrewDependencies },
  'canon-checkout': { check: canonCheckoutHealthy, apply: applyCanonCheckout },
  'canon-plugin': { check: canonPluginHealthy, apply: applyCanonPlugin },
};

export function runSetup(mode, id) {
  if (!['check', 'apply'].includes(mode) || !setupIds.includes(id)) {
    throw new Error('Usage: scripts/setup.js <check|apply> <setup-id>');
  }
  const result = handlers[id][mode]();
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
