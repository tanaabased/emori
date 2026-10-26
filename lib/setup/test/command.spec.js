import assert from 'node:assert/strict';

import { run } from '../command.js';

describe('lib/setup/command', () => {
  for (const [code, message] of [
    ['ENOENT', 'tool is unavailable.'],
    ['ENOBUFS', 'tool exceeded its output buffer limit (ENOBUFS).'],
    ['EACCES', 'tool could not run (EACCES).'],
    ['ETIMEDOUT', 'tool could not run (ETIMEDOUT).'],
    [undefined, 'tool could not run (unknown error).'],
  ]) {
    it(`should distinguish ${code ?? 'unknown'} failures without exposing command data`, () => {
      assert.throws(
        () =>
          run('tool', ['secret-argument'], {
            allowFailure: true,
            spawn: () => ({
              error: { code, message: 'secret-error-detail' },
              stdout: 'secret-output',
              stderr: 'secret-diagnostic',
              status: null,
            }),
          }),
        { message },
      );
    });
  }

  it('should preserve successful results and explicit nonzero-exit handling', () => {
    const success = { status: 0, stdout: 'ok' };
    const failure = { status: 7, stderr: 'private detail' };
    assert.equal(run('tool', [], { spawn: () => success }), success);
    assert.equal(run('tool', [], { spawn: () => failure, allowFailure: true }), failure);
    assert.throws(() => run('tool', ['check'], { spawn: () => failure }), {
      message: 'tool check failed.',
    });
  });
});
