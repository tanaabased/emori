import { parseJson, run } from './command.js';
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

export const memoryDreamingJobContract = {
  declarationKey: 'memory-core:memory-dreaming-promotion',
  event: '__openclaw_memory_core_short_term_promotion_dream__',
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

export function memoryDreamingJobHealthy(cron) {
  const managed = Array.isArray(cron?.jobs)
    ? cron.jobs.filter((job) => job.declarationKey === memoryDreamingJobContract.declarationKey)
    : [];
  if (managed.length !== 1) return false;

  const [job] = managed;
  return (
    job.enabled === true &&
    job.schedule?.kind === 'cron' &&
    typeof job.schedule.expr === 'string' &&
    job.schedule.expr.length > 0 &&
    job.sessionTarget === 'isolated' &&
    job.wakeMode === 'now' &&
    job.payload?.kind === 'agentTurn' &&
    job.payload.message === memoryDreamingJobContract.event &&
    job.payload.lightContext === true &&
    job.delivery?.mode === 'none'
  );
}

function readMemoryConsolidationPolicy() {
  return Object.fromEntries(
    Object.entries(consolidationPaths).map(([key, path]) => [key, readConfigValue(path)]),
  );
}

function inspectMemoryDreamingJob() {
  const result = run('openclaw', ['cron', 'list', '--json'], { allowFailure: true });
  return result.status === 0 ? parseJson(result.stdout, 'openclaw cron list') : null;
}

export function checkMemoryConsolidation() {
  return (
    memorySlotCompatible(readConfigValue(memorySlotPath)) &&
    memoryConsolidationPolicyHealthy(readMemoryConsolidationPolicy()) &&
    memoryCorePluginHealthy(inspectPlugin(pluginId)) &&
    memoryDreamingJobHealthy(inspectMemoryDreamingJob())
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
