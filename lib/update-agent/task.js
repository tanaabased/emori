import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import checkRuntime from './utils/check-runtime.js';
import formatUpdateReport from './utils/format-update-report.js';
import updateCommands from './commands.js';
import runUpdate from './run.js';
import updateStorage from './storage.js';
import verifyUpdate from './verify.js';

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
  verify = verifyUpdate,
}) {
  if (argv.length === 1 && argv[0] === '--help') {
    stdout.write(
      'Agent update: bun scripts/update-agent-task.js [--verify-only | --report-only | --help]\n--verify-only checks health of a proven applied update without repeating changes.\n--report-only reads retained outcomes without running updates or claiming message delivery.\nReports use the Agent System structured JSON document.\n',
    );
    return 0;
  }
  const reportOnly = argv.length === 1 && argv[0] === '--report-only';
  const verifyOnly = argv.length === 1 && argv[0] === '--verify-only';
  const runtime = checkRuntime({ version: runtimeVersion, executable: runtimeExecutable });
  let storage;
  let result;
  let failure;
  let closeFailed = false;
  let verification;
  try {
    if (argv.length && !reportOnly && !verifyOnly) throw new Error('arguments-invalid');
    if (!runtime.supported) throw new Error('runtime-unsupported');
    const workspace = await canonicalize(cwd);
    if (workspace !== (await canonicalize(fileURLToPath(new URL('../../', import.meta.url)))))
      throw new Error('unsupported-target');
    storage = await open(workspace);
    if (reportOnly) {
      result = await storage.read();
      if (
        result &&
        (result.version !== 1 ||
          result.job !== 'update-agent' ||
          result.workspace !== workspace ||
          !/^[a-zA-Z0-9-]{1,80}$/u.test(result.id) ||
          !['running', 'attention', 'success'].includes(result.status))
      )
        throw new Error('checkpoint-invalid');
      verification = await storage.read('verification');
      if (verification?.updateId !== result?.id) verification = undefined;
      if (
        verification &&
        (verification.job !== 'verify-agent' ||
          verification.version !== 1 ||
          verification.workspace !== workspace ||
          verification.updateId !== result?.id ||
          !['running', 'attention', 'success'].includes(verification.status) ||
          (verification.status === 'success' &&
            (verification.steps?.doctor?.status !== 'completed' ||
              verification.steps.doctor.health?.status !== 'healthy')))
      )
        throw new Error('checkpoint-invalid');
    } else if (verifyOnly) {
      result = await storage.read();
      ({ result, verification } = await verify({
        workspace,
        storage,
        commands: commands({ workspace, storage }),
      }));
    } else
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
  const rendered = formatUpdateReport({
    result,
    verification,
    failure,
    closeFailed,
    runtime,
    reportOnly,
  });
  stdout.write(rendered.stdout);
  if (rendered.stderr) stderr.write(rendered.stderr);
  return rendered.exitCode;
}
