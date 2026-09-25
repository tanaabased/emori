import { readConfigValue, setConfigValue, validateConfig } from './config.js';

const bindingsPath = 'bindings';
const channelPath = 'channels.imessage';

export const imessageRouting = {
  accountId: 'emori',
  agentId: 'emori',
  channelId: 'imessage',
};

const defaultAccessPolicy = {
  dmPolicy: 'pairing',
  groupPolicy: 'allowlist',
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function imessageRoutingValues(channel, bindings) {
  if (channel !== undefined && !isObject(channel)) {
    throw new Error('OpenClaw iMessage channel configuration is invalid.');
  }
  if (channel?.accounts !== undefined && !isObject(channel.accounts)) {
    throw new Error('OpenClaw iMessage accounts are invalid.');
  }
  const account = channel?.accounts?.[imessageRouting.accountId];
  if (account !== undefined && !isObject(account)) {
    throw new Error('OpenClaw EMORI iMessage account is invalid.');
  }
  if (bindings !== undefined && !Array.isArray(bindings)) {
    throw new Error('OpenClaw bindings are invalid.');
  }
  return { bindings, channel };
}

function isOwnedRouteScope(binding) {
  if (!isObject(binding) || ![undefined, 'route'].includes(binding.type)) return false;
  const match = binding.match;
  if (!isObject(match)) return false;
  return (
    match.channel === imessageRouting.channelId &&
    match.accountId === imessageRouting.accountId &&
    Object.keys(match).every((key) => ['accountId', 'channel'].includes(key))
  );
}

export function imessageChannelHealthy(channel) {
  return (
    channel?.enabled === true &&
    channel.defaultAccount === imessageRouting.accountId &&
    channel.accounts?.[imessageRouting.accountId]?.enabled === true
  );
}

export function imessageBindingsHealthy(bindings = []) {
  const owned = bindings.filter(isOwnedRouteScope);
  return (
    owned.length === 1 &&
    owned[0].type === 'route' &&
    owned[0].agentId === imessageRouting.agentId &&
    owned[0].session === undefined
  );
}

export function imessageRoutingHealthy(channel, bindings) {
  return imessageChannelHealthy(channel) && imessageBindingsHealthy(bindings);
}

export function nextImessageChannel(channel = {}) {
  const accounts = channel.accounts ?? {};
  const account = accounts[imessageRouting.accountId] ?? {};
  return {
    ...defaultAccessPolicy,
    ...channel,
    enabled: true,
    defaultAccount: imessageRouting.accountId,
    accounts: {
      ...accounts,
      [imessageRouting.accountId]: {
        ...account,
        enabled: true,
      },
    },
  };
}

export function nextImessageBindings(bindings = []) {
  let routeAdded = false;
  const next = [];
  for (const binding of bindings) {
    if (!isOwnedRouteScope(binding)) {
      next.push(binding);
      continue;
    }
    if (routeAdded) continue;
    const route = {
      ...binding,
      type: 'route',
      agentId: imessageRouting.agentId,
      match: {
        channel: imessageRouting.channelId,
        accountId: imessageRouting.accountId,
      },
    };
    delete route.session;
    next.push(route);
    routeAdded = true;
  }
  if (!routeAdded) {
    next.push({
      type: 'route',
      agentId: imessageRouting.agentId,
      match: {
        channel: imessageRouting.channelId,
        accountId: imessageRouting.accountId,
      },
    });
  }
  return next;
}

function inspectImessageRouting() {
  return imessageRoutingValues(readConfigValue(channelPath), readConfigValue(bindingsPath));
}

export function checkImessageRouting() {
  const { bindings, channel } = inspectImessageRouting();
  return imessageRoutingHealthy(channel, bindings);
}

export function applyImessageRouting() {
  const { bindings, channel } = inspectImessageRouting();
  if (!imessageChannelHealthy(channel)) {
    setConfigValue(channelPath, nextImessageChannel(channel), channel);
  }
  if (!imessageBindingsHealthy(bindings)) {
    setConfigValue(bindingsPath, nextImessageBindings(bindings), bindings);
  }
  validateConfig();
}
