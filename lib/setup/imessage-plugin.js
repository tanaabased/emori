import { enablePlugin, inspectPlugin, installPlugin, pluginInspectionHealthy } from './plugin.js';

export const imessagePluginSource = '@openclaw/imessage';

function imessagePluginInstalled(inspection) {
  const resolvedName = inspection?.install?.resolvedName;
  return (
    inspection?.plugin?.packageName === imessagePluginSource &&
    inspection.plugin.channelIds?.includes('imessage') === true &&
    (resolvedName == null || resolvedName === imessagePluginSource)
  );
}

export function imessagePluginInspectionHealthy(inspection) {
  return (
    pluginInspectionHealthy(inspection, 'imessage') &&
    inspection.plugin.status === 'loaded' &&
    imessagePluginInstalled(inspection)
  );
}

export function checkImessagePlugin() {
  return imessagePluginInspectionHealthy(inspectPlugin('imessage'));
}

export function applyImessagePlugin() {
  const inspection = inspectPlugin('imessage');
  if (!imessagePluginInstalled(inspection) || inspection.plugin.status === 'error') {
    installPlugin(imessagePluginSource, { force: true });
  }
  enablePlugin('imessage');
}
