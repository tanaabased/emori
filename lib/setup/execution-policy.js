import { readConfigValue, setConfigValue, validateConfig } from './config.js';

const agentEntriesPath = 'agents.entries';
const execModePath = 'agents.entries.emori.tools.exec.mode';
const profilePath = 'agents.entries.emori.tools.profile';

export const executionPolicy = {
  execMode: 'auto',
  profile: 'coding',
};

function inspectAgentEntries() {
  const entries = readConfigValue(agentEntriesPath) ?? {};
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    throw new Error('OpenClaw agent entries are invalid.');
  }
  return entries;
}

export function executionPolicyValues(entries) {
  const tools = entries?.emori?.tools;
  return { execMode: tools?.exec?.mode, profile: tools?.profile };
}

export function executionPolicyHealthy(profile, execMode) {
  return profile === executionPolicy.profile && execMode === executionPolicy.execMode;
}

export function checkExecutionPolicy() {
  const { execMode, profile } = executionPolicyValues(inspectAgentEntries());
  return executionPolicyHealthy(profile, execMode);
}

export function applyExecutionPolicy() {
  const { execMode, profile } = executionPolicyValues(inspectAgentEntries());
  if (profile !== executionPolicy.profile) {
    setConfigValue(profilePath, executionPolicy.profile, profile);
  }
  if (execMode !== executionPolicy.execMode) {
    setConfigValue(execModePath, executionPolicy.execMode, execMode);
  }
  validateConfig();
}
