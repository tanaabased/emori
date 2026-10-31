import checkCheckout from './utils/check-checkout.js';

/**
 * Update an approved source once, retaining observed phases across failures.
 * The caller supplies managed commands, inspection, and a shared deadline.
 * Checkpoints describe observations, not proof an interrupted command completed.
 */
export default async function updateSource({
  source,
  inspect,
  execute,
  deadline,
  now = Date.now,
  checkpoint = async () => {},
}) {
  const result = { id: source.id, status: 'pending', steps: [], pending: [] };
  let phase = 'inspect';
  const budget = () => {
    const timeoutMs = Math.floor(deadline - now());
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('deadline-exceeded');
    return { timeoutMs };
  };
  const save = () =>
    checkpoint({ ...result, steps: [...result.steps], pending: [...result.pending], phase });
  const command = async (family, argv) => {
    await save();
    return execute(family, argv, budget());
  };
  const skip = (reason) => ({ ...result, status: 'skipped', reason });
  try {
    if (source.status === 'excluded') return { ...result, status: 'excluded' };
    if (source.status !== 'candidate') return skip(source.status);
    await save();
    const before = await inspect(budget());
    const ineligible = checkCheckout(source, before);
    if (ineligible) return skip(ineligible);
    result.before = before.head;

    phase = 'fetch';
    await command('git', [
      'fetch',
      '--no-tags',
      'origin',
      'refs/heads/main:refs/remotes/origin/main',
    ]);
    result.steps.push('fetched');
    const target = (
      await command('git', ['rev-parse', '--verify', 'refs/remotes/origin/main'])
    ).trim();
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(target)) throw new Error('revision-invalid');
    result.target = target;

    // FF-only merge also succeeds when locally ahead. Refuse that case explicitly.
    const counts = (
      await command('git', ['rev-list', '--left-right', '--count', `${before.head}...${target}`])
    ).trim();
    if (!/^\d+\s+\d+$/.test(counts)) throw new Error('ancestry-invalid');
    const [ahead, behind] = counts.split(/\s+/).map(Number);
    if (ahead > 0) return skip(behind > 0 ? 'diverged' : 'ahead');

    phase = 'revalidate';
    const changed = checkCheckout(source, await inspect(budget()), before);
    if (changed) return skip(changed);

    phase = 'advance';
    if (before.head !== target) await command('git', ['merge', '--ff-only', '--no-edit', target]);
    const after = await inspect(budget());
    const invalidAfter = checkCheckout(source, after, { ...before, head: target });
    if (invalidAfter) throw new Error('checkout-verification-failed');
    result.after = after.head;
    result.steps.push(before.head === target ? 'unchanged' : 'advanced');

    phase = 'install';
    const files = (
      await command('git', ['ls-files', '-z', '--', 'package.json', 'bun.lock', 'bun.lockb'])
    ).split('\0');
    if (
      !files.includes('package.json') ||
      !files.some((file) => ['bun.lock', 'bun.lockb'].includes(file))
    )
      return skip('not-bun');
    await command('bun', ['install', '--frozen-lockfile']);
    result.steps.push('dependencies-installed');

    if (source.id === 'openclaw-agent-system') {
      phase = 'sync';
      // A build, including a partial failed build, does not establish the serving runtime.
      result.pending.push('restart');
      await command('bun', ['run', 'sync']);
      result.steps.push('synced');
    }
    result.status = result.pending.length ? 'pending' : 'completed';
  } catch (error) {
    result.status = 'failed';
    result.phase = phase;
    result.reason = [
      'deadline-exceeded',
      'revision-invalid',
      'ancestry-invalid',
      'checkout-verification-failed',
    ].includes(error?.message)
      ? error.message
      : 'operation-failed';
    if (Number.isInteger(error?.exitCode) && error.exitCode > 0 && error.exitCode <= 255)
      result.exitCode = error.exitCode;
    // Provider messages, argv, environments and raw output must not enter the report.
  }
  return result;
}
