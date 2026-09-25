import { readConfigValue, setConfigValue, validateConfig } from './config.js';
import { inspectPlugin, pluginInspectionHealthy } from './plugin.js';

const pluginId = 'memory-core';
const pluginPath = `plugins.entries.${pluginId}`;
const memorySlotPath = 'plugins.slots.memory';
const consolidationPaths = {
  pluginEnabled: `${pluginPath}.enabled`,
  dreamingEnabled: `${pluginPath}.config.dreaming.enabled`,
  verboseLogging: `${pluginPath}.config.dreaming.verboseLogging`,
};

export const memoryConsolidationPolicy = {
  pluginEnabled: true,
  dreamingEnabled: true,
  verboseLogging: true,
};

export function memoryConsolidationPolicyHealthy(values) {
  return Object.keys(memoryConsolidationPolicy).every(
    (key) => values?.[key] === memoryConsolidationPolicy[key],
  );
}

export function memoryCorePluginHealthy(inspection) {
  return (
    pluginInspectionHealthy(inspection, pluginId) &&
    inspection.plugin.origin === 'bundled' &&
    inspection.plugin.memorySlotSelected === true
  );
}

export function memorySlotCompatible(value) {
  return value === undefined || value === pluginId;
}

function readMemoryConsolidationPolicy() {
  return Object.fromEntries(
    Object.entries(consolidationPaths).map(([key, path]) => [key, readConfigValue(path)]),
  );
}

export function checkMemoryConsolidation() {
  return (
    memorySlotCompatible(readConfigValue(memorySlotPath)) &&
    memoryConsolidationPolicyHealthy(readMemoryConsolidationPolicy()) &&
    memoryCorePluginHealthy(inspectPlugin(pluginId))
  );
}

export function applyMemoryConsolidation() {
  const memorySlot = readConfigValue(memorySlotPath);
  if (!memorySlotCompatible(memorySlot)) {
    throw new Error('Another plugin owns the OpenClaw memory slot.');
  }

  const current = readMemoryConsolidationPolicy();
  for (const [key, path] of Object.entries(consolidationPaths)) {
    if (current[key] !== memoryConsolidationPolicy[key]) {
      setConfigValue(path, memoryConsolidationPolicy[key], current[key]);
    }
  }
  validateConfig();

  if (!checkMemoryConsolidation()) {
    throw new Error('Memory consolidation policy is not ready.');
  }
}
