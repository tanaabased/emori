import { parseJson, run } from './command.js';

export function inspectPlugin(id) {
  const result = run('openclaw', ['plugins', 'inspect', id, '--json'], { allowFailure: true });
  const inspection = parseJson(result.stdout, `openclaw plugins inspect ${id}`);
  if (result.status === 0 && inspection?.plugin?.id === id) return inspection;

  // Only OpenClaw's explicit missing-plugin response permits installation.
  if (
    result.status === 1 &&
    inspection?.ok === false &&
    inspection.error?.type === 'cli_error' &&
    typeof inspection.error.message === 'string' &&
    inspection.error.message.startsWith(`Plugin not found: ${id}. Run `)
  ) {
    return null;
  }
  throw new Error(`OpenClaw could not inspect plugin ${id}.`);
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
