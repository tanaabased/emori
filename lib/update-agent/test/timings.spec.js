import assert from 'node:assert/strict';

import runUpdate from '../run.js';

describe('lib/update-agent/run phase observations', () => {
  it('should retain disjoint phase durations and finalize an attempted failed Doctor', async () => {
    let time = 0;
    const head = 'a'.repeat(40);
    const records = [];
    const commands = {
      inspect: async () => ({
        workspace: '/fixture',
        canonical: true,
        dirty: false,
        branch: 'main',
        inProgress: false,
        upstream: 'origin/main',
        remoteApproved: true,
        fastForward: true,
        remote: 'approved',
        head,
        target: head,
      }),
      fetch: async () => {
        time += 10;
      },
      dependencies: async () => {
        time += 20;
      },
      install: async () => {
        time += 30;
      },
      doctor: async () => {
        time += 40;
        throw new Error('command-timeout');
      },
    };
    const result = await runUpdate({
      workspace: '/fixture',
      commands,
      storage: {
        read: async () => undefined,
        assertHeld: async () => {},
        write: async (value) => records.push(structuredClone(value)),
      },
      now: () => time,
      id: 'fixture',
    });
    assert.deepEqual(
      Object.values(result.steps).map((step) => step.elapsedMs),
      [10, 20, 30, 40],
    );
    assert.equal(result.steps.doctor.status, 'blocked');
    assert.equal(result.reason, 'command-timeout');
    assert.equal(result.steps.install.status, 'completed');
    assert.equal(result.pending, undefined);
    assert.equal(records.at(-1).steps.doctor.finishedAt, new Date(100).toISOString());
  });
});
