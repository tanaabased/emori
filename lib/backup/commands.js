import { spawnSync } from 'node:child_process';

/** Use only the strict bound launcher, or the operator's explicit managed CLI mode. */
export default function backupCommands({
  workspace,
  operator,
  storage,
  environment = process.env,
  spawn = spawnSync,
}) {
  if (!operator && !environment.AGENT_SYSTEM_GOG) throw new Error('agent-binding-required');
  if (!Number.isInteger(storage?.lockFd) || storage.lockFd < 0)
    throw new Error('backup-lock-required');
  const execute = async (family, command, argv) => {
    await storage.assertHeld();
    const result = spawn(command, argv, {
      cwd: workspace,
      env: environment,
      encoding: 'utf8',
      // Keep the same flock alive if the wrapper is killed while this command runs.
      stdio: ['ignore', 'pipe', 'pipe', storage.lockFd],
      maxBuffer: 64 * 1024 * 1024,
      timeout: 600_000,
      killSignal: 'SIGKILL',
    });
    if (result.error || result.status !== 0 || result.signal) {
      // Deliberately exclude argv, environment and subprocess text, even if it looks sanitized.
      const error = new Error('managed-command-failed');
      error.diagnostic = {
        command: family,
        reason:
          result.error?.code === 'ETIMEDOUT'
            ? 'timeout'
            : result.error?.code === 'ENOBUFS'
              ? 'output-limit'
              : result.error
                ? 'spawn'
                : 'exit',
        exit: Number.isInteger(result.status) ? result.status : null,
        signal: ['SIGKILL', 'SIGTERM', 'SIGINT', 'SIGABRT', 'SIGSEGV'].includes(result.signal)
          ? result.signal
          : null,
      };
      throw error;
    }
    await storage.assertHeld();
    try {
      return JSON.parse(result.stdout);
    } catch {
      throw new Error('managed-output-invalid');
    }
  };
  return {
    backup: (argv) => execute('backup', 'openclaw', ['agent-system', 'backup', ...argv, '--json']),
    drive: (argv) =>
      operator
        ? execute('google', 'openclaw', ['agent-system', 'tool', 'gog', '--', ...argv])
        : execute('google', environment.AGENT_SYSTEM_GOG, argv),
  };
}
