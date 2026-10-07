import { spawnSync } from 'node:child_process';

/** Use only the strict bound launcher, or the operator's explicit managed CLI mode. */
export default function backupCommands({ workspace, operator, environment = process.env }) {
  if (!operator && !environment.AGENT_SYSTEM_GOG) throw new Error('agent-binding-required');
  const execute = (command, argv) => {
    const result = spawnSync(command, argv, {
      cwd: workspace,
      env: environment,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      timeout: 600_000,
      killSignal: 'SIGKILL',
    });
    if (result.error || result.status !== 0 || result.signal)
      throw new Error('managed-command-failed');
    try {
      return JSON.parse(result.stdout);
    } catch {
      throw new Error('managed-output-invalid');
    }
  };
  return {
    backup: (argv) => execute('openclaw', ['agent-system', 'backup', ...argv, '--json']),
    drive: (argv) =>
      operator
        ? execute('openclaw', ['agent-system', 'tool', 'gog', '--', ...argv])
        : execute(environment.AGENT_SYSTEM_GOG, argv),
  };
}
