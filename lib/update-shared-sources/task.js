import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import openStorage from '../backup/storage.js';
import checkRuntime from '../update/utils/check-runtime.js';
import commandsFor from '../update/commands.js';
import readInventory from './inventory.js';
import refreshCheckout, { verifyCheckout } from '../update/refresh.js';
import report, { failure } from '../update/report.js';

export default async function runSourceTask({
  argv = [],
  cwd,
  environment = process.env,
  signal,
  stdout = process.stdout,
  stderr = process.stderr,
  runtimeVersion = process.versions.bun,
  open = openStorage,
  inventory = readInventory,
  commands = commandsFor,
  refresh = refreshCheckout,
  canonicalize = realpath,
}) {
  const rows = [];
  const actions = [];
  let storage;
  try {
    if (argv.length) throw new Error('arguments-invalid');
    if (!checkRuntime({ version: runtimeVersion }).supported)
      throw new Error('runtime-unsupported');
    const workspace = await canonicalize(cwd);
    if (workspace !== (await canonicalize(fileURLToPath(new URL('../../', import.meta.url)))))
      throw new Error('unsupported-target');
    storage = await open(workspace);
    const sources = await inventory(workspace);
    for (const source of sources) {
      const row = {
        name: source.id === 'canon' ? 'Canon' : 'Agent System',
        status: 'pending',
        label: 'Not run',
        cells: ['—', '—'],
      };
      rows.push(row);
      let step = 'Repository';
      try {
        signal?.throwIfAborted();
        if (source.status !== 'candidate')
          throw Object.assign(new Error(source.status), { skipped: true });
        const execute = commands({
          cwd: source.path,
          storage,
          environment,
          signal,
          diagnostic: (text) => stderr.write(`${source.id}: ${text}\n`),
        });
        const updated = await refresh({ source, execute });
        row.cells[0] = updated.changed
          ? `${updated.before.slice(0, 7)} → ${updated.after.slice(0, 7)}`
          : updated.after.slice(0, 7);
        step = 'Dependencies';
        await execute('bun', ['install', '--frozen-lockfile']);
        await verifyCheckout({ source, execute, head: updated.after });
        row.cells[1] = 'Dependencies installed.';
        if (source.id === 'openclaw-agent-system') {
          step = 'Build/sync';
          await execute('bun', ['run', 'sync']);
          await verifyCheckout({ source, execute, head: updated.after });
          row.cells[1] += ' Build/sync completed.';
        }
        Object.assign(row, { status: 'success', label: updated.changed ? 'Updated' : 'Current' });
      } catch (error) {
        const result = failure(error, step);
        Object.assign(row, { status: result.status, label: result.label });
        row.cells[1] = `${row.cells[1] === '—' ? '' : `${row.cells[1]} `}${result.result}`;
        actions.push(`${row.name}: ${result.action}`);
      }
    }
  } catch (error) {
    const result = failure(error, 'Preflight');
    rows.push({
      name: 'Preflight',
      status: result.status,
      label: result.label,
      cells: ['—', result.result],
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
        cells: ['—', 'Could not close update exclusion.'],
      });
      actions.push('Inspect the active maintenance process before another update.');
    }
  }
  const result = report({
    id: 'update-shared-sources',
    title: 'UPDATE SOURCES',
    columns: ['Repository', 'Status', 'Revision', 'Result'],
    rows,
    actions,
    notes: [
      'Source/build results only; running Gateway activation is not checked. No Gateway restart was performed.',
    ],
  });
  stdout.write(result.stdout);
  return result.exitCode;
}
