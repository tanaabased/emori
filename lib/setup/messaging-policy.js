import { readConfigValue, setConfigValue, validateConfig } from './config.js';

const agentEntriesPath = 'agents.entries';
const alsoAllowPath = 'agents.entries.emori.tools.alsoAllow';
const messagePath = 'agents.entries.emori.tools.message';
const messageToolId = 'message';

export const messagingPolicy = {
  actions: { allow: ['send'] },
};

function inspectAgentEntries() {
  const entries = readConfigValue(agentEntriesPath) ?? {};
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    throw new Error('OpenClaw agent entries are invalid.');
  }
  return entries;
}

export function messagingPolicyValues(entries) {
  const tools = entries?.emori?.tools;
  const alsoAllow = tools?.alsoAllow;
  const message = tools?.message;
  if (
    alsoAllow !== undefined &&
    (!Array.isArray(alsoAllow) || !alsoAllow.every((toolId) => typeof toolId === 'string'))
  ) {
    throw new Error('OpenClaw EMORI additional tool grants are invalid.');
  }
  if (
    message !== undefined &&
    (!message || typeof message !== 'object' || Array.isArray(message))
  ) {
    throw new Error('OpenClaw EMORI message policy is invalid.');
  }
  return { alsoAllow, message };
}

export function messagingPolicyHealthy(message, alsoAllow) {
  return (
    Array.isArray(alsoAllow) &&
    alsoAllow.includes(messageToolId) &&
    Array.isArray(message?.actions?.allow) &&
    message.actions.allow.length === 1 &&
    message.actions.allow[0] === 'send' &&
    message.crossContext === undefined
  );
}

export function nextMessagingToolGrants(alsoAllow = []) {
  return alsoAllow.includes(messageToolId) ? alsoAllow : [...alsoAllow, messageToolId];
}

export function nextMessagingPolicy(message = {}) {
  const next = {
    ...message,
    actions: { ...message.actions, ...messagingPolicy.actions },
  };
  delete next.crossContext;
  return next;
}

export function checkMessagingPolicy() {
  const values = messagingPolicyValues(inspectAgentEntries());
  return messagingPolicyHealthy(values?.message, values?.alsoAllow);
}

export function applyMessagingPolicy() {
  const values = messagingPolicyValues(inspectAgentEntries());
  const alsoAllow = values?.alsoAllow;
  const message = values?.message;
  if (!alsoAllow?.includes(messageToolId)) {
    setConfigValue(alsoAllowPath, nextMessagingToolGrants(alsoAllow), alsoAllow);
  }
  if (!messagingPolicyHealthy(message, nextMessagingToolGrants(alsoAllow))) {
    setConfigValue(messagePath, nextMessagingPolicy(message), message);
  }
  validateConfig();
}
