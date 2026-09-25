import { readConfigValue, setConfigValue, validateConfig } from './config.js';

const agentEntriesPath = 'agents.entries';
const messagePath = 'agents.entries.emori.tools.message';

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

export function messagingPolicyValue(entries) {
  const message = entries?.emori?.tools?.message;
  if (message === undefined) return undefined;
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    throw new Error('OpenClaw EMORI message policy is invalid.');
  }
  return message;
}

export function messagingPolicyHealthy(message) {
  return (
    Array.isArray(message?.actions?.allow) &&
    message.actions.allow.length === 1 &&
    message.actions.allow[0] === 'send' &&
    message.crossContext === undefined
  );
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
  return messagingPolicyHealthy(messagingPolicyValue(inspectAgentEntries()));
}

export function applyMessagingPolicy() {
  const current = messagingPolicyValue(inspectAgentEntries());
  if (!messagingPolicyHealthy(current)) {
    setConfigValue(messagePath, nextMessagingPolicy(current), current);
  }
  validateConfig();
}
