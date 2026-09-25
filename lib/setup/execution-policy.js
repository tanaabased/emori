import { parseJson, run } from './command.js';

const agentToolsPath = 'agents.entries.emori.tools';

export const executionPolicy = {
  execMode: 'auto',
  profile: 'coding',
};

function inspectAgentTools() {
  const result = run('openclaw', ['config', 'get', agentToolsPath, '--json'], {
    allowFailure: true,
  });
  if (result.status !== 0) throw new Error('OpenClaw could not inspect EMORI tool policy.');

  const tools = parseJson(result.stdout, `openclaw config get ${agentToolsPath}`);
  if (!tools || typeof tools !== 'object' || Array.isArray(tools)) {
    throw new Error('EMORI tool policy is invalid.');
  }
  return tools;
}

function setConfigValue(path, value, current) {
  const args = ['config', 'set', path, JSON.stringify(value), '--strict-json'];
  if (current === undefined) args.push('--expect-current-absent');
  else args.push('--expect-current-json', JSON.stringify(current));
  run('openclaw', args);
}

export function executionPolicyHealthy(tools) {
  return (
    tools?.profile === executionPolicy.profile && tools?.exec?.mode === executionPolicy.execMode
  );
}

export function checkExecutionPolicy() {
  return executionPolicyHealthy(inspectAgentTools());
}

export function applyExecutionPolicy() {
  const tools = inspectAgentTools();
  if (tools.profile !== executionPolicy.profile) {
    setConfigValue(`${agentToolsPath}.profile`, executionPolicy.profile, tools.profile);
  }
  if (tools.exec?.mode !== executionPolicy.execMode) {
    setConfigValue(`${agentToolsPath}.exec.mode`, executionPolicy.execMode, tools.exec?.mode);
  }
  run('openclaw', ['config', 'validate', '--json']);
}
