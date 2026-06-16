import assert from 'node:assert/strict';

import { commonEmoriEnvironmentVariables, createCli } from '../lib/bun-cli-support.js';

const DEBUG_ENV_KEYS = ['DEBUG', 'EMORI_DEBUG', 'RUNNER_DEBUG', 'TANAAB_DEBUG'];

function withDebugEnv(values, callback) {
  const previous = new Map(DEBUG_ENV_KEYS.map((key) => [key, process.env[key]]));

  for (const key of DEBUG_ENV_KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, values);

  try {
    callback();
  } finally {
    for (const key of DEBUG_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe('lib/bun-cli-support', () => {
  it('should enable CLI debug output with EMORI_DEBUG', () => {
    withDebugEnv({ EMORI_DEBUG: '1' }, () => {
      const cli = createCli(import.meta.url, { debugNamespace: 'test-cli' });

      assert.equal(cli.isDebugEnabled(), true);
    });
  });

  it('should not enable CLI debug output with TANAAB_DEBUG', () => {
    withDebugEnv({ TANAAB_DEBUG: '1' }, () => {
      const cli = createCli(import.meta.url, { debugNamespace: 'test-cli' });

      assert.equal(cli.isDebugEnabled(), false);
    });
  });

  it('should expose the common EMORI debug environment variable', () => {
    assert.deepEqual(commonEmoriEnvironmentVariables(), [
      { label: 'EMORI_DEBUG', description: 'set to a truthy value to show debug messages' },
    ]);
  });
});
