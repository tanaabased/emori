import { readConfigValue, setConfigValue, validateConfig } from './config.js';
import { inspectPlugin, pluginInspectionHealthy } from './plugin.js';

const pluginId = 'active-memory';
const pluginPath = `plugins.entries.${pluginId}`;
const activeMemoryPaths = {
  pluginEnabled: `${pluginPath}.enabled`,
  recallEnabled: `${pluginPath}.config.enabled`,
  mode: `${pluginPath}.config.mode`,
  timeoutMs: `${pluginPath}.config.timeoutMs`,
  logging: `${pluginPath}.config.logging`,
  persistTranscripts: `${pluginPath}.config.persistTranscripts`,
};

export const activeMemoryPolicy = {
  pluginEnabled: true,
  recallEnabled: true,
  mode: 'escalate',
  timeoutMs: 15000,
  logging: true,
  persistTranscripts: false,
};

export function activeMemoryPolicyHealthy(values) {
  return Object.keys(activeMemoryPolicy).every((key) => values?.[key] === activeMemoryPolicy[key]);
}

export function activeMemoryPluginHealthy(inspection) {
  return pluginInspectionHealthy(inspection, pluginId) && inspection.plugin.origin === 'bundled';
}

function readActiveMemoryPolicy() {
  return Object.fromEntries(
    Object.entries(activeMemoryPaths).map(([key, path]) => [key, readConfigValue(path)]),
  );
}

export function checkActiveMemory() {
  return (
    activeMemoryPolicyHealthy(readActiveMemoryPolicy()) &&
    activeMemoryPluginHealthy(inspectPlugin(pluginId))
  );
}

export function applyActiveMemory() {
  const current = readActiveMemoryPolicy();
  for (const [key, path] of Object.entries(activeMemoryPaths)) {
    if (current[key] !== activeMemoryPolicy[key]) {
      setConfigValue(path, activeMemoryPolicy[key], current[key]);
    }
  }
  validateConfig();

  if (!checkActiveMemory()) {
    throw new Error('Active Memory policy is not ready.');
  }
}
