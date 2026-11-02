import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import checkRuntime from './utils/check-runtime.js';
import formatUpdateReport from './utils/format-update-report.js';
import updateCommands from './commands.js';
import runUpdate from './run.js';
import updateStorage from './storage.js';

/** Execute once, close exclusions, then render the final outcome, including early errors. */
export default async function runUpdateTask({
  argv = [],
  cwd,
  runtimeVersion = process.versions.bun,
  runtimeExecutable = process.execPath,
  stdout = process.stdout,
  stderr = process.stderr,
  canonicalize = realpath,
  open = updateStorage,
  commands = updateCommands,
  run = runUpdate,
}) {
  const runtime = checkRuntime({ version: runtimeVersion, executable: runtimeExecutable });
  let storage;
  let result;
  let failure;
  let closeFailed = false;
  try {
    if (argv.length) throw new Error('arguments-invalid');
    if (!runtime.supported) throw new Error('runtime-unsupported');
    const workspace = await canonicalize(cwd);
    if (workspace !== (await canonicalize(fileURLToPath(new URL('../../', import.meta.url)))))
      throw new Error('unsupported-target');
    storage = await open(workspace);
    result = await run({
      workspace,
      storage,
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
  const rendered = formatUpdateReport({ result, failure, closeFailed, runtime });
  stdout.write(rendered.stdout);
  if (rendered.stderr) stderr.write(rendered.stderr);
  return rendered.exitCode;
}
