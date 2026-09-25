import { spawnSync } from 'node:child_process';

export function commandResult(command, args, options = {}) {
  return spawnSync(command, args, {
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
  if (result.error) throw new Error(`${command} is unavailable.`);
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args[0] ?? ''} failed.`);
  }
  return result;
}
