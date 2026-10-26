import { spawnSync } from 'node:child_process';

export function commandResult(command, args, options = {}) {
  const spawn = options.spawn ?? spawnSync;
  return spawn(command, args, {
    encoding: 'utf8',
    env: options.env ?? process.env,
    input: options.input,
    maxBuffer: 1024 * 1024,
  });
}

export function parseJson(output, label) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

export function run(command, args, options = {}) {
  const result = commandResult(command, args, options);
  if (result.error) {
    if (result.error.code === 'ENOENT') throw new Error(`${command} is unavailable.`);
    if (result.error.code === 'ENOBUFS') {
      throw new Error(`${command} exceeded its output buffer limit (ENOBUFS).`);
    }
    throw new Error(`${command} could not run (${result.error.code ?? 'unknown error'}).`);
  }
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args[0] ?? ''} failed.`);
  }
  return result;
}
