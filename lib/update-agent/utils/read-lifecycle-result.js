import safeText from '../../command-report/utils/safe-text.js';

const statuses = ['blocked', 'drift', 'healthy', 'manual', 'skipped', 'warning'];
const outcomeStatuses = ['created', 'updated', 'removed', 'unchanged', 'skipped'];
const identifier = (value) => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/u.test(value);
const entry = (value, finding = false) =>
  value &&
  identifier(value.component) &&
  identifier(value.code) &&
  typeof value.message === 'string' &&
  value.message.trim() &&
  (value.stepId === undefined || identifier(value.stepId)) &&
  (!finding || statuses.includes(value.status)) &&
  (value.remediation === undefined || typeof value.remediation === 'string');

/** Validate the owning lifecycle envelope before selecting bounded private evidence. */
export default function readLifecycleResult(value, { operation, workspace, environment }) {
  if (!value || value.agentId !== 'emori' || value.workspaceDir !== workspace)
    throw new Error('command-output-invalid');
  const select = (item) =>
    Object.fromEntries(
      (operation === 'doctor'
        ? ['component', 'code', 'status', 'stepId', 'message', 'remediation']
        : ['component', 'code', 'stepId', 'message']
      )
        .filter((key) => typeof item[key] === 'string')
        .map((key) => [
          key,
          key === 'status'
            ? item[key]
            : safeText(
                item[key],
                key === 'message' || key === 'remediation' ? 384 : 120,
                environment,
              ) || 'Detail withheld',
        ]),
    );
  if (operation === 'doctor') {
    if (
      !['healthy', 'drift', 'blocked'].includes(value.status) ||
      !Array.isArray(value.findings) ||
      !value.findings.every((item) => entry(item, true))
    )
      throw new Error('command-output-invalid');
    const aggregate = value.findings.some(({ status }) => status === 'blocked')
      ? 'blocked'
      : value.findings.some(({ status }) => status === 'drift')
        ? 'drift'
        : 'healthy';
    if (value.status !== aggregate) throw new Error('command-output-invalid');
    const ordered = [...value.findings].sort(
      (a, b) => Number(a.status === 'healthy') - Number(b.status === 'healthy'),
    );
    return {
      health: {
        status: value.status,
        findings: ordered.slice(0, 12).map(select),
        omitted: Math.max(0, ordered.length - 12),
        warnings: value.findings.filter(({ status }) => status !== 'healthy').length,
      },
    };
  }
  if (
    !Array.isArray(value.outcomes) ||
    !value.outcomes.every((item) => entry(item) && outcomeStatuses.includes(item.status)) ||
    (value.unattempted !== undefined &&
      (!Array.isArray(value.unattempted) ||
        !value.unattempted.every(
          (item) =>
            item &&
            identifier(item.component) &&
            (item.stepId === undefined || identifier(item.stepId)),
        ))) ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every((item) => entry(item))
  )
    throw new Error('command-output-invalid');
  return {
    setup: 'skipped',
    lifecycle: {
      completed: value.outcomes.filter((item) => item.status !== 'skipped').length,
      skipped: value.outcomes.filter((item) => item.status === 'skipped').length,
      unattempted: Array.isArray(value.unattempted) ? value.unattempted.length : 0,
    },
    warnings: value.warnings.length,
    warningDetails: value.warnings.slice(0, 8).map(select),
    warningsOmitted: Math.max(0, value.warnings.length - 8),
  };
}
