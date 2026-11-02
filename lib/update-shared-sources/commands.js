import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';

import sanitizeDiagnostic from './utils/sanitize-diagnostic.js';

/** Strict managed Git, ordinary Bun; no operator identity override or raw Git fallback. */
export default function sourceCommands({
  cwd,
  storage,
  environment = process.env,
  signal,
  diagnostic = () => {},
  start = spawn,
}) {
  const launcher = environment.AGENT_SYSTEM_GIT;
  if (!launcher || !isAbsolute(launcher)) throw new Error('agent-binding-required');
  return async (family, argv, { timeoutMs }) => {
    if (
      !['git', 'bun', 'node'].includes(family) ||
      (family === 'node' && (argv.length !== 1 || argv[0] !== '--version'))
    )
      throw new Error('command-invalid');
    signal?.throwIfAborted();
    await storage.assertHeld();
    const timeout = Math.min(600_000, Math.floor(timeoutMs));
    if (!(timeout > 0)) throw new Error('deadline-exceeded');
    const result = await new Promise((resolve, reject) => {
      // This is a waited child group, not a detached maintenance/restart service.
      const child = start(family === 'git' ? launcher : family, argv, {
        cwd,
        env: environment,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe', storage.lockFd],
      });
      let output = '';
      let errors = '';
      let bytes = 0;
      let failure;
      let killTimer;
      const kill = (name) => {
        try {
          process.kill(-child.pid, name);
        } catch {
          /* The group may already have exited. */
        }
      };
      const stop = (reason) => {
        if (failure) return;
        failure = reason;
        kill('SIGTERM');
        killTimer = setTimeout(() => kill('SIGKILL'), 1000);
      };
      const abort = () => stop('cancelled');
      const timer = setTimeout(() => stop('timeout'), timeout);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      const collect = (chunk, stream) => {
        bytes += chunk.length;
        if (bytes > 256 * 1024) {
          stop('output-limit');
          return;
        }
        if (stream === 'stdout') output += chunk.toString();
        else errors += chunk.toString();
      };
      child.stdout.on('data', (chunk) => collect(chunk, 'stdout'));
      child.stderr.on('data', (chunk) => collect(chunk, 'stderr'));
      child.once('error', () => {
        failure = 'spawn-failed';
      });
      child.once('close', (code, childSignal) => {
        clearTimeout(timer);
        clearTimeout(killTimer);
        signal?.removeEventListener('abort', abort);
        // Do not leave an install/build grandchild running after its owner exits.
        kill('SIGKILL');
        if (failure || code !== 0 || childSignal) {
          diagnostic(
            `${family}: ${failure ?? 'command-failed'}${Number.isInteger(code) ? ` (exit ${code})` : ''}\n${sanitizeDiagnostic(errors || output, environment)}`,
          );
          reject(Object.assign(new Error('operation-failed'), { exitCode: code }));
        } else resolve(output);
      });
    });
    await storage.assertHeld();
    return result;
  };
}
