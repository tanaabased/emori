import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

import backupCommands from './commands.js';
import formatBackupReport from './utils/format-backup-report.js';
import openStorage from './storage.js';
import runBackupDrive from './drive-task.js';

/** Run maintenance once; report mode changes presentation, never backup or delivery policy. */
export default async function runBackupTask({
  argv = [],
  cwd,
  stdout = process.stdout,
  stderr = process.stderr,
  canonicalize = realpath,
  open = openStorage,
  commands = backupCommands,
  run = runBackupDrive,
}) {
  const args = [...argv];
  const report = args[0] === '--report';
  if (report) args.shift();
  let storage;
  let result;
  let failure;
  let closeFailed = false;
  try {
    const operator = args[0] === '--operator';
    if (operator) args.shift();
    const resumeArchive =
      args[0] === '--resume-archive' && args.length === 2 ? resolve(cwd, args[1]) : undefined;
    if (args.length && (!operator || !resumeArchive)) throw new Error('arguments-invalid');
    const workspace = await canonicalize(cwd);
    storage = await open(workspace);
    const boundCommands = commands({ workspace, operator, storage });
    result = await run({ workspace, commands: boundCommands, storage, resumeArchive });
  } catch (error) {
    failure = error;
  } finally {
    try {
      await storage?.close();
    } catch {
      closeFailed = true;
    }
  }
  const rendered = formatBackupReport({ result, failure, closeFailed });
  if (report) {
    stdout.write(rendered.stdout);
    if (rendered.stderr) stderr.write(rendered.stderr);
  } else {
    if (result) stdout.write(`${JSON.stringify(result)}\n`);
    if (failure || closeFailed) stderr.write(rendered.stderr);
  }
  return failure || closeFailed ? 1 : 0;
}
