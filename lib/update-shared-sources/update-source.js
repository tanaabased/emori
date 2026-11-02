import buildEvidence from './build-evidence.js';
import checkCheckout from './utils/check-checkout.js';
import validBuild from './utils/valid-build.js';

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
  previous,
  evidence = buildEvidence,
}) {
  const result = {
    id: source.id,
    status: 'pending',
    steps: [],
    pending: [...(previous?.pending ?? [])],
    ...(previous?.build ? { build: { ...previous.build } } : {}),
  };
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
      phase = 'build-check';
      const capture = async () => {
        const current = await evidence({ source, head: target, files, execute, budget });
        if (checkCheckout(source, await inspect(budget()), { ...before, head: target }))
          throw new Error('checkout-verification-failed');
        return current;
      };
      const current = await capture();
      if (
        validBuild(result.build) &&
        validBuild(current) &&
        current.inputs === result.build.inputs &&
        current.artifacts === result.build.artifacts
      ) {
        result.steps.push('build-current');
      } else {
        phase = 'sync';
        // Invalidate before the command: even a partial build may need activation.
        delete result.build;
        if (!result.pending.includes('restart')) result.pending.push('restart');
        await command('bun', ['run', 'sync']);
        result.steps.push('synced');
        phase = 'build-check';
        const built = await capture();
        if (!validBuild(built) || built.inputs !== current.inputs)
          throw new Error('build-evidence-invalid');
        result.build = built;
      }
    }
    result.status = 'completed';
  } catch (error) {
    result.status = 'failed';
    result.phase = phase;
    result.reason = [
      'deadline-exceeded',
      'revision-invalid',
      'ancestry-invalid',
      'checkout-verification-failed',
      'build-evidence-invalid',
    ].includes(error?.message)
      ? error.message
      : 'operation-failed';
    if (Number.isInteger(error?.exitCode) && error.exitCode > 0 && error.exitCode <= 255)
      result.exitCode = error.exitCode;
    // Provider messages, argv, environments and raw output must not enter the report.
  }
  return result;
}
