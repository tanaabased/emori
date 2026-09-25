import { closeSync, lstatSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

import { readConfigValue } from './config.js';

export const memoryStorageEntries = [
  { path: 'MEMORY.md', type: 'file' },
  { path: 'DREAMS.md', type: 'file' },
  { path: 'memory', type: 'directory' },
  { path: '.private', type: 'directory' },
];

function defaultWorkspaceDir() {
  return resolveMemoryStorageWorkspace(readConfigValue('agents.entries.emori.workspace'));
}

export function resolveMemoryStorageWorkspace(value, home = process.env.HOME) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error("EMORI's OpenClaw workspace is unavailable.");
  }
  if (value === '~' || value.startsWith('~/')) {
    if (!home) throw new Error('HOME is unavailable.');
    return resolve(home, value === '~' ? '.' : value.slice(2));
  }
  if (!isAbsolute(value)) throw new Error("EMORI's OpenClaw workspace must be absolute.");
  return value;
}

function entryStatus(workspaceDir, entry) {
  try {
    const stat = lstatSync(join(workspaceDir, entry.path));
    if (stat.isSymbolicLink()) return 'symlink';
    if (stat.isFile()) return 'file';
    if (stat.isDirectory()) return 'directory';
    return 'other';
  } catch (error) {
    if (error?.code === 'ENOENT') return 'missing';
    throw error;
  }
}

export function memoryStorageEntriesHealthy(statuses) {
  return memoryStorageEntries.every((entry) => statuses?.[entry.path] === entry.type);
}

export function memoryStoragePathsIgnored(workspaceDir) {
  const ignorePath = join(workspaceDir, '.gitignore');
  try {
    const stat = lstatSync(ignorePath);
    if (stat.isSymbolicLink() || !stat.isFile()) return false;
    const rules = new Set(
      readFileSync(ignorePath, 'utf8')
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('#')),
    );
    return memoryStorageEntries.every((entry) =>
      rules.has(`/${entry.path}${entry.type === 'directory' ? '/' : ''}`),
    );
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function memoryStorageStatuses(workspaceDir) {
  return Object.fromEntries(
    memoryStorageEntries.map((entry) => [entry.path, entryStatus(workspaceDir, entry)]),
  );
}

export function checkMemoryStorage(options = {}) {
  const workspaceDir = options.workspaceDir ?? defaultWorkspaceDir();
  const pathsIgnored = options.pathsIgnored ?? memoryStoragePathsIgnored;
  return (
    pathsIgnored(workspaceDir) && memoryStorageEntriesHealthy(memoryStorageStatuses(workspaceDir))
  );
}

function createMemoryStorageEntry(workspaceDir, entry) {
  const path = join(workspaceDir, entry.path);
  if (entry.type === 'directory') {
    mkdirSync(path, { mode: 0o700 });
    return;
  }
  closeSync(openSync(path, 'wx', 0o600));
}

export function applyMemoryStorage(options = {}) {
  const workspaceDir = options.workspaceDir ?? defaultWorkspaceDir();
  const pathsIgnored = options.pathsIgnored ?? memoryStoragePathsIgnored;
  if (!pathsIgnored(workspaceDir)) {
    throw new Error('Private memory storage paths must remain ignored.');
  }

  const statuses = memoryStorageStatuses(workspaceDir);
  for (const entry of memoryStorageEntries) {
    const status = statuses[entry.path];
    if (status !== 'missing' && status !== entry.type) {
      throw new Error(`${entry.path} exists as ${status}, not ${entry.type}.`);
    }
  }

  for (const entry of memoryStorageEntries) {
    if (statuses[entry.path] === 'missing') createMemoryStorageEntry(workspaceDir, entry);
  }

  if (!checkMemoryStorage({ pathsIgnored, workspaceDir })) {
    throw new Error('Private memory storage is not ready.');
  }
}
