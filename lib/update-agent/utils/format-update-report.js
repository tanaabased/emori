import { failureCode } from '../run.js';

const earlyCodes = new Set([
  'arguments-invalid',
  'runtime-unsupported',
  'backup-run-locked',
  'update-run-locked',
  'backup-lock-lost',
  'update-lock-lost',
  'private-directory-unsafe',
  'update-lock-unsafe',
]);
const labels = {
  source: 'Source',
  dependencies: 'Dependencies',
  install: 'Install',
  doctor: 'Doctor',
};
const statuses = {
  completed: 'Completed',
  skipped: 'Skipped',
  blocked: 'Pending',
  running: 'Uncertain',
  unattempted: 'Not attempted',
};

function nextAction(code) {
  if (code === 'runtime-unsupported')
    return 'Use a Bun runtime matching `package.json#engines.bun`, then retry.';
  if (code === 'arguments-invalid')
    return 'Run `bun scripts/update-agent-task.js` without arguments.';
  if (code.endsWith('-run-locked'))
    return 'Wait for the lock owner to finish; do not remove its lock.';
  if (code === 'automation-execution-stale')
    return 'Reconcile the changed configuration through Agent System Install, then verify loaded state.';
  return 'Inspect `.private/update-agent/status.json` and native run details before recovery; do not blindly replay uncertain mutations.';
}

/** Render owned facts only; neither raw child output nor arbitrary exception text is report content. */
export default function formatUpdateReport({ result, failure, closeFailed = false, runtime }) {
  const complete =
    result?.status === 'success' &&
    Object.keys(labels).every((name) => result.steps?.[name]?.status === 'completed');
  const failed = Boolean(failure || closeFailed);
  const attention = failed || !complete;
  const reason = failure ?? (result?.reason ? new Error(result.reason) : undefined);
  const code = earlyCodes.has(reason?.message) ? reason.message : failureCode(reason);
  const warnings = result?.steps?.install?.warnings;
  const warned = Number.isSafeInteger(warnings) && warnings > 0;
  const outcome = failed
    ? 'Failed'
    : attention
      ? 'Pending'
      : warned
        ? 'Successful with warning'
        : 'Successful';
  const lines = [
    `## ${failed ? '❌' : attention || warned ? '⚠️' : '✅'} UPDATE AGENT`,
    '',
    `${outcome}.`,
    '',
    '| Field | Result |',
    '|---|---|',
  ];
  for (const [name, label] of Object.entries(labels)) {
    const step = result?.steps?.[name];
    const status = Object.hasOwn(statuses, step?.status) ? statuses[step.status] : 'Not attempted';
    let detail = status;
    if (name === 'source') {
      const revision = (value) =>
        typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value)
          ? `\`${value.slice(0, 12)}\``
          : '';
      const before = revision(result?.before);
      const after = revision(result?.after);
      const target = revision(result?.target);
      const unchanged = before && result.before === result.after;
      detail = after
        ? unchanged
          ? `Unchanged ${after}`
          : `${before || 'Unknown'} → ${after}`
        : `${status}${before ? `; before ${before}; after unknown` : ''}`;
      if (target && result.target !== result.after)
        detail += `; target ${target} (not verified as reached)`;
    }
    if (step?.status === 'completed') {
      if (name === 'dependencies') detail = 'Reconciled (frozen)';
      if (name === 'install') detail = 'Complete; setup skipped';
      if (name === 'doctor') detail = 'Healthy (normal checks)';
    }
    if (name === 'install') {
      const lifecycle = step?.lifecycle;
      const counts = ['completed', 'skipped', 'unattempted']
        .filter((key) => Number.isSafeInteger(lifecycle?.[key]) && lifecycle[key] >= 0)
        .map((key) => `${lifecycle[key]} ${key}`);
      if (counts.length) detail += `; components: ${counts.join(', ')}`;
      if (warned) detail += `; ${warnings} warnings`;
    }
    lines.push(`| ${label} | ${detail} |`);
  }
  lines.push('');
  if (code === 'runtime-unsupported') {
    const actual =
      typeof runtime?.actual === 'string' &&
      /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?$/.test(runtime.actual) &&
      runtime.actual.length <= 64
        ? `\`${runtime.actual}\``
        : 'Unavailable';
    const supported =
      typeof runtime?.supported === 'string' &&
      /\d/.test(runtime.supported) &&
      /^[\d.x*<>=~^ |.-]{1,120}$/.test(runtime.supported)
        ? `\`${runtime.supported.replaceAll('|', '\\|')}\``
        : 'Unavailable; see `package.json#engines.bun`';
    lines.push(
      '| Runtime | Value |',
      '|---|---|',
      `| Actual Bun | ${actual} |`,
      `| Supported Bun | ${supported} |`,
      '',
    );
  }
  if (Object.hasOwn(labels, result?.pending))
    lines.push(
      `Uncertain: ${labels[result.pending]}; completed work has not been rolled back.`,
      '',
    );
  if (warned && !attention)
    lines.push('**Next:** Inspect the Install warnings in native lifecycle details.', '');
  if (code.endsWith('-run-locked'))
    lines.push('Skipped: this execution; another run holds the lock.', '');
  if (closeFailed) lines.push('Failed: exclusion descriptor close.', '');
  if (attention) lines.push(`Reason: \`${code}\`.`, '', `**Next:** ${nextAction(code)}`);
  return {
    stdout: `${lines.join('\n')}\n`,
    stderr: attention
      ? `Agent update (${code})${closeFailed ? '; exclusion-close-failed' : ''}.\n`
      : '',
    exitCode: attention ? 1 : 0,
  };
}
