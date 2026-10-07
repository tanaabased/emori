#!/usr/bin/env bun
import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

import backupCommands from '../lib/backup/commands.js';
import runBackupDrive from '../lib/backup/drive-task.js';
import openStorage from '../lib/backup/storage.js';

let storage;
try {
  const argv = process.argv.slice(2);
  const operator = argv[0] === '--operator';
  if (operator) argv.shift();
  const resumeArchive =
    argv[0] === '--resume-archive' && argv.length === 2 ? resolve(argv[1]) : undefined;
  if (argv.length && (!operator || !resumeArchive)) throw new Error('arguments-invalid');
  const workspace = await realpath(process.cwd());
  const commands = backupCommands({ workspace, operator });
  storage = await openStorage(workspace);
  const result = await runBackupDrive({ workspace, commands, storage, resumeArchive });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  const code = /^[a-z][a-z0-9-]{1,80}$/.test(error.message) ? error.message : 'task-failed';
  process.stderr.write(
    `Backup Drive task failed (${code}); inspect .private/backup-drive/status.json and journal.json.\n`,
  );
  process.exitCode = 1;
} finally {
  try {
    await storage?.close();
  } catch {
    process.stderr.write('Backup lock release failed; operator review required.\n');
    process.exitCode = 1;
  }
}
