import { realpath } from 'node:fs/promises';

import { semver } from 'bun';

import packageJson from '../../package.json' with { type: 'json' };
import formatUpdateReport from './utils/format-update-report.js';
import updateCommands from './commands.js';
import updateHost from './host.js';
import runUpdate from './run.js';
import updateStorage from './storage.js';

/** Execute once, close exclusions, then render the final outcome, including early errors. */
export default async function runUpdateTask({
  argv = [],
  cwd,
  runtimeVersion = process.versions.bun,
  stdout = process.stdout,
  stderr = process.stderr,
  canonicalize = realpath,
  open = updateStorage,
  commands = updateCommands,
  host = updateHost,
  run = runUpdate,
}) {
  let storage;
  let result;
  let failure;
  let closeFailed = false;
  try {
    if (argv.length) throw new Error('arguments-invalid');
    if (!runtimeVersion || !semver.satisfies(runtimeVersion, packageJson.engines.bun))
      throw new Error('runtime-unsupported');
    const workspace = await canonicalize(cwd);
    storage = await open(workspace);
    result = await run({
      workspace,
      storage,
      host: host(),
      commands: commands({ workspace, storage }),
    });
  } catch (error) {
    failure = error;
  } finally {
    try {
      await storage?.close();
    } catch {
      closeFailed = true;
    }
  }
  const rendered = formatUpdateReport({ result, failure, closeFailed });
  stdout.write(rendered.stdout);
  if (rendered.stderr) stderr.write(rendered.stderr);
  return rendered.exitCode;
}
