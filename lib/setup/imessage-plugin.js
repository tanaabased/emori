import { enablePlugin, inspectPlugin, installPlugin, pluginInspectionHealthy } from './plugin.js';

export const imessagePluginSource = '@openclaw/imessage';

function imessagePluginInstalled(inspection) {
  return imessageInstallProblems(inspection).length === 0;
}

function imessageInstallProblems(inspection) {
  const problems = [];
  if (inspection?.plugin?.packageName !== imessagePluginSource) problems.push('package name');
  if (inspection?.plugin?.channelIds?.includes('imessage') !== true)
    problems.push('channel registration');
  if (inspection?.install?.resolvedName !== imessagePluginSource)
    problems.push('resolved install name');
  return problems;
}

export function imessagePluginInspectionHealthy(inspection) {
  return pluginInspectionHealthy(inspection, 'imessage') && imessagePluginInstalled(inspection);
}

export function checkImessagePlugin() {
  const inspection = inspectPlugin('imessage');
  if (imessagePluginInspectionHealthy(inspection)) return true;

  const problems = imessageInstallProblems(inspection);
  if (!inspection) problems.unshift('plugin missing');
  else {
    if (inspection.plugin.enabled !== true) problems.push('plugin not enabled');
    if (inspection.plugin.status === 'error') problems.push('plugin status is error');
  }
  process.stderr.write(`iMessage plugin check failed: ${problems.join(', ')}.\n`);
  return false;
}

export function applyImessagePlugin() {
  const inspection = inspectPlugin('imessage');
  if (!imessagePluginInstalled(inspection) || inspection.plugin.status === 'error') {
    installPlugin(imessagePluginSource, { force: true });
  }
  enablePlugin('imessage');
}
