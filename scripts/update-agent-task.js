#!/usr/bin/env bun
import { realpath } from 'node:fs/promises';

import { semver } from 'bun';

import packageJson from '../package.json' with { type: 'json' };
import updateCommands from '../lib/update-agent/commands.js';
import updateHost from '../lib/update-agent/host.js';
import runUpdate from '../lib/update-agent/run.js';
import updateStorage from '../lib/update-agent/storage.js';

let storage;
try {
  if (process.argv.length !== 2) throw new Error('arguments-invalid');
  if (!semver.satisfies(process.versions.bun, packageJson.engines.bun))
    throw new Error('runtime-unsupported');
  const workspace = await realpath(process.cwd());
  storage = await updateStorage(workspace);
  const result = await runUpdate({
    workspace,
    storage,
    host: updateHost(),
    commands: updateCommands({ workspace, storage }),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.stderr.write(
    `Agent update: ${result.status}${result.reason ? ` (${result.reason})` : ''}. Inspect .private/update-agent/status.json.\n`,
  );
  if (result.status !== 'success') process.exitCode = 1;
} catch (error) {
  const code = [
    'arguments-invalid',
    'runtime-unsupported',
    'backup-run-locked',
    'update-run-locked',
  ].includes(error.message)
    ? error.message
    : 'update-task-failed';
  process.stderr.write(`Agent update stopped (${code}); no automatic rollback or retry.\n`);
  process.exitCode = 1;
} finally {
  try {
    await storage?.close();
  } catch {
    process.stderr.write('Update exclusion close failed.\n');
    process.exitCode = 1;
  }
}
