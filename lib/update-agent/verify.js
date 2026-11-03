import { randomUUID } from 'node:crypto';

import { failureCode } from './run.js';
import validStepEvidence from './utils/valid-step-evidence.js';

/** Recheck health only when the original application is positively established. */
export default async function verifyUpdate({
  workspace,
  storage,
  commands,
  now = Date.now,
  id = randomUUID(),
}) {
  const original = await storage.read();
  const steps = ['source', 'dependencies', 'install'];
  if (
    !original ||
    original.version !== 1 ||
    original.job !== 'update-agent' ||
    original.workspace !== workspace ||
    !/^[a-zA-Z0-9-]{1,80}$/u.test(original.id) ||
    !['success', 'attention'].includes(original.status) ||
    original.pending ||
    original.predecessor ||
    (original.status === 'attention' && original.steps?.doctor?.status !== 'blocked') ||
    !/^[a-f0-9]{40}$/u.test(original.after) ||
    !validStepEvidence(original.steps) ||
    !steps.every((key) => original.steps[key]?.status === 'completed')
  )
    throw new Error('verification-refused');
  await storage.assertHeld();
  const observed = await commands.inspect(600_000);
  const unchanged = (value) =>
    value?.workspace === workspace &&
    value.canonical === true &&
    value.head === original.after &&
    value.dirty === false &&
    value.branch === 'main' &&
    value.inProgress === false &&
    value.upstream === 'origin/main' &&
    value.remoteApproved === true;
  if (!unchanged(observed)) throw new Error('verification-refused');
  const began = now();
  const verification = {
    version: 1,
    job: 'verify-agent',
    workspace,
    id,
    updateId: original.id,
    startedAt: new Date(began).toISOString(),
    status: 'running',
    steps: { doctor: { status: 'running' } },
  };
  await storage.write(verification, 'verification');
  try {
    const evidence = await commands.doctor(600_000);
    await storage.assertHeld();
    if (!unchanged(await commands.inspect(600_000))) throw new Error('verification-refused');
    verification.status = 'success';
    verification.steps.doctor = { status: 'completed', ...evidence };
  } catch (error) {
    verification.status = 'attention';
    verification.reason = failureCode(error);
    verification.steps.doctor = {
      status: 'blocked',
      reason: verification.reason,
      ...(error.health ? { health: error.health } : {}),
      ...(error.processFailure ? { processFailure: error.processFailure } : {}),
    };
  }
  verification.steps.doctor.startedAt = verification.startedAt;
  verification.steps.doctor.finishedAt = new Date(now()).toISOString();
  verification.steps.doctor.elapsedMs = Math.max(0, now() - began);
  verification.finishedAt = verification.steps.doctor.finishedAt;
  await storage.write(verification, 'verification');
  return { result: original, verification };
}
