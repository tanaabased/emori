import { readConfigValue, setConfigValue, validateConfig } from './config.js';

const autonomousModePath = 'skills.workshop.autonomous.mode';

export const workshopPolicy = {
  autonomousMode: 'propose',
};

export function workshopPolicyHealthy(mode) {
  return mode === workshopPolicy.autonomousMode;
}

export function checkWorkshopPolicy() {
  return workshopPolicyHealthy(readConfigValue(autonomousModePath));
}

export function applyWorkshopPolicy() {
  const mode = readConfigValue(autonomousModePath);
  if (!workshopPolicyHealthy(mode)) {
    setConfigValue(autonomousModePath, workshopPolicy.autonomousMode, mode);
  }
  validateConfig();
}
