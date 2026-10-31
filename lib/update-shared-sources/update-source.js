import checkCheckout from './utils/check-checkout.js';

/**
 * Update one already selected source under a caller-owned reservation.
 * Internal core only: no production admission, subprocess, restart or scheduler adapter.
 * `inspect({timeoutMs})` supplies checkCheckout facts while holding exclusion.
 * `execute(family, argv, {timeoutMs})` must enforce the timeout, use managed Git,
 * return stdout and reject nonzero exits. Neither boundary may outlive exclusion.
 * `deadline` is shared across sources; this function never retries a mutation.
 */
export default async function updateSource({ source, inspect, execute, deadline, now = Date.now }) {
  const result = { id: source.id, status: 'pending', steps: [], pending: [] };
  let phase = 'inspect';
  const budget = () => {
    const timeoutMs = Math.floor(deadline - now());
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('deadline-exceeded');
    return { timeoutMs };
  };
  const command = (family, argv) => execute(family, argv, budget());
  const skip = (reason) => ({ ...result, status: 'skipped', reason });
  try {
    if (source.status === 'excluded') return { ...result, status: 'excluded' };
    if (source.status !== 'candidate') return skip(source.status);
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
    await command('bun', ['install', '--frozen-lockfile']);
    result.steps.push('dependencies-installed');

    if (source.id === 'openclaw-agent-system') {
      phase = 'sync';
      await command('bun', ['run', 'sync']);
      result.steps.push('synced');
      // A successful build does not establish what the shared Gateway is serving.
      result.pending.push('runtime-handoff');
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
