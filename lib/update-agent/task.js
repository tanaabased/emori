import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import openStorage from '../backup/storage.js';
import checkRuntime from '../update/utils/check-runtime.js';
import commandsFor from '../update/commands.js';
import lifecycle from './lifecycle.js';
import refreshCheckout, { verifyCheckout } from '../update/refresh.js';
import report, { failure } from '../update/report.js';

export default async function runUpdateTask({
  argv = [],
  cwd,
  environment = process.env,
  signal,
  stdout = process.stdout,
  stderr = process.stderr,
  runtimeVersion = process.versions.bun,
  open = openStorage,
  commands = commandsFor,
  refresh = refreshCheckout,
  canonicalize = realpath,
}) {
  const rows = ['Repository', 'Dependencies', 'Install', 'Doctor'].map((name) => ({
    name,
    status: 'pending',
    label: 'Not run',
    cells: ['—'],
  }));
  const actions = [];
  let storage;
  let current = 0;
  try {
    if (argv.length) throw new Error('arguments-invalid');
    if (!checkRuntime({ version: runtimeVersion }).supported)
      throw new Error('runtime-unsupported');
    const workspace = await canonicalize(cwd);
    if (workspace !== (await canonicalize(fileURLToPath(new URL('../../', import.meta.url)))))
      throw new Error('unsupported-target');
    storage = await open(workspace);
    const execute = commands({
      cwd: workspace,
      storage,
      environment,
      signal,
      diagnostic: (text) => stderr.write(`${text}\n`),
    });
    const checkout = { id: 'emori', path: workspace };
    const source = await refresh({ source: checkout, execute });
    Object.assign(rows[0], {
      status: 'success',
      label: source.changed ? 'Updated' : 'Current',
      cells: [
        source.changed
          ? `${source.before.slice(0, 7)} → ${source.after.slice(0, 7)}`
          : source.after.slice(0, 7),
      ],
    });
    current = 1;
    await execute('bun', ['install', '--frozen-lockfile', '--ignore-scripts']);
    await verifyCheckout({ source: checkout, execute, head: source.after });
    Object.assign(rows[1], {
      status: 'success',
      label: 'Installed',
      cells: ['Lockfile unchanged.'],
    });
    for (const operation of ['install', 'doctor']) {
      current = operation === 'install' ? 2 : 3;
      const result = await lifecycle(operation, execute);
      Object.assign(rows[current], {
        status: result.status,
        label: result.label,
        cells: [result.result],
      });
      actions.push(...result.actions);
    }
  } catch (error) {
    const result = failure(error, rows[current].name);
    Object.assign(rows[current], {
      status: result.status,
      label: result.label,
      cells: [result.result],
    });
    actions.push(result.action);
  } finally {
    try {
      await storage?.close();
    } catch {
      rows.push({
        name: 'Cleanup',
        status: 'error',
        label: 'Failed',
        cells: ['Could not close update exclusion.'],
      });
      actions.push('Inspect the active maintenance process before another update.');
    }
  }
  const result = report({
    id: 'update-agent',
    title: 'UPDATE AGENT',
    columns: ['Step', 'Status', 'Result'],
    rows,
    actions,
  });
  stdout.write(result.stdout);
  return result.exitCode;
}
