import { randomUUID } from 'node:crypto';

const steps = ['source', 'dependencies', 'install', 'doctor'];
const codes = new Set([
  'unsupported-target',
  'dirty',
  'non-main',
  'detached',
  'unsafe-upstream',
  'in-progress',
  'ahead-or-diverged',
  'observation-changed',
  'deadline',
  'command-failed',
  'command-timeout',
  'command-output-invalid',
  'automation-execution-stale',
  'interrupted-run',
  'checkpoint-invalid',
]);

/** Never persist arbitrary exception text or subprocess output. */
export function failureCode(error) {
  return codes.has(error?.message) ? error.message : 'command-failed';
}

function eligibility(value, workspace) {
  if (value.workspace !== workspace || value.canonical !== true) return 'unsupported-target';
  if (value.dirty !== false) return 'dirty';
  if (!value.branch) return 'detached';
  if (value.branch !== 'main') return 'non-main';
  if (value.inProgress !== false) return 'in-progress';
  if (value.upstream !== 'origin/main' || value.remoteApproved !== true) return 'unsafe-upstream';
  if (value.fastForward !== true) return 'ahead-or-diverged';
  if (![value.head, value.target].every((sha) => /^[a-f0-9]{40}$/.test(sha)))
    return 'unsafe-upstream';
}

function unchanged(a, b) {
  return ['workspace', 'head', 'target', 'upstream', 'remote'].every((key) => a[key] === b[key]);
}

/**
 * Native commands own lifecycle refusals. Local locks cover backup/update overlap,
 * not other checkout users or shared maintenance; that coordination is deferred.
 * No operation is retried or rolled back after an uncertain result.
 */
export default async function runUpdate({
  workspace,
  commands,
  storage,
  now = Date.now,
  id = randomUUID(),
  budgetMs = 1_800_000,
}) {
  const started = now();
  const result = {
    version: 1,
    job: 'update-agent',
    id,
    workspace,
    startedAt: new Date(started).toISOString(),
    status: 'running',
    steps: Object.fromEntries(steps.map((step) => [step, { status: 'unattempted' }])),
  };
  let current = 'source';
  const checkpoint = () => storage.write(result);
  const guard = async () => {
    if (now() - started >= budgetMs) throw new Error('deadline');
    await storage.assertHeld();
  };
  const step = async (name, operation) => {
    current = name;
    await guard();
    result.steps[name] = { status: 'running' };
    await checkpoint();
    const value = await operation(Math.max(1, budgetMs - (now() - started)));
    result.steps[name] = { status: 'completed', ...value };
    await checkpoint();
  };
  try {
    const previous = await storage.read();
    // An uncertain earlier mutation needs operator inspection, never automatic replay.
    if (
      previous !== undefined &&
      (!previous ||
        previous.version !== 1 ||
        previous.workspace !== workspace ||
        previous.job !== 'update-agent' ||
        !['running', 'attention', 'success'].includes(previous.status) ||
        !/^[a-zA-Z0-9-]{1,80}$/.test(previous.id))
    )
      throw new Error('checkpoint-invalid');
    if (previous && (previous.status === 'running' || previous.pending)) {
      result.predecessor = /^[a-zA-Z0-9-]{1,80}$/.test(previous.id) ? previous.id : undefined;
      throw new Error('interrupted-run');
    }
    if (previous?.reason === 'interrupted-run' || previous?.reason === 'checkpoint-invalid') {
      result.predecessor = previous.id;
      throw new Error(previous.reason);
    }
    await guard();
    await step('source', async (remaining) => {
      const before = await commands.inspect(remaining);
      const reason = eligibility(before, workspace);
      if (reason) throw new Error(reason);
      result.before = before.head;
      await guard();
      await commands.fetch(Math.max(1, budgetMs - (now() - started)));
      const fetched = await commands.inspect(Math.max(1, budgetMs - (now() - started)));
      const fetchedReason = eligibility(fetched, workspace);
      if (fetchedReason) throw new Error(fetchedReason);
      if (before.head !== fetched.head || before.remote !== fetched.remote)
        throw new Error('observation-changed');
      await guard();
      const checked = await commands.inspect(Math.max(1, budgetMs - (now() - started)));
      const checkedReason = eligibility(checked, workspace);
      if (checkedReason) throw new Error(checkedReason);
      if (!unchanged(fetched, checked)) throw new Error('observation-changed');
      result.target = checked.target;
      await checkpoint();
      if (checked.head !== checked.target) {
        await guard();
        result.pending = 'source';
        await checkpoint();
        await commands.advance(checked.target, Math.max(1, budgetMs - (now() - started)));
      }
      const after = await commands.inspect(Math.max(1, budgetMs - (now() - started)));
      if (eligibility(after, workspace) || after.head !== checked.target)
        throw new Error('observation-changed');
      result.after = after.head;
      delete result.pending;
      return { changed: checked.head !== checked.target };
    });
    await step('dependencies', async (remaining) => {
      result.pending = 'dependencies';
      await checkpoint();
      await commands.dependencies(remaining);
      const after = await commands.inspect(Math.max(1, budgetMs - (now() - started)));
      if (eligibility(after, workspace) || after.head !== result.after)
        throw new Error('observation-changed');
      delete result.pending;
    });
    await step('install', async (remaining) => {
      result.pending = 'install';
      await checkpoint();
      const installed = await commands.install(remaining);
      delete result.pending;
      return installed;
    });
    await step('doctor', async (remaining) => {
      await commands.doctor(remaining);
    });
    await guard();
    result.status = 'success';
  } catch (error) {
    result.status = 'attention';
    result.reason = failureCode(error);
    result.steps[current] = { ...result.steps[current], status: 'blocked', reason: result.reason };
    if (current === 'install' && error.lifecycle) {
      result.steps.install.lifecycle = Object.fromEntries(
        ['completed', 'skipped', 'unattempted'].map((name) => [
          name,
          Number.isSafeInteger(error.lifecycle[name]) && error.lifecycle[name] >= 0
            ? error.lifecycle[name]
            : 0,
        ]),
      );
      if (Number.isSafeInteger(error.warnings) && error.warnings >= 0)
        result.steps.install.warnings = error.warnings;
    }
    if (
      !result.pending &&
      [
        'unsupported-target',
        'dirty',
        'non-main',
        'detached',
        'unsafe-upstream',
        'in-progress',
        'ahead-or-diverged',
      ].includes(result.reason)
    )
      result.steps[current].status = 'skipped';
  }
  result.finishedAt = new Date(now()).toISOString();
  // Preserve malformed evidence for inspection instead of replacing it with a
  // fresh journal that would accidentally permit a later replay.
  if (result.reason !== 'checkpoint-invalid') await checkpoint();
  return result;
}
