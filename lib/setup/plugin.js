import { parseJson, run } from './command.js';

export function inspectPlugin(id) {
  const result = run('openclaw', ['plugins', 'inspect', id, '--json'], { allowFailure: true });
  return result.status === 0 ? parseJson(result.stdout, `openclaw plugins inspect ${id}`) : null;
}

export function pluginInspectionHealthy(inspection, id) {
  return (
    inspection?.plugin?.id === id &&
    inspection.plugin.enabled === true &&
    inspection.plugin.status !== 'error'
  );
}

export function enablePlugin(id) {
  run('openclaw', ['plugins', 'enable', id, '--accept-capabilities']);
}

export function installPlugin(source, options = {}) {
  run('openclaw', [
    'plugins',
    'install',
    ...(options.link ? ['--link'] : []),
    source,
    ...(options.force ? ['--force'] : []),
    '--accept-capabilities',
    '--acknowledge-install-policy-warning',
  ]);
}
