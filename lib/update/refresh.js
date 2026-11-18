import checkCheckout from './utils/check-checkout.js';
import inspectCheckout from './inspect.js';

function checkoutError(reason, snapshot, skipped = false) {
  return Object.assign(new Error(reason), {
    skipped,
    checkoutStatus:
      snapshot?.canonical && snapshot.clean === false ? snapshot.changedPaths : undefined,
  });
}

export async function verifyCheckout({ source, execute, head }) {
  const snapshot = await inspectCheckout({ source, execute, timeoutMs: 600_000 });
  if (checkCheckout(source, snapshot) || snapshot.head !== head)
    throw checkoutError('checkout-changed', snapshot);
}

/** Recheck the live checkout, never a previous run's journal. No reset or automatic retry. */
export default async function refresh({ source, execute, inspect = inspectCheckout }) {
  const check = () => inspect({ source, execute, timeoutMs: 600_000 });
  const before = await check();
  const reason = checkCheckout(source, before);
  if (reason) throw checkoutError(reason, before, true);
  await execute('git', [
    'fetch',
    '--no-tags',
    'origin',
    'refs/heads/main:refs/remotes/origin/main',
  ]);
  const target = (
    await execute('git', ['rev-parse', '--verify', 'refs/remotes/origin/main'])
  ).trim();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(target)) throw new Error('revision-invalid');
  const counts = (
    await execute('git', ['rev-list', '--left-right', '--count', `${before.head}...${target}`])
  ).trim();
  if (!/^\d+\s+\d+$/.test(counts)) throw new Error('ancestry-invalid');
  const [ahead, behind] = counts.split(/\s+/).map(Number);
  if (ahead > 0) throw checkoutError(behind > 0 ? 'diverged' : 'ahead', before, true);
  const current = await check();
  const changed = checkCheckout(source, current, before);
  if (changed) throw checkoutError(changed, current, true);
  if (before.head !== target) await execute('git', ['merge', '--ff-only', '--no-edit', target]);
  const after = await check();
  if (checkCheckout(source, after, { ...before, head: target }))
    throw checkoutError('checkout-changed', after);
  return { before: before.head, after: target, changed: before.head !== target };
}
