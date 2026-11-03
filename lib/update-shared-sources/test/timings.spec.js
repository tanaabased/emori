import assert from 'node:assert/strict';

import updateSource from '../update-source.js';

describe('lib/update-shared-sources/update-source phase observations', () => {
  it('should accumulate disjoint build-check intervals without counting sync twice', async () => {
    let time = 0;
    const head = 'a'.repeat(40);
    const source = { id: 'openclaw-agent-system', status: 'candidate', path: '/fixture' };
    const result = await updateSource({
      source,
      now: () => time,
      deadline: 10000,
      inspect: async () => {
        time += 3;
        return {
          canonical: true,
          clean: true,
          branch: 'main',
          head,
          upstream: 'origin/main',
          remote: 'https://github.com/tanaabased/openclaw-agent-system.git',
          root: '/fixture',
          path: '/fixture',
          identity: 'fixture-checkout',
        };
      },
      execute: async (family, argv) => {
        time += 10;
        if (argv[0] === 'rev-parse') return head;
        if (argv[0] === 'rev-list') return '0\t0';
        if (argv[0] === 'ls-files') return 'package.json\0bun.lock\0';
        return '';
      },
      evidence: async () => {
        time += 5;
        return { version: 1, inputs: 'b'.repeat(64), artifacts: 'c'.repeat(64) };
      },
    });
    assert.equal(
      result.timings.reduce((total, item) => total + item.elapsedMs, 0),
      time,
    );
    assert.equal(result.status, 'completed');
    assert.equal(result.timings.filter(({ phase }) => phase === 'build-check').length, 2);
    assert.equal(result.timings.find(({ phase }) => phase === 'sync').elapsedMs, 10);
    assert(result.timings.every((item) => item.elapsedMs >= 0));
  });
});
