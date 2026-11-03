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
    'The private update journal is invalid. Inspect it before running updates again.',
  'journal-unsafe':
    'The private update journal path is unsafe. Restore an ordinary private directory.',
  'journal-lock-lost': 'The updater lock changed. Inspect the private journal before another run.',
};

/** Emit one report document after cleanup. Report-only never repeats updates. */
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
  evidence,
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
      // Seed every source before the first operation can interrupt the new run.
      for (const source of sources) {
        const retained = previous?.results.find((result) => result.id === source.id);
        results.push({
          id: source.id,
          status: 'pending',
          steps: [],
          pending: [...(retained?.pending ?? [])],
          ...(retained?.build ? { build: { ...retained.build } } : {}),
        });
      }
      const record = (finished) => storage.write({ version: 1, finished, results });
      await record(false);
      for (const [index, source] of sources.entries()) {
        signal?.throwIfAborted();
        const execute = commands({
          cwd: source.path ?? workspace,
          storage,
          environment,
          signal,
          diagnostic: (text) => stderr.write(`${text}\n`),
        });
        const result = await updateSource({
          source,
          deadline,
          now,
          execute,
          previous: results[index],
          evidence,
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
  const report = formatSourceReport(results, {
    historical: reportOnly && previous && !previous.finished,
    previous: previous && !previous.finished && !reportOnly ? previous.results : [],
    failure,
    closeFailed,
    retained: reportOnly,
  });
  stdout.write(report.stdout);
  if (report.stderr) stderr.write(report.stderr);
  if (failure || closeFailed) {
    const reason =
      (Object.hasOwn(failures, failure?.message) ? failures[failure.message] : undefined) ??
      (failure?.message === 'cancelled'
        ? 'Update cancelled; inspect the retained partial result before another run.'
        : 'Wrapper or journal operation failed. Inspect the retained result and configured paths before another run.');
    stderr.write(`${reason}\n`);
    stderr.write('Shared-source wrapper did not complete.\n');
  }
  return failure || closeFailed || (reportOnly && previous && !previous.finished)
    ? 1
    : report.exitCode;
}
