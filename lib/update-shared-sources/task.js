import { realpath } from 'node:fs/promises';

import formatSourceReport from './utils/format-source-report.js';
import inspectSource from './inspect.js';
import openStorage from './storage.js';
import readInventory from './inventory.js';
import sourceCommands from './commands.js';
import updateSource from './update-source.js';

const failures = {
  'arguments-invalid':
    'Use no arguments to update, or `--report-only` to read the last result without updating.',
  'agent-binding-required':
    'Run this job through Agent System so managed Git authority is supplied.',
  'workspace-identity-invalid': 'Run from the installed EMORI workspace with its own manifest.',
  'inventory-invalid': 'Check `git.worktrees.repositories.local` in the EMORI manifest.',
  'update-run-active': 'Another source updater is still running; no new update was started.',
  'journal-invalid':
    'The private update journal is invalid. Inspect it before running maintenance again.',
  'journal-unsafe':
    'The private update journal path is unsafe. Restore an ordinary private directory.',
  'journal-lock-lost': 'The updater lock changed. Inspect the private journal before another run.',
};

/** Emit Markdown on every outcome. Report-only never repeats maintenance. */
export default async function runSourceTask({
  argv = [],
  cwd,
  stdout = process.stdout,
  stderr = process.stderr,
  environment = process.env,
  signal,
  inventory = readInventory,
  open = openStorage,
  commands = sourceCommands,
  inspect = inspectSource,
  now = Date.now,
}) {
  const deadline = now() + 1_795_000;
  const results = [];
  let storage;
  let failure;
  let previous;
  let reportOnly = false;
  let closeFailed = false;
  try {
    reportOnly = argv.length === 1 && argv[0] === '--report-only';
    if (argv.length && !reportOnly) throw new Error('arguments-invalid');
    const workspace = await realpath(cwd);
    // Report-only does not require source configuration to remain usable.
    const sources = reportOnly ? [] : await inventory(workspace);
    storage = await open(workspace);
    previous = await storage.read();
    if (reportOnly) {
      results.push(...(previous?.results ?? []));
    } else {
      // Require the strict launcher before changing journals or starting any source.
      commands({ cwd: workspace, storage, environment, signal });
      if (previous) await storage.write(previous, 'previous');
      const record = (finished) => storage.write({ version: 1, finished, results });
      await record(false);
      for (const source of sources) {
        const index = results.length;
        const execute = commands({
          cwd: source.path ?? workspace,
          storage,
          environment,
          signal,
          diagnostic: (text) => stderr.write(`${text}\n`),
        });
        results.push({ id: source.id, status: 'pending', steps: [], pending: [] });
        const result = await updateSource({
          source,
          deadline,
          now,
          execute,
          inspect: ({ timeoutMs }) => inspect({ source, execute, timeoutMs }),
          checkpoint: async (value) => {
            results[index] = value;
            await record(false);
          },
        });
        results[index] = result;
        await record(false);
        if (signal?.aborted) throw new Error('cancelled');
      }
      await record(true);
    }
  } catch (error) {
    failure = error;
  } finally {
    try {
      await storage?.close();
    } catch {
      closeFailed = true;
    }
  }
  if (previous && !previous.finished && !reportOnly) {
    stdout.write(formatSourceReport(previous.results, { historical: true }).stdout);
    stdout.write('\n---\n\n');
  }
  const report = formatSourceReport(results, {
    historical: reportOnly && previous && !previous.finished,
  });
  stdout.write(report.stdout);
  if (report.stderr) stderr.write(report.stderr);
  if (failure || closeFailed) {
    const reason =
      (Object.hasOwn(failures, failure?.message) ? failures[failure.message] : undefined) ??
      (failure?.message === 'cancelled'
        ? 'Update cancelled; inspect the retained partial result before another run.'
        : 'Wrapper or journal operation failed. Inspect the retained result and configured paths before another run.');
    stdout.write(
      `\n---\n\n## ❌ Updater failed\n\n${reason}\n${closeFailed ? '\nJournal cleanup failed; completed source steps above still apply.\n' : ''}`,
    );
    stderr.write('Shared-source wrapper did not complete.\n');
  }
  return failure || closeFailed || (reportOnly && previous && !previous.finished)
    ? 1
    : report.exitCode;
}
