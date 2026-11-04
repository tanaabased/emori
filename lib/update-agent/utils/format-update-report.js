import serializeReport from '../../command-report/utils/serialize-report.js';
import { failureCode } from '../run.js';
import checkRuntime, { maintenanceBunRange } from './check-runtime.js';

const labels = {
  source: 'Check for source changes',
  dependencies: 'Install required dependencies',
  install: 'Apply agent configuration (Install)',
  doctor: 'Check agent health (Doctor)',
};
const states = {
  completed: 'Completed',
  skipped: 'Skipped',
  blocked: 'Blocked',
  running: 'Unverified',
  unattempted: 'Not attempted',
};
const early = new Set([
  'arguments-invalid',
  'runtime-unsupported',
  'backup-run-locked',
  'update-run-locked',
  'backup-lock-lost',
  'update-lock-lost',
  'private-directory-unsafe',
  'update-lock-unsafe',
  'verification-refused',
  'checkpoint-invalid',
]);
const revision = (value) =>
  typeof value === 'string' && /^[a-f0-9]{40,64}$/u.test(value) ? value.slice(0, 12) : undefined;

/** Describe application facts; execution and delivery remain the shared runner's job. */
export default function formatUpdateReport({
  result,
  verification,
  failure,
  closeFailed = false,
  runtime,
  reportOnly = false,
}) {
  const selected = verification?.updateId === result?.id ? verification : undefined;
  const doctor = selected?.steps?.doctor ?? result?.steps?.doctor;
  const executed =
    ['source', 'dependencies', 'install'].every(
      (key) =>
        result?.steps?.[key]?.status === 'completed' &&
        (result.steps[key].exitCode === undefined || result.steps[key].exitCode === 0) &&
        !result.steps[key].processFailure,
    ) &&
    doctor?.status === 'completed' &&
    (doctor.exitCode === undefined || doctor.exitCode === 0) &&
    !doctor.processFailure &&
    !result?.pending &&
    (selected?.status ?? result?.status) === 'success';
  const reporting = [...(result?.steps?.install?.reporting ?? []), ...(doctor?.reporting ?? [])];
  const healthy = doctor?.health?.status === 'healthy' && !doctor?.reporting?.length;
  const verified = executed && healthy;
  const warned = (result?.steps?.install?.warnings ?? 0) > 0 || (doctor?.health?.warnings ?? 0) > 0;
  const attention = Boolean(failure || closeFailed || !executed);
  const reason = failure ?? new Error(selected?.reason ?? result?.reason);
  const code = early.has(reason.message) ? reason.message : failureCode(reason);
  const card = {
    id: 'update-agent',
    title: 'Agent update',
    status: attention ? 'error' : !verified || warned || reporting.length ? 'warning' : 'success',
    summary: verified
      ? 'Agent configuration applied; Doctor reports healthy.'
      : executed
        ? 'Agent configuration applied; Doctor command completed; health verification needs attention.'
        : result?.steps?.install?.status === 'completed'
          ? 'Agent configuration applied; health check failed or remains unverified.'
          : 'Agent update did not establish completed configuration and health checks.',
    facts: [],
    findings: [],
    actions: [],
  };
  if (reportOnly)
    card.findings.push(
      'Retained report only; no update, health check or message delivery was performed.',
    );
  if (!result && !failure) card.status = 'unknown';
  const before = revision(result?.before),
    after = revision(result?.after),
    target = revision(result?.target);
  card.facts.push({
    label: 'Source revision',
    value: after
      ? before === after
        ? `Unchanged ${after}`
        : `${before ?? 'Unknown'} → ${after}`
      : `Before ${before ?? 'unknown'}; after unknown${target ? `; target ${target} not verified as reached` : ''}`,
  });
  for (const [key, label] of Object.entries(labels)) {
    const step = key === 'doctor' ? doctor : result?.steps?.[key];
    let value = Object.hasOwn(states, step?.status) ? states[step.status] : 'Not attempted';
    if (step?.status === 'completed')
      value =
        key === 'install'
          ? 'Complete; setup skipped'
          : key === 'doctor'
            ? 'Command completed'
            : key === 'dependencies'
              ? 'Reconciled (frozen)'
              : value;
    if (key === 'doctor') {
      value += step?.health?.status
        ? `; Doctor status: ${step.health.status}`
        : '; health verification unavailable';
      if (step?.reporting?.length) value += '; health verification unavailable or incomplete';
    }
    if (Number.isInteger(step?.exitCode)) value += `; exit ${step.exitCode}`;
    const counts = ['completed', 'skipped', 'unattempted']
      .filter((name) => Number.isSafeInteger(step?.lifecycle?.[name]) && step.lifecycle[name] >= 0)
      .map((name) => `${step.lifecycle[name]} ${name}`);
    if (counts.length) value += `; components: ${counts.join(', ')}`;
    if (step?.processFailure)
      value += `; process ${['signal', 'spawn', 'exit'].includes(step.processFailure.kind) ? step.processFailure.kind : 'failure'}${Number.isInteger(step.processFailure.exitCode) ? ` ${step.processFailure.exitCode}` : ''}${['SIGKILL', 'SIGTERM', 'SIGINT', 'SIGABRT', 'SIGSEGV'].includes(step.processFailure.signal) ? ` ${step.processFailure.signal}` : ''}`;
    if (Number.isSafeInteger(step?.warnings) && step.warnings > 0)
      value += `; ${step.warnings} warnings`;
    value +=
      Number.isFinite(step?.elapsedMs) && step.elapsedMs >= 0
        ? `; ${(step.elapsedMs / 1000).toFixed(1)}s`
        : '; timing unavailable';
    card.facts.push({ label, value });
    for (const issue of step?.reporting ?? []) card.findings.push(issue);
    for (const item of [
      ...(step?.warningDetails ?? []),
      ...(step?.health?.findings ?? []).filter((item) => item.status !== 'healthy'),
    ])
      card.findings.push(
        `${item.component} / ${item.code}${item.status ? ` (${item.status})` : ''}: ${item.message}${item.remediation ? ` Next: ${item.remediation}` : ''}`,
      );
    const omitted = (step?.warningsOmitted ?? 0) + (step?.health?.omitted ?? 0);
    if (omitted > 0)
      card.findings.push(`${omitted} lifecycle detail entries omitted from private evidence.`);
  }
  if (selected) {
    card.findings.push(
      'Latest verification checked the already-applied configuration; the original update attempt is unchanged.',
    );
    const original = result.steps?.doctor;
    card.facts.push({
      label: 'Original health check',
      value: `${Object.hasOwn(states, original?.status) ? states[original.status] : 'Unverified'}${original?.reason ? `; ${failureCode(new Error(original.reason))}` : ''}`,
    });
  }
  if (Object.hasOwn(labels, result?.pending))
    card.findings.push(
      `Uncertain: ${labels[result.pending]}; completed work has not been rolled back.`,
    );
  if (closeFailed) card.findings.push('Failed: exclusion descriptor close.');
  if (attention) {
    card.findings.push(`Reason: ${code}.`);
    card.actions.push(
      code === 'runtime-unsupported'
        ? `Use a stable Bun runtime matching ${maintenanceBunRange} for updates, then retry.`
        : code === 'arguments-invalid'
          ? 'Use no arguments, --verify-only, --report-only or --help.'
          : code.endsWith('-run-locked')
            ? 'Wait for the lock owner to finish; do not remove its lock.'
            : code === 'automation-execution-stale'
              ? 'Reconcile the changed configuration through Agent System Install, then verify loaded state.'
              : 'Inspect .private/update-agent/status.json and native run details before recovery; do not blindly replay uncertain mutations.',
    );
  } else if (warned)
    card.actions.push(
      'Inspect retained Install warnings and health findings before further recovery.',
    );
  if (!attention && (!verified || reporting.length))
    card.actions.push(
      'Health verification or report detail is unavailable or needs attention. Inspect retained results; use verification-only recovery when eligible, without replaying Install.',
    );
  if (code === 'runtime-unsupported') {
    const facts = checkRuntime({ version: runtime?.version, executable: runtime?.executable });
    card.facts.push(
      { label: 'Actual Bun', value: facts.version },
      { label: 'Supported Bun', value: maintenanceBunRange },
    );
    if (facts.executable) card.facts.push({ label: 'Executable', value: facts.executable });
  }
  return {
    stdout: serializeReport([card]),
    stderr: attention
      ? `Agent update (${code})${closeFailed ? '; exclusion-close-failed' : ''}.\n`
      : '',
    exitCode: attention ? 1 : 0,
  };
}
