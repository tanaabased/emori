import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { sqliteVectorPackage } from './brew-dependencies.js';
import { parseJson, run } from './command.js';
import { readConfigValue, setConfigValue, validateConfig } from './config.js';

const agentId = 'emori';
const vectorConfigPath = `agents.entries.${agentId}.memory.search.store.vector`;

export function sqliteVectorExtensionPath(
  globalNpmRoot,
  platform = process.platform,
  arch = process.arch,
) {
  return resolve(globalNpmRoot.trim(), sqliteVectorPackage(platform, arch), 'vec0.dylib');
}

export function memoryVectorStorePolicy(extensionPath) {
  return { enabled: true, extensionPath };
}

export function memoryVectorStoreHealthy(vector, expected) {
  return vector?.enabled === true && vector.extensionPath === expected.extensionPath;
}

export function memoryVectorStatusHealthy(statuses, expected) {
  const status = Array.isArray(statuses)
    ? statuses.find((entry) => entry.agentId === agentId)?.status
    : undefined;
  return memoryVectorStoreHealthy(status?.vector, expected);
}

function installedVectorExtensionPath() {
  const npmRoot = run('npm', ['root', '--global']).stdout;
  return sqliteVectorExtensionPath(npmRoot);
}

export function checkMemoryVectorStore() {
  const extensionPath = installedVectorExtensionPath();
  const expected = memoryVectorStorePolicy(extensionPath);
  return (
    existsSync(extensionPath) &&
    memoryVectorStoreHealthy(readConfigValue(vectorConfigPath), expected)
  );
}

export function applyMemoryVectorStore() {
  const extensionPath = installedVectorExtensionPath();
  if (!existsSync(extensionPath)) throw new Error('SQLite vector extension is unavailable.');

  const expected = memoryVectorStorePolicy(extensionPath);
  const current = readConfigValue(vectorConfigPath);
  if (!memoryVectorStoreHealthy(current, expected)) {
    setConfigValue(vectorConfigPath, expected, current);
  }
  validateConfig();

  const statuses = parseJson(
    run('openclaw', ['memory', 'status', '--agent', agentId, '--json']).stdout,
    'openclaw memory status',
  );
  if (!memoryVectorStatusHealthy(statuses, expected)) {
    throw new Error('SQLite vector store is not ready.');
  }
}
