import { enablePlugin, inspectPlugin, installPlugin, pluginInspectionHealthy } from './plugin.js';

export const codexPluginSource = 'clawhub:@openclaw/codex';

export function checkCodexPlugin() {
  return pluginInspectionHealthy(inspectPlugin('codex'), 'codex');
}

export function applyCodexPlugin() {
  if (!inspectPlugin('codex')) installPlugin(codexPluginSource);
  enablePlugin('codex');
}
