import { resolve } from 'node:path';

import { commandResult, parseJson, run } from './command.js';

export function homebrewEnvironment(environment = process.env) {
  return { ...environment, HOMEBREW_NO_AUTO_UPDATE: '1' };
}

export function sqliteVectorPackage(platform = process.platform, arch = process.arch) {
  if (platform !== 'darwin' || !['arm64', 'x64'].includes(arch)) {
    throw new Error(`SQLite vector support is unavailable for ${platform}-${arch}.`);
  }
  return `sqlite-vec-darwin-${arch}`;
}

function requireCommand(command) {
  const result = commandResult(command, ['--version']);
  if (result.error || result.status !== 0) throw new Error(`${command} is a prerequisite.`);
}

function requireMacos() {
  if (process.platform !== 'darwin') throw new Error('EMORI setup requires macOS.');
}

function npmPackageInstalled(packageName) {
  const result = run('npm', ['list', '--global', '--depth=0', '--json'], {
    allowFailure: true,
    env: homebrewEnvironment(),
  });
  const packages = parseJson(result.stdout, 'npm list --global');
  return packages.dependencies?.[packageName] !== undefined;
}

function checkPrerequisites() {
  requireMacos();
  requireCommand('brew');
  requireCommand('npm');
}

export function checkBrewDependencies() {
  checkPrerequisites();
  const bundle = run('brew', ['bundle', 'check', '--file', resolve('Brewfile')], {
    allowFailure: true,
    env: homebrewEnvironment(),
  });
  return bundle.status === 0 && npmPackageInstalled(sqliteVectorPackage());
}

export function applyBrewDependencies() {
  checkPrerequisites();
  const vectorPackage = sqliteVectorPackage();
  if (!npmPackageInstalled(vectorPackage)) {
    run('npm', ['install', '--global', vectorPackage], { env: homebrewEnvironment() });
  }
  run('brew', ['bundle', '--file', resolve('Brewfile')], {
    env: homebrewEnvironment(),
  });
}
