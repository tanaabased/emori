import { parseJson, run } from './command.js';
import { readConfigValue, setConfigValue, validateConfig } from './config.js';

const agentId = 'emori';
const searchPath = `agents.entries.${agentId}.memory.search`;
const recallPaths = {
  rememberAcrossConversations: `${searchPath}.rememberAcrossConversations`,
  sessionMemory: `${searchPath}.experimental.sessionMemory`,
  sessionMemoryHook: 'hooks.internal.entries.session-memory.enabled',
  sessionVisibility: 'tools.sessions.visibility',
  sources: `${searchPath}.sources`,
};

export const memoryRecallPolicy = {
  rememberAcrossConversations: true,
  sessionMemory: true,
  sessionMemoryHook: false,
  sessionVisibility: 'agent',
  sources: ['memory', 'sessions'],
};

function memoryRecallValueHealthy(key, value) {
  const expected = memoryRecallPolicy[key];
  return Array.isArray(expected)
    ? Array.isArray(value) &&
        value.length === expected.length &&
        value.every((entry, index) => entry === expected[index])
    : value === expected;
}

export function memoryRecallPolicyHealthy(values) {
  return Object.keys(memoryRecallPolicy).every((key) =>
    memoryRecallValueHealthy(key, values?.[key]),
  );
}

export function memoryRecallStatusHealthy(statuses) {
  const sources = Array.isArray(statuses)
    ? statuses.find((entry) => entry.agentId === agentId)?.status?.sources
    : undefined;
  return (
    Array.isArray(sources) &&
    sources.length === memoryRecallPolicy.sources.length &&
    sources.every((source, index) => source === memoryRecallPolicy.sources[index])
  );
}

export function sessionMemoryHookHealthy(hooks) {
  const hook = hooks?.hooks?.find((entry) => entry.name === 'session-memory');
  return hook?.disabled === true && hook.enabledByConfig === false;
}

function readMemoryRecallPolicy() {
  return Object.fromEntries(
    Object.entries(recallPaths).map(([key, path]) => [key, readConfigValue(path)]),
  );
}

export function checkMemoryRecall() {
  return memoryRecallPolicyHealthy(readMemoryRecallPolicy());
}

export function applyMemoryRecall() {
  const current = readMemoryRecallPolicy();
  for (const [key, path] of Object.entries(recallPaths)) {
    if (!memoryRecallValueHealthy(key, current[key])) {
      setConfigValue(path, memoryRecallPolicy[key], current[key]);
    }
  }
  validateConfig();

  const statuses = parseJson(
    run('openclaw', ['memory', 'status', '--agent', agentId, '--json']).stdout,
    'openclaw memory status',
  );
  if (!memoryRecallStatusHealthy(statuses)) {
    throw new Error('EMORI memory recall sources are not ready.');
  }

  const hooks = parseJson(
    run('openclaw', ['hooks', 'list', '--json']).stdout,
    'openclaw hooks list',
  );
  if (!sessionMemoryHookHealthy(hooks)) {
    throw new Error('Legacy session-memory hook is still enabled.');
  }
}
