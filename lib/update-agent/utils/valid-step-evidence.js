/** Optional observations are backward-compatible, but malformed evidence is not trusted. */
export default function validStepEvidence(steps) {
  if (!steps || typeof steps !== 'object' || Array.isArray(steps)) return false;
  return Object.values(steps).every((step) => {
    if (!step || typeof step !== 'object') return false;
    if (
      step.exitCode !== undefined &&
      (!Number.isInteger(step.exitCode) || step.exitCode < 0 || step.exitCode > 255)
    )
      return false;
    if (
      step.reporting !== undefined &&
      (!Array.isArray(step.reporting) ||
        step.reporting.length > 8 ||
        !step.reporting.every((item) => typeof item === 'string' && item.length <= 410))
    )
      return false;
    if (
      step.processFailure !== undefined &&
      (!['signal', 'spawn', 'exit'].includes(step.processFailure?.kind) ||
        (step.processFailure.exitCode !== undefined &&
          (!Number.isInteger(step.processFailure.exitCode) ||
            step.processFailure.exitCode < 0 ||
            step.processFailure.exitCode > 255)) ||
        (step.processFailure.signal !== undefined &&
          !['SIGKILL', 'SIGTERM', 'SIGINT', 'SIGABRT', 'SIGSEGV'].includes(
            step.processFailure.signal,
          )) ||
        Object.keys(step.processFailure).some(
          (key) => !['kind', 'exitCode', 'signal'].includes(key),
        ))
    )
      return false;
    if (
      step.elapsedMs !== undefined &&
      (!Number.isFinite(step.elapsedMs) || step.elapsedMs < 0 || step.elapsedMs > 1_800_000)
    )
      return false;
    for (const key of ['startedAt', 'finishedAt'])
      if (
        step[key] !== undefined &&
        (typeof step[key] !== 'string' || !Number.isFinite(Date.parse(step[key])))
      )
        return false;
    const validEntries = (entries, maximum) =>
      Array.isArray(entries) &&
      entries.length <= maximum &&
      entries.every(
        (entry) =>
          entry &&
          ['component', 'code', 'message'].every(
            (key) =>
              typeof entry[key] === 'string' && entry[key].length > 0 && entry[key].length <= 410,
          ) &&
          Object.entries(entry).every(
            ([key, value]) =>
              ['component', 'code', 'message', 'status', 'stepId', 'remediation'].includes(key) &&
              typeof value === 'string' &&
              value.length <= 410,
          ),
      );
    if (step.warningDetails !== undefined && !validEntries(step.warningDetails, 8)) return false;
    if (
      step.health !== undefined &&
      (!step.health ||
        (step.health.status !== undefined &&
          (typeof step.health.status !== 'string' || step.health.status.length > 410)) ||
        !validEntries(step.health.findings, 12) ||
        !Number.isSafeInteger(step.health.omitted) ||
        step.health.omitted < 0 ||
        (step.health.warnings !== undefined &&
          (!Number.isSafeInteger(step.health.warnings) || step.health.warnings < 0)))
    )
      return false;
    for (const key of ['warningsOmitted', 'warnings'])
      if (step[key] !== undefined && (!Number.isSafeInteger(step[key]) || step[key] < 0))
        return false;
    return true;
  });
}
