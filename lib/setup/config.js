import { parseJson, run } from './command.js';

export function configPathUnset(result, path) {
  if (result.status === 0) return false;
  try {
    const output = JSON.parse(result.stdout);
    return output?.error?.message?.startsWith(`Config path is valid but unset: ${path}.`) === true;
  } catch {
    return false;
  }
}

export function readConfigValue(path) {
  const result = run('openclaw', ['config', 'get', path, '--json'], { allowFailure: true });
  if (configPathUnset(result, path)) return undefined;
  if (result.status !== 0) throw new Error(`OpenClaw could not inspect ${path}.`);
  return parseJson(result.stdout, `openclaw config get ${path}`);
}
