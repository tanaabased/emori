import assert from 'node:assert/strict';

import { booleanFromEnv } from '../utils/boolean-from-env.js';

describe('utils/boolean-from-env', () => {
  it('should use the fallback only when the environment value is missing', () => {
    assert.equal(booleanFromEnv(undefined, true), true);
    assert.equal(booleanFromEnv(undefined, false), false);
    assert.equal(booleanFromEnv('false', true), false);
    assert.equal(booleanFromEnv('yes', false), true);
  });
});
