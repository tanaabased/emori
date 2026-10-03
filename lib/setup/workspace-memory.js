import { lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const memoryHeading = '# Memory\n\nPrivate, curated notes for this agent.\n';

function inspectPath(path, expectedType) {
  try {
    const stats = lstatSync(path);
    if (expectedType === 'directory' && stats.isDirectory()) return true;
    if (expectedType === 'file' && stats.isFile()) return true;
    throw new Error(`Workspace memory path has conflicting type: ${path}`);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function inspectWorkspaceMemory(workspace) {
  const memoryDirectory = join(workspace, 'memory');
  const memoryFile = join(workspace, 'MEMORY.md');
  return {
    memoryDirectory,
    memoryDirectoryExists: inspectPath(memoryDirectory, 'directory'),
    memoryFile,
    memoryFileExists: inspectPath(memoryFile, 'file'),
  };
}

export function checkWorkspaceMemory(workspace = process.cwd()) {
  const { memoryDirectoryExists, memoryFileExists } = inspectWorkspaceMemory(workspace);
  return memoryDirectoryExists && memoryFileExists;
}

export function applyWorkspaceMemory(workspace = process.cwd()) {
  const state = inspectWorkspaceMemory(workspace);
  if (!state.memoryDirectoryExists) mkdirSync(state.memoryDirectory);
  if (!state.memoryFileExists) {
    writeFileSync(state.memoryFile, memoryHeading, { flag: 'wx' });
  }
}
