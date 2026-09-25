import { readConfigValue, setConfigValue, validateConfig } from './config.js';

const execModePath = 'agents.entries.emori.tools.exec.mode';
const profilePath = 'agents.entries.emori.tools.profile';

export const executionPolicy = {
  execMode: 'auto',
  profile: 'coding',
};

export function executionPolicyHealthy(profile, execMode) {
  return profile === executionPolicy.profile && execMode === executionPolicy.execMode;
}

export function checkExecutionPolicy() {
  return executionPolicyHealthy(readConfigValue(profilePath), readConfigValue(execModePath));
}

export function applyExecutionPolicy() {
  const profile = readConfigValue(profilePath);
  const execMode = readConfigValue(execModePath);
  if (profile !== executionPolicy.profile) {
    setConfigValue(profilePath, executionPolicy.profile, profile);
  }
  if (execMode !== executionPolicy.execMode) {
    setConfigValue(execModePath, executionPolicy.execMode, execMode);
  }
  validateConfig();
}
