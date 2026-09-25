import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { commandResult, run } from './command.js';

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

function requireGit() {
  const result = commandResult('git', ['--version']);
  if (result.error || result.status !== 0) throw new Error('git is a prerequisite.');
}

export function checkCanonCheckout() {
  requireGit();
  const canon = canonPath();
  if (existsSync(canon) && !isDirectory(join(canon, '.git'))) {
    throw new Error('The Canon path exists but is not a Git checkout.');
  }
  return isDirectory(join(canon, '.git'));
}

export function applyCanonCheckout() {
  requireGit();
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
